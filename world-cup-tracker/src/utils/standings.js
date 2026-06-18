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

  global.WC = global.WC || {};
  global.WC.computeGroupTable = computeGroupTable;
  global.WC.computeAllGroupTables = computeAllGroupTables;
  global.WC.bestThirdPlaced = bestThirdPlaced;
  global.WC.groupComplete = groupComplete;
})(window);
