// Bonus overlay: fetch penalty shootout kick-by-kick data from Sofascore's
// unofficial API. Called lazily when the user expands the goals panel on a
// match that went to penalties. Falls back silently (returns null) on any
// network error, CORS block, or missing data — the ESPN scorer list stays.
(function (global) {
  var BASE = 'https://api.sofascore.com/api/v1';

  // Per-date event list cache (avoids re-fetching for multiple matches).
  var dateCache = {};
  // Per-match shootout cache keyed by "date|team1|team2".
  var shootoutCache = {};

  var ALIASES = {
    'USA':                  ['United States'],
    'South Korea':          ['South Korea', 'Korea Republic'],
    'Ivory Coast':          ["Côte d'Ivoire", 'Ivory Coast'],
    'DR Congo':             ['DR Congo', 'Democratic Republic of Congo'],
    'Czech Republic':       ['Czechia'],
    'Bosnia & Herzegovina': ['Bosnia-Herzegovina', 'Bosnia and Herzegovina'],
    'Cape Verde':           ['Cabo Verde'],
  };

  function normalize(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function namesMatch(ours, theirs) {
    if (normalize(ours) === normalize(theirs)) return true;
    var alts = ALIASES[ours] || [];
    return alts.some(function (a) { return normalize(a) === normalize(theirs); });
  }

  function fetchJson(url) {
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('sofascore ' + r.status);
        return r.json();
      });
  }

  function fetchEventsForDate(date) {
    if (dateCache[date]) return Promise.resolve(dateCache[date]);
    return fetchJson(BASE + '/sport/football/scheduled-events/' + date)
      .then(function (data) {
        var events = data.events || [];
        dateCache[date] = events;
        return events;
      });
  }

  function findEvent(events, team1, team2) {
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var home = ev.homeTeam && ev.homeTeam.name;
      var away = ev.awayTeam && ev.awayTeam.name;
      if (!home || !away) continue;
      var direct  = namesMatch(team1, home) && namesMatch(team2, away);
      var swapped = namesMatch(team1, away) && namesMatch(team2, home);
      if (direct || swapped) return { id: ev.id, homeIsTeam1: direct };
    }
    return null;
  }

  function parsePenalties(data, homeIsTeam1) {
    // Sofascore returns an array under either "penalties" or "shootoutPenalties".
    var pens = data.penalties || data.shootoutPenalties || [];
    if (!pens.length) return null;
    var kicks1 = [], kicks2 = [];
    pens.forEach(function (p) {
      var name = p.player && (p.player.shortName || p.player.name) || '?';
      var kick = { name: name, scored: !!p.scored };
      var isHome = p.homeTeam !== undefined ? p.homeTeam : p.isHome;
      if (isHome) {
        (homeIsTeam1 ? kicks1 : kicks2).push(kick);
      } else {
        (homeIsTeam1 ? kicks2 : kicks1).push(kick);
      }
    });
    return (kicks1.length || kicks2.length) ? { kicks1: kicks1, kicks2: kicks2 } : null;
  }

  // Main entry point: returns Promise<{kicks1, kicks2}|null>
  function fetchShootout(date, team1, team2) {
    var key = date + '|' + team1 + '|' + team2;
    if (shootoutCache[key] !== undefined) return Promise.resolve(shootoutCache[key]);

    return fetchEventsForDate(date)
      .then(function (events) {
        var match = findEvent(events, team1, team2);
        if (!match) return null;
        return fetchJson(BASE + '/event/' + match.id + '/penalties')
          .then(function (data) { return parsePenalties(data, match.homeIsTeam1); });
      })
      .then(function (result) {
        shootoutCache[key] = result;
        return result;
      })
      .catch(function () {
        shootoutCache[key] = null;
        return null;
      });
  }

  global.WC = global.WC || {};
  global.WC.fetchSofascoreShootout = fetchShootout;
})(window);
