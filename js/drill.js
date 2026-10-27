// ⚡ Quick drill: a calm, untimed flashcard round on the kana you just missed (pick the romaji from 4).
// Pure logic (no DOM). A wrong pick shows the answer + a 💡 hint and puts that kana back at the end once.
// Nothing here touches your saved progress.
(function (root) {
  // items: [{ ch, ro }] to drill (deduped, max n). pool: [{ ch, ro, script }] to draw distractors from.
  // look(ch) -> look-alike kana (preferred distractors); roOf(ch) -> romaji. rand: () => [0,1)
  function build(items, pool, opts) {
    opts = opts || {}; var rand = opts.rand || Math.random, n = opts.n || 6, seen = {}, q = [];
    (items || []).forEach(function (it) { if (it && it.ch && it.ro && !seen[it.ch] && q.length < n) { seen[it.ch] = 1; q.push({ ch: it.ch, ro: it.ro }); } });
    return { queue: q, i: 0, total: q.length, first: 0, done: false, retried: {}, pool: pool || [], look: opts.look, roOf: opts.roOf, rand: rand, cur: null };
  }
  function shuffle(a, rand) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function scriptOf(ch) { var c = ch.charCodeAt(0); return c >= 0x30a0 ? "kata" : "hira"; }
  // 4 different romaji: the answer, look-alikes first, then same-script kana from the pool
  function choices(D, it) {
    var out = [it.ro];
    if (D.look && D.roOf) D.look(it.ch).forEach(function (c) { var r = D.roOf(c); if (r && out.indexOf(r) < 0 && out.length < 3) out.push(r); });
    var sc = scriptOf(it.ch), rest = shuffle(D.pool.filter(function (p) { return (p.script || scriptOf(p.ch)) === sc; }).map(function (p) { return p.ro; }), D.rand);
    if (rest.length < 3) rest = rest.concat(shuffle(D.pool.map(function (p) { return p.ro; }), D.rand));
    for (var i = 0; i < rest.length && out.length < 4; i++) if (out.indexOf(rest[i]) < 0) out.push(rest[i]);
    return shuffle(out, D.rand);
  }
  // the current card { ch, ro, choices, n, of, miss } or null when finished
  function card(D) {
    if (D.done || D.i >= D.queue.length) { D.done = true; return null; }
    if (!D.cur || D.cur.idx !== D.i) { var it = D.queue[D.i]; D.cur = { idx: D.i, ch: it.ch, ro: it.ro, choices: choices(D, it), n: Math.min(D.i + 1, D.queue.length), of: D.queue.length, miss: false }; }
    return D.cur;
  }
  // pick a romaji for the current card: { ok, picked, answer, ch, again } (wrong picks stay on the card until right)
  function pick(D, ro) {
    var c = card(D); if (!c) return null;
    if (ro === c.ro) {
      if (!c.miss) D.first++;
      D.i++; if (D.i >= D.queue.length) D.done = true;
      return { ok: true, picked: ro, answer: c.ro, ch: c.ch, firstTry: !c.miss, finished: D.done };
    }
    var again = false;
    if (!c.miss) { c.miss = true; if (!D.retried[c.ch]) { D.retried[c.ch] = 1; D.queue.push({ ch: c.ch, ro: c.ro }); again = true; c.of = D.queue.length; } }
    return { ok: false, picked: ro, answer: c.ro, ch: c.ch, again: again };
  }
  function summary(D) { return { first: D.first, total: D.total, cards: D.queue.length, perfect: D.first === D.queue.length }; }
  var API = { build: build, card: card, pick: pick, summary: summary, choices: choices };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_DRILL = API;
})(this);
