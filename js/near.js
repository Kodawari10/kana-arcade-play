// 🌱 Almost mastered: which kana are only a few right answers away from ★ mastered.
// Pure logic (no DOM). Mastered = at least MASTER_CORRECT right and accuracy >= MASTER_ACC (80%),
// so the right answers still needed are max(8 - c, 4w - c) for the default 8 / 0.8 rule.
(function (root) {
  var NEAR = 3; // "almost" = 1 to 3 more right answers in a row
  function clean(st) {
    if (!st || typeof st !== "object") return null;
    var c = Number(st.c), w = Number(st.w);
    if (!isFinite(c) || c < 0) c = 0; if (!isFinite(w) || w < 0) w = 0;
    return { c: Math.floor(c), w: Math.floor(w) };
  }
  // right answers (in a row) still needed to master this kana; 0 = mastered, Infinity = never seen
  function need(st, masterCorrect, masterAcc) {
    var s = clean(st); if (!s || (s.c + s.w) === 0) return Infinity;
    var mc = masterCorrect || 8, acc = masterAcc || 0.8, k = Math.max(0, mc - s.c);
    while ((s.c + k) / (s.c + k + s.w) < acc - 1e-9) k++;
    return k;
  }
  function isNear(st, masterCorrect, masterAcc) { var n = need(st, masterCorrect, masterAcc); return n >= 1 && n <= NEAR; }
  // list of { ch, need } for kana close to mastery, closest first (ties: more right answers first), optional filter
  function list(kanaStats, opts) {
    opts = opts || {}; var out = [];
    for (var ch in (kanaStats || {})) {
      if (opts.only && !opts.only(ch)) continue;
      var n = need(kanaStats[ch], opts.masterCorrect, opts.masterAcc);
      if (n >= 1 && n <= NEAR) out.push({ ch: ch, need: n, c: clean(kanaStats[ch]).c });
    }
    out.sort(function (a, b) { return a.need - b.need || b.c - a.c || (a.ch < b.ch ? -1 : 1); });
    return opts.max ? out.slice(0, opts.max) : out;
  }
  function needText(n) { return n === 1 ? "1 more right answer" : n + " more right answers"; }
  var API = { NEAR: NEAR, need: need, isNear: isNear, list: list, needText: needText };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_NEAR = API;
})(this);
