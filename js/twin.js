// 👯 Twin kana: every hiragana has a katakana twin that sounds the same (し ↔ シ).
// Pure logic; game.js shows the twin as a tappable chip in each "🔊 し = shi" line.
(function (root) {
  function of(ch, rows) {
    rows = rows || (root.KANA && (root.KANA.ALL || root.KANA.ROWS)) || [];
    if (typeof ch !== "string" || ch.length !== 1) return null;
    for (var r = 0; r < rows.length; r++) for (var i = 0; i < rows[r].kana.length; i++) {
      var k = rows[r].kana[i];
      if (k[0] === ch) return { ch: k[1], script: "katakana", ro: k[2] };
      if (k[1] === ch) return { ch: k[0], script: "hiragana", ro: k[2] };
    }
    return null;
  }
  function chip(ch, rows) {
    var t = of(ch, rows);
    if (!t) return "";
    return " <span class='twinWrap'>· 👯 " + t.script + " twin <button type='button' class='twinBtn' data-ch='" + t.ch +
      "' lang='ja' aria-label='" + t.script + " twin " + t.ch + ", " + t.ro + ", tap to hear it'>" + t.ch + "</button></span>";
  }
  var api = { of: of, chip: chip };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KA_TWIN = api;
})(typeof window !== "undefined" ? window : this);
