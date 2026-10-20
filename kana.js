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
  var KANA = { ROWS: ROWS };
  if (typeof module !== "undefined" && module.exports) module.exports = KANA;
  else root.KANA = KANA;
})(this);
