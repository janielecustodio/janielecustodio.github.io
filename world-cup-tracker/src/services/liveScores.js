// Free, keyless live-score overlay for matches still in progress.
// openfootball/world-cup.json has no partial score data while a match is
// live (only a final result once it ends), so for the live window we poll
// ESPN's public (unauthenticated, CORS-enabled) scoreboard endpoint and
// match it to our fixtures by team name. As soon as openfootball reports a
// real final score for a match, App.js stops using this overlay for it.
(function (global) {
  var ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

  // Known name mismatches between our team list and ESPN's team names.
  var ALIASES = {
    USA: ['United States'],
    'South Korea': ['Korea Republic'],
    'Ivory Coast': ["Côte d'Ivoire", 'Cote dIvoire', 'Ivory Coast'],
    'DR Congo': ['Congo DR', 'Democratic Republic of the Congo'],
    'Czech Republic': ['Czechia'],
    'Bosnia & Herzegovina': ['Bosnia and Herzegovina'],
    'Cape Verde': ['Cabo Verde'],
    'Curaçao': ['Curacao']
  };

  function normalize(name) {
    return (name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function namesMatch(ourName, espnName) {
    if (!ourName || !espnName) return false;
    if (normalize(ourName) === normalize(espnName)) return true;
    return (ALIASES[ourName] || []).some(function (a) { return normalize(a) === normalize(espnName); });
  }

  var cache = { events: null, fetchedAt: 0 };
  var dateCache = {}; // dateKey ('YYYYMMDD') -> { events, fetchedAt }

  // Tracks whether the ESPN overlay fetch is succeeding, so the UI can warn
  // the user (e.g. "check your connection") instead of silently showing no
  // live scores/cards when the request is blocked on their network.
  var debugInfo = { lastAttempt: null, lastOk: null, lastError: null, lastCount: null };
  function getDebugInfo() { return debugInfo; }

  function fetchEvents() {
    var now = Date.now();
    if (cache.events && now - cache.fetchedAt < 15000) {
      return Promise.resolve(cache.events);
    }
    debugInfo.lastAttempt = new Date().toISOString();
    return fetch(ESPN_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('espn http ' + res.status);
        return res.json();
      })
      .then(function (json) {
        cache.events = json.events || [];
        cache.fetchedAt = now;
        debugInfo.lastOk = true;
        debugInfo.lastError = null;
        debugInfo.lastCount = cache.events.length;
        return cache.events;
      })
      .catch(function (err) {
        debugInfo.lastOk = false;
        debugInfo.lastError = String(err && err.message || err);
        return cache.events || [];
      });
  }

  // ESPN keeps the full play-by-play (goals + cards) for a date's matches
  // long after they finish, so past/already-final matches can be backfilled
  // by date instead of only catching them while they're live. dateKey is
  // 'YYYY-MM-DD' (converted to ESPN's 'YYYYMMDD' query format).
  function fetchEventsForDate(dateKey) {
    var entry = dateCache[dateKey];
    if (entry) return Promise.resolve(entry);
    var espnDate = dateKey.replace(/-/g, '');
    return fetch(ESPN_URL + '?dates=' + espnDate, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('espn http ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var events = json.events || [];
        dateCache[dateKey] = events;
        return events;
      })
      .catch(function () { return []; });
  }

  // Extracts goal-scorer events from ESPN's play-by-play `details` array
  // (when present) into our { name, minute, penalty } shape, split by side.
  // Excludes goals that were disallowed/overturned (VAR etc.) — ESPN still
  // labels those events with "Goal" in the text, but they don't count
  // toward the actual score, so including them would make the scorer list
  // disagree with the scoreline.
  var DISALLOWED_RE = /disallow|cancel|overturn|no goal|var review/i;
  function extractGoals(comp, scoringTeamId, conceedingTeamId) {
    var goalsFor = [], goalsAgainst = [];
    (comp.details || []).forEach(function (d) {
      var text = d.type && d.type.text || '';
      if (text.indexOf('Goal') === -1) return; // "Goal", "Penalty - Scored", "Own Goal"
      if (d.scoringPlay === false) return;
      if (DISALLOWED_RE.test(text)) return;
      var scorer = d.athletesInvolved && d.athletesInvolved[0];
      var entry = {
        name: scorer ? (scorer.shortName || scorer.displayName) : '?',
        minute: d.clock && d.clock.displayValue ? d.clock.displayValue.replace("'", '') : '',
        penalty: text.indexOf('Penalty') !== -1
      };
      var teamId = d.team && d.team.id;
      if (teamId === scoringTeamId) goalsFor.push(entry);
      else if (teamId === conceedingTeamId) goalsAgainst.push(entry);
    });
    return [goalsFor, goalsAgainst];
  }

  // Extracts yellow/red card events the same way extractGoals pulls scorers.
  // Extracts penalty shootout kick-by-kick data from comp.details.
  // Kicks are identified by shootout:true or period.number===5, ordered as
  // they appear in the play-by-play so rounds pair up naturally.
  function extractShootout(comp, team1Id, team2Id) {
    var kicks1 = [], kicks2 = [];
    global._wcShootoutDebug = (comp.details || []).map(function(d) {
      return { type: d.type && d.type.text, period: d.period && (d.period.number || d.period), shootout: d.shootout, scoringPlay: d.scoringPlay, teamId: d.team && d.team.id, player: d.athletesInvolved && d.athletesInvolved[0] && d.athletesInvolved[0].shortName };
    });
    (comp.details || []).forEach(function (d) {
      var text = d.type && d.type.text || '';
      var periodNum = d.period && (typeof d.period === 'object' ? d.period.number : d.period);
      // ESPN only sets shootout:true on scored kicks; missed/saved kicks often
      // only appear with type.text "Miss"/"Save"/"Penalty - Missed". Accept
      // by any of: shootout flag, period 5, or penalty/miss/save type text.
      var isShootoutEvent = d.shootout || periodNum === 5
        || /^(miss|save|penalty[\s-])/i.test(text);
      if (!isShootoutEvent) return;
      var scored = d.scoringPlay === true || /goal/i.test(text);
      var player = d.athletesInvolved && d.athletesInvolved[0];
      var entry = {
        name: player ? (player.shortName || player.displayName || '?') : '?',
        scored: scored
      };
      var teamId = String(d.team && d.team.id || '');
      if (teamId === String(team1Id)) kicks1.push(entry);
      else if (teamId === String(team2Id)) kicks2.push(entry);
    });
    return (kicks1.length || kicks2.length) ? { kicks1: kicks1, kicks2: kicks2 } : null;
  }

  function extractCards(comp, team1Id, team2Id) {
    var cardsFor = [], cardsAgainst = [];
    (comp.details || []).forEach(function (d) {
      var text = d.type && d.type.text || '';
      var isRed = /red card/i.test(text);
      var isYellow = /yellow card/i.test(text);
      if (!isRed && !isYellow) return;
      var player = d.athletesInvolved && d.athletesInvolved[0];
      var entry = {
        name: player ? (player.shortName || player.displayName) : '?',
        minute: d.clock && d.clock.displayValue ? d.clock.displayValue.replace("'", '') : '',
        red: isRed
      };
      var teamId = d.team && d.team.id;
      if (teamId === team1Id) cardsFor.push(entry);
      else if (teamId === team2Id) cardsAgainst.push(entry);
    });
    return [cardsFor, cardsAgainst];
  }

  function findLiveScore(events, team1, team2) {
    for (var i = 0; i < events.length; i++) {
      var comp = events[i].competitions && events[i].competitions[0];
      if (!comp || !comp.competitors || comp.competitors.length !== 2) continue;
      var c0 = comp.competitors[0], c1 = comp.competitors[1];
      var n0 = c0.team && (c0.team.displayName || c0.team.name);
      var n1 = c1.team && (c1.team.displayName || c1.team.name);
      var direct = namesMatch(team1, n0) && namesMatch(team2, n1);
      var swapped = namesMatch(team1, n1) && namesMatch(team2, n0);
      if (!direct && !swapped) continue;

      var score1 = Number(direct ? c0.score : c1.score);
      var score2 = Number(direct ? c1.score : c0.score);
      if (isNaN(score1) || isNaN(score2)) continue;

      var status = comp.status || {};
      var state = status.type && status.type.state; // 'pre' | 'in' | 'post'
      var period = status.period || 1; // 1=1H 2=2H 3=ET1 4=ET2 5=Pens
      var isET = period === 3 || period === 4;
      var isPens = period >= 5;
      var team1Id = direct ? c0.team && c0.team.id : c1.team && c1.team.id;
      var team2Id = direct ? c1.team && c1.team.id : c0.team && c0.team.id;
      var goals = extractGoals(comp, team1Id, team2Id);
      var cards = extractCards(comp, team1Id, team2Id);
      var shootout = (isET || isPens) ? extractShootout(comp, team1Id, team2Id) : null;
      // The play-by-play `details` feed is the more reliable signal — the
      // competitor `score` field has been observed lagging behind it. If
      // ESPN already lists more (real, non-disallowed) goals than the
      // scoreline shows, trust the goal list and bump the score to match.
      score1 = Math.max(score1, goals[0].length);
      score2 = Math.max(score2, goals[1].length);
      // Penalty shootout scores live in linescores[4] (the 5th period slot).
      var penScore = null;
      if (isPens) {
        var ls1 = (direct ? c0 : c1).linescores || [];
        var ls2 = (direct ? c1 : c0).linescores || [];
        if (ls1[4] !== undefined && ls2[4] !== undefined) {
          penScore = [Number(ls1[4].value || 0), Number(ls2[4].value || 0)];
        }
      }
      return {
        score: [score1, score2], minute: status.displayClock || null, state: state,
        goals1: goals[0], goals2: goals[1], cards1: cards[0], cards2: cards[1],
        isET: isET, isPens: isPens, penScore: penScore, shootout: shootout
      };
    }
    return null;
  }

  global.WC = global.WC || {};
  global.WC.fetchEspnEvents = fetchEvents;
  global.WC.fetchEspnEventsForDate = fetchEventsForDate;
  global.WC.findEspnLiveScore = findLiveScore;
  global.WC.getEspnDebugInfo = getDebugInfo;
})(window);
