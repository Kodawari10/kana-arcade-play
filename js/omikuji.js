/* 🎋 Omikuji: one paper fortune per day with a lucky kana, saved under kanaArcade.omikuji.
   Pure logic (no DOM), so it can be tested on its own. Exposes window.KA_OMIKUJI. */
(function (root) {
  "use strict";
  // Only happy fortunes: this is a cozy game. kana = reading (gets romaji on top), en = meaning.
  var FORTUNES = [
    { id: "daikichi",   jp: "大吉", kana: "だいきち",   en: "Great luck!",          weight: 2 },
    { id: "chuukichi",  jp: "中吉", kana: "ちゅうきち", en: "Good luck",            weight: 3 },
    { id: "shoukichi",  jp: "小吉", kana: "しょうきち", en: "A little luck",        weight: 3 },
    { id: "kichi",      jp: "吉",   kana: "きち",       en: "Luck",                 weight: 3 },
    { id: "suekichi",   jp: "末吉", kana: "すえきち",   en: "Luck is on its way",   weight: 2 }
  ];
  // {k} = the lucky kana, {r} = its romaji
  var TIPS = [
    "Say {k} out loud three times: {r}, {r}, {r}!",
    "Look for {k} in a word today. It's hiding everywhere!",
    "Draw {k} in the air with your finger. Muscle memory is magic.",
    "{k} sounds like \"{r}\". Make up a silly story to remember it!",
    "A small game today beats a long one tomorrow. がんばって!",
    "Missed a kana? That's how it sticks. Tap it to hear it again.",
    "Try the other script today: find the katakana twin of {k}.",
    "Teach {k} to someone. Teaching is the best way to learn!"
  ];
  var CHEERS = ["Good things fall from the sky today ✨", "Your companion feels lucky too!", "The stars say: shoot kana! ☆", "Today is a kana kind of day 🌸"];
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function allKana(rows) { var out = []; rows.forEach(function (r) { r.kana.forEach(function (k) { out.push(k); }); }); return out; }
  // The fortune for a day is fixed (same for the whole day), so drawing twice can't reroll it.
  function draw(key, rows) {
    var total = 0; FORTUNES.forEach(function (f) { total += f.weight; });
    var roll = hash("omikuji:" + key) % total, fortune = FORTUNES[0];
    for (var i = 0, acc = 0; i < FORTUNES.length; i++) { acc += FORTUNES[i].weight; if (roll < acc) { fortune = FORTUNES[i]; break; } }
    var list = allKana(rows), k = list[hash("lucky-kana:" + key) % list.length];
    var fill = function (s) { return s.split("{k}").join(k[0]).split("{r}").join(k[2]); };
    return { date: key, fortune: fortune, kana: k, hira: k[0], kata: k[1], romaji: k[2],
      tip: fill(TIPS[hash("omikuji-tip:" + key) % TIPS.length]), cheer: CHEERS[hash("omikuji-cheer:" + key) % CHEERS.length] };
  }
  // Saved value is { date: "YYYY-MM-DD" } of the day you last drew. Anything else = not drawn.
  function drawnOn(saved, key) { return !!(saved && typeof saved === "object" && saved.date === key); }
  // Is this falling kana today's lucky one? (hiragana and katakana both count)
  function isLucky(ch, today) { return !!(today && ch && (ch === today.hira || ch === today.kata)); }
  root.KA_OMIKUJI = { FORTUNES: FORTUNES, TIPS: TIPS, draw: draw, drawnOn: drawnOn, isLucky: isLucky, MULT: 2 };
})(typeof window !== "undefined" ? window : globalThis);
