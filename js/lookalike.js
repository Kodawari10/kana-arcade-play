// 👀 Look-alikes (そっくり, sokkuri): kana that are easy to mix up, with a one-line tip to tell them apart.
// Pure logic (no DOM). Each group lists kana from ONE script plus a plain-English tip.
(function (root) {
  var GROUPS = [
    { kana: ["ぬ", "め"], tip: "ぬ ends in a little loop; め doesn't." },
    { kana: ["ね", "れ", "わ"], tip: "ね ends in a loop, れ kicks out to the right, わ curves back in." },
    { kana: ["は", "ほ"], tip: "ほ has an extra line across the top." },
    { kana: ["さ", "ち"], tip: "Mirror twins: ち's belly bulges right like a 5, さ opens to the right like a c." },
    { kana: ["き", "さ"], tip: "き has two lines across, さ has just one." },
    { kana: ["る", "ろ"], tip: "る has a loop at the bottom; ろ doesn't." },
    { kana: ["い", "り"], tip: "い's two strokes are short and even; り's right stroke is long and drops down." },
    { kana: ["い", "こ"], tip: "い's strokes stand side by side; こ's lie stacked on top of each other." },
    { kana: ["あ", "お"], tip: "お has a little dot at the top right; あ doesn't." },
    { kana: ["ま", "も"], tip: "ま has a loop at the bottom; も's tail curls up with no loop." },
    { kana: ["シ", "ツ", "ン", "ソ"], tip: "Dashes on the left and a stroke sweeping up: シ (two dashes), ン (one). Dashes on top and a stroke falling down: ツ (two), ソ (one)." },
    { kana: ["ク", "ケ", "タ"], tip: "ク is just the hook, ケ's line sticks out to the right, タ has an extra dash inside." },
    { kana: ["ウ", "ワ", "フ"], tip: "ウ has a dash on top, ワ has a short line on the left, フ is just the hook." },
    { kana: ["コ", "ユ", "ロ"], tip: "コ is open on the left, ユ's bottom line sticks out, ロ is a closed box." },
    { kana: ["ス", "ヌ"], tip: "ヌ has an extra dash crossing it; ス doesn't." },
    { kana: ["ナ", "メ"], tip: "ナ is a flat line crossed by a falling stroke; メ is a slanted x." },
    { kana: ["チ", "テ"], tip: "チ's top stroke slants down from the right; テ's top lines are flat." },
    { kana: ["ア", "マ"], tip: "ア's tail falls down; マ's tail is a little tick back to the middle." }
  ];
  function groupsFor(ch) { return GROUPS.filter(function (g) { return g.kana.indexOf(ch) >= 0; }); }
  function has(ch) { return groupsFor(ch).length > 0; }
  // kana that look like ch (unique, in group order)
  function partners(ch) {
    var out = [];
    groupsFor(ch).forEach(function (g) { g.kana.forEach(function (k) { if (k !== ch && out.indexOf(k) < 0) out.push(k); }); });
    return out;
  }
  // the tip for a pair (or the first group of ch when b is missing)
  function tipFor(a, b) {
    var gs = groupsFor(a).filter(function (g) { return !b || g.kana.indexOf(b) >= 0; });
    return gs.length ? gs[0].tip : "";
  }
  // which partner of ch has this romaji (romajiOf maps a kana to its main romaji); null if none
  function partnerByRomaji(ch, ro, romajiOf) {
    if (!ro) return null;
    var p = partners(ch);
    for (var i = 0; i < p.length; i++) if (romajiOf(p[i]) === ro) return p[i];
    return null;
  }
  // up to max look-alike notes for a game: mix-ups you actually made first, then missed kana that have look-alikes.
  // mixups: { target: partner } ; missed: { ch: count }. Returns [{ a, b, tip }], no group repeated.
  function notes(mixups, missed, max) {
    max = max || 2; var out = [], used = [];
    function add(a, b) {
      if (out.length >= max || !a || !b) return;
      var g = groupsFor(a).filter(function (x) { return x.kana.indexOf(b) >= 0; })[0];
      if (!g || used.indexOf(g) >= 0) return;
      used.push(g); out.push({ a: a, b: b, kana: g.kana.slice(), tip: g.tip });
    }
    Object.keys(mixups || {}).forEach(function (a) { add(a, mixups[a]); });
    Object.keys(missed || {}).sort(function (x, y) { return (missed[y] || 0) - (missed[x] || 0); })
      .forEach(function (a) { var p = partners(a); if (p.length) add(a, p[0]); });
    return out;
  }
  var API = { GROUPS: GROUPS, has: has, partners: partners, tipFor: tipFor, partnerByRomaji: partnerByRomaji, notes: notes };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_LOOK = API;
})(this);
