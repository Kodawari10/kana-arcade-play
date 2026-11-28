// Small romaji above kana (furigana-style) for the home screen. Plain JS, no dependencies.
// KA_ROMAJI.ruby("ひらがな") -> <ruby>ひ<rt>hi</rt></ruby><ruby>ら<rt>ra</rt></ruby>…
// Kanji, numbers, emoji and punctuation pass through unchanged.
(function (root) {
  var H = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん" +
          "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ";
  var R = ["a","i","u","e","o","ka","ki","ku","ke","ko","sa","shi","su","se","so","ta","chi","tsu","te","to",
           "na","ni","nu","ne","no","ha","hi","fu","he","ho","ma","mi","mu","me","mo","ya","yu","yo",
           "ra","ri","ru","re","ro","wa","wo","n",
           "ga","gi","gu","ge","go","za","ji","zu","ze","zo","da","ji","zu","de","do",
           "ba","bi","bu","be","bo","pa","pi","pu","pe","po"];
  var MAP = {};
  function kata(ch) { return String.fromCharCode(ch.charCodeAt(0) + 0x60); }
  for (var i = 0; i < H.length; i++) { MAP[H[i]] = R[i]; MAP[kata(H[i])] = R[i]; }
  // small vowels / small ya-yu-yo on their own
  var SMALL = { "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o", "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ゎ": "wa" };
  Object.keys(SMALL).forEach(function (k) { MAP[k] = SMALL[k]; MAP[kata(k)] = SMALL[k]; });
  MAP["ヴ"] = "vu";
  var YOON = { "ゃ": "a", "ゅ": "u", "ょ": "o" };
  function isKana(ch) { var c = ch.charCodeAt(0); return (c >= 0x3041 && c <= 0x3096) || (c >= 0x30A1 && c <= 0x30FA) || ch === "ー"; }
  function toHira(ch) { var c = ch.charCodeAt(0); return c >= 0x30A1 && c <= 0x30F6 ? String.fromCharCode(c - 0x60) : ch; }
  function lastVowel(ro) { var m = /[aiueo](?!.*[aiueo])/.exec(ro || ""); return m ? m[0] : ""; }

  // split a string into units: { jp, ro } for kana (one mora each, e.g. ちゃ = cha), { jp } for anything else
  function units(str) {
    var out = [], s = String(str || "");
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (!isKana(ch)) { var last = out[out.length - 1]; if (last && last.ro === undefined) last.jp += ch; else out.push({ jp: ch }); continue; }
      var next = s[i + 1], h = toHira(ch), nh = next ? toHira(next) : "";
      if (ch === "ー") { var prev = out[out.length - 1]; out.push({ jp: ch, ro: lastVowel(prev && prev.ro) || "-" }); continue; }
      if (h === "っ") { // small tsu doubles the next consonant
        var nr = MAP[next] || ""; var c0 = nr.indexOf("ch") === 0 ? "t" : nr.charAt(0);
        out.push({ jp: ch, ro: c0 && "aiueon".indexOf(c0) < 0 ? c0 : "-" }); continue;
      }
      var ro = MAP[ch];
      if (YOON[nh] && ro && /i$/.test(ro) && ro !== "i") { // きゃ kya, しゃ sha, ちゃ cha, じゃ ja
        var base = /^(shi|chi|ji)$/.test(ro) ? ro.slice(0, -1) : ro.slice(0, -1) + "y";
        out.push({ jp: ch + next, ro: base + YOON[nh] }); i++; continue;
      }
      out.push({ jp: ch, ro: ro || "" });
    }
    return out;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // the whole word in romaji: "ひらがな" -> "hiragana", "かなアーケード" -> "kanaaakeedo" (ー repeats the vowel)
  function toRomaji(str) { return units(str).map(function (u) { return u.ro === undefined ? u.jp : u.ro; }).join(""); }
  // HTML with tiny romaji above every kana; rt is aria-hidden so screen readers read the Japanese once
  function ruby(str) {
    return units(str).map(function (u) {
      return u.ro === undefined ? esc(u.jp) : '<ruby class="ro">' + esc(u.jp) + '<rt aria-hidden="true">' + esc(u.ro) + "</rt></ruby>";
    }).join("");
  }
  var API = { units: units, toRomaji: toRomaji, ruby: ruby };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.KA_ROMAJI = API;
})(this);
