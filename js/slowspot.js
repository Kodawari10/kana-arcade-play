// ⏱ Slow to spot: kana you got right but only after a long think. Hesitation means the kana isn't automatic yet,
// so these are worth a little practice even though you never missed them. Pure logic (no DOM).
// times: [{ ch, s }] seconds from the moment a kana became the next one to answer (lowest on screen) until you zapped it.
(function (root) {
  var MIN_SAMPLES = 4, MIN_SEC = 2, RATIO = 1.4;
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : 0; }
  // up to max kana whose average answer time is at least MIN_SEC and RATIO × your median: [{ ch, s }] slowest first
  function list(times, opts) {
    opts = opts || {}; var max = opts.max || 3, skip = opts.skip || {};
    var ok = (times || []).filter(function (t) { return t && t.ch && isFinite(t.s) && t.s >= 0 && t.s < 60; });
    if (ok.length < MIN_SAMPLES) return [];
    var med = median(ok.map(function (t) { return t.s; })), cut = Math.max(MIN_SEC, med * RATIO), by = {};
    ok.forEach(function (t) { (by[t.ch] = by[t.ch] || []).push(t.s); });
    return Object.keys(by).map(function (ch) { var a = by[ch]; return { ch: ch, s: a.reduce(function (x, y) { return x + y; }, 0) / a.length }; })
      .filter(function (it) { return it.s >= cut && !skip[it.ch]; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, max)
      .map(function (it) { return { ch: it.ch, s: Math.round(it.s * 10) / 10 }; });
  }
  var API = { MIN_SAMPLES: MIN_SAMPLES, MIN_SEC: MIN_SEC, RATIO: RATIO, median: median, list: list };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_SLOW = API;
})(this);
