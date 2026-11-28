/* 💬 Companion chatter: tap (or press Enter on) your companion on the companion screen and it says a little
   Japanese phrase in a speech bubble, with romaji and meaning, and speaks it in Japanese. Lines rotate and some
   use your own progress (the kana you miss most, how many you've mastered, the next growth stage).
   Pure logic (no DOM, no save keys), so it can be tested on its own. Exposes window.KA_CHAT. */
(function (root) {
  "use strict";
  var RAPID_PATS = 6, RAPID_MS = 4000;
  function hello(hour) {
    if (hour >= 5 && hour < 11) return { jp: "おはよう!", en: "Good morning! Thanks for the pat." };
    if (hour >= 11 && hour < 17) return { jp: "こんにちは!", en: "Hello! Let's learn some kana." };
    return { jp: "こんばんは!", en: "Good evening! One more game?" };
  }
  // the kana you miss most that isn't mastered yet (null if none)
  function weakest(kana, isMastered) {
    var best = null, bw = 0;
    Object.keys(kana || {}).forEach(function (ch) {
      var s = kana[ch]; if (!s || typeof s !== "object") return;
      var w = +s.w || 0;
      if (w > bw && !(isMastered && isMastered(s))) { best = ch; bw = w; }
    });
    return best;
  }
  // ctx: { n (pat number, 0-based), hour, petName, petJp, mastered, nextStage: {name, jp} | null,
  //        weakest: kana | null, romajiOf(kana), rapid (bool) }
  // → { id, jp (Japanese, gets romaji on top), en, speak (what to say out loud), kana (optional) }
  function line(ctx) {
    var n = Math.max(0, ctx.n | 0), ro = ctx.romajiOf || function () { return ""; };
    if (ctx.rapid) return { id: "tickle", jp: "くすぐったい!", en: "Hehe, that tickles!", speak: "くすぐったい" };
    switch (n % 8) {
      case 0: var h = hello(ctx.hour); return { id: "hello", jp: h.jp, en: h.en, speak: h.jp };
      case 1: return { id: "nade", jp: "なでなで", en: "Pat pat! More please 💕", speak: "なでなで" };
      case 2:
        if (ctx.weakest) return { id: "practice", jp: ctx.weakest, kana: ctx.weakest,
          en: "Let's practice " + ctx.weakest + " together. It's \"" + ro(ctx.weakest) + "\"!", speak: ctx.weakest };
        return { id: "ganbatte", jp: "がんばって!", en: "You've got this!", speak: "がんばって" };
      case 3:
        if (ctx.mastered > 0) return { id: "sugoi", jp: "すごい!", en: "Amazing! You've mastered " + ctx.mastered + " kana.", speak: "すごい" };
        return { id: "issho", jp: "いっしょに がんばろう!", en: "Let's do our best together!", speak: "いっしょに がんばろう" };
      case 4: return { id: "daisuki", jp: "だいすき!", en: "I love you!", speak: "だいすき" };
      case 5:
        if (ctx.nextStage) return { id: "grow", jp: "おおきく なりたい!", en: "I want to grow into a " + ctx.nextStage.name + "!", speak: "おおきく なりたい" };
        return { id: "sensei", jp: "せんせい!", en: "We're kana teachers now!", speak: "せんせい" };
      case 6: return { id: "name", jp: ctx.petJp ? "わたし は " + ctx.petJp + "!" : "よろしく!", en: "I'm " + (ctx.petName || "your companion") + ", nice to meet you!", speak: ctx.petJp ? "わたしは " + ctx.petJp : "よろしく" };
      default: return { id: "hungry", jp: "おなか すいた!", en: "I'm hungry... for kana!", speak: "おなか すいた" };
    }
  }
  // pats: array of recent pat times (ms). Returns true when it's a burst of quick pats.
  function isRapid(pats, now) {
    var recent = (pats || []).filter(function (t) { return now - t < RAPID_MS; });
    return recent.length >= RAPID_PATS;
  }
  root.KA_CHAT = { line: line, weakest: weakest, isRapid: isRapid, hello: hello, RAPID_PATS: RAPID_PATS };
})(window);
