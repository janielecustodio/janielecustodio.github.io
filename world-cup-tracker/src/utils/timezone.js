// Converts venue-local kickoff times ("13:00 UTC-6") into a chosen display
// timezone. Offsets are fixed (no DST library) and set for June 2026 —
// the World Cup window — so e.g. New York is UTC-4 (EDT), not UTC-5.
(function (global) {
  var TIMEZONES = [
    // North America
    { id: 'America/New_York', label: 'New York (ET)', offset: -4, region: 'North America' },
    { id: 'America/Toronto', label: 'Toronto (ET)', offset: -4, region: 'North America' },
    { id: 'America/Chicago', label: 'Chicago (CT)', offset: -5, region: 'North America' },
    { id: 'America/Denver', label: 'Denver (MT)', offset: -6, region: 'North America' },
    { id: 'America/Los_Angeles', label: 'Los Angeles (PT)', offset: -7, region: 'North America' },
    { id: 'America/Vancouver', label: 'Vancouver (PT)', offset: -7, region: 'North America' },
    { id: 'America/Mexico_City', label: 'Mexico City (CT)', offset: -6, region: 'North America' },
    { id: 'America/Tijuana', label: 'Tijuana (PT)', offset: -7, region: 'North America' },
    { id: 'America/Monterrey', label: 'Monterrey (CT)', offset: -6, region: 'North America' },
    // South America (incl. Brazil)
    { id: 'America/Sao_Paulo', label: 'Brasília Time — São Paulo/Rio/Brasília (BRT)', offset: -3, region: 'South America' },
    { id: 'America/Rio_Branco', label: 'Rio Branco, Brazil (ACT)', offset: -5, region: 'South America' },
    { id: 'America/Manaus', label: 'Manaus, Brazil (AMT)', offset: -4, region: 'South America' },
    { id: 'America/Noronha', label: 'Fernando de Noronha, Brazil (FNT)', offset: -2, region: 'South America' },
    { id: 'America/Buenos_Aires', label: 'Buenos Aires (ART)', offset: -3, region: 'South America' },
    { id: 'America/Santiago', label: 'Santiago (CLT)', offset: -4, region: 'South America' },
    { id: 'America/Bogota', label: 'Bogotá (COT)', offset: -5, region: 'South America' },
    { id: 'America/Lima', label: 'Lima (PET)', offset: -5, region: 'South America' },
    // UTC / Africa
    { id: 'UTC', label: 'UTC', offset: 0, region: 'UTC' },
    { id: 'Africa/Casablanca', label: 'Casablanca (WEST)', offset: 1, region: 'Africa' },
    { id: 'Africa/Lagos', label: 'Lagos (WAT)', offset: 1, region: 'Africa' },
    { id: 'Africa/Cairo', label: 'Cairo (EET)', offset: 3, region: 'Africa' },
    { id: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', offset: 2, region: 'Africa' },
    // Europe
    { id: 'Europe/London', label: 'London (BST)', offset: 1, region: 'Europe' },
    { id: 'Europe/Lisbon', label: 'Lisbon (WEST)', offset: 1, region: 'Europe' },
    { id: 'Europe/Paris', label: 'Paris (CEST)', offset: 2, region: 'Europe' },
    { id: 'Europe/Berlin', label: 'Berlin (CEST)', offset: 2, region: 'Europe' },
    { id: 'Europe/Madrid', label: 'Madrid (CEST)', offset: 2, region: 'Europe' },
    { id: 'Europe/Rome', label: 'Rome (CEST)', offset: 2, region: 'Europe' },
    { id: 'Europe/Amsterdam', label: 'Amsterdam (CEST)', offset: 2, region: 'Europe' },
    { id: 'Europe/Athens', label: 'Athens (EEST)', offset: 3, region: 'Europe' },
    { id: 'Europe/Moscow', label: 'Moscow (MSK)', offset: 3, region: 'Europe' },
    // Middle East / Asia
    { id: 'Asia/Dubai', label: 'Dubai (GST)', offset: 4, region: 'Asia' },
    { id: 'Asia/Karachi', label: 'Karachi (PKT)', offset: 5, region: 'Asia' },
    { id: 'Asia/Kolkata', label: 'New Delhi/Mumbai (IST)', offset: 5.5, region: 'Asia' },
    { id: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: 7, region: 'Asia' },
    { id: 'Asia/Shanghai', label: 'Beijing/Shanghai (CST)', offset: 8, region: 'Asia' },
    { id: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 8, region: 'Asia' },
    { id: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 9, region: 'Asia' },
    { id: 'Asia/Seoul', label: 'Seoul (KST)', offset: 9, region: 'Asia' },
    // Oceania
    { id: 'Australia/Sydney', label: 'Sydney (AEST)', offset: 10, region: 'Oceania' },
    { id: 'Australia/Perth', label: 'Perth (AWST)', offset: 8, region: 'Oceania' },
    { id: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: 12, region: 'Oceania' }
  ];
  var TIME_RE = /^(\d{1,2}):(\d{2})\s*UTC([+-]\d+)$/;
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var DEFAULT_TZ = TIMEZONES[0];

  function pad(n) { return String(n).padStart(2, '0'); }

  // Returns null if date/time can't be parsed (e.g. missing/odd feed data).
  function toUtcMillis(date, time) {
    var dm = DATE_RE.exec(date || '');
    var tm = TIME_RE.exec(time || '');
    if (!dm || !tm) return null;
    var venueOffset = Number(tm[3]);
    return Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]) - venueOffset, Number(tm[2]));
  }

  // Returns { date: 'YYYY-MM-DD', time: 'HH:MM' } in the given timezone, or
  // null (caller should fall back to the raw venue-local strings).
  function formatInTimezone(date, time, tz) {
    var ms = toUtcMillis(date, time);
    if (ms === null) return null;
    var shifted = new Date(ms + (tz.offset || 0) * 3600000);
    return {
      date: shifted.getUTCFullYear() + '-' + pad(shifted.getUTCMonth() + 1) + '-' + pad(shifted.getUTCDate()),
      time: pad(shifted.getUTCHours()) + ':' + pad(shifted.getUTCMinutes())
    };
  }

  // Today's date (YYYY-MM-DD) as seen from the given timezone, computed
  // from the real current time — used to drive the "Today" matches tab.
  function todayInTimezone(tz) {
    var shifted = new Date(Date.now() + (tz.offset || 0) * 3600000);
    return shifted.getUTCFullYear() + '-' + pad(shifted.getUTCMonth() + 1) + '-' + pad(shifted.getUTCDate());
  }

  // Adds (or subtracts, for negative n) whole days to a 'YYYY-MM-DD' date
  // string — used to step through days in the "Today's Matches" view.
  function addDays(dateStr, n) {
    var dm = DATE_RE.exec(dateStr || '');
    if (!dm) return dateStr;
    var d = new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])));
    d.setUTCDate(d.getUTCDate() + n);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  // A match is treated as live from kickoff until ~2h15m later (full
  // 90 minutes + stoppage/halftime/extra-time buffer) if it has no score yet.
  function isLive(date, time) {
    var startMs = toUtcMillis(date, time);
    if (startMs === null) return false;
    var nowMs = Date.now();
    return nowMs >= startMs && nowMs <= startMs + 135 * 60000;
  }

  // Whether kickoff has already happened — used to tell a real final score
  // apart from a score entered ahead of time in simulation mode.
  function hasKickedOff(date, time) {
    var startMs = toUtcMillis(date, time);
    if (startMs === null) return false;
    return Date.now() >= startMs;
  }

  // Rough estimate of the match clock from elapsed real time since kickoff —
  // the data source has no real live-minute feed, so this assumes a 15min
  // halftime break after 45 simulated minutes. Approximate, not authoritative.
  function liveMinute(date, time) {
    var startMs = toUtcMillis(date, time);
    if (startMs === null) return null;
    var mins = Math.floor((Date.now() - startMs) / 60000);
    if (mins < 0) return null;
    if (mins <= 45) return mins;
    if (mins <= 60) return 45; // halftime break
    var secondHalf = mins - 60 + 45;
    return secondHalf <= 90 ? secondHalf : 90;
  }

  global.WC = global.WC || {};
  global.WC.TIMEZONES = TIMEZONES;
  global.WC.DEFAULT_TZ = DEFAULT_TZ;
  global.WC.toUtcMillis = toUtcMillis;
  global.WC.formatInTimezone = formatInTimezone;
  global.WC.todayInTimezone = todayInTimezone;
  global.WC.addDays = addDays;
  global.WC.isLive = isLive;
  global.WC.hasKickedOff = hasKickedOff;
  global.WC.liveMinute = liveMinute;
})(window);
