// 🔤 What did I answer? When a wrong romaji is a real kana's sound, name that kana ("ke" is け) so every mistake
// teaches one more kana. Pure logic (no DOM). Never reveals the right answer.
(function (root) {
  var K = root.KANA || (typeof require === "function" ? require("../kana.js") : null), MAP = { hira: {}, kata: {} };
  if (K) {
    var rows = K.ALL || K.ROWS;
    [2, 3, 4].forEach(function (col) { // main romaji first, then alternates (si, tu, la…) if still free
      rows.forEach(function (r) { r.kana.forEach(function (k) {
        var ro = k[col]; if (!ro) return;
        if (!MAP.hira[ro]) MAP.hira[ro] = k[0];
        if (!MAP.kata[ro]) MAP.kata[ro] = k[1];
      }); });
    });
  }
  function scriptOf(ch) { return ch && ch.charCodeAt(0) >= 0x30a0 ? "kata" : "hira"; }
  // the kana (same script as target) whose sound is ro, or null; null when ro is actually one of target's answers
  function kanaFor(ro, target, answers) {
    ro = String(ro || "").toLowerCase();
    if (!ro || (answers && answers.indexOf(ro) >= 0)) return null;
    var m = MAP[scriptOf(target)] || MAP.hira, k = Object.prototype.hasOwnProperty.call(m, ro) ? m[ro] : null;
    return k && k !== target ? k : null;
  }
  function line(ro, kana) { return "✗ " + ro + " is " + kana; }
  var API = { MAP: MAP, kanaFor: kanaFor, line: line };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_DECODE = API;
})(this);
