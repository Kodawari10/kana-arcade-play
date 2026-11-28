/* 🎀 Combo ribbons + かんぺき perfect levels.
   Every 5th hit in a row gets a little cheer (いいね!, すごい!, …).
   Clear a level without a kana (or word) hitting the ground and the next
   banner says かんぺき!. Nothing is saved: old saves stay as they are.
   Pure logic. Exposes window.KA_RIBBON. */
(function (root) {
  "use strict";
  var RIBBONS = [
    { at: 5, emoji: "🍡", jp: "いいね!", en: "Nice!" },
    { at: 10, emoji: "🌸", jp: "すごい!", en: "Wow!" },
    { at: 15, emoji: "⭐", jp: "やるじゃん!", en: "You're on fire!" },
    { at: 20, emoji: "🎆", jp: "サイコー!", en: "The best!" },
    { at: 25, emoji: "👑", jp: "てんさい!", en: "Genius!" },
    { at: 30, emoji: "🌈", jp: "でんせつ!", en: "Legendary!" }
  ];
  function cheer(combo) {
    if (typeof combo !== "number" || !isFinite(combo) || combo < 5 || combo % 5 !== 0) return null;
    var pick = RIBBONS[0];
    for (var i = 0; i < RIBBONS.length; i++) if (combo >= RIBBONS[i].at) pick = RIBBONS[i];
    return { at: combo, emoji: pick.emoji, jp: pick.jp, en: pick.en };
  }
  function line(c, times) {
    if (!c) return "";
    var m = typeof times === "number" && isFinite(times) ? Math.max(1, Math.floor(times)) : 1;
    return c.emoji + " " + c.jp + " ×" + m;
  }
  function fresh() { return { clean: true, count: 0 }; }
  function noteMiss(state) {
    if (state && typeof state === "object") state.clean = false;
    return state || null;
  }
  // The level just finished. A perfect clear bumps the count, then the next level starts clean.
  function clear(state) {
    if (!state || typeof state !== "object") return { perfect: false, count: 0 };
    var perfect = state.clean === true;
    if (perfect) state.count = (state.count || 0) + 1;
    state.clean = true;
    return { perfect: perfect, count: state.count || 0 };
  }
  var api = { RIBBONS: RIBBONS, cheer: cheer, line: line, fresh: fresh, noteMiss: noteMiss, clear: clear };
  root.KA_RIBBON = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
