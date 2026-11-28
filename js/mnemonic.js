// 💡 Memory hints: one short picture-story per kana, to make a missed kana stick.
// Pure logic (no DOM). hint(ch) returns the hint for a hiragana/katakana; voiced kana (が, パ…) reuse the plain
// kana's hint (が → か's). Hints never replace the answer; they're shown next to it.
(function (root) {
  var H = {
    "あ": "🍎 Ahh! a stick person falling into a big swirl", "い": "🐍 two little eels side by side: ii",
    "う": "😮 a face looking up at the sky: ooh!", "え": "🦜 an exotic bird with a crest: eh?",
    "お": "⛳ Oh! a golf flag with the ball right beside it", "か": "🥋 a ka-rate chop with a spark flying off",
    "き": "🔑 a key with two teeth on top", "く": "🐦 a cuckoo's open beak: ku ku",
    "け": "🍺 a keg standing next to its tap", "こ": "🪱 two worms cuddling: co-zy",
    "さ": "🗡️ a samurai's sword over a curved back: sa", "し": "🎣 a fishhook: she's fishing (shi)",
    "す": "🎠 a swing with a loop: Sue swings", "せ": "👩‍🏫 a sensei pointing at the board: se",
    "そ": "🧵 a zig-zag sewing thread: so (sew)", "た": "✍️ it's t and a squished together: ta",
    "ち": "5️⃣ looks like a 5 with a cheeky chin: chi", "つ": "🌊 a tsunami wave curling over",
    "て": "✋ a hand reaching out (te means hand)", "と": "🦶 a toe with a thorn stuck in it: to",
    "な": "🙏 a nun praying next to a cross: na", "に": "🦵 a knee: one leg and two little lines (ni = 2)",
    "ぬ": "🍜 noodles on chopsticks, a loop at the end: nu", "ね": "🐈 a cat (neko) curling its tail: ne",
    "の": "🚫 a 'no' sign: one big swirl", "は": "😆 Ha! it's an H and an a laughing together",
    "ひ": "😁 a big grin: hee hee (hi)", "ふ": "🗻 Mount Fuji with clouds puffing around: fu",
    "へ": "⛰️ a little hill: heh, easy climb", "ほ": "🎅 Ho ho! は wearing an extra hat line",
    "ま": "👩 mama with a ponytail loop", "み": "2️⃣1️⃣ looks like 21: me at 21 (mi)",
    "む": "🐄 a cow saying moo, with its tail out", "め": "👁️ an eye (me means eye): ぬ without the loop",
    "も": "🐟 a hook catching more fish: mo", "や": "🐂 a yak with a big horn: ya",
    "ゆ": "🐠 a unique fish swimming: yu", "よ": "🪀 a yo-yo hanging off a finger",
    "ら": "🐰 a rabbit with one ear up: ra", "り": "🌾 two reeds by the river: ri",
    "る": "🎢 a route with a loop-de-loop at the end: ru", "れ": "🦵 Ray kicking his leg out: re",
    "ろ": "🛣️ a road that doesn't loop: ro", "わ": "🦢 a wa-ddling swan curling back in",
    "を": "🏄 Whoa! someone surfing a wave: wo", "ん": "〽️ a little n with a tail: n",
    "ア": "🪓 an axe swinging down: a", "イ": "🎨 an easel standing up: i",
    "ウ": "🏠 う with a roof on top: u", "エ": "🛗 an elevator going between floors: e",
    "オ": "🎤 an opera singer with arms out: o", "カ": "🥋 か's karate chop without the spark: ka",
    "キ": "🔑 a key with two teeth: ki", "ク": "👨‍🍳 a cook's hat seen from the side: ku",
    "ケ": "🤸 a K doing a cartwheel: ke", "コ": "📐 a corner of a box: ko",
    "サ": "🪑 a saddle on two legs: sa", "シ": "😊 she smiles: two eyes on the left, the smile sweeps up",
    "ス": "🤼 a sumo wrestler standing tall: su", "セ": "👩‍🏫 like せ, the sensei: se",
    "ソ": "🪡 one dash and a needle falling down: so (sew)", "タ": "🦶 ク with a tap dash inside: ta",
    "チ": "📣 a cheerleader with a slanted hat: chi", "ツ": "💧 two drops falling into a tsunami: tsu",
    "テ": "📞 a telephone pole with two wires: te", "ト": "🗿 a totem pole with one branch: to",
    "ナ": "🔪 a knife crossing a line: na", "ニ": "2️⃣ two lines (ni = 2)",
    "ヌ": "🍜 chopsticks lifting noodles: nu", "ネ": "📿 a necklace on a hook: ne",
    "ノ": "🙅 one slash: No!", "ハ": "😆 two lines like a laughing mouth: ha",
    "ヒ": "👠 a heel kicking: hi", "フ": "🗻 the top of Mount Fuji: fu",
    "ヘ": "⛰️ same little hill as へ: he", "ホ": "✝️ a cross with two dots: ho (holy)",
    "マ": "🍸 a martini glass on its side: ma", "ミ": "🎵 three lines, me-me-me: mi",
    "ム": "🐮 a cow's nose: moo (mu)", "メ": "❌ an X: mark me here (me)",
    "モ": "🎣 も's fishing hook with a flat top: mo", "ヤ": "⛵ a yacht's sail: ya",
    "ユ": "🚢 a U-boat on the water: yu", "ヨ": "🪀 a yo-yo trick with three strings: yo",
    "ラ": "🐰 a rabbit's head with a flat ear: ra", "リ": "🌾 same reeds as り: ri",
    "ル": "🌱 two roots growing down: ru", "レ": "🦵 a leg kicking out: re",
    "ロ": "🚧 a closed box, a roadblock: ro", "ワ": "🍷 a wine glass: wa",
    "ヲ": "🏄 ヨ with a whoa-tail: wo", "ン": "〽️ one dash and a stroke up: n"
  };
  var K = root.KANA || (typeof require === "function" ? require("../kana.js") : null), BASE = {};
  if (K && K.DAKUTEN) K.DAKUTEN.forEach(function (d) {
    var from = K.ROWS.filter(function (r) { return r.name === d.from; })[0];
    if (from) d.kana.forEach(function (k, i) { var b = from.kana[i]; if (b) { BASE[k[0]] = b[0]; BASE[k[1]] = b[1]; } });
  });
  function hint(ch) { return H[ch] || (BASE[ch] && H[BASE[ch]]) || ""; }
  function baseOf(ch) { return BASE[ch] || null; }
  var API = { HINTS: H, hint: hint, baseOf: baseOf };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_HINT = API;
})(this);
