// Kana data: rows of [hiragana, katakana, romaji, ...alternates]
(function (root) {
  var ROWS = [
    { name: "a-row",  kana: [["あ","ア","a"],["い","イ","i"],["う","ウ","u"],["え","エ","e"],["お","オ","o"]] },
    { name: "ka-row", kana: [["か","カ","ka","ca"],["き","キ","ki"],["く","ク","ku","cu"],["け","ケ","ke"],["こ","コ","ko","co"]] },
    { name: "sa-row", kana: [["さ","サ","sa"],["し","シ","shi","si"],["す","ス","su"],["せ","セ","se"],["そ","ソ","so"]] },
    { name: "ta-row", kana: [["た","タ","ta"],["ち","チ","chi","ti"],["つ","ツ","tsu","tu"],["て","テ","te"],["と","ト","to"]] },
    { name: "na-row", kana: [["な","ナ","na"],["に","ニ","ni"],["ぬ","ヌ","nu"],["ね","ネ","ne"],["の","ノ","no"]] },
    { name: "ha-row", kana: [["は","ハ","ha"],["ひ","ヒ","hi"],["ふ","フ","fu","hu"],["へ","ヘ","he"],["ほ","ホ","ho"]] },
    { name: "ma-row", kana: [["ま","マ","ma"],["み","ミ","mi"],["む","ム","mu"],["め","メ","me"],["も","モ","mo"]] },
    { name: "ya-row", kana: [["や","ヤ","ya"],["ゆ","ユ","yu"],["よ","ヨ","yo"]] },
    { name: "ra-row", kana: [["ら","ラ","ra","la"],["り","リ","ri","li"],["る","ル","ru","lu"],["れ","レ","re","le"],["ろ","ロ","ro","lo"]] },
    { name: "wa-row", kana: [["わ","ワ","wa"],["を","ヲ","wo","o"],["ん","ン","n","nn"]] }
  ];
  // ゛ Tenten & ゜ maru: the voiced kana, unlocked after the ten basic rows (levels 11-15).
  // Kept apart from ROWS so badges (and their on-chain ids) and words stay exactly as before.
  // じ/ぢ both sound "ji" and ず/づ both "zu"; ぢ/づ also accept "di"/"du" (how keyboards type them).
  var DAKUTEN = [
    { name: "ga-row", from: "ka-row", mark: "゛", tip: "k → g", kana: [["が","ガ","ga"],["ぎ","ギ","gi"],["ぐ","グ","gu"],["げ","ゲ","ge"],["ご","ゴ","go"]] },
    { name: "za-row", from: "sa-row", mark: "゛", tip: "s → z", kana: [["ざ","ザ","za"],["じ","ジ","ji","zi"],["ず","ズ","zu"],["ぜ","ゼ","ze"],["ぞ","ゾ","zo"]] },
    { name: "da-row", from: "ta-row", mark: "゛", tip: "t → d", kana: [["だ","ダ","da"],["ぢ","ヂ","ji","di"],["づ","ヅ","zu","du"],["で","デ","de"],["ど","ド","do"]] },
    { name: "ba-row", from: "ha-row", mark: "゛", tip: "h → b", kana: [["ば","バ","ba"],["び","ビ","bi"],["ぶ","ブ","bu"],["べ","ベ","be"],["ぼ","ボ","bo"]] },
    { name: "pa-row", from: "ha-row", mark: "゜", tip: "h → p", kana: [["ぱ","パ","pa"],["ぴ","ピ","pi"],["ぷ","プ","pu"],["ぺ","ペ","pe"],["ぽ","ポ","po"]] }
  ];
  var KANA = { ROWS: ROWS, DAKUTEN: DAKUTEN, ALL: ROWS.concat(DAKUTEN) };
  KANA.TOTAL = KANA.ALL.reduce(function (n, r) { return n + r.kana.length; }, 0) * 2; // hiragana + katakana
  if (typeof module !== "undefined" && module.exports) module.exports = KANA;
  else root.KANA = KANA;
})(this);
