/* 💬 Words: after a few levels, simple Japanese words fall too (ねこ neko = cat).
   Hiragana mode sends hiragana words, katakana mode sends katakana loanwords (ケーキ keeki = cake), MIX sends both.
   A word only falls once every kana in it is unlocked (dakuten words like バナナ also wait for level 6).
   Plain JS, no dependencies. Exposes KA_WORDS (window) / module.exports (Node tests). */
(function (root) {
  "use strict";
  var START = 3;        // first level with words
  var DAKU_LEVEL = 6;   // words with ゛/゜ kana (バナナ, ゲーム, ありがとう) wait a bit longer
  // [word, English, emoji]
  var LIST = [
    // hiragana (native words)
    ["いえ", "house", "🏠"], ["うえ", "up", "⬆️"], ["かお", "face", "😊"], ["いか", "squid", "🦑"], ["すし", "sushi", "🍣"],
    ["あさ", "morning", "🌅"], ["かさ", "umbrella", "☂️"], ["しお", "salt", "🧂"], ["えき", "station", "🚉"], ["あし", "foot", "🦶"],
    ["いす", "chair", "🪑"], ["あかい", "red", "🔴"], ["おかし", "sweets", "🍬"], ["すいか", "watermelon", "🍉"],
    ["たこ", "octopus", "🐙"], ["つき", "moon", "🌙"], ["くつ", "shoes", "👟"], ["くち", "mouth", "👄"], ["とけい", "clock", "⏰"],
    ["ねこ", "cat", "🐱"], ["いぬ", "dog", "🐶"], ["なつ", "summer", "☀️"], ["にく", "meat", "🍖"], ["さかな", "fish", "🐟"],
    ["きのこ", "mushroom", "🍄"], ["なし", "pear", "🍐"],
    ["はな", "flower", "🌼"], ["ほし", "star", "⭐"], ["ふね", "boat", "⛵"], ["ひと", "person", "🧑"], ["はし", "chopsticks", "🥢"],
    ["ふく", "clothes", "👕"], ["ひこうき", "airplane", "✈️"],
    ["うみ", "sea", "🌊"], ["もも", "peach", "🍑"], ["みみ", "ear", "👂"], ["あめ", "rain", "☔"], ["むし", "bug", "🐛"],
    ["かめ", "turtle", "🐢"], ["くま", "bear", "🐻"], ["あたま", "head", "🙆"],
    ["やま", "mountain", "⛰️"], ["ゆき", "snow", "❄️"], ["ゆめ", "dream", "💭"], ["やさい", "vegetables", "🥕"], ["へや", "room", "🚪"],
    ["さくら", "cherry blossom", "🌸"], ["そら", "sky", "🌤️"], ["とり", "bird", "🐦"], ["よる", "night", "🌃"], ["くるま", "car", "🚗"],
    ["はる", "spring", "🌷"], ["ありがとう", "thank you", "🙏"], ["いちご", "strawberry", "🍓"], ["ねずみ", "mouse", "🐭"],
    ["わに", "crocodile", "🐊"], ["りんご", "apple", "🍎"], ["ほん", "book", "📕"], ["みかん", "mandarin", "🍊"],
    // katakana (loanwords)
    ["ケーキ", "cake", "🍰"], ["スキー", "ski", "⛷️"], ["アイス", "ice cream", "🍨"], ["ココア", "cocoa", "🍫"], ["ソース", "sauce", "🥫"],
    ["タクシー", "taxi", "🚕"], ["テスト", "test", "📝"], ["トースト", "toast", "🍞"], ["スーツ", "suit", "🕴️"], ["セーター", "sweater", "🧶"],
    ["テニス", "tennis", "🎾"], ["ネクタイ", "necktie", "👔"], ["ノート", "notebook", "📓"],
    ["ナイフ", "knife", "🔪"], ["ハート", "heart", "💖"], ["コーヒー", "coffee", "☕"], ["バス", "bus", "🚌"], ["バナナ", "banana", "🍌"],
    ["トマト", "tomato", "🍅"], ["メモ", "memo", "🗒️"], ["ハム", "ham", "🥓"], ["ゲーム", "game", "🎮"],
    ["タイヤ", "tire", "🛞"], ["ヨーヨー", "yo-yo", "🪀"],
    ["カメラ", "camera", "📷"], ["ホテル", "hotel", "🏨"], ["クラス", "class", "🏫"], ["テレビ", "TV", "📺"],
    ["ラーメン", "ramen", "🍜"], ["メロン", "melon", "🍈"], ["レモン", "lemon", "🍋"], ["パン", "bread", "🥖"]
  ];
  // voiced kana → [base kana, romaji alternates] (hiragana; katakana is +0x60)
  var DAKU = { "が": ["か", "ga"], "ぎ": ["き", "gi"], "ぐ": ["く", "gu"], "げ": ["け", "ge"], "ご": ["こ", "go"],
    "ざ": ["さ", "za"], "じ": ["し", "ji", "zi"], "ず": ["す", "zu"], "ぜ": ["せ", "ze"], "ぞ": ["そ", "zo"],
    "だ": ["た", "da"], "で": ["て", "de"], "ど": ["と", "do"],
    "ば": ["は", "ba"], "び": ["ひ", "bi"], "ぶ": ["ふ", "bu"], "べ": ["へ", "be"], "ぼ": ["ほ", "bo"],
    "ぱ": ["は", "pa"], "ぴ": ["ひ", "pi"], "ぷ": ["ふ", "pu"], "ぺ": ["へ", "pe"], "ぽ": ["ほ", "po"] };
  function toHira(ch) { var c = ch.charCodeAt(0); return c >= 0x30A1 && c <= 0x30F6 ? String.fromCharCode(c - 0x60) : ch; }
  function isKata(s) { return /[\u30A1-\u30FA]/.test(s); }
  var cache = {};
  function table(ROWS) { // hiragana char → { row, alts }
    var t = {};
    ROWS.forEach(function (r, ri) { r.kana.forEach(function (k) { t[k[0]] = { row: ri, alts: k.slice(2), base: k[0] }; }); });
    Object.keys(DAKU).forEach(function (d) { var b = t[DAKU[d][0]]; if (b) t[d] = { row: b.row, alts: DAKU[d].slice(1), base: DAKU[d][0], daku: true }; });
    return t;
  }
  // everything about one word: romaji per kana, every accepted typing, which kana rows it needs
  function info(jp, ROWS) {
    if (cache[jp]) return cache[jp];
    var t = table(ROWS), entry = null;
    for (var i = 0; i < LIST.length; i++) if (LIST[i][0] === jp) { entry = LIST[i]; break; }
    var units = [], maxRow = 0, daku = false, ok = true;
    for (var j = 0; j < jp.length; j++) {
      var ch = jp[j];
      if (ch === "ー") { var prev = units[units.length - 1], v = prev ? prev.alts[0].slice(-1) : ""; units.push({ ch: ch, alts: [v], base: null }); continue; }
      var e = t[toHira(ch)]; if (!e) { ok = false; continue; }
      maxRow = Math.max(maxRow, e.row); if (e.daku) daku = true;
      // ん: "n" or "nn"; the plain kana for the "seen it" check is the unvoiced one in the same script
      var base = isKata(ch) ? String.fromCharCode(e.base.charCodeAt(0) + 0x60) : e.base;
      units.push({ ch: ch, alts: e.alts, base: base });
    }
    var answers = [""];
    units.forEach(function (u) {
      var next = [];
      answers.forEach(function (a) { u.alts.forEach(function (al) { if (next.length < 64) next.push(a + al); }); });
      answers = next;
    });
    var out = { jp: jp, en: entry ? entry[1] : "", emoji: entry ? entry[2] : "", kata: isKata(jp), ro: answers[0],
      answers: answers.filter(function (a, i) { return answers.indexOf(a) === i; }), units: units.map(function (u) { return { ch: u.ch, ro: u.alts[0] }; }),
      kana: units.filter(function (u) { return u.base; }).map(function (u) { return u.base; }),
      minLevel: Math.max(START, maxRow + 1, daku ? DAKU_LEVEL : 0), ok: ok && !!entry };
    cache[jp] = out; return out;
  }
  function all(ROWS) { return LIST.map(function (w) { return info(w[0], ROWS); }); }
  function scriptOk(w, script) { return script === "both" || (script === "katakana" ? w.kata : !w.kata); }
  // words ready at this level for this script
  function available(level, script, ROWS) { return all(ROWS).filter(function (w) { return w.ok && level >= w.minLevel && scriptOk(w, script); }); }
  // chance that the next drop is a word: none before level 3, then more and more (up to 1 in 2)
  function chance(level, gentle) {
    if (level < START) return 0;
    var c = Math.min(0.5, 0.2 + 0.06 * (level - START));
    return gentle ? c * 0.8 : c;
  }
  function maxOnScreen(level, gentle) { return gentle ? 1 : (level >= 6 ? 2 : 1); }
  // pick a word: prefer ones made only of kana you've already played (weight 3), review ones you missed (+2)
  function pick(level, script, ROWS, kanaStats, wordStats, skip, rand) {
    rand = rand || Math.random; kanaStats = kanaStats || {}; wordStats = wordStats || {}; skip = skip || {};
    var list = available(level, script, ROWS).filter(function (w) { return !skip[w.jp]; });
    if (!list.length) return null;
    var weights = list.map(function (w) {
      var seen = w.kana.every(function (k) { return kanaStats[k] && kanaStats[k].c > 0; });
      var ws = wordStats[w.jp];
      return (seen ? 3 : 1) + (ws && ws.w > (ws.c || 0) / 2 ? 2 : 0);
    });
    var tot = weights.reduce(function (a, b) { return a + b; }, 0), r = rand() * tot;
    for (var i = 0; i < list.length; i++) { r -= weights[i]; if (r < 0) return list[i]; }
    return list[list.length - 1];
  }
  // three wrong romaji choices that look close: swap one kana for a similar one, then other words
  function distractors(w, level, script, ROWS, rand) {
    rand = rand || Math.random;
    var out = [], bad = {}; w.answers.forEach(function (a) { bad[a] = 1; });
    var pool = []; ROWS.slice(0, Math.min(level, ROWS.length)).forEach(function (r) { r.kana.forEach(function (k) { if (k[2] !== "n") pool.push(k[2]); }); });
    for (var tries = 0; tries < 80 && out.length < 3; tries++) {
      var idx = Math.floor(rand() * w.units.length), u = w.units[idx];
      if (u.ch === "ー" || u.ro === "n") continue;
      var sim = pool.filter(function (p) { return p !== u.ro && (p.slice(-1) === u.ro.slice(-1) || p[0] === u.ro[0]); });
      if (!sim.length) continue;
      var s = w.units.map(function (x, i) { return i === idx ? sim[Math.floor(rand() * sim.length)] : x.ro; }).join("");
      if (!bad[s] && out.indexOf(s) < 0) out.push(s);
    }
    var others = available(Math.max(level, START), script, ROWS).map(function (x) { return x.ro; });
    for (var i = 0; i < others.length && out.length < 3; i++) { var o = others[Math.floor(rand() * others.length)]; if (!bad[o] && out.indexOf(o) < 0) out.push(o); }
    ["neko", "sushi", "hana"].forEach(function (f) { if (out.length < 3 && !bad[f] && out.indexOf(f) < 0) out.push(f); });
    return out.slice(0, 3);
  }
  // per-word stats (own save key kanaArcade.words); junk → empty
  function normalize(v) {
    var out = {};
    if (!v || typeof v !== "object" || Array.isArray(v)) return out;
    Object.keys(v).forEach(function (k) { var s = v[k]; if (s && typeof s === "object") out[k] = { c: Math.max(0, +s.c || 0), w: Math.max(0, +s.w || 0) }; });
    return out;
  }
  var API = { START: START, DAKU_LEVEL: DAKU_LEVEL, LIST: LIST, info: info, all: all, available: available, chance: chance,
    maxOnScreen: maxOnScreen, pick: pick, distractors: distractors, normalize: normalize };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.KA_WORDS = API;
})(typeof window !== "undefined" ? window : globalThis);
