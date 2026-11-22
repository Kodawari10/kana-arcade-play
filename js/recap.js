// ⏸ Pause recap: a quick look at this game so far (score, level, combo, accuracy, kana caught & missed)
(function (root) {
  function list(obj, max) {
    if (!obj || typeof obj !== "object") return [];
    var keys = Object.keys(obj).filter(function (k) { return +obj[k] > 0; });
    // most often first; ties keep the order they happened in
    keys = keys.map(function (k, i) { return { ch: k, n: +obj[k], i: i }; })
      .sort(function (a, b) { return b.n - a.n || a.i - b.i; });
    return keys.slice(0, max || 10).map(function (x) { return { ch: x.ch, n: x.n }; });
  }
  function build(g, opts) {
    opts = opts || {};
    if (!g) return null;
    var shots = +g.shots || 0, hits = +g.hits || 0;
    var caught = list(g.caught, opts.max || 10), missed = list(g.missed, opts.maxMissed || 6);
    var acc = shots ? Math.round(100 * hits / shots) : null;
    var caughtN = g.caught ? Object.keys(g.caught).length : 0;
    var cheer = !hits ? "Every kana you catch shows up here ✨"
      : !missed.length ? "No misses yet, keep it up! ✨"
      : "Tap a kana to hear it before you jump back in 🔊";
    var aria = "Paused. Score " + (g.score || 0) + ", level " + (g.level || 1) + ", best combo " + (g.best || 0) +
      (acc === null ? "" : ", accuracy " + acc + " percent") + ". " +
      (caughtN ? caughtN + " different kana caught" : "No kana caught yet") +
      (missed.length ? ", " + missed.length + " missed" : "") + ".";
    return { score: g.score || 0, level: g.level || 1, best: g.best || 0, acc: acc, caught: caught, caughtN: caughtN,
      missed: missed, cheer: cheer, aria: aria, review: !!g.review };
  }
  var api = { build: build, list: list };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KA_RECAP = api;
})(typeof window !== "undefined" ? window : this);
