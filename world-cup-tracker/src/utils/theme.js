// Applies / persists the "My Team" colour theme as CSS variables on :root.
(function (global) {
  var STORAGE_KEY = 'wc2026_my_team';

  function applyPalette(palette) {
    var root = document.documentElement;
    root.style.setProperty('--color-primary', palette[0] || '#0b3d2e');
    root.style.setProperty('--color-secondary', palette[1] || '#13734f');
    root.style.setProperty('--color-accent', palette[2] || '#ffd166');
    root.style.setProperty('--color-page-bg', 'color-mix(in srgb, ' + (palette[0] || '#0b3d2e') + ' 8%, var(--color-bg))');
  }

  function clearPalette() {
    var root = document.documentElement;
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-secondary');
    root.style.removeProperty('--color-accent');
    root.style.removeProperty('--color-page-bg');
  }

  function saveMyTeam(team) {
    if (team) localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function loadMyTeam() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  global.WC = global.WC || {};
  global.WC.applyPalette = applyPalette;
  global.WC.clearPalette = clearPalette;
  global.WC.saveMyTeam = saveMyTeam;
  global.WC.loadMyTeam = loadMyTeam;
})(window);
