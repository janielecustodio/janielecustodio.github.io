// Resolves the placeholder slot references used in fixtures ("1A", "2A",
// "3A/B/C/D/F", "W74", "L74") into real team names as the tournament
// progresses, cascading winners through the knockout rounds.
//
// Group winners/runners-up/third-placed qualifiers are always projected
// from the *current* standings, even before a group is finished — so the
// bracket shows what would happen if the current group standings held.
// Slots derived from an unfinished group are flagged `projected: true` so
// the UI can distinguish "locked in" from "projected" qualifiers.
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

    // Always project from current standings, even mid-group.
    var thirdPool = WC.bestThirdPlaced(tables);
    var usedThirds = {};

    var byId = {};
    var sorted = rawMatches.slice().sort(function (a, b) { return a.id - b.id; });

    // Returns { team, projected } or null if nothing can be inferred yet.
    function resolveRef(ref) {
      if (!ref) return null;
      var gm = GROUP_RE.exec(ref);
      if (gm) {
        var team = gm[1] === '1' ? tables[gm[2]][0].team : tables[gm[2]][1].team;
        return { team: team, projected: !groupDone[gm[2]] };
      }
      var tm = THIRD_RE.exec(ref);
      if (tm) {
        var eligible = tm[1].split('/');
        for (var i = 0; i < thirdPool.length; i++) {
          var t = thirdPool[i];
          if (!usedThirds[t.team] && eligible.indexOf(t.group) !== -1) {
            usedThirds[t.team] = true;
            return { team: t.team, projected: !allGroupsDone };
          }
        }
        return null;
      }
      var wl = WL_RE.exec(ref);
      if (wl) {
        var ref_m = byId[wl[2]];
        if (!ref_m) return null;
        var name = wl[1] === 'W' ? ref_m.winner : ref_m.loser;
        if (!name) return null;
        return { team: name, projected: ref_m.projected || !ref_m.score };
      }
      return { team: ref, projected: false }; // literal team name (group stage)
    }

    var resolved = sorted.map(function (m) {
      var r1 = resolveRef(m.team1);
      var r2 = resolveRef(m.team2);
      var team1Resolved = r1 ? r1.team : null;
      var team2Resolved = r2 ? r2.team : null;
      var team1Projected = !!(r1 && r1.projected);
      var team2Projected = !!(r2 && r2.projected);
      var out = {
        id: m.id, round: m.round, date: m.date, time: m.time, ground: m.ground, group: m.group,
        team1Ref: m.team1, team2Ref: m.team2,
        team1Resolved: team1Resolved, team2Resolved: team2Resolved,
        team1Projected: team1Projected, team2Projected: team2Projected,
        score: m.score || null, penalties: m.penalties || null,
        winner: null, loser: null,
        projected: (team1Projected || team2Projected) || !m.score
      };
      if (team1Resolved && team2Resolved && out.score) {
        out.winner = decideWinner(out);
        out.loser = out.winner === team1Resolved ? team2Resolved : team1Resolved;
      }
      byId[m.id] = out;
      return out;
    });

    // qualified: currently projected to advance (top 2 + best-8 thirds),
    // regardless of whether their group is finished.
    var qualified = {};
    var projectedQualified = {};
    Object.keys(groups).forEach(function (g) {
      [tables[g][0].team, tables[g][1].team].forEach(function (team) {
        qualified[team] = true;
        if (!groupDone[g]) projectedQualified[team] = true;
      });
    });
    thirdPool.forEach(function (t) {
      qualified[t.team] = true;
      if (!groupDone[t.group]) projectedQualified[t.team] = true;
    });

    // eliminated: only once a group is actually finished and the team
    // didn't qualify (never "projected eliminated" — too speculative).
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
      projectedQualified: projectedQualified,
      eliminatedGroupStage: eliminatedGroupStage
    };
  }

  global.WC = global.WC || {};
  global.WC.resolveBracket = resolveAll;
})(window);
