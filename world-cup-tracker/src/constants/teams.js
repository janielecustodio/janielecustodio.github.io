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

  // Curated [primary, secondary, accent] hex colours per team, based on each
  // team's actual flag/kit colours — chosen by hand instead of extracted from
  // flag images, since automatic extraction (ColorThief) reliably produced
  // muddy/incorrect blended tones (e.g. green+yellow+blue averaging to purple).
  var TEAM_PALETTES = {
    Mexico: ['#0b5c36', '#a6192e', '#ffffff'],
    'South Africa': ['#007a4d', '#de3831', '#ffb612'],
    'South Korea': ['#002d62', '#ffffff', '#cd2e3a'],
    'Czech Republic': ['#11457e', '#ffffff', '#d7141a'],
    Canada: ['#a6192e', '#ffffff', '#a6192e'],
    'Bosnia & Herzegovina': ['#002395', '#ffd400', '#ffffff'],
    Qatar: ['#8a1538', '#ffffff', '#8a1538'],
    Switzerland: ['#d52b1e', '#ffffff', '#d52b1e'],
    Brazil: ['#0a5c2b', '#ffd700', '#0033a0'],
    Haiti: ['#00209f', '#d21034', '#ffffff'],
    Morocco: ['#c1272d', '#006233', '#ffffff'],
    Scotland: ['#0065bd', '#ffffff', '#0065bd'],
    USA: ['#0a3161', '#b31942', '#ffffff'],
    Australia: ['#00843d', '#ffcd00', '#00008b'],
    Paraguay: ['#0038a8', '#cd1126', '#ffffff'],
    Turkey: ['#a4282f', '#ffffff', '#a4282f'],
    Germany: ['#1a1a1a', '#dd0000', '#ffce00'],
    'Curaçao': ['#002b7f', '#ffd100', '#ffffff'],
    Ecuador: ['#ffd100', '#0033a0', '#ed1c24'],
    'Ivory Coast': ['#f77f00', '#ffffff', '#009e60'],
    Netherlands: ['#ae1c28', '#21468b', '#ff6c00'],
    Japan: ['#1a1a1a', '#bc002d', '#ffffff'],
    Sweden: ['#005293', '#fecc02', '#ffffff'],
    Tunisia: ['#a4282f', '#ffffff', '#a4282f'],
    Belgium: ['#1a1a1a', '#fdda24', '#ed2939'],
    Egypt: ['#a4282f', '#1a1a1a', '#ffd700'],
    Iran: ['#c8102e', '#1a1a1a', '#ffffff'],
    'New Zealand': ['#1a1a1a', '#ffffff', '#1a1a1a'],
    Spain: ['#aa151b', '#f1bf00', '#aa151b'],
    'Cape Verde': ['#003893', '#cf2027', '#f7d116'],
    'Saudi Arabia': ['#0b5c36', '#ffffff', '#0b5c36'],
    Uruguay: ['#0038a8', '#ffffff', '#fcd116'],
    France: ['#0055a4', '#ffffff', '#ef4135'],
    Iraq: ['#1a1a1a', '#ce1126', '#ffffff'],
    Norway: ['#ba0c2f', '#00205b', '#ffffff'],
    Senegal: ['#00853f', '#fdef42', '#e31b23'],
    Argentina: ['#338ac0', '#ffffff', '#f6b40e'],
    Algeria: ['#006233', '#ffffff', '#d21034'],
    Austria: ['#ed2939', '#ffffff', '#ed2939'],
    Jordan: ['#1a1a1a', '#ce1126', '#007a3d'],
    Portugal: ['#006600', '#ff0000', '#ffe900'],
    Colombia: ['#fcd116', '#003893', '#ce1126'],
    'DR Congo': ['#007fff', '#f7d618', '#ce1021'],
    Uzbekistan: ['#0099b5', '#1eb53a', '#ce1126'],
    England: ['#1a1a1a', '#c8102e', '#ffffff'],
    Croatia: ['#171796', '#e30613', '#ffffff'],
    Ghana: ['#006b3f', '#fcd116', '#ce1126'],
    Panama: ['#0050a4', '#d21034', '#ffffff']
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
  global.WC.TEAM_PALETTES = TEAM_PALETTES;
})(window);
