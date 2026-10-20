/* 📅 Together since: remembers the day you and each companion became friends (the first day it was your companion).
   Pure logic only; game.js draws the little pill on the ★ companion screen. Saved on this device as kanaArcade.met
   ({ petId: "2026-10-20" } local dates, or "old" for companions you already played with before this feature).
   Never sent anywhere or on-chain. Exposes window.KA_SINCE (and module.exports for tests). */
(function (root) {
  "use strict";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || ""); if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  function valid(v, now) { if (v === "old") return true; var d = parse(v); return !!d && d.getTime() <= parse(todayKey(now)).getTime(); }
  // keep only known companions with a real past date (or "old"); junk is dropped quietly
  function sanitize(raw, pets, now) {
    var out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    (pets || []).forEach(function (P) { if (Object.prototype.hasOwnProperty.call(raw, P.id) && valid(raw[P.id], now)) out[P.id] = raw[P.id]; });
    return out;
  }
  // first time a companion is yours: today, unless you had already played with it before this update ("old")
  function stamp(map, id, hadXP, now) {
    if (map && map[id]) return map;
    var out = {}, k; for (k in map || {}) if (Object.prototype.hasOwnProperty.call(map, k)) out[k] = map[k];
    out[id] = hadXP ? "old" : todayKey(now);
    return out;
  }
  function daysBetween(a, b) { return Math.round((parse(todayKey(b)) - parse(todayKey(a))) / 86400000); }
  // { emoji, text, aria, days } for the pill. name = what you call your companion (nickname or name)
  function label(v, name, now) {
    now = now || new Date();
    if (v === "old") return { emoji: "💛", text: "An old friend of yours", aria: name + " is an old friend of yours", days: null };
    var d = parse(v); if (!d) return null;
    var days = daysBetween(d, now);
    if (days <= 0) return { emoji: "🎉", text: "Friends since today!", aria: "You and " + name + " became friends today", days: 0 };
    if (days === 1) return { emoji: "🌙", text: "Friends since yesterday", aria: "You and " + name + " became friends yesterday", days: 1 };
    var when = MONTHS[d.getMonth()] + " " + d.getDate() + (d.getFullYear() !== now.getFullYear() ? ", " + d.getFullYear() : "");
    var long = days + " days";
    return { emoji: "📅", text: "Friends since " + when + " · " + long, aria: "You and " + name + " have been friends since " + when + ", " + long, days: days };
  }
  var SINCE = { todayKey: todayKey, parse: parse, sanitize: sanitize, stamp: stamp, label: label, daysBetween: daysBetween };
  if (typeof module !== "undefined" && module.exports) module.exports = SINCE;
  else root.KA_SINCE = SINCE;
})(this);
