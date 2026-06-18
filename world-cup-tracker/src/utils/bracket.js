// Resolves the placeholder slot references used in fixtures ("1A", "2A",
// "3A/B/C/D/F", "W74", "L74") into real team names as the tournament
// progresses, cascading winners through the knockout rounds.
(function (global) {
  var GROUP_RE = /^([12])([A-L])$/;
  var THIRD_RE = /^3((?:[A-L])(?:\/[A-L])+)$/;
  var WL_RE = /^([WL])(\d+)$/;

  function decideWinner(m) {
    if (!m.score) return null;
    var g1 = m.score[0], g2 = m.score[1];
    if (g1 === g2) {
      // Knockout draws go to penalties in real life; pen score (if present)
      // breaks the tie, otherwise fall back to team1 deterministically.
      if (m.penalties) return m.penalties[0] > m.penalties[1] ? m.team1Resolved : m.team2Resolved;
      return m.team1Resolved;
    }
    return g1 > g2 ? m.team1Resolved : m.team2Resolved;
  }

  function resolveAll(rawMatches, groups) {
    var WC = global.WC;
    var tables = WC.computeAllGroupTables(rawMatches, groups);
    var groupDone = {};
    Object.keys(groups).forEach(function (g) { groupDone[g] = WC.groupComplete(rawMatches, g); });
    var allGroupsDone = Object.keys(groups).every(function (g) { return groupDone[g]; });

    var thirdPool = allGroupsDone ? WC.bestThirdPlaced(tables) : null;
    var usedThirds = {};

    var byId = {};
    var sorted = rawMatches.slice().sort(function (a, b) { return a.id - b.id; });

    function resolveRef(ref) {
      if (!ref) return null;
      var gm = GROUP_RE.exec(ref);
      if (gm) {
        if (!groupDone[gm[2]]) return null;
        return gm[1] === '1' ? tables[gm[2]][0].team : tables[gm[2]][1].team;
      }
      var tm = THIRD_RE.exec(ref);
      if (tm) {
        if (!thirdPool) return null;
        var eligible = tm[1].split('/');
        for (var i = 0; i < thirdPool.length; i++) {
          var t = thirdPool[i];
          if (!usedThirds[t.team] && eligible.indexOf(t.group) !== -1) {
            usedThirds[t.team] = true;
            return t.team;
          }
        }
        return null;
      }
      var wl = WL_RE.exec(ref);
      if (wl) {
        var ref_m = byId[wl[2]];
        if (!ref_m || !ref_m.winner) return null;
        return wl[1] === 'W' ? ref_m.winner : ref_m.loser;
      }
      return ref; // literal team name (group stage)
    }

    var resolved = sorted.map(function (m) {
      var team1Resolved = resolveRef(m.team1);
      var team2Resolved = resolveRef(m.team2);
      var out = {
        id: m.id, round: m.round, date: m.date, time: m.time, ground: m.ground, group: m.group,
        team1Ref: m.team1, team2Ref: m.team2,
        team1Resolved: team1Resolved, team2Resolved: team2Resolved,
        score: m.score || null, penalties: m.penalties || null,
        winner: null, loser: null
      };
      if (team1Resolved && team2Resolved && out.score) {
        out.winner = decideWinner(out);
        out.loser = out.winner === team1Resolved ? team2Resolved : team1Resolved;
      }
      byId[m.id] = out;
      return out;
    });

    var qualified = {};
    Object.keys(groups).forEach(function (g) {
      if (!groupDone[g]) return;
      qualified[tables[g][0].team] = true;
      qualified[tables[g][1].team] = true;
    });
    if (thirdPool) thirdPool.forEach(function (t) { qualified[t.team] = true; });

    var eliminatedGroupStage = {};
    Object.keys(groups).forEach(function (g) {
      if (!groupDone[g]) return;
      groups[g].forEach(function (team) {
        if (!qualified[team]) eliminatedGroupStage[team] = true;
      });
    });

    return {
      matches: resolved,
      tables: tables,
      groupDone: groupDone,
      allGroupsDone: allGroupsDone,
      thirdPool: thirdPool,
      qualified: qualified,
      eliminatedGroupStage: eliminatedGroupStage
    };
  }

  global.WC = global.WC || {};
  global.WC.resolveBracket = resolveAll;
})(window);
