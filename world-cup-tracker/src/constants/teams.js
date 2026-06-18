// 48 teams of the 2026 FIFA World Cup, grouped A-L, with ISO 3166-1 alpha-2
// codes used by flagcdn.com (https://flagcdn.com/w40/{iso}.png).
// Correct any wrong codes here — nothing else needs to change.
(function (global) {
  var GROUPS = {
    A: ['Mexico', 'South Africa', 'South Korea', 'Czech Republic'],
    B: ['Canada', 'Bosnia & Herzegovina', 'Qatar', 'Switzerland'],
    C: ['Brazil', 'Haiti', 'Morocco', 'Scotland'],
    D: ['USA', 'Australia', 'Paraguay', 'Turkey'],
    E: ['Germany', 'Curaçao', 'Ecuador', 'Ivory Coast'],
    F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
    G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
    H: ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'],
    I: ['France', 'Iraq', 'Norway', 'Senegal'],
    J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
    K: ['Portugal', 'Colombia', 'DR Congo', 'Uzbekistan'],
    L: ['England', 'Croatia', 'Ghana', 'Panama']
  };

  var ISO_CODES = {
    Mexico: 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czech Republic': 'cz',
    Canada: 'ca', 'Bosnia & Herzegovina': 'ba', Qatar: 'qa', Switzerland: 'ch',
    Brazil: 'br', Haiti: 'ht', Morocco: 'ma', Scotland: 'gb-sct',
    USA: 'us', Australia: 'au', Paraguay: 'py', Turkey: 'tr',
    Germany: 'de', 'Curaçao': 'cw', Ecuador: 'ec', 'Ivory Coast': 'ci',
    Netherlands: 'nl', Japan: 'jp', Sweden: 'se', Tunisia: 'tn',
    Belgium: 'be', Egypt: 'eg', Iran: 'ir', 'New Zealand': 'nz',
    Spain: 'es', 'Cape Verde': 'cv', 'Saudi Arabia': 'sa', Uruguay: 'uy',
    France: 'fr', Iraq: 'iq', Norway: 'no', Senegal: 'sn',
    Argentina: 'ar', Algeria: 'dz', Austria: 'at', Jordan: 'jo',
    Portugal: 'pt', Colombia: 'co', 'DR Congo': 'cd', Uzbekistan: 'uz',
    England: 'gb-eng', Croatia: 'hr', Ghana: 'gh', Panama: 'pa'
  };

  var TEAMS = [];
  Object.keys(GROUPS).forEach(function (g) {
    GROUPS[g].forEach(function (name) {
      TEAMS.push({ name: name, group: g, iso: ISO_CODES[name] });
    });
  });
  TEAMS.sort(function (a, b) { return a.name.localeCompare(b.name); });

  global.WC = global.WC || {};
  global.WC.GROUPS = GROUPS;
  global.WC.ISO_CODES = ISO_CODES;
  global.WC.TEAMS = TEAMS;
})(window);
