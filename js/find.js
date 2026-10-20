// 🔍 Find a kana: type romaji ("shi", "tsu", "ga") or a kana (し / シ) on the companion screen and the grid
// lights up the matching cells. Pure logic, no DOM. KA_FIND.search(query, rows) -> { kind, q, matches, script }
//   kind: "empty" | "exact" (romaji matches a reading) | "prefix" (readings that start with it) | "kana" | "none"
//   matches: [{ h, k, ro, row }] in grid order; script: "hiragana" | "katakana" | null (which tab a typed kana is on)
(function (root) {
  var MAX = 12;
  function clean(s) {
    s = String(s == null ? "" : s).normalize ? String(s == null ? "" : s).normalize("NFC") : String(s == null ? "" : s);
    s = s.trim().toLowerCase().replace(/[āīūēō]/g, function (c) { return { "ā": "a", "ī": "i", "ū": "u", "ē": "e", "ō": "o" }[c]; });
    return s.replace(/[^a-z\u3040-\u30ff]/g, "").slice(0, MAX);
  }
  function isKana(ch) { var c = ch.charCodeAt(0); return c >= 0x3041 && c <= 0x30fa; }
  function each(rows, fn) { rows.forEach(function (row) { row.kana.forEach(function (k) { fn(k, row); }); }); }
  function item(k, row) { return { h: k[0], k: k[1], ro: k[2], row: row.name }; }
  function search(query, rows) {
    var q = clean(query), out = { kind: "empty", q: q, matches: [], script: null };
    if (!q) return out;
    if (isKana(q[0])) { // a kana: find that one (first character only)
      var ch = q[0];
      each(rows, function (k, row) { if (k[0] === ch || k[1] === ch) { out.matches.push(item(k, row)); out.script = k[1] === ch ? "katakana" : "hiragana"; } });
      out.kind = out.matches.length ? "kana" : "none";
      return out;
    }
    q = q.replace(/[^a-z]/g, ""); out.q = q;
    if (!q) { out.kind = "none"; return out; }
    each(rows, function (k, row) { if (k.slice(2).indexOf(q) >= 0) out.matches.push(item(k, row)); });
    if (out.matches.length) { out.kind = "exact"; return out; }
    each(rows, function (k, row) { if (k.slice(2).some(function (r) { return r.indexOf(q) === 0; })) out.matches.push(item(k, row)); });
    out.kind = out.matches.length ? "prefix" : "none";
    return out;
  }
  // 🎲 Surprise me: pick one random kana from the grid you're looking at (hiragana or katakana) to see and hear.
  // Kana you haven't mastered in that script come first, so the dice nudges practice; once they're all mastered any
  // kana can come up. Never the same one twice in a row.
  //   surprise(rows, kanaStats, isMastered, script, last, rand) -> { h, k, ro, row, ch, mastered } or null
  function surprise(rows, stats, isMastered, script, last, rand) {
    rand = rand || Math.random; stats = stats || {}; var kata = script === "katakana", all = [], fresh = [];
    each(rows, function (k, row) {
      var it = item(k, row); it.ch = kata ? k[1] : k[0]; it.mastered = !!(isMastered && isMastered(stats[it.ch]));
      all.push(it); if (!it.mastered) fresh.push(it);
    });
    var base = fresh.length ? fresh : all, pool = base.filter(function (m) { return m.ch !== last; });
    if (!pool.length) pool = base;
    if (!pool.length) return null;
    return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
  }
  var API = { search: search, clean: clean, surprise: surprise, MAX: MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.KA_FIND = API;
})(this);
