/* 👋 おかえり! Welcome back: when you return after a while, your companion greets you on the title screen
   and suggests a few kana you've missed before as a quick warm-up. Saved under kanaArcade.lastSeen (a time in ms),
   so the main save is untouched. Pure logic (no DOM), so it can be tested on its own. Exposes window.KA_WELCOME. */
(function (root) {
  "use strict";
  var AWAY_MS = 3 * 60 * 60 * 1000; // greet after 3 hours or more away
  var DAY = 24 * 60 * 60 * 1000;
  function validTime(v, now) { return typeof v === "number" && isFinite(v) && v > 0 && v <= now + 60000; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  // calendar days between two times (local clock): 0 = same day, 1 = yesterday, ...
  function daysBetween(a, b) {
    var da = new Date(a), db = new Date(b);
    var ma = new Date(da.getFullYear(), da.getMonth(), da.getDate(), 12).getTime(), mb = new Date(db.getFullYear(), db.getMonth(), db.getDate(), 12).getTime();
    return Math.round((mb - ma) / DAY);
  }
  function hello(hour) {
    if (hour >= 5 && hour < 11) return { jp: "おはよう!", en: "Good morning" };
    if (hour >= 11 && hour < 17) return { jp: "こんにちは!", en: "Hi again" };
    if (hour >= 17 && hour < 22) return { jp: "こんばんは!", en: "Good evening" };
    return { jp: "こんばんは!", en: "Hello, night owl" };
  }
  // lastSeen: saved time (or junk); now: ms. Returns null (no greeting) or { awayMs, days, hello, gap }.
  function compute(lastSeen, now) {
    if (!validTime(lastSeen, now)) return null; // first visit, junk or a time in the future: no greeting
    var away = now - lastSeen;
    if (away < AWAY_MS) return null;
    var days = daysBetween(lastSeen, now), gap;
    if (days >= 2) gap = "It's been " + days + " days!";
    else if (days === 1) gap = "Welcome back from yesterday!";
    else gap = "It's been " + Math.floor(away / 3600000) + " hours!";
    return { awayMs: away, days: days, hello: hello(new Date(now).getHours()), gap: gap };
  }
  // the kana you've missed most (not mastered yet), for a quick warm-up. stats = progress.kana, rows = KANA.ROWS
  function reviewKana(stats, rows, n, isMastered) {
    var ro = {};
    (rows || []).forEach(function (r) { r.kana.forEach(function (k) { ro[k[0]] = k[2]; ro[k[1]] = k[2]; }); });
    var list = Object.keys(stats || {}).filter(function (ch) {
      var s = stats[ch]; return ro[ch] && s && typeof s === "object" && (s.w || 0) > 0 && !(isMastered && isMastered(s));
    }).map(function (ch) { var s = stats[ch]; return { ch: ch, romaji: ro[ch], w: s.w || 0, acc: (s.c || 0) / ((s.c || 0) + (s.w || 0)) }; });
    list.sort(function (a, b) { return b.w - a.w || a.acc - b.acc || (a.ch < b.ch ? -1 : 1); });
    return list.slice(0, n || 3).map(function (x) { return { ch: x.ch, romaji: x.romaji }; });
  }
  var api = { AWAY_MS: AWAY_MS, compute: compute, reviewKana: reviewKana, hello: hello, dayKey: dayKey, validTime: validTime };
  root.KA_WELCOME = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
