// Converts venue-local kickoff times ("13:00 UTC-6") into a chosen display
// timezone. Offsets are fixed (no DST library) and set for June 2026 —
// the World Cup window — so e.g. New York is UTC-4 (EDT), not UTC-5.
(function (global) {
  var TIMEZONES = [
    { id: 'America/New_York', label: 'New York (ET)', offset: -4 },
    { id: 'America/Chicago', label: 'Chicago (CT)', offset: -5 },
    { id: 'America/Denver', label: 'Denver (MT)', offset: -6 },
    { id: 'America/Los_Angeles', label: 'Los Angeles (PT)', offset: -7 },
    { id: 'America/Mexico_City', label: 'Mexico City (CT)', offset: -6 },
    { id: 'UTC', label: 'UTC', offset: 0 },
    { id: 'Europe/London', label: 'London (BST)', offset: 1 },
    { id: 'Europe/Paris', label: 'Paris/Berlin (CEST)', offset: 2 },
    { id: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 9 },
    { id: 'Australia/Sydney', label: 'Sydney (AEST)', offset: 10 }
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

  global.WC = global.WC || {};
  global.WC.TIMEZONES = TIMEZONES;
  global.WC.DEFAULT_TZ = DEFAULT_TZ;
  global.WC.formatInTimezone = formatInTimezone;
})(window);
