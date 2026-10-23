/* Kana Arcade — falling-kana typing/tapping shooter. Plain JS, no dependencies. */
(function () {
  "use strict";
  var BASE = window.KANA.ROWS, ROWS = window.KANA.ALL || BASE; // ゛ levels 11-15 add the tenten/maru rows; words + omikuji stay on the basic rows
  var KANA_TOTAL = window.KANA.TOTAL || 92;
  var DAKU_OF = {}; // ゛ voiced kana → { base, mark, tip, same } (が → か + ゛), for the companion-screen grid
  (window.KANA.DAKUTEN || []).forEach(function (row) {
    var from = BASE.filter(function (r) { return r.name === row.from; })[0]; if (!from) return;
    row.kana.forEach(function (k, i) { [0, 1].forEach(function (s) {
      var same = { "ぢ": "じ", "づ": "ず", "ヂ": "ジ", "ヅ": "ズ" }[k[s]] || "";
      DAKU_OF[k[s]] = { base: from.kana[i][s], mark: row.mark, tip: row.tip, same: same };
    }); });
  });
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("game"), ctx = canvas.getContext("2d");
  var stage = $("stage"), input = $("input");
  var params = new URLSearchParams(location.search);
  var DEMO = params.get("demo") === "1";
  var isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;

  // ---------- storage ----------
  function load(k, d) { try { var v = localStorage.getItem("kanaArcade." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem("kanaArcade." + k, JSON.stringify(v)); } catch (e) {} }
  var settings = {
    script: params.get("script") || load("script", "hiragana"),
    input: params.get("input") || load("input", isTouch ? "tap" : "type"),
    muted: load("muted", false),
    // 🫧 Gentle mode: slower, calmer play. Bad saved values fall back to off.
    gentle: params.get("gentle") ? params.get("gentle") === "1" : load("gentle", false) === true,
    // 🎵 arcade music (off by default; bad saved values fall back to off)
    music: load("music", false) === true
  };
  var reduceMQ = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  // calm = no shaking, flashing, wobbling or buzzing (Gentle mode, or the device's "reduce motion" setting)
  function calm() { return settings.gentle || !!reduceMQ.matches; }
  // Gentle games keep their own high score so normal records stay fair
  function highKey() { return "high." + settings.script + (settings.gentle ? ".gentle" : ""); }
  var CP = window.COMPANION;
  var progress = CP.normalize(load("progress", null));
  if (params.get("pet")) progress.pet = CP.petById(params.get("pet")).id;
  function saveProgress() { save("progress", progress); }
  // 🏷️ companion nicknames (js/nick.js): { petId: "Mochi" }, on this device only
  var NICK = window.KA_NICK, nicks = NICK ? NICK.sanitize(load("nicks", {}), CP.PETS) : {};
  function nickOf(id) { return nicks[id] || ""; }
  function callName(P) { return nickOf(P.id) || P.name; }
  function escHTML(t) { return NICK ? NICK.escapeHTML(t) : String(t).replace(/[&<>"']/g, ""); }
  // 📅 Together since (js/since.js): { petId: "2026-10-20" | "old" }, the day each companion became yours; on this device only
  var SINCE = window.KA_SINCE, met = SINCE ? SINCE.sanitize(load("met", {}), CP.PETS) : {};
  function stampMet(id) {
    if (!SINCE || met[id]) return;
    met = SINCE.stamp(met, id, (progress.pets[id] && progress.pets[id].xp) > 0); save("met", met);
  }
  function renderSince() {
    var el = $("petSince"); if (!el) return;
    var P = CP.petById(progress.pet), L = SINCE ? SINCE.label(met[P.id], callName(P)) : null;
    if (!L) { el.classList.add("hidden"); return; }
    el.innerHTML = '<span aria-hidden="true">' + L.emoji + "</span> " + escHTML(L.text);
    el.setAttribute("aria-label", L.aria); el.classList.remove("hidden");
    el.classList.toggle("today", L.days === 0); el.classList.toggle("old", L.days === null);
  }
  stampMet(progress.pet);
  function petXP() { return progress.pets[progress.pet].xp; }
  function masteredCount() { return CP.countMastered(progress.kana); }
  function petStage() { return CP.stageFor(petXP(), masteredCount()); }
  function stat(ch) { return progress.kana[ch] || (progress.kana[ch] = { c: 0, w: 0 }); }
  // 📜 daily quest (own save key, so old saves load unchanged)
  var QUEST = window.KA_QUEST;
  function hasMissed() { return Object.keys(progress.kana).some(function (k) { return (progress.kana[k].w || 0) > 0; }); }
  var quest = QUEST.normalize(load("quest", null), QUEST.dayKey(), { hasMissed: hasMissed() });
  save("quest", quest);
  // 🎋 omikuji (own save key { date }): once drawn today, the lucky kana sparkles gold in games for ×2 points
  var OMI = window.KA_OMIKUJI;
  function omikujiToday() { var key = QUEST.dayKey(); return OMI && OMI.drawnOn(load("omikuji", null), key) ? OMI.draw(key, BASE) : null; }
  function questDay() { // a new day while the game is open → a new quest
    var key = QUEST.dayKey();
    if (quest.date !== key) { quest = QUEST.normalize(quest, key, { hasMissed: hasMissed() }); save("quest", quest); }
  }

  // 💬 words (js/words.js; per-word stats in their own save key kanaArcade.words, so old saves load unchanged)
  var KW = window.KA_WORDS;
  var NEAR = window.KA_NEAR; // 🌱 almost mastered kana
  var LOOK = window.KA_LOOK; // 👀 look-alike kana (ぬ/め, シ/ツ…)
  var wordStats = KW ? KW.normalize(load("words", null)) : {};
  function wordStat(jp) { return wordStats[jp] || (wordStats[jp] = { c: 0, w: 0 }); }

  // ---------- audio ----------
  var actx = null, master = null;
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC(); master = actx.createGain(); master.gain.value = 0.25; master.connect(actx.destination);
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(type, f0, f1, dur, vol, delay) {
    if (settings.muted) return; var a = audio(); if (!a) return;
    var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol || 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    if (settings.muted) return; var a = audio(); if (!a) return;
    var n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 1800; s.buffer = b; g.gain.value = vol || 0.6;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  var sfx = {
    shoot: function () { tone("square", 1400, 220, 0.12, 0.35); },
    boom: function (c) { noise(0.3, 0.7); tone("triangle", 300 + Math.min(c, 20) * 40, 80, 0.25, 0.4); },
    miss: function () { tone("sawtooth", 200, 50, 0.45, 0.5); noise(0.2, 0.4); },
    wrong: function () { tone("square", 140, 110, 0.15, 0.3); },
    evolve: function () { [392, 523, 659, 784, 1047, 1319].forEach(function (f, i) { tone("triangle", f, f, 0.18, 0.35, i * 0.11); tone("square", f * 2, f * 2, 0.08, 0.12, i * 0.11 + 0.05); }); },
    master: function () { tone("sine", 1319, 1319, 0.1, 0.3); tone("sine", 1760, 1760, 0.18, 0.3, 0.08); },
    level: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone("square", f, f, 0.12, 0.3, i * 0.09); }); },
    drop: function () { tone("sine", 660, 300, 0.16, 0.22); tone("triangle", 990, 495, 0.12, 0.1, 0.03); },
    snap: function () { noise(0.06, 0.35); tone("sine", 1568, 1568, 0.06, 0.22, 0.05); tone("sine", 2093, 2093, 0.1, 0.2, 0.11); },
    over: function () { [392, 330, 262, 196].forEach(function (f, i) { tone("triangle", f, f * 0.98, 0.25, 0.4, i * 0.2); }); }
  };

  // ---------- canvas sizing ----------
  var W = 400, H = 600, DPR = 1, stars = [];
  function resize() {
    var r = stage.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(200, r.width); H = Math.max(200, r.height);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stars = [];
    for (var i = 0; i < Math.round(W * H / 4000); i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.8 + 0.2 });
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 200); });

  // ---------- game state ----------
  var G = null, state = "title", lastT = 0;
  function groundY() { return H - Math.max(46, H * 0.08); }
  function fontSize() { return Math.max(28, Math.min(64, W / 10, H / 9)); }

  function unlockedRows(level) { return Math.min(level, ROWS.length); }
  function pool() {
    var out = [], n = G.review ? G.review.rows : unlockedRows(G.level); // 🔁 review: look-alikes come from the rows you're reviewing
    for (var r = 0; r < n; r++) ROWS[r].kana.forEach(function (k) { out.push({ k: k, row: r }); });
    return out;
  }
  function charFor(k) {
    var s = settings.script === "both" ? (Math.random() < 0.5 ? "hiragana" : "katakana") : settings.script;
    return s === "katakana" ? k[1] : k[0];
  }

  function newGame(reviewItems) {
    G = {
      level: DEMO ? 3 : 1, score: 0, lives: 5, combo: 0, best: 0, kills: 0, levelKills: 0, shots: 0, hits: 0,
      enemies: [], particles: [], lasers: [], texts: [], spawnT: 0.6, shake: 0, flash: 0,
      banner: null, missed: {}, played: {}, caught: {}, target: null, demoT: 0, demoN: 0,
      pet: { mood: "idle", moodT: 0, say: "", sayT: 0 }, petStage: petStage(), xpGained: 0, newMastered: [], mStart: masteredCount(), evo: null,
      lucky: omikujiToday(), luckyHits: 0, words: 0, wordsCleared: [], missedWords: {}, wordHello: false, review: null, mixups: {}
    };
    if (reviewItems && REV) { // 🔁 a review round: only your trickiest kana, a calm level-2 pace, no words or level-ups
      G.review = REV.start(reviewItems); G.level = 2; G.lucky = null;
    }
    showBanner();
    input.value = ""; input.classList.remove("bad");
  }
  function speed() { // fraction of screen height per second
    var fallTime = Math.max(2.6, 9.5 * Math.pow(0.9, G.level - 1));
    return 1 / (fallTime * (settings.gentle ? 1.5 : 1)); // gentle: kana fall a third slower
  }
  function spawnEvery() { return Math.max(0.55, 2.2 * Math.pow(0.9, G.level - 1)) * (settings.input === "tap" ? 1.15 : 1) * (settings.gentle ? 1.35 : 1); }
  function maxOnScreen() {
    if (settings.gentle) return Math.min(2 + G.level, settings.input === "tap" ? 4 : 6);
    return Math.min(3 + G.level, settings.input === "tap" ? 6 : 10);
  }

  function showBanner() {
    if (G.review) { G.banner = { t: 0, dur: 2.8, title: "🔁 REVIEW", review: G.review.items }; return; }
    var r = unlockedRows(G.level) - 1, newRow = (G.level <= ROWS.length) ? ROWS[r] : null;
    G.banner = { t: 0, dur: newRow ? 2.8 : 1.6, title: "LEVEL " + G.level, row: newRow };
  }

  function wordsOnScreen() { return G.enemies.filter(function (e) { return e.word; }).length; }
  // 💬 maybe drop a word instead of a single kana (from level 3, more often as levels go up)
  function spawnWord(force, jp) {
    if (!KW) return false;
    if (!force && (wordsOnScreen() >= KW.maxOnScreen(G.level, settings.gentle) || Math.random() >= KW.chance(G.level, settings.gentle))) return false;
    var skip = {}; G.enemies.forEach(function (e) { if (e.word) skip[e.word.jp] = 1; });
    var w = jp ? KW.info(jp, BASE) : KW.pick(G.level, settings.script, BASE, progress.kana, wordStats, skip);
    if (!w) return false;
    var fs = fontSize(), wfs = wordFont(), half = wordHalf(w, wfs), x = half + 8 + Math.random() * Math.max(1, W - (half + 8) * 2);
    for (var i = 0; i < 6; i++) {
      var clash = G.enemies.some(function (e) { return e.y < fs * 2 && Math.abs(e.x - x) < half + fs; });
      if (!clash) break; x = half + 8 + Math.random() * Math.max(1, W - (half + 8) * 2);
    }
    G.enemies.push({ word: w, k: [w.jp, w.jp, w.ro], ch: w.jp, answers: w.answers.slice(), x: x, y: -fs * 0.6, wob: Math.random() * 6.28,
      v: speed() * (settings.input === "tap" ? 0.85 : 0.72) * (0.9 + Math.random() * 0.2), dead: false });
    G.words++;
    if (!G.wordHello) { // the first word of the game gets a little hello
      G.wordHello = true;
      G.texts.push({ x: W / 2, y: H * 0.2, s: "💬 WORDS!", c: "#ff8fd9", t: 0, dur: 1.6, big: true });
      petMood("cheer", 1.3, "ことば!");
    }
    return true;
  }
  function wordFont() { return Math.round(fontSize() * 0.72); }
  function wordHalf(w, wfs) { return Math.max(wfs * 1.1, (w.jp.length * wfs * 1.02) / 2 + wfs * 0.4); }
  function spawn() {
    if (G.review) return spawnReview();
    if (G.level >= (KW ? KW.START : 99) && spawnWord(false)) return;
    var p = pool(), newest = unlockedRows(G.level) - 1, pick;
    var live = {}; G.enemies.forEach(function (e) { live[e.k[2]] = 1; });
    for (var tries = 0; tries < 12; tries++) {
      // 45% chance to drill the newest row while it's fresh
      var cand = (G.level <= ROWS.length && Math.random() < 0.45) ? p.filter(function (x) { return x.row === newest; }) : p;
      pick = cand[Math.floor(Math.random() * cand.length)];
      if (!live[pick.k[2]]) break;
    }
    if (G.lucky && Math.random() < 0.12) { // 🎋 the lucky kana drops by a bit more often (once its row is unlocked)
      var lk = p.filter(function (x) { return x.k[2] === G.lucky.romaji; })[0];
      if (lk && !live[lk.k[2]]) pick = lk;
    }
    var fs = fontSize(), margin = fs * 0.8;
    var x = margin + Math.random() * (W - margin * 2);
    // avoid stacking right on top of a recent spawn
    for (var i = 0; i < 6; i++) {
      var clash = G.enemies.some(function (e) { return e.y < fs * 2 && Math.abs(e.x - x) < fs * 1.3; });
      if (!clash) break; x = margin + Math.random() * (W - margin * 2);
    }
    G.enemies.push({ k: pick.k, ch: charFor(pick.k), answers: pick.k.slice(2), x: x, y: -fs * 0.6, wob: Math.random() * 6.28,
      v: speed() * (0.85 + Math.random() * 0.3), dead: false });
  }

  // 🔁 review: drop one of the kana still needed (the exact hiragana or katakana you missed)
  function spawnReview() {
    var live = {}; G.enemies.forEach(function (e) { live[e.ch] = 1; });
    var it = REV.next(G.review, live); if (!it) return;
    var fs = fontSize(), margin = fs * 0.8, x = margin + Math.random() * (W - margin * 2);
    for (var i = 0; i < 6; i++) {
      var clash = G.enemies.some(function (e) { return e.y < fs * 2 && Math.abs(e.x - x) < fs * 1.3; });
      if (!clash) break; x = margin + Math.random() * (W - margin * 2);
    }
    G.enemies.push({ k: it.k, ch: it.ch, answers: it.answers.slice(), x: x, y: -fs * 0.6, wob: Math.random() * 6.28,
      v: speed() * (0.85 + Math.random() * 0.3), dead: false });
  }
  function reviewDone() {
    if (!G || !G.review || G.reviewDone) return;
    G.reviewDone = true; gainXP(REVIEW_XP);
    G.texts.push({ x: W / 2, y: H * 0.3, s: "🔁 REVIEW CLEAR! +" + REVIEW_XP + " XP", c: "#6dffb0", t: 0, dur: 1.6, big: true });
    petMood("cheer", 1.6, "ばっちり!"); sfx.level();
    setTimeout(function () { if (state === "play" && G && G.reviewDone) gameOver(); }, 900);
  }

  function burst(x, y, color, n, power) {
    if (calm()) { n = Math.ceil(n / 3); power *= 0.6; } // a light sprinkle instead of an explosion
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = (Math.random() * 0.8 + 0.2) * power;
      G.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, max: 1, c: color, sz: 2 + Math.random() * 4 });
    }
  }

  function mult() { return Math.min(8, 1 + Math.floor(G.combo / 5)); }

  var CHEERS = ["すごい!", "やった!", "いいね!", "かっこいい!", "さいこう!"];
  function petMood(m, dur, say) {
    G.pet.mood = m; G.pet.moodT = dur;
    if (say) { G.pet.say = say; G.pet.sayT = Math.max(1.1, dur); }
  }
  function gainXP(n) {
    progress.pets[progress.pet].xp += n; G.xpGained += n; checkEvolve();
  }
  function checkEvolve() {
    var st = petStage();
    if (st > G.petStage) {
      G.evo = { t: 0, dur: 3.4, from: G.petStage, to: st, burst: false };
      G.petStage = st; sfx.evolve();
    }
  }
  function recordAnswer(ch, ok) {
    var s0 = stat(ch), was = CP.isMastered(s0);
    if (G && G.played) G.played[ch] = 1;
    if (ok && G && G.caught) G.caught[ch] = (G.caught[ch] || 0) + 1;
    if (ok) s0.c++; else s0.w++;
    var now = CP.isMastered(s0);
    if (now && !was) {
      G.newMastered.push(ch); sfx.master();
      G.texts.push({ x: W / 2, y: H * 0.22, s: "★ MASTERED " + ch + " ★", c: "#ffe94d", t: 0, dur: 1.6, big: true });
      petMood("cheer", 1.4, ch + " ばっちり!");
      progress.pets[progress.pet].xp += 25; G.xpGained += 25;
    }
    saveProgress(); checkEvolve();
  }

  function kill(e) {
    e.dead = true; G.hits++; G.shots++; G.combo++; G.best = Math.max(G.best, G.combo);
    var heightBonus = Math.round(10 * (1 - Math.max(0, e.y) / groundY()));
    var pts = (10 + heightBonus) * G.level * mult();
    var lucky = !e.word && OMI && OMI.isLucky(e.ch, G.lucky);
    if (lucky) { pts *= OMI.MULT; G.luckyHits++; }
    if (e.word) pts *= e.word.kana.length; // 💬 words are worth one kana's points per kana
    G.score += pts; G.kills++; G.levelKills++;
    var sx = W / 2, sy = groundY() + 4;
    G.lasers.push({ x1: sx, y1: sy, x2: e.x, y2: e.y, t: 0.15 });
    var cols = ["#2be8ff", "#ff2bd6", "#ffe94d"];
    burst(e.x, e.y, cols[G.combo % 3], 26, 260 + G.combo * 6);
    burst(e.x, e.y, "#ffffff", 8, 120);
    if (e.word) G.texts.push(wordCard(e, false));
    else G.texts.push({ x: e.x, y: e.y, s: "+" + pts, sub: e.answers[0], c: "#ffe94d", t: 0, dur: 0.9 });
    if (lucky) {
      burst(e.x, e.y, "#ffd36b", 18, 200);
      G.texts.push({ x: e.x, y: e.y - fontSize() * 0.9, s: "✨ LUCKY ×" + OMI.MULT, c: "#ffd36b", t: 0, dur: 1.1 });
    }
    if (G.combo > 0 && G.combo % 5 === 0) G.texts.push({ x: W / 2, y: H * 0.42, s: "COMBO x" + mult() + "!", c: "#ff2bd6", t: 0, dur: 1.1, big: true });
    G.flash = 0.06;
    sfx.shoot(); setTimeout(function () { sfx.boom(G ? G.combo : 0); }, 60);
    G.enemies = G.enemies.filter(function (x) { return x !== e; });
    gainXP(2 + Math.floor(Math.min(G.combo, 20) / 5));
    if (e.word) { petMood("cheer", 1.1, e.word.emoji + " " + e.word.jp + "!"); sayKana(e.word.jp, 120); }
    else if (lucky && G.luckyHits === 1) petMood("cheer", 1.3, "ラッキー!");
    else if (G.combo > 0 && G.combo % 5 === 0) petMood("cheer", 1.2, CHEERS[Math.floor(Math.random() * CHEERS.length)]);
    else if (G.pet.mood !== "cheer") petMood("happy", 0.6, Math.random() < 0.25 ? "♪" : "");
    var practiced = !e.word && !!(progress.kana[e.ch] && progress.kana[e.ch].w > 0);
    if (e.word) { wordStat(e.word.jp).c++; save("words", wordStats); if (G.wordsCleared.indexOf(e.word.jp) < 0) G.wordsCleared.push(e.word.jp); }
    else recordAnswer(e.ch, true);
    if (G.review && !e.word) {
      var got = REV.hit(G.review, e.ch);
      if (got) G.texts.push({ x: e.x, y: e.y - fontSize() * 0.9, s: "✓ " + e.ch + " = " + e.answers[0], c: "#6dffb0", t: 0, dur: 1.1 });
      if (REV.finished(G.review) && !G.enemies.length) reviewDone();
    }
    if (!G.review && G.levelKills >= 8 + G.level) { G.level++; G.levelKills = 0; showBanner(); sfx.level(); gainXP(10); petMood("cheer", 2, "レベルアップ!"); }
    questEvent({ type: "kill", kata: e.word ? e.word.kata : e.ch === e.k[1], practiced: practiced, combo: G.combo, level: G.level });
    refreshTap(true);
  }

  function missGround(e) {
    e.dead = true; G.lives--; G.combo = 0; G.shake = 0.45;
    if (e.word) G.missedWords[e.word.jp] = (G.missedWords[e.word.jp] || 0) + 1;
    else G.missed[e.ch] = (G.missed[e.ch] || 0) + 1;
    burst(e.x, groundY(), "#ff3b5c", 30, 300);
    if (e.word) G.texts.push(wordCard(e, true));
    else G.texts.push({ x: e.x, y: groundY() - fontSize() * 1.4, s: e.ch + " = " + e.answers[0], c: "#ff3b5c", t: 0, dur: 1.8, reveal: true });
    sfx.miss();
    petMood("sad", 1.4, "うぅ…");
    sayKana(e.ch, 380); // hear the one you missed (a whole word for words)

    if (e.word) { wordStat(e.word.jp).w++; save("words", wordStats); }
    else recordAnswer(e.ch, false);
    if (G.review && !e.word) REV.miss(G.review, e.ch); // 🔁 a miss asks for one more clear of that kana
    if (navigator.vibrate && !calm()) try { navigator.vibrate(120); } catch (er) {}
    G.enemies = G.enemies.filter(function (x) { return x !== e; });
    refreshTap(true);
    if (G.lives <= 0) gameOver();
  }

  function wrongAnswer(ch) {
    G.shots++; G.combo = 0; G.shake = Math.max(G.shake, 0.15); sfx.wrong();
    petMood("sad", 0.8, "あれ?");
    if (ch) recordAnswer(ch, false);
  }

  // 💬 a word card: tiny romaji above each kana, the word, and its meaning (shown when cleared or missed)
  function wordCard(e, miss) {
    var w = e.word, units = KR ? KR.units(w.jp) : w.units.map(function (u) { return { jp: u.ch, ro: u.ro }; });
    return { word: true, miss: miss, x: e.x, y: miss ? groundY() - fontSize() * 1.9 : Math.max(fontSize() * 1.6, e.y), jp: w.jp, units: units, en: w.en, emoji: w.emoji,
      c: miss ? "#ff3b5c" : "#ff8fd9", t: 0, dur: miss ? 2.4 : 1.8 };
  }

  // 🔊 hear the kana (js/voice.js; quietly does nothing without speech support or when muted)
  function sayKana(ch, delay) {
    if (settings.muted || !window.KA_VOICE) return;
    if (delay) setTimeout(function () { if (!settings.muted) window.KA_VOICE.speak(ch, { interrupt: false }); }, delay);
    else window.KA_VOICE.speak(ch);
  }
  function romajiOf(ch) {
    for (var r = 0; r < ROWS.length; r++) for (var i = 0; i < ROWS[r].kana.length; i++) { var k = ROWS[r].kana[i]; if (k[0] === ch || k[1] === ch) return k[2]; }
    if (KW && ch && ch.length > 1) { var w = KW.info(ch, BASE); if (w.ok) return w.ro + " (" + w.emoji + " " + w.en + ")"; }
    return "";
  }
  // tap a kana in the grid / practice list: say it out loud and show it big in the speech line
  function hearKana(btn, lineId) {
    var ch = btn.dataset.ch, ro = romajiOf(ch), line = $(lineId);
    btn.classList.remove("hear"); void btn.offsetWidth; btn.classList.add("hear");
    var V = window.KA_VOICE, msg;
    if (!V || !V.supported) msg = "<b lang='ja'>" + ch + "</b> = " + ro + " · your browser can't speak Japanese yet";
    else if (settings.muted) msg = "<b lang='ja'>" + ch + "</b> = " + ro + " · sound is off, tap 🔇 to hear it";
    else { V.speak(ch, { force: true }); msg = "🔊 <b lang='ja'>" + ch + "</b> = " + ro + (V.hasJapaneseVoice ? "" : " · add a Japanese voice in your device settings for the best sound"); }
    if (window.KA_TWIN) msg += window.KA_TWIN.chip(ch, ROWS); // 👯 its hiragana/katakana twin, tap to hear
    if (line) { line.innerHTML = msg; line.classList.remove("hidden"); }
  }
  // 👯 tapping a twin chip says the twin and shows it in the same line (with its own twin to flip back)
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest(".twinBtn[data-ch]"), line = b && b.closest("p[id]");
    if (!b || !line || !line.id) return;
    ev.stopPropagation();
    hearKana(b, line.id);
    var nb = line.querySelector(".twinBtn"); if (nb) nb.focus({ preventScroll: true });
    try { window.dispatchEvent(new CustomEvent("ka:twin", { detail: { ch: b.dataset.ch } })); } catch (e) {}
  }, true);

  // ---------- typing input ----------
  function lowestMatching(str, exact) {
    var best = null;
    G.enemies.forEach(function (e) {
      if (e.dead) return;
      var ok = e.answers.some(function (a) { return exact ? a === str : a.indexOf(str) === 0; });
      if (ok && (!best || e.y > best.y)) best = e;
    });
    return best;
  }
  function isLongerPrefix(str, hit) { // could str still grow into a longer answer on screen? (a word's own "…nn" doesn't count)
    return G.enemies.some(function (e) { return !(hit && hit.word && e === hit) && e.answers.some(function (a) { return a.length > str.length && a.indexOf(str) === 0; }); });
  }
  var swallowN = 0; // after a word ending in ん fires on "n", a second "n" right away is quietly ignored
  function handleTyped() {
    if (state !== "play") return;
    var v = input.value.toLowerCase().replace(/[^a-z]/g, "");
    if (v !== input.value) input.value = v;
    if (!v) return;
    var hit = lowestMatching(v, true);
    if (hit && !isLongerPrefix(v, hit)) { var nEnd = hit.word && /n$/.test(v); kill(hit); input.value = ""; if (nEnd) swallowN = Date.now(); return; }
    if (hit || lowestMatching(v, false)) { input.classList.remove("bad"); return; }
    if (v === "n" && Date.now() - swallowN < 700) { swallowN = 0; input.value = ""; return; }
    // not a prefix of anything: maybe earlier chars completed an answer (e.g. "n" then "k", or "ne" then "ka" while ねこ falls)
    for (var cut = v.length - 1; cut >= 1; cut--) {
      var prev = lowestMatching(v.slice(0, cut), true);
      if (prev) { kill(prev); input.value = v.slice(cut); handleTyped(); return; }
    }
    wrongAnswer(); input.classList.add("bad");
    setTimeout(function () { input.value = ""; input.classList.remove("bad"); }, 220);
  }
  function submitTyped() {
    var v = input.value.toLowerCase(); if (!v || state !== "play") return;
    var hit = lowestMatching(v, true);
    if (hit) kill(hit); else wrongAnswer();
    input.value = "";
  }
  input.addEventListener("input", handleTyped);
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); submitTyped(); }
  });

  // ---------- tap input ----------
  var ansBtns = Array.prototype.slice.call(document.querySelectorAll(".ans"));
  function currentTarget() {
    var t = null;
    G.enemies.forEach(function (e) { if (!e.dead && (!t || e.y > t.y)) t = e; });
    return t;
  }
  function refreshTap(force) {
    if (!G || settings.input !== "tap") return;
    var t = currentTarget();
    if (t === G.target && !force) return;
    if (t === G.target && t) return;
    G.target = t;
    if (!t) { ansBtns.forEach(function (b) { b.textContent = "·"; b.disabled = true; b.dataset.v = ""; }); return; }
    if (t.word) { // 💬 a word: the right romaji plus three look-alikes
      var wo = shuffle([t.answers[0]].concat(KW.distractors(t.word, G.level, settings.script, BASE)));
      ansBtns.forEach(function (b, i) { b.textContent = wo[i]; b.dataset.v = wo[i]; b.disabled = false; b.className = "ans word"; });
      return;
    }
    var correct = t.answers[0], opts = [correct], p = pool().map(function (x) { return x.k[2]; });
    // prefer distractors with same vowel or consonant for a real challenge
    var similar = p.filter(function (r) { return r !== correct && (r.slice(-1) === correct.slice(-1) || r[0] === correct[0]); });
    shuffle(similar);
    // 👀 a look-alike kana in play (ぬ vs め, シ vs ツ) is always one of the choices, so you learn to tell them apart
    if (LOOK) similar = shuffle(LOOK.partners(t.ch).map(romajiOf).filter(function (r) { return r && r !== correct && p.indexOf(r) >= 0; })).slice(0, 2).concat(similar);
    var others = shuffle(p.filter(function (r) { return r !== correct; }));
    similar.concat(others).forEach(function (r) { if (opts.length < 4 && opts.indexOf(r) < 0) opts.push(r); });
    while (opts.length < 4) opts.push(["ka", "mi", "ro", "te", "su"][opts.length]);
    shuffle(opts);
    ansBtns.forEach(function (b, i) { b.textContent = opts[i]; b.dataset.v = opts[i]; b.disabled = false; b.className = "ans"; });
  }
  // 👀 you picked the romaji of a look-alike (め's "me" for ぬ): name the one you picked, but don't give the answer away
  function lookMixup(t, ro) {
    if (!LOOK || !t || t.word) return null;
    var other = LOOK.partnerByRomaji(t.ch, ro, romajiOf); if (!other) return null;
    G.mixups[t.ch] = other;
    G.texts.push({ x: t.x, y: t.y + fontSize() * 1.1, s: "👀 that's " + other + " (" + ro + ")! look again", c: "#ffb36b", t: 0, dur: 1.6, look: true });
    return other;
  }
  function lookHTML(n) {
    return "<b lang='ja'>" + n.a + "</b> <small>" + romajiOf(n.a) + "</small> vs <b lang='ja'>" + n.b + "</b> <small>" + romajiOf(n.b) + "</small>: " + n.tip.replace(/[\u3040-\u30ff]/g, "<b lang='ja'>$&</b>");
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function tapAnswer(b) {
    if (state !== "play" || !G.target || b.disabled) return;
    audio();
    if (G.target.answers.indexOf(b.dataset.v) >= 0) {
      b.classList.add("flash-ok"); kill(G.target);
    } else {
      b.classList.add("flash-bad"); b.disabled = true; wrongAnswer(G.target.word ? null : G.target.ch);
      lookMixup(G.target, b.dataset.v);
      if (navigator.vibrate && !calm()) try { navigator.vibrate(40); } catch (er) {}
    }
  }
  ansBtns.forEach(function (b) {
    b.addEventListener("pointerdown", function (ev) { ev.preventDefault(); tapAnswer(b); });
  });
  // keyboard shortcuts 1-4 for tap mode on desktop
  document.addEventListener("keydown", function (ev) {
    var onBtn = document.activeElement && document.activeElement.tagName === "BUTTON" && document.activeElement.id !== "startBtn";
    if (!$("omikujiScreen").classList.contains("hidden")) { if (ev.key === "Escape") { ev.preventDefault(); closeOmikuji(); } return; }
    if (state === "title" && ev.key === "Enter" && !onBtn && $("petScreen").classList.contains("hidden") && !$("startScreen").classList.contains("hidden")) { ev.preventDefault(); startNormal(); return; }
    if (state === "over" && ev.key === "Enter" && Date.now() - overAt > 600 && $("petScreen").classList.contains("hidden")) { ev.preventDefault(); playAgain(); return; }
    if (ev.key === "Escape" && state === "title" && welcomeOn) { ev.preventDefault(); hideWelcome(true); return; }
    if (ev.key === "Escape") { if (state === "play") pause(); else if (state === "pause") resume(); return; }
    if (state === "play" && settings.input === "tap" && /^[1-4]$/.test(ev.key)) tapAnswer(ansBtns[+ev.key - 1]);
    if (state === "play" && settings.input === "type" && document.activeElement !== input && /^[a-z]$/i.test(ev.key)) {
      input.focus();
    }
  });

  // ---------- update / draw ----------
  function update(dt) {
    if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
    var gy = groundY();
    if (G.pet.moodT > 0) { G.pet.moodT -= dt; if (G.pet.moodT <= 0) G.pet.mood = "idle"; }
    if (G.pet.sayT > 0) G.pet.sayT -= dt;
    if (G.evo) {
      G.evo.t += dt;
      if (!G.evo.burst && G.evo.t > G.evo.dur * 0.62) {
        G.evo.burst = true; G.flash = 0.25;
        burst(W / 2, H * 0.45, "#ffe94d", 50, 420); burst(W / 2, H * 0.45, "#ff8fd9", 40, 300); burst(W / 2, H * 0.45, "#ffffff", 30, 200);
      }
      if (G.evo.t > G.evo.dur) { G.evo = null; petMood("cheer", 2, "ありがとう!"); }
    }
    if (!G.banner && !G.evo) {
      G.spawnT -= dt;
      if (G.spawnT <= 0 && G.enemies.length < maxOnScreen()) { spawn(); G.spawnT = spawnEvery() * (0.75 + Math.random() * 0.5); }
    }
    var slow = G.evo ? 0.05 : (G.banner ? 0.25 : 1);
    G.enemies.slice().forEach(function (e) {
      e.wob += dt * 3; e.y += e.v * H * dt * slow;
      if (e.y + fontSize() * 0.35 >= gy && !e.dead) missGround(e);
    });
    if (G.review && !G.reviewDone && REV.finished(G.review) && !G.enemies.length) reviewDone();
    if (settings.input === "tap") refreshTap(false);
    G.particles = G.particles.filter(function (p) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.vx *= 0.98; return p.life > 0;
    });
    G.lasers = G.lasers.filter(function (l) { l.t -= dt; return l.t > 0; });
    G.texts = G.texts.filter(function (t) { t.t += dt; return t.t < t.dur; });
    G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt);
    stars.forEach(function (s) { s.y += s.z * 30 * dt * (1 + G.level * 0.15); if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    if (DEMO) demoTick(dt);
  }

  function demoTick(dt) { // scripted autoplay used only for screenshots (?demo=1)
    G.demoT += dt;
    var t = currentTarget();
    if (t && t.y > H * 0.45 && G.demoT > 0.5) {
      G.demoT = 0; G.demoN++;
      if (G.demoN % 5 !== 0) { if (settings.input === "tap") { var b = ansBtns.filter(function (b) { return b.dataset.v === t.answers[0]; })[0]; if (b) tapAnswer(b); else kill(t); } else kill(t); }
      else t.v *= 3;
    }
    if (G.lives < 3) G.lives = 3;
  }

  function neonText(s, x, y, size, color, blur) {
    ctx.font = "bold " + size + "px 'Courier New', monospace";
    ctx.shadowColor = color; ctx.shadowBlur = blur || 12; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.shadowBlur = 0;
  }
  var JP_FONT = "'Hiragino Maru Gothic ProN','Hiragino Sans','Yu Gothic','Meiryo','Noto Sans CJK JP','Noto Sans JP','Noto Serif CJK JP',sans-serif";

  function drawBackground(t) {
    var SKY = window.KA_SKY; // 🌌 arcade skies (js/skies.js): the playfield background you picked
    if (SKY && SKY.current) { SKY.draw(ctx, SKY.current(), { W: W, H: H, gy: groundY(), t: t, stars: stars, calm: calm() }); return; }
    ctx.fillStyle = "#07021a"; ctx.fillRect(-20, -20, W + 40, H + 40);
    stars.forEach(function (s) { ctx.fillStyle = "rgba(200,220,255," + (s.z * 0.8) + ")"; ctx.fillRect(s.x, s.y, s.z * 2.5, s.z * 2.5); });
    // perspective grid floor
    var gy = groundY();
    ctx.strokeStyle = "rgba(255,43,214,0.35)"; ctx.lineWidth = 1;
    for (var i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * W * 0.04, gy); ctx.lineTo(W / 2 + i * W * 0.2, H + 4); ctx.stroke(); }
    var off = (t * 40) % 12;
    for (var j = 0; j < 6; j++) { var yy = gy + Math.pow(j + off / 12, 1.6) * 4; if (yy < H) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); } }
    ctx.strokeStyle = "#ff2bd6"; ctx.lineWidth = 3; ctx.shadowColor = "#ff2bd6"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); ctx.shadowBlur = 0;
  }

  // 💬 a falling word: soft pink bubble with a little heart, the word inside (no romaji until it's cleared or missed)
  function drawWord(e, t, gy) {
    var danger = Math.max(0, (e.y / gy - 0.6) / 0.4), still = calm(), x = e.x + (still ? 0 : Math.sin(e.wob) * 3);
    var wfs = wordFont(), half = wordHalf(e.word, wfs), bh = wfs * 0.78, isT = settings.input === "tap" && e === G.target;
    ctx.fillStyle = "rgba(255,143,217," + (0.14 + danger * 0.1) + ")";
    roundRect(x - half, e.y - bh, half * 2, bh * 2, bh * 0.7); ctx.fill();
    ctx.strokeStyle = isT ? "#ffe94d" : (danger > 0.01 ? "#ff6b8a" : "#ff8fd9"); ctx.lineWidth = isT ? 3 : 2.5;
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = isT ? 18 : 12; ctx.stroke(); ctx.shadowBlur = 0;
    // little speech-bubble tail + heart
    ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(x - 6, e.y + bh); ctx.lineTo(x, e.y + bh + 8); ctx.lineTo(x + 6, e.y + bh); ctx.fill();
    ctx.font = Math.round(wfs * 0.42) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.globalAlpha = still ? 1 : 0.75 + 0.25 * Math.sin(t * 4 + e.wob); ctx.fillText("💗", x + half - wfs * 0.1, e.y - bh + wfs * 0.05); ctx.globalAlpha = 1;
    var col = danger > 0.01 ? "rgb(255," + Math.round(233 - 180 * danger) + "," + Math.round(255 - 160 * danger) + ")" : "#fff4fb";
    ctx.font = "bold " + wfs + "px " + JP_FONT; ctx.fillStyle = col; ctx.shadowColor = isT ? "#ffe94d" : "#ff2bd6"; ctx.shadowBlur = 12;
    ctx.fillText(e.word.jp, x, e.y + wfs * 0.04); ctx.shadowBlur = 0;
    if (isT) { ctx.strokeStyle = "#ffe94d"; ctx.lineWidth = 2; var r = still ? 0 : Math.sin(t * 8) * 2;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { var cx = x + c[0] * (half + 7 + r), cy = e.y + c[1] * (bh + 7 + r);
        ctx.beginPath(); ctx.moveTo(cx, cy - c[1] * 10); ctx.lineTo(cx, cy); ctx.lineTo(cx - c[0] * 10, cy); ctx.stroke(); }); }
  }
  // 💬 word card: tiny romaji above each kana (like the home screen), the word, then the meaning
  function drawWordCard(tx, k, fs) {
    var wfs = Math.round(fs * 0.62), rfs = Math.max(11, Math.round(wfs * 0.36)), mfs = Math.max(13, Math.round(wfs * 0.42));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold " + wfs + "px " + JP_FONT;
    var widths = tx.units.map(function (u) { return ctx.measureText(u.jp).width; });
    ctx.font = "bold " + rfs + "px 'Courier New', monospace";
    widths = widths.map(function (wd, i) { return Math.max(wd, tx.units[i].ro === undefined ? 0 : ctx.measureText(tx.units[i].ro).width + 2); });
    var wordW = widths.reduce(function (a, b) { return a + b; }, 0);
    var meaning = tx.emoji + " " + tx.en;
    ctx.font = "bold " + mfs + "px sans-serif"; var mw = ctx.measureText(meaning).width;
    var cw = Math.max(wordW, mw) + 28, ch = rfs + wfs + mfs + 26;
    var rise = tx.miss ? 0 : k * 26, cx = Math.max(cw / 2 + 4, Math.min(W - cw / 2 - 4, tx.x)), top = Math.max(4, tx.y - ch / 2 - rise);
    ctx.fillStyle = tx.miss ? "rgba(40,0,16,0.85)" : "rgba(40,6,40,0.85)"; roundRect(cx - cw / 2, top, cw, ch, 14); ctx.fill();
    ctx.strokeStyle = tx.c; ctx.lineWidth = 2.5; ctx.shadowColor = tx.c; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
    var x0 = cx - wordW / 2, ry = top + 8 + rfs / 2, wy = ry + rfs / 2 + 4 + wfs / 2, my = wy + wfs / 2 + 6 + mfs / 2;
    tx.units.forEach(function (u, i) {
      var mx = x0 + widths[i] / 2;
      if (u.ro !== undefined) { ctx.font = "bold " + rfs + "px 'Courier New', monospace"; ctx.fillStyle = "#2be8ff"; ctx.fillText(u.ro, mx, ry); }
      ctx.font = "bold " + wfs + "px " + JP_FONT; ctx.fillStyle = "#ffffff"; ctx.shadowColor = tx.c; ctx.shadowBlur = 10; ctx.fillText(u.jp, mx, wy); ctx.shadowBlur = 0;
      x0 += widths[i];
    });
    ctx.font = "bold " + mfs + "px sans-serif"; ctx.fillStyle = tx.miss ? "#ffb3c1" : "#ffe94d"; ctx.fillText(meaning, cx, my);
  }

  function drawShip() {
    var x = W / 2, y = groundY() + 6, s = Math.max(10, Math.min(18, W / 40));
    ctx.fillStyle = "#2be8ff"; ctx.shadowColor = "#2be8ff"; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 1.4, y + s * 0.6); ctx.lineTo(x - s * 1.4, y + s * 0.6); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#ffe94d"; ctx.fillRect(x - 3, y - s * 0.6, 6, 6);
  }

  function draw(t) {
    ctx.save();
    if (G && G.shake > 0 && !calm()) { G.shakeFrames = (G.shakeFrames || 0) + 1; var m = G.shake * 22; ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m); }
    drawBackground(t);
    if (!G) { ctx.restore(); return; }
    var fs = fontSize(), gy = groundY();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // danger zone glow
    var grd = ctx.createLinearGradient(0, gy - H * 0.2, 0, gy);
    grd.addColorStop(0, "rgba(255,59,92,0)"); grd.addColorStop(1, "rgba(255,59,92,0.12)");
    ctx.fillStyle = grd; ctx.fillRect(0, gy - H * 0.2, W, H * 0.2);
    // enemies
    G.enemies.forEach(function (e) {
      if (e.word) { drawWord(e, t, gy); return; }
      var danger = Math.max(0, (e.y / gy - 0.6) / 0.4);
      var col = danger > 0.01 ? "rgb(255," + Math.round(233 - 180 * danger) + "," + Math.round(255 - 160 * danger) + ")" : "#ffffff";
      var still = calm(), x = e.x + (still ? 0 : Math.sin(e.wob) * 4);
      var isT = settings.input === "tap" && e === G.target, isL = OMI && OMI.isLucky(e.ch, G.lucky);
      // pixel-style invader box (🎋 lucky kana: warm gold box with little sparkles)
      ctx.strokeStyle = isT ? "#ffe94d" : (isL ? "#ffb347" : "rgba(43,232,255,0.55)"); ctx.lineWidth = isT || isL ? 3 : 2;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = isT || isL ? 18 : 8;
      var b = fs * 0.62; ctx.strokeRect(x - b, e.y - b, b * 2, b * 2); ctx.shadowBlur = 0;
      if (isT) { // target reticle corners
        ctx.strokeStyle = "#ffe94d"; ctx.lineWidth = 2; var r = b + 8 + (still ? 0 : Math.sin(t * 8) * 2);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          ctx.beginPath(); ctx.moveTo(x + c[0] * r, e.y + c[1] * (r - 10)); ctx.lineTo(x + c[0] * r, e.y + c[1] * r); ctx.lineTo(x + c[0] * (r - 10), e.y + c[1] * r); ctx.stroke();
        });
      }
      if (isL) {
        ctx.fillStyle = "rgba(255,179,71,0.16)"; ctx.fillRect(x - b, e.y - b, b * 2, b * 2);
        ctx.font = Math.round(fs * 0.42) + "px sans-serif"; ctx.fillStyle = "#ffd36b";
        var tw = still ? 0 : t * 3;
        ctx.globalAlpha = still ? 0.9 : 0.55 + 0.45 * Math.sin(tw); ctx.fillText("✦", x + b + 2, e.y - b - 2);
        ctx.globalAlpha = still ? 0.9 : 0.55 + 0.45 * Math.sin(tw + 2.1); ctx.fillText("✦", x - b - 2, e.y + b * 0.6);
        ctx.globalAlpha = 1;
      }
      ctx.font = "bold " + fs + "px " + JP_FONT; ctx.fillStyle = isL && danger <= 0.01 ? "#ffe9a8" : col; ctx.shadowColor = isT ? "#ffe94d" : (isL ? "#ffb347" : "#ff2bd6"); ctx.shadowBlur = 14;
      ctx.fillText(e.ch, x, e.y + fs * 0.04); ctx.shadowBlur = 0;
      // thruster
      ctx.fillStyle = "rgba(255,43,214," + (still ? 0.6 : 0.4 + Math.random() * 0.4) + ")"; ctx.fillRect(x - 3, e.y - b - 6 - (still ? 3 : Math.random() * 6), 6, 6);
    });
    // lasers
    G.lasers.forEach(function (l) {
      ctx.strokeStyle = "#2be8ff"; ctx.lineWidth = 2 + l.t * 30; ctx.shadowColor = "#2be8ff"; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); ctx.shadowBlur = 0;
    });
    // particles (square pixels)
    G.particles.forEach(function (p) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.sz, p.sz); });
    ctx.globalAlpha = 1;
    drawShip();
    // floating texts
    G.texts.forEach(function (tx) {
      var k = tx.t / tx.dur; ctx.globalAlpha = 1 - Math.pow(k, 3);
      if (tx.word) {
        drawWordCard(tx, k, fs);
      } else if (tx.reveal) {
        ctx.font = "bold " + Math.round(fs * 0.7) + "px " + JP_FONT; ctx.fillStyle = "rgba(20,0,10,0.75)";
        var w = ctx.measureText(tx.s).width + 24, xx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, tx.x));
        ctx.fillRect(xx - w / 2, tx.y - fs * 0.5, w, fs); ctx.strokeStyle = "#ff3b5c"; ctx.lineWidth = 2; ctx.strokeRect(xx - w / 2, tx.y - fs * 0.5, w, fs);
        ctx.fillStyle = "#ff3b5c"; ctx.shadowColor = "#ff3b5c"; ctx.shadowBlur = 10; ctx.fillText(tx.s, xx, tx.y + 2); ctx.shadowBlur = 0;
      } else if (tx.look) { // 👀 look-alike hint: a small orange pill kept on screen
        ctx.font = "bold " + Math.round(fs * 0.42) + "px " + JP_FONT;
        var lw = ctx.measureText(tx.s).width + 20, lx = Math.max(lw / 2 + 4, Math.min(W - lw / 2 - 4, tx.x)), ly = Math.min(groundY() - fs * 2.2, tx.y);
        ctx.fillStyle = "rgba(30,12,0,0.8)"; ctx.fillRect(lx - lw / 2, ly - fs * 0.33, lw, fs * 0.66);
        ctx.strokeStyle = tx.c; ctx.lineWidth = 2; ctx.strokeRect(lx - lw / 2, ly - fs * 0.33, lw, fs * 0.66);
        ctx.fillStyle = tx.c; ctx.fillText(tx.s, lx, ly + 1);
      } else if (tx.big) {
        neonText(tx.s, tx.x, tx.y - k * 20, Math.round(Math.min(48, W / 10) * (1 + 0.2 * Math.sin(k * 3.14))), tx.c, 20);
      } else {
        neonText(tx.s, tx.x, tx.y - k * 50, Math.round(fs * 0.4), tx.c, 10);
        if (tx.sub) neonText(tx.sub, tx.x, tx.y - k * 50 + fs * 0.42, Math.round(fs * 0.34), "#2be8ff", 8);
      }
      ctx.globalAlpha = 1;
    });
    drawPetCorner(t);
    drawHUD(t);
    if (G.banner && !G.evo) drawBanner();
    if (G.evo) drawEvolution(t);
    if (G.flash > 0 && !calm()) { ctx.fillStyle = "rgba(255,255,255," + G.flash * 2 + ")"; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  function petSize() { return Math.max(84, Math.min(140, Math.min(W, H) * 0.24)); }
  function drawPetCorner(t) {
    if (G.evo) return;
    var s = petSize(), x = s * 0.55 + 6, y = groundY() - 2;
    CP.draw(ctx, progress.pet, G.petStage, x, y, s, G.pet.mood, t);
    if (G.pet.sayT > 0 && G.pet.say) {
      var fsz = Math.round(Math.max(13, s * 0.17));
      ctx.font = "bold " + fsz + "px " + JP_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var w = ctx.measureText(G.pet.say).width + 16, bx = Math.max(w / 2 + 4, x + s * 0.2), by = y - s * 1.05;
      ctx.globalAlpha = Math.min(1, G.pet.sayT * 3);
      ctx.fillStyle = "#fff"; roundRect(bx - w / 2, by - fsz * 0.8, w, fsz * 1.6, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 8, by + fsz * 0.7); ctx.lineTo(bx - 14, by + fsz * 1.3); ctx.lineTo(bx + 2, by + fsz * 0.75); ctx.fill();
      ctx.fillStyle = "#2a1530"; ctx.fillText(G.pet.say, bx, by + 1); ctx.globalAlpha = 1;
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function drawEvolution(t) {
    var e = G.evo, k = e.t / e.dur, P = CP.petById(progress.pet), st = CP.STAGES[e.to];
    ctx.fillStyle = "rgba(7,2,26," + Math.min(0.8, k * 4) + ")"; ctx.fillRect(0, 0, W, H);
    // light rays
    ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.rotate(t * 0.6);
    for (var i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = i % 2 ? "rgba(255,233,77,0.10)" : "rgba(255,43,214,0.10)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -Math.max(W, H)); ctx.lineTo(40, -Math.max(W, H)); ctx.fill(); }
    ctx.restore();
    var s = Math.min(W, H * 0.8) * 0.42, y = H * 0.52 + s * 0.45;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (k < 0.62) { // flicker between old and new silhouettes, faster and faster
      var freq = 2 + k * 30, showNew = Math.sin(e.t * freq * Math.PI) > 0;
      CP.draw(ctx, progress.pet, showNew ? e.to : e.from, W / 2, y, s, "idle", t, { silhouette: showNew ? "#ffffff" : "#ffe94d" });
      neonText("…!?", W / 2, H * 0.15, Math.min(40, W / 10), "#fff", 10);
    } else {
      CP.draw(ctx, progress.pet, e.to, W / 2, y, s, "cheer", t);
      neonText(P.name + " grew up!", W / 2, H * 0.13, Math.min(40, W / 12), "#ffe94d", 16);
      neonText("→ " + st.name.toUpperCase(), W / 2, H * 0.13 + Math.min(44, W / 11), Math.min(30, W / 15), "#ff2bd6", 12);
      ctx.font = "bold " + Math.round(Math.min(30, W / 15)) + "px " + JP_FONT; ctx.fillStyle = "#2be8ff"; ctx.fillText(st.jp, W / 2, H * 0.13 + Math.min(80, W / 6));
    }
  }

  function drawHUD() {
    var sz = Math.max(14, Math.min(22, W / 26));
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    neonText("SCORE " + G.score, 12, 12, sz, "#ffe94d", 8);
    neonText(G.review ? "🔁 REVIEW · " + REV.left(G.review) + " LEFT" : "LV " + G.level, 12, 14 + sz * 1.2, sz * 0.85, G.review ? "#6dffb0" : "#2be8ff", 8);
    var hearts = ""; for (var i = 0; i < 5; i++) hearts += i < G.lives ? "♥" : "·";
    neonText(hearts, 12, 16 + sz * 2.2, sz, "#ff3b5c", 8);
    if (G.combo >= 2) {
      ctx.textAlign = "right";
      neonText(G.combo + " COMBO  x" + mult(), W - 12, 56, sz * 0.9, "#ff2bd6", 10);
    }
    // level progress bar
    var need = 8 + G.level, pw = Math.min(160, W * 0.3), done = G.levelKills / need;
    if (G.review) done = G.review.total ? G.review.cleared / G.review.total : 1;
    ctx.fillStyle = G.review ? "rgba(109,255,176,0.2)" : "rgba(43,232,255,0.2)"; ctx.fillRect(12, 20 + sz * 3.2, pw, 5);
    ctx.fillStyle = G.review ? "#6dffb0" : "#2be8ff"; ctx.fillRect(12, 20 + sz * 3.2, pw * Math.min(1, done), 5);
  }

  function drawBanner() {
    var b = G.banner, k = b.t / b.dur, a = k < 0.15 ? k / 0.15 : (k > 0.85 ? (1 - k) / 0.15 : 1);
    ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(7,2,26,0.7)"; ctx.fillRect(0, H * 0.28, W, H * 0.34);
    neonText(b.title, W / 2, H * 0.34, Math.min(52, W / 8), b.review ? "#6dffb0" : "#ff2bd6", 20);
    if (b.review) { // 🔁 the kana you'll review, each with its romaji
      neonText("YOUR TRICKY KANA · CLEAR EACH " + REV.NEED + "×", W / 2, H * 0.41, Math.min(18, W / 26), "#ffe94d", 8);
      var rn = b.review.length, rw = Math.min(W / (rn + 0.5), 100);
      b.review.forEach(function (it, i) {
        var x = W / 2 + (i - (rn - 1) / 2) * rw;
        ctx.font = "bold " + Math.round(Math.min(44, rw * 0.5)) + "px " + JP_FONT;
        ctx.fillStyle = "#fff"; ctx.shadowColor = "#6dffb0"; ctx.shadowBlur = 12; ctx.fillText(it.ch, x, H * 0.49); ctx.shadowBlur = 0;
        neonText(it.romaji, x, H * 0.565, Math.min(20, rw * 0.28), "#6dffb0", 6);
      });
    } else if (b.row) {
      neonText("NEW KANA: " + b.row.name.toUpperCase(), W / 2, H * 0.41, Math.min(18, W / 24), "#ffe94d", 8);
      if (KW && G.level === KW.START) neonText("💬 + WORDS!", W / 2, H * 0.6, Math.min(18, W / 24), "#ff8fd9", 8);
      if (b.row.mark) neonText("✦ " + (b.row.mark === "゛" ? "TENTEN" : "MARU") + " CHANGES THE SOUND: " + b.row.tip.toUpperCase() + " ✦", W / 2, H * 0.6, Math.min(18, W / 30), "#ff8fd9", 8);
      var n = b.row.kana.length, cw = Math.min(W / (n + 0.5), 110);
      b.row.kana.forEach(function (kk, i) {
        var x = W / 2 + (i - (n - 1) / 2) * cw;
        var ch = settings.script === "katakana" ? kk[1] : (settings.script === "both" ? kk[0] + kk[1] : kk[0]);
        ctx.font = "bold " + Math.round(Math.min(44, cw * (settings.script === "both" ? 0.36 : 0.5))) + "px " + JP_FONT;
        ctx.fillStyle = "#fff"; ctx.shadowColor = "#2be8ff"; ctx.shadowBlur = 12; ctx.fillText(ch, x, H * 0.49); ctx.shadowBlur = 0;
        neonText(kk[2], x, H * 0.565, Math.min(20, cw * 0.28), "#2be8ff", 6);
      });
    } else {
      neonText("FASTER!", W / 2, H * 0.47, Math.min(28, W / 14), "#ffe94d", 10);
    }
    ctx.globalAlpha = 1;
  }

  function loop(ts) {
    var t = ts / 1000, dt = Math.min(0.05, t - (lastT || t)); lastT = t;
    if (state === "play") update(dt);
    else if (G && state !== "pause") { // let particles settle on game-over
      G.particles = G.particles.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; return p.life > 0; });
      G.shake = Math.max(0, G.shake - dt);
    }
    if (!G || state === "title") stars.forEach(function (s) { s.y += s.z * 30 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    draw(t);
    drawDomPets(t);
    requestAnimationFrame(loop);
  }

  // ---------- screens ----------
  function questEvent(ev) {
    questDay();
    var before = quest.prog, cleared = QUEST.advance(quest, ev);
    if (quest.prog !== before || cleared) save("quest", quest);
    if (!cleared) return false;
    if (G) {
      gainXP(QUEST.REWARD); G.questCleared = true;
      G.texts.push({ x: W / 2, y: H * 0.13, s: "📜 QUEST CLEAR! +" + QUEST.REWARD + " XP", c: "#6dffb0", t: 0, dur: 2, big: true });
      if (state === "play") { petMood("cheer", 1.8, "やった! クエスト!"); sfx.level(); }
    } else { progress.pets[progress.pet].xp += QUEST.REWARD; }
    saveProgress();
    showToast("📜 Daily quest complete! +" + QUEST.REWARD + " XP for " + callName(CP.petById(progress.pet)) + (quest.streak > 1 ? " · 🔥 " + quest.streak + "-day streak" : ""));
    return true;
  }
  function renderQuest() {
    questDay();
    var def = QUEST.byId(quest.id), goal = def.goal, prog = quest.done ? goal : quest.prog;
    $("questJp").innerHTML = rubyHTML(def.jp); $("questJp").setAttribute("aria-label", def.jp + ", " + romajiWord(def.jp));
    $("questText").innerHTML = rubyHTML(def.icon + " " + def.text); // any kana in the quest gets its romaji on top too
    $("questFill").style.width = Math.round(100 * prog / goal) + "%";
    $("questProg").textContent = quest.done ? "✓ DONE! +" + QUEST.REWARD + " XP earned" : prog + " / " + goal + " · reward +" + QUEST.REWARD + " XP";
    var bar = $("questBar"); bar.setAttribute("aria-valuemax", goal); bar.setAttribute("aria-valuenow", prog);
    bar.setAttribute("aria-valuetext", quest.done ? "complete" : prog + " of " + goal);
    $("questCard").classList.toggle("done", quest.done);
    $("questStreak").textContent = quest.done
      ? (quest.streak > 1 ? "🔥 " + quest.streak + "-day streak! " : "") + "New quest tomorrow ✨"
      : (quest.streak > 0 ? "🔥 " + quest.streak + "-day streak · finish today to keep it!" : "Finish quests on different days to build a streak 🔥");
  }
  function show(id, on) { $(id).classList.toggle("hidden", !on); }
  function applyInputMode() {
    var tap = settings.input === "tap";
    show("tapBar", tap); show("typeBar", !tap);
    $("modeToggle").textContent = tap ? "👆 TAP" : "⌨ TYPE";
    document.querySelectorAll(".inBtn").forEach(function (b) { b.classList.toggle("on", b.dataset.input === settings.input); });
    $("tips").innerHTML = tap
      ? "Tap the romaji for the kana in the <b style='color:#ffe94d'>yellow target</b> (the lowest one). Keys 1–4 work too. Wrong taps break your combo!"
      : "Just type — kana fire automatically. shi/si, chi/ti, tsu/tu, fu/hu all work. For ん type <b>n</b>. Esc = pause.";
    requestAnimationFrame(resize);
    if (G) { G.target = null; refreshTap(true); }
    if (state === "play" && !tap && !isTouch) input.focus();
  }
  function applyScript() {
    document.querySelectorAll(".modeBtn").forEach(function (b) { b.classList.toggle("on", b.dataset.script === settings.script); });
    $("startHigh").textContent = load(highKey(), 0);
  }
  // ---------- companion UI ----------
  function prepCanvas(c) {
    var sz = +c.dataset.size || 64, d = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== sz * d) { c.width = sz * d; c.height = sz * d; c.style.width = sz + "px"; c.style.height = sz + "px"; }
    var x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, sz, sz); return { x: x, sz: sz };
  }
  var petPokeT = 0, petHearts = [], petPats = 0, petPatTimes = [];
  // 💤 sleepy companion (js/doze.js): quiet companion screen → it dozes off; any input wakes it
  var DOZE = window.KA_DOZE, doze = DOZE ? DOZE.create() : null, wokeAt = 0, dozeCount = 0;
  function petScreenOpen() { return !$("petScreen").classList.contains("hidden"); }
  function dozeOff() {
    var P = CP.petById(progress.pet), L = DOZE.sleepLine(new Date().getHours(), callName(P)), el = $("petSay");
    dozeCount++;
    el.innerHTML = "💤 <b lang='ja'>" + rubyHTML(L.jp) + "</b> " + escHTML(L.en); el.dataset.line = L.id;
    $("bigPet").classList.add("dozing"); $("bigPet").setAttribute("aria-label", "Wake " + P.name + (nickOf(P.id) ? ", nicknamed " + nickOf(P.id) : "") + ", who is dozing");
  }
  function wakeUp() {
    var P = CP.petById(progress.pet), L = DOZE.wakeLine(new Date().getHours(), callName(P)), el = $("petSay");
    wokeAt = Date.now(); petPokeT = calm() ? 0 : 1.0;
    el.innerHTML = "☀️ <b lang='ja'>" + rubyHTML(L.jp) + "</b> " + escHTML(L.en); el.dataset.line = L.id;
    el.classList.remove("pop"); void el.offsetWidth; if (!calm()) el.classList.add("pop");
    $("bigPet").classList.remove("dozing"); $("bigPet").setAttribute("aria-label", "Pet " + P.name + (nickOf(P.id) ? ", nicknamed " + nickOf(P.id) : ""));
    tone("sine", 523, 1047, 0.28, 0.22); tone("triangle", 784, 1568, 0.18, 0.12, 0.16); // soft rising stretch chirp
    var V = window.KA_VOICE; if (V && V.supported && !settings.muted) V.speak(L.speak, { force: true });
  }
  function dozeActivity(ev) {
    if (!doze || !petScreenOpen()) return;
    if (ev && ev.type === "pointermove" && ev.pointerType !== "mouse") return;
    if (doze.poke(performance.now())) wakeUp();
  }
  ["pointerdown", "keydown", "wheel", "pointermove", "touchstart"].forEach(function (n) { document.addEventListener(n, dozeActivity, { capture: true, passive: true }); });
  $("petScreen").addEventListener("scroll", dozeActivity, { capture: true, passive: true });
  function drawDomPets(t) {
    if (!$("startScreen").classList.contains("hidden")) {
      document.querySelectorAll(".petPick canvas").forEach(function (c) {
        var id = c.dataset.pet, p = prepCanvas(c), st = CP.stageFor(progress.pets[id].xp, masteredCount());
        CP.draw(p.x, id, st, p.sz / 2, p.sz * 0.9, p.sz * 0.85, id === progress.pet ? "happy" : "idle", t);
      });
    }
    if (welcomeOn && !$("startScreen").classList.contains("hidden")) {
      var wc = prepCanvas($("welcomePet")), wave = !calm() && (t % 2.4) < 0.9;
      CP.draw(wc.x, progress.pet, petStage(), wc.sz / 2, wc.sz * 0.96, wc.sz * 1.0, wave ? "cheer" : "happy", t);
    }
    if (!$("petScreen").classList.contains("hidden")) {
      var b = prepCanvas($("bigPet")); petPokeT = Math.max(0, petPokeT - 1 / 60);
      if (doze && doze.tick(performance.now())) dozeOff();
      var asleep = doze && doze.isDozing();
      var dancing = danceT > 0 && !asleep;
      if (danceT > 0) { danceT = Math.max(0, danceT - 1 / 60); if (danceT === 0) $("danceBtn").classList.remove("on"); }
      if (dancing) { // 🪩 bop, sway and a little hop (Gentle / reduce motion: still and happy)
        drawLights(b, t);
        var ph = (DANCE_DUR - danceT) * 7.5, mv = calm() ? 0 : 1;
        b.x.save(); b.x.translate(b.sz / 2 + mv * Math.sin(ph) * b.sz * 0.05, b.sz * 0.92 - mv * Math.abs(Math.sin(ph)) * b.sz * 0.07); b.x.rotate(mv * Math.sin(ph) * 0.12);
        CP.draw(b.x, progress.pet, petStage(), 0, 0, b.sz * 0.62, calm() ? "happy" : ((ph % 6.28) < 3.14 ? "cheer" : "happy"), t);
        b.x.restore(); drawDance(b, t);
      } else
      CP.draw(b.x, progress.pet, petStage(), b.sz / 2, b.sz * 0.92, b.sz * 0.62, asleep ? "sleep" : (petPokeT > 0 ? "cheer" : "idle"), t);
      if (asleep) DOZE.zs(t, calm()).forEach(function (z) { // 💤 little floating z's
        b.x.font = "bold " + Math.round(b.sz * 0.11 * z.size) + "px 'Press Start 2P', monospace, sans-serif"; b.x.textAlign = "center"; b.x.globalAlpha = z.alpha;
        b.x.lineWidth = 3; b.x.strokeStyle = "#fff"; b.x.strokeText(z.ch, b.sz * z.x, b.sz * z.y); b.x.fillStyle = "#8a6dff"; b.x.fillText(z.ch, b.sz * z.x, b.sz * z.y); b.x.globalAlpha = 1;
      });
      // 💬 hearts from pats: they float up (in Gentle / reduce motion they just fade where they are)
      petHearts = petHearts.filter(function (h) { h.t -= 1 / 60; return h.t > 0; });
      petHearts.forEach(function (h) {
        var age = 1.2 - h.t, rise = calm() ? 0 : age * 34;
        b.x.font = h.size + "px sans-serif"; b.x.textAlign = "center"; b.x.fillStyle = h.color; b.x.globalAlpha = Math.min(1, h.t);
        b.x.fillText("♥", b.sz / 2 + h.dx + (calm() ? 0 : Math.sin(age * 5 + h.dx) * 4), b.sz * 0.32 - rise); b.x.globalAlpha = 1;
      });
    }
    if (!$("installScreen").classList.contains("hidden")) { // 📲 home screen help: your companion waves along
      var ic = prepCanvas($("installPet")), iw = !calm() && (t % 2.4) < 0.9;
      CP.draw(ic.x, progress.pet, petStage(), ic.sz / 2, ic.sz * 0.94, ic.sz * 0.8, iw ? "cheer" : "happy", t);
    }
    if (!$("overScreen").classList.contains("hidden")) {
      var o = prepCanvas($("overPet"));
      CP.draw(o.x, progress.pet, petStage(), o.sz / 2, o.sz * 0.92, o.sz * 0.7, overPetMood, t);
    }
  }
  function buildPicker() {
    var box = $("petPicker"); box.innerHTML = "";
    CP.PETS.forEach(function (P) {
      var b = document.createElement("button"); b.className = "petPick" + (P.id === progress.pet ? " on" : "");
      var st = CP.STAGES[CP.stageFor(progress.pets[P.id].xp, masteredCount())];
      b.innerHTML = '<canvas data-size="64" data-pet="' + P.id + '"></canvas>' + P.name + (nickOf(P.id) ? '<em class="nickTag">\u201c' + escHTML(nickOf(P.id)) + '\u201d</em>' : "") + '<small><span lang="ja" aria-label="' + P.jp + ", " + romajiWord(P.jp) + '">' + rubyHTML(P.jp) + "</span> · " + st.name + "</small>";
      b.addEventListener("click", function () { progress.pet = P.id; saveProgress(); stampMet(P.id); buildPicker(); });
      box.appendChild(b);
    });
  }
  var gridScript = "hiragana";
  function openPetScreen() {
    var P = CP.petById(progress.pet), si = petStage(), st = CP.STAGES[si], nx = CP.STAGES[si + 1], xp = petXP(), m = masteredCount();
    $("petName").textContent = P.name + " · " + P.jp;
    $("petStage").textContent = "Stage " + (si + 1) + "/5: " + st.name + " · " + st.jp;
    if (nx) {
      var pct = Math.min(1, (xp - st.xp) / (nx.xp - st.xp)) * 0.5 + Math.min(1, nx.mastered ? (m / nx.mastered) : 1) * 0.5;
      $("xpFill").style.width = Math.round(pct * 100) + "%";
      $("xpText").textContent = xp + " / " + nx.xp + " XP";
      $("petNext").innerHTML = "Next: <b>" + nx.name + " (" + nx.jp + ")</b> needs " + nx.xp + " XP" + (nx.mastered ? " and <b>" + nx.mastered + " kana mastered</b> (you have " + m + ")" : "") + ".";
    } else {
      $("xpFill").style.width = "100%"; $("xpText").textContent = xp + " XP · MAX"; $("petNext").textContent = "Fully grown! A true kana sensei. 先生!";
    }
    var cl = costumeLine(); $("petCostume").textContent = cl; show("petCostume", !!cl);
    if ($("findInput")) $("findInput").value = ""; findRes = null; // 🔍 the search starts empty each time
    buildGrid(); applyFind(false); $("gridSay").innerHTML = "🔊 Tap any kana to hear it in Japanese";
    $("bigPet").setAttribute("aria-label", "Pet " + P.name + (nickOf(P.id) ? ", nicknamed " + nickOf(P.id) : "")); $("petSay").innerHTML = "💬 Tap " + escHTML(callName(P)) + " to chat! <span lang='ja'>" + rubyHTML("なでなで") + "</span>"; $("petSay").dataset.line = "";
    closeNick(false); renderNick(); stampMet(P.id); renderSince();
    if (doze) doze.reset(performance.now()); $("bigPet").classList.remove("dozing");
    danceT = 0; danceBits = []; $("danceBtn").classList.remove("on");
    show("startScreen", false); show("overScreen", false); show("petScreen", true);
  }
  function buildGrid() {
    var g = $("kanaGrid"), html = "", n = 0, tot = 0, near = 0, dn = 0, dt = 0, dhtml = "";
    document.querySelectorAll(".gridTab").forEach(function (b) { b.classList.toggle("on", b.dataset.script === gridScript); });
    ROWS.forEach(function (row) {
      var isD = !!row.mark, rh = ""; // ゛ tenten/maru rows go in their own little grid below
      var cells = row.kana.slice();
      if (row.name === "ya-row") cells = [cells[0], null, cells[1], null, cells[2]];
      if (row.name === "wa-row") cells = [cells[0], null, null, cells[1], cells[2]];
      cells.forEach(function (k) {
        if (!k) { rh += '<div class="kc blank" aria-hidden="true"></div>'; return; }
        var ch = gridScript === "katakana" ? k[1] : k[0], s0 = progress.kana[ch], ms = CP.isMastered(s0);
        if (isD) { dt++; if (ms) dn++; } else { tot++; if (ms) n++; }
        var nd = NEAR && !ms ? NEAR.need(s0, CP.MASTER_CORRECT, CP.MASTER_ACC) : Infinity, nr = nd >= 1 && nd <= (NEAR ? NEAR.NEAR : 0); if (nr) near++;
        var cls = ms ? "kc mastered" : (s0 ? "kc seen" + (nr ? " near" : "") : "kc"), pr = s0 ? Math.min(1, s0.c / CP.MASTER_CORRECT) : 0;
        var tip = s0 ? (s0.c + " correct, " + s0.w + " missed") : "not seen yet";
        var label = ch + ", " + k[2] + (isD ? ", " + (row.mark === "゛" ? "tenten" : "maru") + " " + row.tip.replace("→", "to") : "") + (ms ? ", mastered" : "") + (nr ? ", almost mastered: " + NEAR.needText(nd) : "") + ", " + tip + ". Tap to hear it.";
        rh += '<button type="button" class="' + cls + '" data-ch="' + ch + '"' + (nr ? ' data-need="' + nd + '"' : "") + ' title="' + tip + (nr ? " · 🌱 " + NEAR.needText(nd) + " to master" : "") + ' · tap to hear" aria-label="' + label + '"><i aria-hidden="true">' + k[2] + '</i><b lang="ja">' + ch + '</b>' + (nr ? '<span class="sprout" aria-hidden="true">🌱</span>' : "") + (s0 && !ms ? '<span class="pb"><span style="width:' + Math.round(pr * 100) + '%"></span></span>' : "") + "</button>";
      });
      if (isD) dhtml += rh; else html += rh;
    });
    g.innerHTML = html;
    $("dakuGrid").innerHTML = dhtml;
    if (typeof markFind === "function" && findRes) markFind();
    $("dakuCount").textContent = dn + " / " + dt + " mastered · unlocked from level 11";
    $("masteryCount").textContent = (gridScript === "katakana" ? "Katakana" : "Hiragana") + " mastered: " + n + " / " + tot + "  ·  total mastered: " + masteredCount() + " / " + KANA_TOTAL + (near ? "  ·  🌱 " + near + " almost there" : "");
  }
  // 🔍 Find a kana (js/find.js): type romaji or a kana and the matching cells light up, the rest dim
  var FIND = window.KA_FIND, findRes = null;
  function markFind() {
    var r = findRes, on = !!(r && r.kind !== "empty"), want = {};
    if (r) r.matches.forEach(function (m) { want[gridScript === "katakana" ? m.k : m.h] = 1; });
    document.querySelectorAll("#kanaGrid .kc[data-ch], #dakuGrid .kc[data-ch]").forEach(function (b) { b.classList.toggle("found", !!want[b.dataset.ch]); });
    $("petScreen").classList.toggle("finding", on);
  }
  function findText(r) {
    var cur = function (m) { return gridScript === "katakana" ? m.k : m.h; }, list = function (ms) { return ms.map(function (m) { return "<b lang='ja'>" + cur(m) + "</b> " + m.ro; }).join(", "); };
    var q = escHTML(r.q), n = r.matches.length;
    if (r.kind === "none") return "🤔 No kana reads “" + q + "” yet. Try <b>ka</b>, <b>shi</b> or <b>tsu</b>!";
    if (n === 1) { var m = r.matches[0]; return "🔍 <b lang='ja'>" + m.h + "</b> <b lang='ja'>" + m.k + "</b> = " + m.ro + " · press Enter or tap it to hear it"; }
    if (r.kind === "prefix") return "🔍 " + n + " kana start with “" + q + "”: " + list(r.matches);
    return "🔍 " + n + " kana read “" + q + "”: " + list(r.matches) + " · they sound the same!";
  }
  function applyFind(scroll) {
    var inp = $("findInput"); if (!inp || !FIND) return null;
    var r = FIND.search(inp.value, ROWS); findRes = r;
    if (r.script && r.script !== gridScript) { gridScript = r.script; buildGrid(); } // typed a katakana: show the katakana grid
    markFind();
    var say = $("findSay"), on = r.kind !== "empty";
    say.innerHTML = on ? findText(r) : ""; show("findSay", on); show("findClear", !!inp.value);
    var found = document.querySelectorAll("#kanaGrid .kc.found, #dakuGrid .kc.found"), first = found[0], last = found[found.length - 1];
    if (scroll && first && first.scrollIntoView) { // bring the whole match group into view, the first one wins
      if (last !== first) last.scrollIntoView({ block: "nearest" });
      first.scrollIntoView({ block: "nearest", behavior: calm() || last !== first ? "auto" : "smooth" });
    }
    window.dispatchEvent(new CustomEvent("ka:findkana", { detail: { q: r.q, kind: r.kind, found: r.matches.map(function (m) { return m.h; }) } }));
    return r;
  }
  // 🎲 Surprise me: a random kana from the grid on screen (not-yet-mastered first) lights up, explains itself and is said aloud
  var lastSurprise = null;
  function surpriseKana(rand) {
    if (!FIND || !FIND.surprise) return null;
    var m = FIND.surprise(ROWS, progress.kana, CP.isMastered, gridScript, lastSurprise, rand); if (!m) return null;
    lastSurprise = m.ch; $("findInput").value = m.ch;
    var r = applyFind(true), d = $("findDice");
    if (r) $("findSay").innerHTML = "🎲 Surprise! <b lang='ja'>" + m.h + "</b> <b lang='ja'>" + m.k + "</b> = " + m.ro + (m.mastered ? " · ★ you know this one!" : " · tap 🎲 again for another");
    if (d && !calm()) { d.classList.remove("roll"); void d.offsetWidth; d.classList.add("roll"); }
    var b = document.querySelector('#kanaGrid .kc.found, #dakuGrid .kc.found'); if (b) gridClick({ target: b });
    window.dispatchEvent(new CustomEvent("ka:surprise", { detail: { ch: m.ch, h: m.h, k: m.k, ro: m.ro, mastered: m.mastered, script: gridScript } }));
    return { ch: m.ch, h: m.h, k: m.k, ro: m.ro, mastered: m.mastered, script: gridScript };
  }
  function clearFind(focus) { var inp = $("findInput"); inp.value = ""; applyFind(false); if (focus) inp.focus(); }
  if ($("findInput")) {
    $("findInput").addEventListener("input", function () { applyFind(true); });
    // typing a search never triggers game shortcuts; Enter hears the first match, Esc clears
    $("findInput").addEventListener("keydown", function (ev) {
      ev.stopPropagation();
      if (ev.key === "Escape") { ev.preventDefault(); if ($("findInput").value) clearFind(true); else $("findInput").blur(); }
      else if (ev.key === "Enter") { ev.preventDefault(); var b = document.querySelector("#kanaGrid .kc.found, #dakuGrid .kc.found"); if (b) gridClick({ target: b }); }
    });
    $("findClear").addEventListener("click", function () { clearFind(true); });
    if ($("findDice")) $("findDice").addEventListener("click", function () { surpriseKana(); });
    document.addEventListener("keydown", function (ev) { // "/" jumps to the search box on the companion screen
      if (ev.key !== "/" || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey || $("petScreen").classList.contains("hidden")) return;
      var t = ev.target, tag = t && t.tagName; if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
      if (window.KA_KEYS && window.KA_KEYS.isOpen()) return;
      ev.preventDefault(); $("findInput").focus();
    });
  }
  $("petBtn").addEventListener("click", openPetScreen);
  $("overPetBtn").addEventListener("click", openPetScreen);
  $("petBack").addEventListener("click", function () { show("petScreen", false); toTitle(); });
  function gridClick(ev) {
    var b = ev.target.closest && ev.target.closest(".kc[data-ch]"); if (!b) return;
    hearKana(b, "gridSay");
    var nd = +b.dataset.need; // 🌱 almost mastered: say how close it is
    if (nd && NEAR) $("gridSay").innerHTML += " · 🌱 " + NEAR.needText(nd) + " to master it!";
    var lp = LOOK ? LOOK.partners(b.dataset.ch) : []; // 👀 looks like…
    if (lp.length) $("gridSay").innerHTML += "<span class='lookNote'> · 👀 looks like " + lp.map(function (c) { return "<b lang='ja'>" + c + "</b> (" + romajiOf(c) + ")"; }).join(", ") + ". " + LOOK.tipFor(b.dataset.ch, lp[0]).replace(/[\u3040-\u30ff]/g, "<b lang='ja'>$&</b>") + "</span>";
    var dk = DAKU_OF[b.dataset.ch]; // ゛ how it's built from the plain kana
    if (dk) $("gridSay").innerHTML += "<span class='dakuNote'> · <b lang='ja'>" + b.dataset.ch + "</b> = <b lang='ja'>" + dk.base + "</b> + " + dk.mark + " (" + dk.tip + ")" + (dk.same ? ", sounds like <b lang='ja'>" + dk.same + "</b>" : "") + "</span>";
  }
  $("kanaGrid").addEventListener("click", gridClick);
  $("dakuGrid").addEventListener("click", gridClick);
  $("toPractice").addEventListener("click", function (ev) { var b = ev.target.closest && ev.target.closest(".pk[data-ch]"); if (b) hearKana(b, "practiceSay"); });
  // 💬 Companion chatter: each pat gets a heart and a little Japanese line (romaji on top + meaning), spoken aloud
  function petChat() {
    var C = window.KA_CHAT, P = CP.petById(progress.pet), si = petStage(), now = Date.now();
    if (now - wokeAt < 350) return; // 💤 this tap just woke them up: keep the "good morning" line
    petPokeT = 1.2; audio(); sfx.master();
    var cols = ["#ff6b9a", "#ff8fb8", "#ffb3d1", "#ff4f8b"];
    petHearts.push({ t: 1.2, dx: petHearts.length ? Math.round((Math.random() - 0.5) * 120) : 50, size: 20 + Math.round(Math.random() * 12), color: cols[petPats % cols.length] });
    if (petHearts.length > 12) petHearts.shift();
    if (!C) return;
    petPatTimes.push(now); petPatTimes = petPatTimes.filter(function (t) { return now - t < 4000; });
    var rapid = C.isRapid(petPatTimes, now);
    var L = C.line({ n: petPats, hour: new Date().getHours(), petName: P.name, petJp: P.jp, mastered: masteredCount(),
      nextStage: CP.STAGES[si + 1] || null, weakest: C.weakest(progress.kana, CP.isMastered), romajiOf: romajiOf, rapid: rapid });
    if (rapid) petPatTimes = []; else petPats++;
    var el = $("petSay");
    el.innerHTML = "<b lang='ja'>" + rubyHTML(L.jp) + "</b> " + escHTML(L.en);
    el.dataset.line = L.id;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    var V = window.KA_VOICE; if (V && V.supported && !settings.muted) V.speak(L.speak, { force: true });
  }
  // 🪩 Dance party: your companion bops along, music notes, hearts and kana you've mastered float up, soft party
  // lights glow and a bouncy tune plays. Gentle mode / reduced motion: it stays still with a few soft fading notes.
  // Nothing is saved.
  var DANCE_DUR = 4.2, danceT = 0, danceBits = [], danceCount = 0;
  function dance() {
    if (!petScreenOpen()) return false;
    var P = CP.petById(progress.pet), el = $("petSay"), b = $("bigPet");
    if (doze) { doze.poke(performance.now()); b.classList.remove("dozing"); b.setAttribute("aria-label", "Pet " + P.name + (nickOf(P.id) ? ", nicknamed " + nickOf(P.id) : "")); }
    var mk = Object.keys(progress.kana || {}).filter(function (ch) { return CP.isMastered(progress.kana[ch]); });
    for (var i = mk.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), tmp = mk[i]; mk[i] = mk[j]; mk[j] = tmp; }
    var kana = mk.slice(0, 3), syms = ["♪", "♫", "♥", "♪", "♫"], cols = ["#ff2bd6", "#2be8ff", "#ffe14d", "#8aff6d", "#ff8fb8"], items = syms.concat(kana);
    if (calm()) items = ["♪", "♫"].concat(kana.slice(0, 1));
    danceBits = items.map(function (ch, k) { return { ch: ch, kana: kana.indexOf(ch) >= 0, dx: (k % 2 ? 1 : -1) * (18 + (k * 23) % 62), delay: calm() ? k * 0.5 : k * 0.38, color: cols[k % cols.length] }; });
    danceT = DANCE_DUR; danceCount++; petPokeT = 0;
    $("danceBtn").classList.add("on");
    var who = escHTML(callName(P));
    el.innerHTML = "🪩 <b lang='ja'>" + rubyHTML("おどろう!") + "</b> Let's dance! " + who + " is dancing" + (kana.length ? " with kana you mastered: <span lang='ja'>" + kana.join(" ") + "</span>" : "") + "!";
    el.dataset.line = "dance";
    el.classList.remove("pop"); void el.offsetWidth; if (!calm()) el.classList.add("pop");
    var notes = [523, 659, 784, 659, 880, 784, 1047, 1319];
    notes.forEach(function (f, k) {
      if (calm()) { if (k % 2 === 0) tone("sine", f, f, 0.22, 0.12, k * 0.2); return; }
      tone("triangle", f, f, 0.14, 0.28, k * 0.16); if (k % 2 === 0) tone("square", f / 4, f / 4, 0.1, 0.12, k * 0.16);
    });
    var V = window.KA_VOICE; if (V && V.supported && !settings.muted) setTimeout(function () { if (!settings.muted) V.speak("おどろう", { force: true }); }, 1400);
    try { window.dispatchEvent(new CustomEvent("ka:dance", { detail: { pet: P.id, kana: kana.slice() } })); } catch (e) {}
    return true;
  }
  function drawDance(b, t) {
    var age = DANCE_DUR - danceT, x = b.x, sz = b.sz;
    danceBits.forEach(function (d) {
      var a = age - d.delay; if (a < 0 || a > 2.2) return;
      var alpha = a < 0.25 ? a / 0.25 : (a > 1.7 ? (2.2 - a) / 0.5 : 1), rise = calm() ? 0 : a * 42, wob = calm() ? 0 : Math.sin(a * 6 + d.dx) * 6;
      x.globalAlpha = Math.max(0, Math.min(1, alpha)); x.textAlign = "center";
      x.font = (d.kana ? "bold " + Math.round(sz * 0.13) + "px sans-serif" : Math.round(sz * 0.12) + "px sans-serif");
      x.lineWidth = 3; x.strokeStyle = "#fff"; x.strokeText(d.ch, sz / 2 + d.dx + wob, sz * 0.36 - rise);
      x.fillStyle = d.color; x.fillText(d.ch, sz / 2 + d.dx + wob, sz * 0.36 - rise); x.globalAlpha = 1;
    });
  }
  function drawLights(b, t) {
    if (calm()) return;
    var x = b.x, sz = b.sz, cols = ["#ff2bd6", "#2be8ff", "#ffe14d"];
    cols.forEach(function (c, i) {
      var ang = t * 2.2 + i * 2.09, cx = sz / 2 + Math.cos(ang) * sz * 0.28, cy = sz * 0.55 + Math.sin(ang) * sz * 0.16;
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.32); g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
      x.globalAlpha = 0.28 * Math.min(1, danceT / 0.5); x.fillStyle = g; x.fillRect(0, 0, sz, sz); x.globalAlpha = 1;
    });
  }
  $("danceBtn").addEventListener("click", function () { dance(); });
  $("bigPet").addEventListener("pointerdown", petChat);
  $("bigPet").addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); petChat(); } });
  // 🏷️ nickname pill + little edit box under the companion's name
  function renderNick() {
    var P = CP.petById(progress.pet), n = nickOf(P.id), b = $("nickBtn");
    b.textContent = n ? "🏷️ \u201c" + n + "\u201d ✎" : "🏷️ Give a nickname";
    b.classList.toggle("has", !!n);
    b.setAttribute("aria-label", n ? P.name + "'s nickname: " + n + ". Change nickname" : "Give " + P.name + " a nickname");
    $("nickLabel").textContent = "Nickname for " + P.name + " (up to " + (NICK ? NICK.MAX : 16) + " letters, empty removes it)";
  }
  function nickCount() { var v = $("nickInput").value; $("nickCount").textContent = (NICK ? NICK.length(v) : v.length) + "/" + (NICK ? NICK.MAX : 16); }
  function openNick() {
    var P = CP.petById(progress.pet), inp = $("nickInput");
    inp.value = nickOf(P.id); inp.placeholder = P.id === "kitsune" ? "e.g. Fluffy" : P.id === "ryu" ? "e.g. Mochi" : "e.g. Momo";
    nickCount(); show("nickBtn", false); $("nickForm").classList.remove("hidden");
    inp.focus(); try { inp.setSelectionRange(0, inp.value.length); } catch (e) {}
  }
  function closeNick(focusBtn) {
    if ($("nickForm").classList.contains("hidden")) return;
    $("nickForm").classList.add("hidden"); show("nickBtn", true);
    if (focusBtn) $("nickBtn").focus();
  }
  function setNick(id, name) {
    var P = CP.petById(id);
    if (!NICK || P.id !== id) return "";
    nicks = NICK.set(nicks, P, name); save("nicks", nicks);
    return nickOf(id);
  }
  function saveNick() {
    var P = CP.petById(progress.pet), before = nickOf(P.id), n = setNick(P.id, $("nickInput").value), el = $("petSay");
    closeNick(true); renderNick(); renderSince();
    $("bigPet").setAttribute("aria-label", "Pet " + P.name + (n ? ", nicknamed " + n : ""));
    if (n && n !== before) {
      el.innerHTML = "<b lang='ja'>" + rubyHTML("うれしい!") + "</b> " + escHTML(P.name) + " loves being called <b class='nickSay'>\u201c" + escHTML(n) + "\u201d</b> 💕";
      petPokeT = 1.2; petMoodBurst();
      if (!calm()) { var b = $("nickBtn"); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
      var V = window.KA_VOICE; if (V && V.supported && !settings.muted) V.speak("うれしい", { force: true });
    } else if (!n && before) {
      el.innerHTML = "🏷️ OK! Back to plain <b>" + escHTML(P.name) + "</b>.";
    } else return;
    el.dataset.line = "nick"; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  }
  function petMoodBurst() { petHearts.push({ t: 1.2, dx: 0, size: 28, color: "#ff8fb8" }); if (petHearts.length > 12) petHearts.shift(); }
  $("nickBtn").addEventListener("click", openNick);
  $("nickCancel").addEventListener("click", function () { closeNick(true); });
  $("nickForm").addEventListener("submit", function (ev) { ev.preventDefault(); saveNick(); });
  $("nickInput").addEventListener("input", function () {
    var inp = $("nickInput");
    if (NICK && NICK.length(inp.value) > NICK.MAX) inp.value = Array.from(inp.value).slice(0, NICK.MAX).join("");
    nickCount();
  });
  // typing a name never triggers game shortcuts; Esc just cancels the edit
  $("nickInput").addEventListener("keydown", function (ev) {
    ev.stopPropagation();
    if (ev.key === "Escape") { ev.preventDefault(); closeNick(true); }
  });
  document.querySelectorAll(".gridTab").forEach(function (b) { b.addEventListener("click", function () { gridScript = b.dataset.script; buildGrid(); if (findRes && findRes.kind !== "empty") { $("findSay").innerHTML = findText(findRes); markFind(); } }); });
  // 📸 Save sticker (js/sticker.js): a picture card of your companion, shared on phones / downloaded on laptops
  function masteredList() {
    var out = [];
    [0, 1].forEach(function (s) { ROWS.forEach(function (row) { row.kana.forEach(function (k) { if (CP.isMastered(progress.kana[k[s]])) out.push(k[s]); }); }); });
    return out;
  }
  function stickerInfo() {
    var P = CP.petById(progress.pet), si = petStage(), st = CP.STAGES[si], ks = masteredList();
    return { petId: P.id, name: P.name, nick: nickOf(P.id), jp: P.jp, ro: romajiWord(P.jp), stage: si, stageName: st.name, stageJp: st.jp, mastered: ks.length, total: KANA_TOTAL, kana: ks, date: new Date() };
  }
  var stickerBusy = false;
  function saveSticker(opts) {
    var S = window.KA_STICKER; opts = opts || {};
    if (!S || stickerBusy) return Promise.resolve(null);
    stickerBusy = true;
    var info = stickerInfo(), c = S.make(info), name = S.fileName(info.name, info.date);
    audio(); sfx.snap();
    var bp = $("bigPet"); if (!calm()) { bp.classList.remove("flash"); void bp.offsetWidth; bp.classList.add("flash"); }
    petPokeT = 1.2;
    var done = opts.dryRun ? Promise.resolve("dry") : S.save(c, name);
    return done.then(function (how) {
      stickerBusy = false;
      if (how !== "cancelled") {
        showToast("📸 Saved " + info.name + "'s sticker!");
        $("stickerSay").textContent = "Saved a sticker of " + info.name + ", stage " + (info.stage + 1) + ", " + info.mastered + " kana mastered.";
      }
      return { how: how, name: name, canvas: c, info: info };
    }, function () { stickerBusy = false; return null; });
  }
  $("stickerBtn").addEventListener("click", function () { saveSticker(); });
  // 📸 Group photo (js/sticker.js makeGroup): all your companions together; ones you haven't played with are "?" silhouettes
  function groupInfo() {
    var mc = masteredCount();
    var friends = CP.PETS.map(function (P) {
      var xp = (progress.pets[P.id] && progress.pets[P.id].xp) || 0, si = CP.stageFor(xp, mc), st = CP.STAGES[si];
      return { petId: P.id, name: P.name, nick: nickOf(P.id), jp: P.jp, stage: si, stageName: st.name, stageJp: st.jp, met: P.id === progress.pet || xp > 0 || !!met[P.id] };
    });
    return { friends: friends, current: progress.pet, mastered: mc, total: KANA_TOTAL, date: new Date() };
  }
  function groupSentence(info) {
    var names = info.friends.filter(function (f) { return f.met; }).map(function (f) { return (f.nick ? f.nick + " the " : "") + f.name + " (stage " + (f.stage + 1) + ")"; });
    var waiting = info.friends.filter(function (f) { return !f.met; }).map(function (f) { return f.name; });
    var t = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    return "Saved a group photo of " + t + "." + (waiting.length ? " Still waiting to meet: " + waiting.join(" and ") + "." : "");
  }
  var groupBusy = false;
  function saveGroupPhoto(opts) {
    var S = window.KA_STICKER; opts = opts || {};
    if (!S || !S.makeGroup || groupBusy) return Promise.resolve(null);
    groupBusy = true;
    var info = groupInfo(), c = S.makeGroup(info), name = S.groupFileName(info.date);
    audio(); sfx.snap();
    var bp = $("bigPet"); if (!calm()) { bp.classList.remove("flash"); void bp.offsetWidth; bp.classList.add("flash"); }
    petPokeT = 1.2;
    var done = opts.dryRun ? Promise.resolve("dry") : S.save(c, name, "Kana Arcade group photo");
    return done.then(function (how) {
      groupBusy = false;
      if (how !== "cancelled") {
        var n = info.friends.filter(function (f) { return f.met; }).length;
        showToast("📸 はい、チーズ! Saved a group photo" + (n > 1 ? " of " + n + " friends" : "") + "!");
        $("stickerSay").textContent = groupSentence(info);
      }
      return { how: how, name: name, canvas: c, info: info, say: groupSentence(info) };
    }, function () { groupBusy = false; return null; });
  }
  $("groupBtn").addEventListener("click", function () { saveGroupPhoto(); });

  function applyGentle() {
    var b = $("gentleBtn"), on = settings.gentle;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    b.textContent = on ? "🫧 Gentle: ON" : "🫧 Gentle: OFF";
    $("gentleNote").textContent = on
      ? "Gentle mode: kana fall slower and fewer at once, no shaking, flashing or buzzing. Gentle games have their own high score."
      : "Want it calmer? Gentle mode slows the kana down and turns off shaking and flashing.";
    $("highLabel").textContent = on ? "🫧 GENTLE HIGH SCORE:" : "HIGH SCORE:";
    document.body.classList.toggle("calm", calm());
    applyScript();
  }
  var toastT = 0, lastToastAt = 0;
  function showToast(msg) {
    lastToastAt = Date.now();
    var el = $("kaToast"); el.textContent = msg; el.classList.remove("hidden");
    el.classList.toggle("sr", state === "play"); // mid-game the canvas banner shows it; screen readers still hear it
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.add("hidden"); }, 1800);
  }
  function setGentle(on) {
    settings.gentle = !!on; save("gentle", settings.gentle); applyGentle();
    showToast(settings.gentle ? "🫧 Gentle mode on" : "Gentle mode off");
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", function () { document.body.classList.toggle("calm", calm()); });

  // ---------- 🎃 spooky-season costumes (js/costumes.js) ----------
  var KC = window.KA_COSTUMES, helloStarted = false;
  function applyCostumes() {
    var b = $("costumeBtn"); if (!KC || !b) return;
    var season = KC.inSeason(), on = KC.wanted();
    show("costumeBtn", season);
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    b.textContent = on ? "🎃 Costumes: ON" : "🎃 Costumes: OFF";
  }
  function costumeLine() {
    var look = KC && KC.costumeFor(progress.pet, petStage()), P = CP.petById(progress.pet);
    if (look) return look.emoji + " " + P.name + " dressed up as " + look.name + " for spooky season!";
    if (KC && KC.active() && petStage() >= 4) return "👑 " + P.name + " keeps the sensei crown on for spooky season.";
    return "";
  }
  function setCostumes(on) {
    if (!KC) return;
    KC.setOn(on); KC.markHello(); applyCostumes();
    var line = costumeLine();
    showToast(on ? (line ? "🎃 Costumes on! " + line.replace(/^\S+ /, "").replace(" for spooky season!", "!") : "🎃 Costumes on!") : "Costumes off");
    if (on) { audio(); sfx.level(); }
  }
  function costumeHello() {
    if (!KC || DEMO || !KC.needsHello()) return;
    if (!helloStarted) { helloStarted = true; return setTimeout(costumeHello, 900); }
    var tries = 0;
    (function tryHello() {
      // wait politely: never cover another toast, and only say hello on the title or game over screen
      if ((Date.now() - lastToastAt < 2500 || (state !== "title" && state !== "over")) && ++tries < 120) { setTimeout(tryHello, 1000); return; }
      if (!KC.needsHello()) return;
      KC.markHello(); var line = costumeLine();
      showToast("🎃 Spooky season! " + (line ? line.replace(/^\S+ /, "").replace(" for spooky season!", "!") : "Your companions dressed up!"));
    })();
  }
  $("costumeBtn").addEventListener("click", function () { setCostumes(!KC.wanted()); });

  function applyMute() { $("muteBtn").textContent = settings.muted ? "🔇" : "🔊"; }

  // ---------- 🎵 arcade music (js/music.js): a soft chiptune loop, quicker each level, calm in Gentle mode ----------
  var KM = window.KA_MUSIC, music = KM ? KM.create({
    getCtx: function () { return actx; }, // never creates audio by itself: browsers only allow sound after a tap
    mood: function () { return { on: settings.music, muted: settings.muted, hidden: document.hidden, state: state, level: G ? G.level : 1, gentle: settings.gentle }; }
  }) : null;
  function applyMusic() {
    var b = $("musicBtn"); if (!b) return; var on = settings.music;
    show("musicBtn", !!KM);
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    b.textContent = on ? "🎵 Music: ON" : "🎵 Music: OFF";
  }
  function setMusic(on) {
    settings.music = !!on; save("music", settings.music); applyMusic();
    if (settings.music) audio();
    showToast(!settings.music ? "Music off" : settings.muted ? "🎵 Music on · unmute 🔇 to hear it" : "🎵 Music on");
    if (music) music.tick();
  }
  $("musicBtn").addEventListener("click", function () { setMusic(!settings.music); });
  // saved music starts quietly on the first tap or key press
  function firstGesture() { if (settings.music && !settings.muted) { audio(); if (music) setTimeout(music.tick, 30); } }
  document.addEventListener("pointerdown", firstGesture, true);
  document.addEventListener("keydown", firstGesture, true);

  // 👩/👨 kana voice (choice saved by js/voice.js in its own key; default female)
  var voiceNotes = load("voiceNotes", {}); if (!voiceNotes || typeof voiceNotes !== "object") voiceNotes = {};
  function applyVoice() {
    var V = window.KA_VOICE, g = V ? V.gender : "female";
    document.querySelectorAll(".voiceRow").forEach(function (r) { r.classList.toggle("hidden", !(V && V.supported)); });
    document.querySelectorAll(".voiceBtn").forEach(function (b) {
      var on = b.dataset.gender === g; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function setVoice(g, btn) {
    var V = window.KA_VOICE; if (!V || !V.supported) return;
    var inf = V.setGender(g); applyVoice();
    if (btn && !calm()) { btn.classList.remove("hear"); void btn.offsetWidth; btn.classList.add("hear"); }
    var name = inf.gender === "male" ? "👨 Male voice" : "👩 Female voice", msg;
    if (settings.muted) msg = name + " · sound is off, tap 🔇 to hear it";
    else {
      V.speak("あ", { force: true });
      msg = name + " · あ";
      if (inf.hasJapaneseVoice && !inf.exact && !voiceNotes[inf.gender]) {
        msg = "No " + inf.gender + " Japanese voice on this device, so I made it " + (inf.gender === "male" ? "deeper" : "higher") + " 🎵";
        voiceNotes[inf.gender] = true; save("voiceNotes", voiceNotes);
      }
    }
    showToast(msg);
    if (!$("petScreen").classList.contains("hidden")) $("gridSay").innerHTML = (settings.muted ? "" : "🔊 <b lang='ja'>あ</b> = a · ") + name;
  }
  document.querySelectorAll(".voiceBtn").forEach(function (b) { b.addEventListener("click", function () { setVoice(b.dataset.gender, b); }); });

  function startGame(reviewItems) {
    hideWelcome(); audio(); newGame(reviewItems && reviewItems.length ? reviewItems : null); state = "play";
    show("startScreen", false); show("overScreen", false); show("pauseScreen", false); show("petScreen", false);
    show("controls", true); show("pauseBtn", true);
    applyInputMode();
    if (settings.input === "type" && !isTouch) setTimeout(function () { input.focus(); }, 50);
  }
  // 🔁 review rounds (js/review.js): no save keys, they read your kana stats
  var REV = window.KA_REVIEW, REVIEW_XP = 15, lastReview = false;
  function reviewList() { return REV ? REV.pick(progress.kana, ROWS, REV.MAX, CP.isMastered) : []; }
  function startReview() { var list = reviewList(); if (!list.length) return false; lastReview = true; startGame(list); return true; }
  function startNormal() { lastReview = false; startGame(); }
  function playAgain() { if (lastReview && startReview()) return; startNormal(); }
  function applyReviewBtn() {
    var n = reviewList().length, b = $("reviewBtn"); if (!b) return;
    show("reviewBtn", n > 0);
    b.innerHTML = "🔁 REVIEW <small>(" + n + ")</small>";
    b.setAttribute("aria-label", "Review round: " + n + " kana you miss most");
  }
  var overAt = 0, overPetMood = "happy";
  function gameOver() {
    state = "over"; overAt = Date.now(); input.blur();
    var rv = G.review, cleared = !!(rv && G.reviewDone);
    if (cleared) sfx.level(); else sfx.over();
    var hi = load(highKey(), 0), isNew = !rv && G.score > hi; // review rounds never touch high scores
    if (isNew) save(highKey(), G.score);
    $("overTitle").textContent = cleared ? "REVIEW CLEAR!" : rv ? "REVIEW OVER" : "GAME OVER";
    $("overTitle").classList.toggle("reviewClear", cleared);
    if (rv) {
      var tr = REV.tricky(rv), left = reviewList().length;
      $("overReview").innerHTML = (cleared ? "🔁 You cleared all " + rv.items.length + " tricky kana: " : "🔁 Reviewed: ") +
        "<b lang='ja'>" + rv.items.map(function (it) { return it.ch; }).join(" ") + "</b>" +
        (tr.length ? " · still tricky: <b lang='ja' style='color:#ff8fb8'>" + tr.map(function (it) { return it.ch; }).join(" ") + "</b>" : cleared ? " · no misses! ✨" : "") +
        (cleared ? " · +" + REVIEW_XP + " XP" : "");
      $("againBtn").textContent = left ? "▶ REVIEW AGAIN" : "▶ PLAY";
    } else $("againBtn").textContent = "▶ PLAY AGAIN";
    show("overReview", !!rv);
    $("finalScore").textContent = G.score; $("overHigh").textContent = rv ? hi : Math.max(hi, G.score);
    show("overGentle", settings.gentle);
    $("finalLevel").textContent = G.level; $("finalCombo").textContent = G.best;
    $("finalAcc").textContent = G.shots ? Math.round(100 * G.hits / G.shots) : 0;
    show("newHigh", isNew);
    var missed = Object.keys(G.missed).sort(function (a, b) { return G.missed[b] - G.missed[a]; }).slice(0, 6);
    var lookup = {}; ROWS.forEach(function (r) { r.kana.forEach(function (k) { lookup[k[0]] = k[2]; lookup[k[1]] = k[2]; }); });
    var mw = KW ? Object.keys(G.missedWords).slice(0, 3).map(function (j) { return KW.info(j, BASE); }) : [];
    $("toPractice").innerHTML = (missed.length || mw.length) ? "Practice these (tap to hear): " + missed.map(function (c) { return "<button type='button' class='pk' data-ch='" + c + "' aria-label='" + c + " = " + lookup[c] + ", tap to hear it'><b lang='ja'>" + c + "</b>=" + lookup[c] + "</button>"; }).concat(mw.map(function (w) {
      return "<button type='button' class='pk pw' data-ch='" + w.jp + "' aria-label='" + w.jp + " = " + w.ro + ", " + w.en + ", tap to hear it'><b lang='ja'>" + rubyHTML(w.jp) + "</b>=" + w.ro + " " + w.emoji + "</button>"; })).join(" ") : "";
    $("practiceSay").textContent = ""; show("practiceSay", false);
    questEvent({ type: "game" });
    var qd = QUEST.byId(quest.id);
    $("overQuest").textContent = G.questCleared
      ? "📜 Daily quest complete! +" + QUEST.REWARD + " XP" + (quest.streak > 1 ? " · 🔥 " + quest.streak + "-day streak" : "")
      : quest.done ? "📜 Daily quest done ✓ · new one tomorrow" : "📜 Daily quest: " + qd.text + " · " + quest.prog + " / " + qd.goal;
    saveProgress();
    var ps = CP.STAGES[petStage()];
    $("overPetLine").innerHTML = escHTML(callName(CP.petById(progress.pet))) + " (" + ps.name + ") gained <b style='color:#ffe94d'>+" + G.xpGained + " XP</b>" +
      (G.newMastered.length ? " · newly mastered: <b style='color:#fff;font-size:1.2em'>" + G.newMastered.join(" ") + "</b>" : "") +
      (G.wordsCleared.length ? " · 💬 words: <b lang='ja' style='color:#ff8fd9'>" + G.wordsCleared.slice(0, 5).join(" ") + "</b>" : "") +
      (G.luckyHits ? " · <span style='color:#ffd36b'>🎋 lucky <b lang='ja'>" + G.lucky.hira + "</b> ×" + G.luckyHits + "</span>" : "");
    // 🌱 kana from this game that are only a few right answers away from ★ mastered
    var nearList = NEAR ? NEAR.list(progress.kana, { only: function (c) { return !!G.played[c]; }, masterCorrect: CP.MASTER_CORRECT, masterAcc: CP.MASTER_ACC, max: 5 }) : [];
    $("overNear").innerHTML = nearList.length ? "🌱 Almost mastered: " + nearList.map(function (it) { return "<b lang='ja'>" + it.ch + "</b> <small>+" + it.need + "</small>"; }).join(" · ") + " (right answers to go)" : "";
    show("overNear", nearList.length > 0);
    // 👀 look-alikes you mixed up (or missed) this game, with how to tell them apart
    var looks = LOOK ? LOOK.notes(G.mixups, G.missed, 2) : [];
    $("overLook").innerHTML = looks.length ? "👀 Look-alikes <span lang='ja'>そっくり</span>: " + looks.map(lookHTML).join(" · ") : "";
    show("overLook", looks.length > 0);
    // 🌌 a new playfield sky opens up when your mastered kana reach 5 / 15 / 30 / 50 / 75
    var SKY = window.KA_SKY, skyNew = SKY && SKY.note ? SKY.note(masteredCount()) : [];
    $("overSky").innerHTML = skyNew.length ? "🌌 New sky unlocked: " + skyNew.map(function (k) { return "<b>" + k.icon + " " + k.name + "</b>"; }).join(" · ") + "! Pick it with 🌌 Sky on the title screen." : "";
    show("overSky", skyNew.length > 0);
    // 🎖️ Rank up: this game's newly mastered kana lifted you to the next Kana rank (see 📊 My stats)
    var ST = window.KA_STATS, rkA = ST && ST.rank ? ST.rank(G.mStart, KANA_TOTAL) : null, rkB = ST && ST.rank ? ST.rank(masteredCount(), KANA_TOTAL) : null;
    var rankUp = !!(rkA && rkB && rkB.index > rkA.index);
    $("overRank").innerHTML = rankUp ? "🎖️ Rank up! You're now a <b>" + rkB.icon + " " + rkB.name + "</b> <span lang='ja' aria-label='" + rkB.jp + ", " + rkB.ro + "'>" + rkB.jp + "</span>!" +
      (rkB.next ? " <small>" + rkB.line + "</small>" : " <small>すごい! 👑</small>") : "";
    $("overRank").classList.toggle("top", rankUp && rkB.top);
    show("overRank", rankUp);
    if (rankUp) window.dispatchEvent(new CustomEvent("ka:rankup", { detail: { from: rkA.name, to: rkB.name, index: rkB.index, mastered: rkB.mastered } }));
    overPetMood = isNew || G.newMastered.length || skyNew.length || rankUp ? "cheer" : "happy";
    setTimeout(function () { show("overScreen", true); show("controls", false); show("pauseBtn", false); }, 700);
  }
  function pause() { if (state !== "play") return; state = "pause"; renderRecap(); show("pauseScreen", true); input.blur(); }
  // ⏸ Pause recap: score, level, best combo, accuracy, and the kana you caught / missed (tap to hear)
  function recapPill(it, cls) {
    var ro = romajiOf(it.ch);
    return "<button type='button' class='pk" + (cls ? " " + cls : "") + "' data-ch='" + it.ch + "' aria-label='" + it.ch + " = " + ro +
      (it.n > 1 ? ", " + it.n + " times" : "") + ", tap to hear it'><b lang='ja'>" + it.ch + "</b>=" + ro + (it.n > 1 ? "<small>×" + it.n + "</small>" : "") + "</button>";
  }
  function renderRecap() {
    var R = window.KA_RECAP, r = R && G ? R.build(G) : null;
    show("pauseRecap", !!r); if (!r) return null;
    $("recapStats").innerHTML = "SCORE <b>" + r.score + "</b> · LV <b>" + r.level + "</b> · BEST COMBO <b>" + r.best + "</b>" + (r.acc === null ? "" : " · ACC <b>" + r.acc + "%</b>");
    $("recapCaught").innerHTML = r.caught.length ? "✨ Caught" + (r.caughtN > r.caught.length ? " (" + r.caughtN + " kana, top " + r.caught.length + ")" : "") + ": " + r.caught.map(function (it) { return recapPill(it, ""); }).join(" ") : "";
    show("recapCaught", r.caught.length > 0);
    $("recapMissed").innerHTML = r.missed.length ? "😅 Missed: " + r.missed.map(function (it) { return recapPill(it, "miss"); }).join(" ") : "";
    show("recapMissed", r.missed.length > 0);
    $("recapCheer").textContent = r.cheer;
    $("recapSay").textContent = ""; show("recapSay", false);
    $("recapAria").textContent = r.aria;
    window.dispatchEvent(new CustomEvent("ka:recap", { detail: r }));
    return r;
  }
  $("pauseRecap").addEventListener("click", function (ev) { var b = ev.target.closest && ev.target.closest(".pk[data-ch]"); if (b) hearKana(b, "recapSay"); });
  function resume() { if (state !== "pause") return; state = "play"; show("pauseScreen", false); if (settings.input === "type" && !isTouch) input.focus(); }
  function toTitle() { state = "title"; G = null; buildPicker(); renderQuest(); applyReviewBtn(); show("petScreen", false); show("pauseScreen", false); show("overScreen", false); show("controls", false); show("pauseBtn", false); show("startScreen", true); applyScript(); applyOmikujiBtn(); requestAnimationFrame(resize); }

  $("startBtn").addEventListener("click", startNormal);
  $("reviewBtn").addEventListener("click", startReview);
  $("againBtn").addEventListener("click", playAgain);
  $("titleBtn").addEventListener("click", toTitle);
  $("quitBtn").addEventListener("click", toTitle);
  $("resumeBtn").addEventListener("click", resume);
  $("pauseBtn").addEventListener("click", function () { state === "pause" ? resume() : pause(); });
  $("gentleBtn").addEventListener("click", function () { setGentle(!settings.gentle); });
  $("muteBtn").addEventListener("click", function () { settings.muted = !settings.muted; save("muted", settings.muted); applyMute(); if (!settings.muted) { audio(); sfx.shoot(); } });
  $("modeToggle").addEventListener("click", function () { settings.input = settings.input === "tap" ? "type" : "tap"; save("input", settings.input); applyInputMode(); });
  document.querySelectorAll(".modeBtn").forEach(function (b) { b.addEventListener("click", function () { settings.script = b.dataset.script; save("script", settings.script); applyScript(); }); });
  document.querySelectorAll(".inBtn").forEach(function (b) { b.addEventListener("click", function () { settings.input = b.dataset.input; save("input", settings.input); applyInputMode(); }); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
  // tapping the playfield in type mode re-focuses the input (desktop)
  canvas.addEventListener("pointerdown", function () { if (state === "play" && settings.input === "type") input.focus(); });

  // ---------- small romaji above the kana on the home screen (js/romaji.js) ----------
  var KR = window.KA_ROMAJI;
  function rubyHTML(s) { return KR ? KR.ruby(s) : String(s); }
  function romajiWord(s) { return KR ? KR.toRomaji(s) : ""; }
  function applyHomeRomaji() {
    document.querySelectorAll(".rubyJp").forEach(function (el) {
      if (!el.dataset.jp) el.dataset.jp = el.textContent;
      el.innerHTML = rubyHTML(el.dataset.jp);
    });
  }

  // ---------- 🎋 omikuji screen ----------
  function applyOmikujiBtn() {
    var o = omikujiToday(), b = $("omikujiBtn");
    b.classList.toggle("fresh", !o);
    b.innerHTML = o ? '🎋 LUCKY <span lang="ja">' + rubyHTML(o.hira) + "</span>" : "🎋 OMIKUJI";
    b.setAttribute("aria-label", o ? "Omikuji: today's lucky kana is " + o.hira + ", " + o.romaji : "Omikuji: draw today's fortune");
  }
  function renderSlip(o) {
    $("okFortune").textContent = o.fortune.jp;
    $("okReading").innerHTML = rubyHTML(o.fortune.kana); $("okReading").setAttribute("aria-label", o.fortune.kana + ", " + romajiWord(o.fortune.kana));
    $("okEn").textContent = o.fortune.en;
    var lk = $("okLucky"); lk.dataset.ch = o.hira;
    lk.innerHTML = '<i aria-hidden="true">' + o.romaji + '</i><b lang="ja">' + o.hira + '</b><b lang="ja" class="okKata">' + o.kata + "</b>";
    lk.setAttribute("aria-label", "Lucky kana " + o.hira + " and " + o.kata + ", " + o.romaji + ". Tap to hear it.");
    $("okTip").textContent = "💡 " + o.tip;
    $("okBonus").innerHTML = "In today's games <b lang='ja'>" + o.hira + "</b> / <b lang='ja'>" + o.kata + "</b> fall with a gold glow ✦ Shoot them for <b>×" + OMI.MULT + " points</b>!";
    $("omikujiSub").textContent = CP.petById(progress.pet).name + ": " + o.cheer;
    show("omikujiBox", false); show("omikujiSlip", true);
    $("okSay").innerHTML = "🔊 Tap the lucky kana to hear it";
  }
  function openOmikuji() {
    var o = omikujiToday();
    show("startScreen", false); show("omikujiScreen", true);
    $("omikujiSlip").classList.remove("reveal");
    if (o) { renderSlip(o); $("okLucky").focus(); }
    else {
      $("omikujiSub").textContent = "Shake the box for today's fortune and your lucky kana!"; $("okSay").textContent = "";
      show("omikujiSlip", false); show("omikujiBox", true); $("omikujiBox").disabled = false; $("omikujiBox").focus();
    }
  }
  function closeOmikuji() { show("omikujiScreen", false); toTitle(); applyOmikujiBtn(); $("omikujiBtn").focus(); }
  function drawOmikuji() {
    var box = $("omikujiBox"); if (box.disabled) return;
    box.disabled = true; audio();
    var still = calm();
    if (!still) { box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); }
    [0, 0.12, 0.24, 0.36].forEach(function (d, i) { tone("triangle", 660 + i * 90, 520, 0.07, 0.25, d); });
    setTimeout(function () {
      box.classList.remove("shake");
      save("omikuji", { date: QUEST.dayKey() });
      var o = omikujiToday(); renderSlip(o);
      if (!still) $("omikujiSlip").classList.add("reveal");
      sfx.master(); sayKana(o.hira, 250);
      showToast("🎋 " + o.fortune.jp + " · lucky kana " + o.hira + " (" + o.romaji + ")");
      applyOmikujiBtn(); $("okLucky").focus();
    }, still ? 120 : 750);
  }
  $("omikujiBtn").addEventListener("click", openOmikuji);
  $("omikujiBox").addEventListener("click", drawOmikuji);
  $("omikujiBack").addEventListener("click", closeOmikuji);
  $("okLucky").addEventListener("click", function () { hearKana($("okLucky"), "okSay"); });

  // ---------- 👋 おかえり! welcome back (js/welcome.js, own save key kanaArcade.lastSeen) ----------
  var WB = window.KA_WELCOME, welcomeOn = false, welcomeInfo = null;
  function welcomeNudge() {
    var rev = WB.reviewKana(progress.kana, ROWS, 3, CP.isMastered);
    if (rev.length) {
      $("wbReview").innerHTML = "Warm up with kana you missed (tap to hear): " + rev.map(function (r) {
        return "<button type='button' class='pk' data-ch='" + r.ch + "' aria-label='" + r.ch + " = " + r.romaji + ", tap to hear it'><b lang='ja'>" + r.ch + "</b>=" + r.romaji + "</button>";
      }).join(" ") + (REV ? " <button type='button' id='wbGo' class='alt small review'>🔁 Review them</button>" : "");
      return;
    }
    questDay(); var qd = QUEST.byId(quest.id);
    $("wbReview").innerHTML = quest.done ? "Today's quest is done ✓ Ready for a game? Press ▶ START!"
      : "📜 Today's quest is waiting: " + rubyHTML(qd.icon + " " + qd.text);
  }
  function showWelcome(info) {
    welcomeInfo = info; welcomeOn = true;
    var P = CP.petById(progress.pet);
    $("wbEn").textContent = info.hello.en + "!";
    $("wbText").textContent = callName(P) + " missed you 💕 " + info.gap;
    welcomeNudge();
    $("wbSay").textContent = ""; show("wbSay", false);
    var c = $("welcomeCard"); c.classList.remove("pop"); show("welcomeCard", true);
    if (!calm()) { void c.offsetWidth; c.classList.add("pop"); }
  }
  function hideWelcome(focusStart) {
    if (!welcomeOn) return; welcomeOn = false; show("welcomeCard", false);
    if (focusStart) $("startBtn").focus();
  }
  // compare with the last time the game was open, then remember now
  function checkWelcome() {
    if (!WB) return null;
    var now = Date.now(), info = WB.compute(load("lastSeen", null), now);
    save("lastSeen", now);
    if (info && !DEMO && state === "title") showWelcome(info);
    return info;
  }
  function seenNow() { if (WB) save("lastSeen", Date.now()); }
  $("wbClose").addEventListener("click", function () { hideWelcome(true); });
  $("wbReview").addEventListener("click", function (ev) {
    if (ev.target.closest && ev.target.closest("#wbGo")) { hideWelcome(); startReview(); return; } // 🔁 straight into a review round
    var b = ev.target.closest && ev.target.closest(".pk[data-ch]"); if (b) hearKana(b, "wbSay");
  });
  setInterval(function () { if (!document.hidden) seenNow(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (document.hidden) seenNow(); else checkWelcome(); });
  window.addEventListener("pagehide", seenNow);

  // ---------- boot ----------
  applyHomeRomaji(); buildPicker(); renderQuest(); applyReviewBtn(); applyOmikujiBtn(); applyScript(); applyGentle(); applyMute(); applyMusic(); applyVoice(); applyInputMode(); applyCostumes(); resize(); checkWelcome(); costumeHello();
  if (params.get("screen") === "pet") openPetScreen();
  requestAnimationFrame(loop);
  if (DEMO) { if (params.get("review") === "1") startReview() || startNormal(); else startNormal(); }
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  // test hook
  window.__kanaArcade = { get state() { return state; }, recap: function () { return state === "pause" ? renderRecap() : null; }, get game() { return G; }, settings: settings, progress: progress, petStage: petStage,
    petHearts: function () { return petHearts.length; }, petPats: function () { return petPats; },
    toast: showToast, saveSticker: saveSticker, stickerInfo: stickerInfo, saveGroupPhoto: saveGroupPhoto, groupInfo: groupInfo, cheer: function () { sfx.level(); }, drop: function () { sfx.drop(); }, pet: function () { return CP.petById(progress.pet); },
    setGentle: setGentle, setMusic: setMusic, music: function () { return music ? music.info() : null; }, setCostumes: setCostumes, costumeLine: costumeLine, setVoice: setVoice, omikuji: function () { return omikujiToday(); }, welcome: function () { return welcomeOn ? welcomeInfo : null; }, checkWelcome: checkWelcome, isCalm: calm, get quest() { return quest; }, killFor: function (ch) { if (state === "play" && G) { var e = G.enemies[0]; if (!e) { spawn(); e = G.enemies[0]; } if (ch) { e.ch = ch; } kill(e); } },
 speed: function () { return G ? speed() : 0; }, maxOnScreen: function () { return G ? maxOnScreen() : 0; },
    spawnWord: function (jp) { return state === "play" && G ? spawnWord(true, jp) : false; }, wordStats: function () { return wordStats; },
    killWord: function () { var e = G && G.enemies.filter(function (x) { return x.word; })[0]; if (e) kill(e); return !!e; },
    missWord: function () { var e = G && G.enemies.filter(function (x) { return x.word; })[0]; if (e) missGround(e); return !!e; },
    startReview: startReview, reviewList: reviewList, get review() { return G && G.review; },
    sky: function () { return window.KA_SKY && window.KA_SKY.current ? window.KA_SKY.current() : "neon"; }, masteredCount: masteredCount, dakuOf: function (ch) { return DAKU_OF[ch] || null; }, pool: function () { return G ? pool().map(function (x) { return x.k[0]; }) : []; },
    showBanner: function () { if (G) showBanner(); return G && G.banner ? { title: G.banner.title, row: G.banner.row ? G.banner.row.name : null } : null; },
    doze: function () { if (doze && petScreenOpen()) { doze.force(); dozeOff(); } return !!(doze && doze.isDozing()); },
    dance: dance, danceInfo: function () { return { on: danceT > 0, t: danceT, bits: danceBits.map(function (d) { return d.ch; }), count: danceCount, line: $("petSay").dataset.line }; },
    isDozing: function () { return !!(doze && doze.isDozing()); }, setDozeDelay: function (ms) { if (doze) { doze.setDelay(ms); doze.reset(performance.now()); } }, dozeCount: function () { return dozeCount; },
    met: function (id) { return met[id || progress.pet] || null; }, renderSince: renderSince,
    nickOf: nickOf, setNick: function (id, n) { var r = setNick(id, n); if (!$("petScreen").classList.contains("hidden")) renderNick(); return r; },
    surpriseKana: function (seed) { return surpriseKana(seed == null ? undefined : function () { return seed; }); },
    findKana: function (q) { $("findInput").value = q == null ? "" : q; return applyFind(true); }, findInfo: function () { return findRes ? { q: findRes.q, kind: findRes.kind, found: Array.prototype.map.call(document.querySelectorAll(".kc.found"), function (b) { return b.dataset.ch; }), say: $("findSay").textContent, script: gridScript } : null; },
    setLevel: function (n) { if (G) { G.level = n; G.banner = null; } },
    lookMixup: function (ro) { return state === "play" && G && G.target ? lookMixup(G.target, ro) : null; },
    missFor: function (ch) { if (state === "play" && G) { var e = G.enemies[0]; if (!e) { spawn(); e = G.enemies[0]; } e.ch = ch; e.answers = [romajiOf(ch)]; missGround(e); } } };
})();
