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

  function fetchEvents() {
    var now = Date.now();
    if (cache.events && now - cache.fetchedAt < 15000) {
      return Promise.resolve(cache.events);
    }
    return fetch(ESPN_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('espn http ' + res.status);
        return res.json();
      })
      .then(function (json) {
        cache.events = json.events || [];
        cache.fetchedAt = now;
        return cache.events;
      })
      .catch(function () { return cache.events || []; });
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
      var team1Id = direct ? c0.team && c0.team.id : c1.team && c1.team.id;
      var team2Id = direct ? c1.team && c1.team.id : c0.team && c0.team.id;
      var goals = extractGoals(comp, team1Id, team2Id);
      // The play-by-play `details` feed is the more reliable signal — the
      // competitor `score` field has been observed lagging behind it. If
      // ESPN already lists more (real, non-disallowed) goals than the
      // scoreline shows, trust the goal list and bump the score to match.
      score1 = Math.max(score1, goals[0].length);
      score2 = Math.max(score2, goals[1].length);
      return { score: [score1, score2], minute: status.displayClock || null, state: state, goals1: goals[0], goals2: goals[1] };
    }
    return null;
  }

  global.WC = global.WC || {};
  global.WC.fetchEspnEvents = fetchEvents;
  global.WC.findEspnLiveScore = findLiveScore;
})(window);
