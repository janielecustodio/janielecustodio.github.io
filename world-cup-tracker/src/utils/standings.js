// Group table + FIFA third-place tiebreak ranking.
// Tiebreak order: points -> goal difference -> goals for -> group letter
// (head-to-head / fair play / drawing of lots are not modelled; group
// letter gives a deterministic, stable order instead of lots).
(function (global) {
  function emptyRow(team, group) {
    return { team: team, group: group, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  }

  function computeGroupTable(matches, groupLetter, teamNames) {
    var rows = {};
    teamNames.forEach(function (t) { rows[t] = emptyRow(t, groupLetter); });

    matches.forEach(function (m) {
      if (m.group !== groupLetter || !m.score) return;
      var a = rows[m.team1], b = rows[m.team2];
      if (!a || !b) return;
      var g1 = m.score[0], g2 = m.score[1];
      a.played++; b.played++;
      a.gf += g1; a.ga += g2;
      b.gf += g2; b.ga += g1;
      if (g1 > g2) { a.won++; a.points += 3; b.lost++; }
      else if (g1 < g2) { b.won++; b.points += 3; a.lost++; }
      else { a.drawn++; b.drawn++; a.points++; b.points++; }
    });

    var list = teamNames.map(function (t) {
      var r = rows[t];
      r.gd = r.gf - r.ga;
      return r;
    });
    list.sort(function (a, b) {
      return b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team);
    });
    return list;
  }

  function computeAllGroupTables(matches, groups) {
    var tables = {};
    Object.keys(groups).forEach(function (g) {
      tables[g] = computeGroupTable(matches, g, groups[g]);
    });
    return tables;
  }

  // Returns the 8 best third-placed teams (out of 12), ranked.
  function bestThirdPlaced(tables) {
    var thirds = Object.keys(tables).map(function (g) {
      var row = tables[g][2];
      return row;
    });
    thirds.sort(function (a, b) {
      return b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.group.localeCompare(b.group);
    });
    return thirds.slice(0, 8);
  }

  function groupComplete(matches, groupLetter) {
    var played = matches.filter(function (m) { return m.group === groupLetter && m.score; }).length;
    return played >= 6;
  }

  // A team is mathematically clinched for a top-2 (direct qualification)
  // spot if it finishes top-2 on points alone in EVERY possible combination
  // of results for the group's remaining (unplayed) matches — brute-forced
  // exactly, since a group has at most 6 matches (3^6 = 729 combinations).
  // This correctly accounts for head-to-head fixtures still to be played:
  // e.g. if two rivals still have to play each other, they can't both win,
  // so they can't both reach their independent "best case" simultaneously
  // — a flaw the older per-team independent-best-case formula had. Ties on
  // points are treated pessimistically (assumed lost on tiebreakers), so
  // this never wrongly flags a clinch, only possibly a little late.
  function clinchedTop2(matches, groupLetter, teamNames) {
    var result = {};
    teamNames.forEach(function (t) { result[t] = true; });

    var groupMatches = matches.filter(function (m) { return m.group === groupLetter; });
    var remaining = groupMatches.filter(function (m) { return !m.score; });
    if (!remaining.length) {
      teamNames.forEach(function (t) { result[t] = false; });
      return result;
    }

    var basePoints = {};
    teamNames.forEach(function (t) { basePoints[t] = 0; });
    groupMatches.filter(function (m) { return m.score; }).forEach(function (m) {
      var g1 = m.score[0], g2 = m.score[1];
      if (g1 > g2) basePoints[m.team1] += 3;
      else if (g2 > g1) basePoints[m.team2] += 3;
      else { basePoints[m.team1] += 1; basePoints[m.team2] += 1; }
    });

    var n = remaining.length;
    var total = Math.pow(3, n);
    for (var code = 0; code < total; code++) {
      var pts = Object.assign({}, basePoints);
      var c = code;
      for (var i = 0; i < n; i++) {
        var d = c % 3; c = Math.floor(c / 3);
        var m = remaining[i];
        if (d === 0) pts[m.team1] += 3;
        else if (d === 1) { pts[m.team1] += 1; pts[m.team2] += 1; }
        else pts[m.team2] += 3;
      }
      teamNames.forEach(function (team) {
        if (!result[team]) return;
        var ge = 0;
        teamNames.forEach(function (t) { if (t !== team && pts[t] >= pts[team]) ge++; });
        if (ge > 1) result[team] = false;
      });
    }
    return result;
  }

  global.WC = global.WC || {};
  global.WC.computeGroupTable = computeGroupTable;
  global.WC.computeAllGroupTables = computeAllGroupTables;
  global.WC.bestThirdPlaced = bestThirdPlaced;
  global.WC.groupComplete = groupComplete;
  global.WC.clinchedTop2 = clinchedTop2;
})(window);
