// 🔀 My mix-ups: which kana you confuse with which, remembered across games (saved as kanaArcade.mixlog).
// Pure logic (no DOM). log = { "ぬ|め": 3 } means: ぬ was falling and you answered め's sound, 3 times.
(function (root) {
  var MAX_KEYS = 60, K = root.KANA || (typeof require === "function" ? require("../kana.js") : null), RO = {};
  if (K) (K.ALL || K.ROWS).forEach(function (r) { r.kana.forEach(function (k) { RO[k[0]] = k[2]; RO[k[1]] = k[2]; }); });
  function isKana(c) { return typeof c === "string" && c.length === 1 && Object.prototype.hasOwnProperty.call(RO, c); }
  function clean(log) {
    var out = {}; if (!log || typeof log !== "object" || Array.isArray(log)) return out;
    Object.keys(log).forEach(function (k) { var p = k.split("|"), n = Math.floor(Number(log[k])); if (p.length === 2 && isKana(p[0]) && isKana(p[1]) && p[0] !== p[1] && n > 0) out[k] = Math.min(n, 9999); });
    return out;
  }
  // record one mix-up (target falling, you answered other's sound); keeps the log small
  function add(log, target, other) {
    log = clean(log); if (!isKana(target) || !isKana(other) || target === other) return log;
    var k = target + "|" + other; log[k] = (log[k] || 0) + 1;
    var keys = Object.keys(log);
    if (keys.length > MAX_KEYS) keys.sort(function (a, b) { return log[a] - log[b]; }).slice(0, keys.length - MAX_KEYS).forEach(function (x) { if (x !== k) delete log[x]; });
    return log;
  }
  // pairs, both directions merged, most-confused first: [{ a, b, ra, rb, n }]
  function pairs(log, max) {
    log = clean(log); var by = {};
    Object.keys(log).forEach(function (k) {
      var p = k.split("|"), a = p[0] < p[1] ? p[0] : p[1], b = a === p[0] ? p[1] : p[0], key = a + "|" + b;
      if (!by[key]) by[key] = { a: p[0], b: p[1], ra: RO[p[0]], rb: RO[p[1]], n: 0, top: 0 };
      by[key].n += log[k];
      if (log[k] > by[key].top) { by[key].top = log[k]; by[key].a = p[0]; by[key].b = p[1]; by[key].ra = RO[p[0]]; by[key].rb = RO[p[1]]; }
    });
    return Object.keys(by).map(function (k) { var x = by[k]; return { a: x.a, b: x.b, ra: x.ra, rb: x.rb, n: x.n }; })
      .sort(function (x, y) { return y.n - x.n || (x.a < y.a ? -1 : 1); }).slice(0, max || 4);
  }
  // unique kana from the pairs (for a ⚡ drill)
  function kana(ps) { var out = []; (ps || []).forEach(function (p) { [p.a, p.b].forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); }); }); return out; }
  var API = { MAX_KEYS: MAX_KEYS, clean: clean, add: add, pairs: pairs, kana: kana, roOf: function (c) { return RO[c] || ""; } };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_MIX = API;
})(this);
