// Applies / persists the "My Team" colour theme as CSS variables on :root.
(function (global) {
  var STORAGE_KEY = 'wc2026_my_team';

  function rgbToHex(rgb) {
    return '#' + rgb.map(function (c) { return c.toString(16).padStart(2, '0'); }).join('');
  }

  function applyPalette(palette) {
    var root = document.documentElement;
    root.style.setProperty('--color-primary', palette[0] || '#0b3d2e');
    root.style.setProperty('--color-secondary', palette[1] || '#13734f');
    root.style.setProperty('--color-accent', palette[2] || '#ffd166');
  }

  function clearPalette() {
    var root = document.documentElement;
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-secondary');
    root.style.removeProperty('--color-accent');
  }

  // RGB -> HSL, used to pick vivid, distinct swatches and avoid the muddy
  // blended tones ColorThief's raw palette order tends to surface from
  // anti-aliased flag edges (e.g. green+yellow+blue averaging to purple).
  function rgbToHsl(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }

  function darken(rgb, targetL) {
    var hsl = rgbToHsl(rgb);
    if (hsl[2] <= targetL) return rgb;
    return hslToRgb(hsl[0], hsl[1], targetL);
  }

  function hslToRgb(h, s, l) {
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    var hk = h / 360;
    return [
      Math.round(hue2rgb(p, q, hk + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, hk) * 255),
      Math.round(hue2rgb(p, q, hk - 1 / 3) * 255)
    ];
  }

  function extractPaletteFromFlag(isoCode, cb) {
    var img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function () {
      try {
        var thief = new window.ColorThief();
        var raw = thief.getPalette(img, 10, 5);
        var candidates = raw
          .map(function (rgb) { return { rgb: rgb, hsl: rgbToHsl(rgb) }; })
          .filter(function (c) { return c.hsl[1] >= 0.25 && c.hsl[2] >= 0.15 && c.hsl[2] <= 0.85; });

        var chosen = [];
        candidates.sort(function (a, b) { return b.hsl[1] - a.hsl[1]; });
        candidates.forEach(function (c) {
          var tooClose = chosen.some(function (k) { return Math.abs(k.hsl[0] - c.hsl[0]) < 25; });
          if (!tooClose) chosen.push(c);
        });

        if (chosen.length < 3) {
          chosen = thief.getPalette(img, 3).map(function (rgb) { return { rgb: rgb, hsl: rgbToHsl(rgb) }; });
        }

        chosen.sort(function (a, b) { return a.hsl[2] - b.hsl[2]; }); // darkest first
        var primary = darken(chosen[0].rgb, 0.32);
        var secondary = chosen[1] ? chosen[1].rgb : chosen[0].rgb;
        var accent = chosen[2] ? chosen[2].rgb : chosen[chosen.length - 1].rgb;

        cb([primary, secondary, accent].map(rgbToHex));
      } catch (e) {
        cb(null);
      }
    };
    img.onerror = function () { cb(null); };
    img.src = 'https://flagcdn.com/w80/' + isoCode + '.png';
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
  global.WC.extractPaletteFromFlag = extractPaletteFromFlag;
  global.WC.saveMyTeam = saveMyTeam;
  global.WC.loadMyTeam = loadMyTeam;
})(window);
