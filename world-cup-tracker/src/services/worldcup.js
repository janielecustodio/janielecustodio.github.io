// Single place responsible for getting 2026 World Cup fixtures/results.
// Tries the live openfootball feed first, falls back to the hardcoded
// fixture skeleton (src/constants/fixtureTemplate.js) if it's unreachable.
(function (global) {
  var FEED_URL = 'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json';

  function normalizeFeedMatch(m, id) {
    var group = m.group ? m.group.replace('Group ', '') : null;
    return {
      id: id,
      round: m.round,
      date: m.date,
      time: m.time,
      team1: m.team1,
      team2: m.team2,
      ground: m.ground || null,
      group: group,
      score: m.score && m.score.ft ? m.score.ft : null,
      penalties: m.score && m.score.p ? m.score.p : null,
      goals1: m.goals1 || [],
      goals2: m.goals2 || []
    };
  }

  function fromFeed(json) {
    var matches = json.matches.map(function (m, i) { return normalizeFeedMatch(m, i + 1); });

    // Reassign stable template ids so that W<id> bracket refs (e.g. "W73" in
    // the R16 fixture stubs) always point to the correct match, regardless of
    // how the live feed orders its entries. Match by UTC kickoff time, which
    // is unique per fixture and identical between feed and template.
    if (global.WC && global.WC.FIXTURE_TEMPLATE && global.WC.toUtcMillis) {
      var templateByUtcMs = {};
      global.WC.FIXTURE_TEMPLATE.forEach(function (tm) {
        var ms = global.WC.toUtcMillis(tm.date, tm.time);
        if (ms !== null) templateByUtcMs[ms] = tm.id;
      });
      matches.forEach(function (m) {
        var ms = global.WC.toUtcMillis(m.date, m.time);
        if (ms !== null && templateByUtcMs[ms] !== undefined) {
          m.id = templateByUtcMs[ms];
        }
      });
    }

    return matches;
  }

  function fromFallback() {
    return global.WC.FIXTURE_TEMPLATE.map(function (m) {
      return {
        id: m.id, round: m.round, date: m.date, time: m.time,
        team1: m.team1, team2: m.team2, ground: m.ground, group: m.group,
        score: null, penalties: null
      };
    });
  }

  function fetchWorldCupData() {
    return fetch(FEED_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('feed http ' + res.status);
        return res.json();
      })
      .then(function (json) {
        return { matches: fromFeed(json), source: 'live' };
      })
      .catch(function () {
        return { matches: fromFallback(), source: 'fallback' };
      });
  }

  global.WC = global.WC || {};
  global.WC.fetchWorldCupData = fetchWorldCupData;
})(window);
