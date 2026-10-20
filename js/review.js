// 🔁 Review round: a short game that drops only the kana you miss most (light spaced repetition).
// Pure logic, no save keys: it reads the existing kana stats, and normal answers keep updating mastery.
(function (root) {
  "use strict";
  var MAX = 8, NEED = 2, MAX_NEED = 3;
  function lookup(rows) {
    var out = {};
    (rows || []).forEach(function (r, ri) { r.kana.forEach(function (k) { out[k[0]] = { k: k, row: ri, kata: false }; out[k[1]] = { k: k, row: ri, kata: true }; }); });
    return out;
  }
  // the kana to review: missed at least once and not mastered yet, most-missed first, then lowest accuracy
  function pick(stats, rows, n, isMastered) {
    var info = lookup(rows);
    var list = Object.keys(stats || {}).filter(function (ch) {
      var s = stats[ch]; return info[ch] && s && typeof s === "object" && (+s.w || 0) > 0 && !(isMastered && isMastered(s));
    }).map(function (ch) { var s = stats[ch], c = +s.c || 0, w = +s.w || 0; return { ch: ch, w: w, acc: c / (c + w) }; });
    list.sort(function (a, b) { return b.w - a.w || a.acc - b.acc || (a.ch < b.ch ? -1 : 1); });
    return list.slice(0, n || MAX).map(function (x) {
      var i = info[x.ch]; return { ch: x.ch, romaji: i.k[2], answers: i.k.slice(2), k: i.k, row: i.row, kata: i.kata };
    });
  }
  // a round: each kana must be cleared NEED times; a miss asks for one more (up to MAX_NEED)
  function start(items) {
    var rows = 1;
    var list = (items || []).map(function (it) { rows = Math.max(rows, it.row + 1); return { ch: it.ch, romaji: it.romaji, answers: it.answers.slice(), k: it.k, need: NEED, hits: 0, misses: 0 }; });
    return { items: list, rows: rows, total: list.length * NEED, cleared: 0 };
  }
  function find(round, ch) { return round.items.filter(function (it) { return it.ch === ch; })[0] || null; }
  function hit(round, ch) {
    var it = find(round, ch); if (!it) return false;
    it.hits++; if (it.need > 0) { it.need--; round.cleared++; }
    return it.need === 0;
  }
  function miss(round, ch) {
    var it = find(round, ch); if (!it) return;
    it.misses++; if (it.need < MAX_NEED) { it.need++; round.total++; }
  }
  function left(round) { return round.items.reduce(function (a, it) { return a + it.need; }, 0); }
  function finished(round) { return left(round) === 0; }
  // next kana to drop: one still needed and not already falling, weighted by how many clears it still needs
  function next(round, live, rnd) {
    rnd = rnd || Math.random;
    var cand = round.items.filter(function (it) { return it.need > 0 && !(live && live[it.ch]); });
    if (!cand.length) return null;
    var sum = cand.reduce(function (a, it) { return a + it.need; }, 0), r = rnd() * sum;
    for (var i = 0; i < cand.length; i++) { r -= cand[i].need; if (r < 0) return cand[i]; }
    return cand[cand.length - 1];
  }
  // still tricky after the round: missed in it at least once
  function tricky(round) { return round.items.filter(function (it) { return it.misses > 0; }); }
  var api = { MAX: MAX, NEED: NEED, MAX_NEED: MAX_NEED, pick: pick, start: start, hit: hit, miss: miss, left: left, finished: finished, next: next, tricky: tricky };
  root.KA_REVIEW = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
