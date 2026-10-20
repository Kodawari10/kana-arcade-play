/* Kana Arcade badges: a sticker book of things you've learned (works fully offline).
 * The same ids are used by the optional on-chain contract (contracts/src/lib.cairo):
 *   row badges   1..20  = script * 10 + row + 1   (script 0 = hiragana, 1 = katakana; row order = kana.js)
 *   growth stamps 100 + pet * 10 + stage          (pet order = companion.js PETS; stage 1..4 = Baby..Master)
 * Earned badges are derived from the existing save (progress), so nothing new is stored and old saves just work. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("../kana.js"), require("../companion.js"));
  else root.KA_BADGES = factory(root.KANA, root.COMPANION);
})(this, function (KANA, CP) {
  "use strict";
  var ROWS = KANA.ROWS, SCRIPTS = ["hiragana", "katakana"], SCRIPT_JP = ["ひらがな", "カタカナ"];
  var STAMP_BASE = 100;
  var ALL = [];
  SCRIPTS.forEach(function (sc, s) {
    ROWS.forEach(function (row, r) {
      var chars = row.kana.map(function (k) { return k[s]; });
      ALL.push({ id: s * 10 + r + 1, kind: "row", script: sc, row: r,
        icon: chars[0], chars: chars,
        name: chars[0] + "-row " + SCRIPT_JP[s],
        title: row.name + " (" + sc + ")",
        desc: "Mastered every " + sc + " kana in the " + row.name + ": " + chars.join(" ") });
    });
  });
  CP.PETS.forEach(function (P, p) {
    for (var st = 1; st < CP.STAGES.length; st++) {
      var S = CP.STAGES[st];
      ALL.push({ id: STAMP_BASE + p * 10 + st, kind: "stamp", pet: P.id, petIndex: p, stage: st,
        icon: ["", "🐣", "🌱", "🌟", "👑"][st] || "⭐",
        name: P.name + " · " + S.name,
        title: P.name + " grew into " + S.name + " (" + S.jp + ")",
        desc: P.name + " (" + P.jp + ") reached the " + S.name + " stage · " + S.jp });
    }
  });
  var BY_ID = {}; ALL.forEach(function (b) { BY_ID[b.id] = b; });

  function rowMastered(progress, s, r) {
    var kana = (progress && progress.kana) || {};
    return ROWS[r].kana.every(function (k) { return CP.isMastered(kana[k[s]]); });
  }
  /** Badge ids this save has earned, in claim order (rows first, then each pet's stamps in stage order). */
  function earned(progress) {
    var out = [];
    if (!progress) return out;
    for (var s = 0; s < SCRIPTS.length; s++) for (var r = 0; r < ROWS.length; r++) if (rowMastered(progress, s, r)) out.push(s * 10 + r + 1);
    var m = CP.countMastered(progress.kana || {});
    CP.PETS.forEach(function (P, p) {
      var xp = (progress.pets && progress.pets[P.id] && +progress.pets[P.id].xp) || 0, stage = CP.stageFor(xp, m);
      for (var st = 1; st <= stage; st++) out.push(STAMP_BASE + p * 10 + st);
    });
    return out;
  }
  function isValid(id) { return !!BY_ID[id]; }
  return { ALL: ALL, BY_ID: BY_ID, STAMP_BASE: STAMP_BASE, earned: earned, rowMastered: rowMastered, isValid: isValid, count: ALL.length };
});
