/* Kana Arcade — falling-kana typing/tapping shooter. Plain JS, no dependencies. */
(function () {
  "use strict";
  var ROWS = window.KANA.ROWS;
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
    muted: load("muted", false)
  };
  function highKey() { return "high." + settings.script; }
  var CP = window.COMPANION;
  var progress = CP.normalize(load("progress", null));
  if (params.get("pet")) progress.pet = CP.petById(params.get("pet")).id;
  function saveProgress() { save("progress", progress); }
  function petXP() { return progress.pets[progress.pet].xp; }
  function masteredCount() { return CP.countMastered(progress.kana); }
  function petStage() { return CP.stageFor(petXP(), masteredCount()); }
  function stat(ch) { return progress.kana[ch] || (progress.kana[ch] = { c: 0, w: 0 }); }

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
    var out = [];
    for (var r = 0; r < unlockedRows(G.level); r++) ROWS[r].kana.forEach(function (k) { out.push({ k: k, row: r }); });
    return out;
  }
  function charFor(k) {
    var s = settings.script === "both" ? (Math.random() < 0.5 ? "hiragana" : "katakana") : settings.script;
    return s === "katakana" ? k[1] : k[0];
  }

  function newGame() {
    G = {
      level: DEMO ? 3 : 1, score: 0, lives: 5, combo: 0, best: 0, kills: 0, levelKills: 0, shots: 0, hits: 0,
      enemies: [], particles: [], lasers: [], texts: [], spawnT: 0.6, shake: 0, flash: 0,
      banner: null, missed: {}, target: null, demoT: 0, demoN: 0,
      pet: { mood: "idle", moodT: 0, say: "", sayT: 0 }, petStage: petStage(), xpGained: 0, newMastered: [], evo: null
    };
    showBanner();
    input.value = ""; input.classList.remove("bad");
  }
  function speed() { // fraction of screen height per second
    var fallTime = Math.max(2.6, 9.5 * Math.pow(0.9, G.level - 1));
    return 1 / fallTime;
  }
  function spawnEvery() { return Math.max(0.55, 2.2 * Math.pow(0.9, G.level - 1)) * (settings.input === "tap" ? 1.15 : 1); }
  function maxOnScreen() { return Math.min(3 + G.level, settings.input === "tap" ? 6 : 10); }

  function showBanner() {
    var r = unlockedRows(G.level) - 1, newRow = (G.level <= ROWS.length) ? ROWS[r] : null;
    G.banner = { t: 0, dur: newRow ? 2.8 : 1.6, title: "LEVEL " + G.level, row: newRow };
  }

  function spawn() {
    var p = pool(), newest = unlockedRows(G.level) - 1, pick;
    var live = {}; G.enemies.forEach(function (e) { live[e.k[2]] = 1; });
    for (var tries = 0; tries < 12; tries++) {
      // 45% chance to drill the newest row while it's fresh
      var cand = (G.level <= ROWS.length && Math.random() < 0.45) ? p.filter(function (x) { return x.row === newest; }) : p;
      pick = cand[Math.floor(Math.random() * cand.length)];
      if (!live[pick.k[2]]) break;
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

  function burst(x, y, color, n, power) {
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
    G.score += pts; G.kills++; G.levelKills++;
    var sx = W / 2, sy = groundY() + 4;
    G.lasers.push({ x1: sx, y1: sy, x2: e.x, y2: e.y, t: 0.15 });
    var cols = ["#2be8ff", "#ff2bd6", "#ffe94d"];
    burst(e.x, e.y, cols[G.combo % 3], 26, 260 + G.combo * 6);
    burst(e.x, e.y, "#ffffff", 8, 120);
    G.texts.push({ x: e.x, y: e.y, s: "+" + pts, sub: e.answers[0], c: "#ffe94d", t: 0, dur: 0.9 });
    if (G.combo > 0 && G.combo % 5 === 0) G.texts.push({ x: W / 2, y: H * 0.42, s: "COMBO x" + mult() + "!", c: "#ff2bd6", t: 0, dur: 1.1, big: true });
    G.flash = 0.06;
    sfx.shoot(); setTimeout(function () { sfx.boom(G ? G.combo : 0); }, 60);
    G.enemies = G.enemies.filter(function (x) { return x !== e; });
    gainXP(2 + Math.floor(Math.min(G.combo, 20) / 5));
    if (G.combo > 0 && G.combo % 5 === 0) petMood("cheer", 1.2, CHEERS[Math.floor(Math.random() * CHEERS.length)]);
    else if (G.pet.mood !== "cheer") petMood("happy", 0.6, Math.random() < 0.25 ? "♪" : "");
    recordAnswer(e.ch, true);
    if (G.levelKills >= 8 + G.level) { G.level++; G.levelKills = 0; showBanner(); sfx.level(); gainXP(10); petMood("cheer", 2, "レベルアップ!"); }
    refreshTap(true);
  }

  function missGround(e) {
    e.dead = true; G.lives--; G.combo = 0; G.shake = 0.45;
    G.missed[e.ch] = (G.missed[e.ch] || 0) + 1;
    burst(e.x, groundY(), "#ff3b5c", 30, 300);
    G.texts.push({ x: e.x, y: groundY() - fontSize() * 1.4, s: e.ch + " = " + e.answers[0], c: "#ff3b5c", t: 0, dur: 1.8, reveal: true });
    sfx.miss();
    petMood("sad", 1.4, "うぅ…");
    sayKana(e.ch, 380); // hear the one you missed

    recordAnswer(e.ch, false);
    if (navigator.vibrate) try { navigator.vibrate(120); } catch (er) {}
    G.enemies = G.enemies.filter(function (x) { return x !== e; });
    refreshTap(true);
    if (G.lives <= 0) gameOver();
  }

  function wrongAnswer(ch) {
    G.shots++; G.combo = 0; G.shake = Math.max(G.shake, 0.15); sfx.wrong();
    petMood("sad", 0.8, "あれ?");
    if (ch) recordAnswer(ch, false);
  }

  // 🔊 hear the kana (js/voice.js; quietly does nothing without speech support or when muted)
  function sayKana(ch, delay) {
    if (settings.muted || !window.KA_VOICE) return;
    if (delay) setTimeout(function () { if (!settings.muted) window.KA_VOICE.speak(ch, { interrupt: false }); }, delay);
    else window.KA_VOICE.speak(ch);
  }
  function romajiOf(ch) {
    for (var r = 0; r < ROWS.length; r++) for (var i = 0; i < ROWS[r].kana.length; i++) { var k = ROWS[r].kana[i]; if (k[0] === ch || k[1] === ch) return k[2]; }
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
    if (line) { line.innerHTML = msg; line.classList.remove("hidden"); }
  }

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
  function isLongerPrefix(str) { // could str still grow into a longer answer on screen?
    return G.enemies.some(function (e) { return e.answers.some(function (a) { return a.length > str.length && a.indexOf(str) === 0; }); });
  }
  function handleTyped() {
    if (state !== "play") return;
    var v = input.value.toLowerCase().replace(/[^a-z]/g, "");
    if (v !== input.value) input.value = v;
    if (!v) return;
    var hit = lowestMatching(v, true);
    if (hit && !isLongerPrefix(v)) { kill(hit); input.value = ""; return; }
    if (hit || lowestMatching(v, false)) { input.classList.remove("bad"); return; }
    // not a prefix of anything: maybe the previous chars completed an answer (e.g. "n" then "k")
    var head = v.slice(0, -1), last = v.slice(-1);
    var prev = head && lowestMatching(head, true);
    if (prev) { kill(prev); input.value = last; handleTyped(); return; }
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
    var correct = t.answers[0], opts = [correct], p = pool().map(function (x) { return x.k[2]; });
    // prefer distractors with same vowel or consonant for a real challenge
    var similar = p.filter(function (r) { return r !== correct && (r.slice(-1) === correct.slice(-1) || r[0] === correct[0]); });
    shuffle(similar);
    var others = shuffle(p.filter(function (r) { return r !== correct; }));
    similar.concat(others).forEach(function (r) { if (opts.length < 4 && opts.indexOf(r) < 0) opts.push(r); });
    while (opts.length < 4) opts.push(["ka", "mi", "ro", "te", "su"][opts.length]);
    shuffle(opts);
    ansBtns.forEach(function (b, i) { b.textContent = opts[i]; b.dataset.v = opts[i]; b.disabled = false; b.className = "ans"; });
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function tapAnswer(b) {
    if (state !== "play" || !G.target || b.disabled) return;
    audio();
    if (G.target.answers.indexOf(b.dataset.v) >= 0) {
      b.classList.add("flash-ok"); kill(G.target);
    } else {
      b.classList.add("flash-bad"); b.disabled = true; wrongAnswer(G.target.ch);
      if (navigator.vibrate) try { navigator.vibrate(40); } catch (er) {}
    }
  }
  ansBtns.forEach(function (b) {
    b.addEventListener("pointerdown", function (ev) { ev.preventDefault(); tapAnswer(b); });
  });
  // keyboard shortcuts 1-4 for tap mode on desktop
  document.addEventListener("keydown", function (ev) {
    if (state === "title" && ev.key === "Enter" && $("petScreen").classList.contains("hidden")) { ev.preventDefault(); startGame(); return; }
    if (state === "over" && ev.key === "Enter" && Date.now() - overAt > 600 && $("petScreen").classList.contains("hidden")) { ev.preventDefault(); startGame(); return; }
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

  function drawShip() {
    var x = W / 2, y = groundY() + 6, s = Math.max(10, Math.min(18, W / 40));
    ctx.fillStyle = "#2be8ff"; ctx.shadowColor = "#2be8ff"; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 1.4, y + s * 0.6); ctx.lineTo(x - s * 1.4, y + s * 0.6); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#ffe94d"; ctx.fillRect(x - 3, y - s * 0.6, 6, 6);
  }

  function draw(t) {
    ctx.save();
    if (G && G.shake > 0) { var m = G.shake * 22; ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m); }
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
      var danger = Math.max(0, (e.y / gy - 0.6) / 0.4);
      var col = danger > 0.01 ? "rgb(255," + Math.round(233 - 180 * danger) + "," + Math.round(255 - 160 * danger) + ")" : "#ffffff";
      var x = e.x + Math.sin(e.wob) * 4;
      var isT = settings.input === "tap" && e === G.target;
      // pixel-style invader box
      ctx.strokeStyle = isT ? "#ffe94d" : "rgba(43,232,255,0.55)"; ctx.lineWidth = isT ? 3 : 2;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = isT ? 18 : 8;
      var b = fs * 0.62; ctx.strokeRect(x - b, e.y - b, b * 2, b * 2); ctx.shadowBlur = 0;
      if (isT) { // target reticle corners
        ctx.strokeStyle = "#ffe94d"; ctx.lineWidth = 2; var r = b + 8 + Math.sin(t * 8) * 2;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          ctx.beginPath(); ctx.moveTo(x + c[0] * r, e.y + c[1] * (r - 10)); ctx.lineTo(x + c[0] * r, e.y + c[1] * r); ctx.lineTo(x + c[0] * (r - 10), e.y + c[1] * r); ctx.stroke();
        });
      }
      ctx.font = "bold " + fs + "px " + JP_FONT; ctx.fillStyle = col; ctx.shadowColor = isT ? "#ffe94d" : "#ff2bd6"; ctx.shadowBlur = 14;
      ctx.fillText(e.ch, x, e.y + fs * 0.04); ctx.shadowBlur = 0;
      // thruster
      ctx.fillStyle = "rgba(255,43,214," + (0.4 + Math.random() * 0.4) + ")"; ctx.fillRect(x - 3, e.y - b - 6 - Math.random() * 6, 6, 6);
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
      if (tx.reveal) {
        ctx.font = "bold " + Math.round(fs * 0.7) + "px " + JP_FONT; ctx.fillStyle = "rgba(20,0,10,0.75)";
        var w = ctx.measureText(tx.s).width + 24, xx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, tx.x));
        ctx.fillRect(xx - w / 2, tx.y - fs * 0.5, w, fs); ctx.strokeStyle = "#ff3b5c"; ctx.lineWidth = 2; ctx.strokeRect(xx - w / 2, tx.y - fs * 0.5, w, fs);
        ctx.fillStyle = "#ff3b5c"; ctx.shadowColor = "#ff3b5c"; ctx.shadowBlur = 10; ctx.fillText(tx.s, xx, tx.y + 2); ctx.shadowBlur = 0;
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
    if (G.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + G.flash * 2 + ")"; ctx.fillRect(0, 0, W, H); }
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
    neonText("LV " + G.level, 12, 14 + sz * 1.2, sz * 0.85, "#2be8ff", 8);
    var hearts = ""; for (var i = 0; i < 5; i++) hearts += i < G.lives ? "♥" : "·";
    neonText(hearts, 12, 16 + sz * 2.2, sz, "#ff3b5c", 8);
    if (G.combo >= 2) {
      ctx.textAlign = "right";
      neonText(G.combo + " COMBO  x" + mult(), W - 12, 56, sz * 0.9, "#ff2bd6", 10);
    }
    // level progress bar
    var need = 8 + G.level, pw = Math.min(160, W * 0.3);
    ctx.fillStyle = "rgba(43,232,255,0.2)"; ctx.fillRect(12, 20 + sz * 3.2, pw, 5);
    ctx.fillStyle = "#2be8ff"; ctx.fillRect(12, 20 + sz * 3.2, pw * G.levelKills / need, 5);
  }

  function drawBanner() {
    var b = G.banner, k = b.t / b.dur, a = k < 0.15 ? k / 0.15 : (k > 0.85 ? (1 - k) / 0.15 : 1);
    ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(7,2,26,0.7)"; ctx.fillRect(0, H * 0.28, W, H * 0.34);
    neonText(b.title, W / 2, H * 0.34, Math.min(52, W / 8), "#ff2bd6", 20);
    if (b.row) {
      neonText("NEW KANA: " + b.row.name.toUpperCase(), W / 2, H * 0.41, Math.min(18, W / 24), "#ffe94d", 8);
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
  var petPokeT = 0;
  function drawDomPets(t) {
    if (!$("startScreen").classList.contains("hidden")) {
      document.querySelectorAll(".petPick canvas").forEach(function (c) {
        var id = c.dataset.pet, p = prepCanvas(c), st = CP.stageFor(progress.pets[id].xp, masteredCount());
        CP.draw(p.x, id, st, p.sz / 2, p.sz * 0.9, p.sz * 0.85, id === progress.pet ? "happy" : "idle", t);
      });
    }
    if (!$("petScreen").classList.contains("hidden")) {
      var b = prepCanvas($("bigPet")); petPokeT = Math.max(0, petPokeT - 1 / 60);
      CP.draw(b.x, progress.pet, petStage(), b.sz / 2, b.sz * 0.92, b.sz * 0.62, petPokeT > 0 ? "cheer" : "idle", t);
      if (petPokeT > 0) { b.x.font = "28px sans-serif"; b.x.textAlign = "center"; b.x.fillStyle = "#ff6b9a"; b.x.globalAlpha = Math.min(1, petPokeT); b.x.fillText("♥", b.sz / 2 + 50, b.sz * 0.3 - (1 - petPokeT) * 30); b.x.globalAlpha = 1; }
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
      b.innerHTML = '<canvas data-size="64" data-pet="' + P.id + '"></canvas>' + P.name + "<small>" + P.jp + " · " + st.name + "</small>";
      b.addEventListener("click", function () { progress.pet = P.id; saveProgress(); buildPicker(); });
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
    buildGrid(); $("gridSay").innerHTML = "🔊 Tap any kana to hear it in Japanese";
    show("startScreen", false); show("overScreen", false); show("petScreen", true);
  }
  function buildGrid() {
    var g = $("kanaGrid"), html = "", n = 0, tot = 0;
    document.querySelectorAll(".gridTab").forEach(function (b) { b.classList.toggle("on", b.dataset.script === gridScript); });
    ROWS.forEach(function (row) {
      var cells = row.kana.slice();
      if (row.name === "ya-row") cells = [cells[0], null, cells[1], null, cells[2]];
      if (row.name === "wa-row") cells = [cells[0], null, null, cells[1], cells[2]];
      cells.forEach(function (k) {
        if (!k) { html += '<div class="kc blank" aria-hidden="true"></div>'; return; }
        var ch = gridScript === "katakana" ? k[1] : k[0], s0 = progress.kana[ch], ms = CP.isMastered(s0); tot++; if (ms) n++;
        var cls = ms ? "kc mastered" : (s0 ? "kc seen" : "kc"), pr = s0 ? Math.min(1, s0.c / CP.MASTER_CORRECT) : 0;
        var tip = s0 ? (s0.c + " correct, " + s0.w + " missed") : "not seen yet";
        var label = ch + ", " + k[2] + (ms ? ", mastered" : "") + ", " + tip + ". Tap to hear it.";
        html += '<button type="button" class="' + cls + '" data-ch="' + ch + '" title="' + tip + ' · tap to hear" aria-label="' + label + '"><b lang="ja">' + ch + '</b><i>' + k[2] + '</i>' + (s0 && !ms ? '<span class="pb"><span style="width:' + Math.round(pr * 100) + '%"></span></span>' : "") + "</button>";
      });
    });
    g.innerHTML = html;
    $("masteryCount").textContent = (gridScript === "katakana" ? "Katakana" : "Hiragana") + " mastered: " + n + " / " + tot + "  ·  total mastered: " + masteredCount() + " / 92";
  }
  $("petBtn").addEventListener("click", openPetScreen);
  $("overPetBtn").addEventListener("click", openPetScreen);
  $("petBack").addEventListener("click", function () { show("petScreen", false); toTitle(); });
  $("kanaGrid").addEventListener("click", function (ev) { var b = ev.target.closest && ev.target.closest(".kc[data-ch]"); if (b) hearKana(b, "gridSay"); });
  $("toPractice").addEventListener("click", function (ev) { var b = ev.target.closest && ev.target.closest(".pk[data-ch]"); if (b) hearKana(b, "practiceSay"); });
  $("bigPet").addEventListener("pointerdown", function () { petPokeT = 1.2; audio(); sfx.master(); });
  document.querySelectorAll(".gridTab").forEach(function (b) { b.addEventListener("click", function () { gridScript = b.dataset.script; buildGrid(); }); });

  function applyMute() { $("muteBtn").textContent = settings.muted ? "🔇" : "🔊"; }

  function startGame() {
    audio(); newGame(); state = "play";
    show("startScreen", false); show("overScreen", false); show("pauseScreen", false); show("petScreen", false);
    show("controls", true); show("pauseBtn", true);
    applyInputMode();
    if (settings.input === "type" && !isTouch) setTimeout(function () { input.focus(); }, 50);
  }
  var overAt = 0, overPetMood = "happy";
  function gameOver() {
    state = "over"; overAt = Date.now(); sfx.over(); input.blur();
    var hi = load(highKey(), 0), isNew = G.score > hi;
    if (isNew) save(highKey(), G.score);
    $("finalScore").textContent = G.score; $("overHigh").textContent = Math.max(hi, G.score);
    $("finalLevel").textContent = G.level; $("finalCombo").textContent = G.best;
    $("finalAcc").textContent = G.shots ? Math.round(100 * G.hits / G.shots) : 0;
    show("newHigh", isNew);
    var missed = Object.keys(G.missed).sort(function (a, b) { return G.missed[b] - G.missed[a]; }).slice(0, 6);
    var lookup = {}; ROWS.forEach(function (r) { r.kana.forEach(function (k) { lookup[k[0]] = k[2]; lookup[k[1]] = k[2]; }); });
    $("toPractice").innerHTML = missed.length ? "Practice these (tap to hear): " + missed.map(function (c) { return "<button type='button' class='pk' data-ch='" + c + "' aria-label='" + c + " = " + lookup[c] + ", tap to hear it'><b lang='ja'>" + c + "</b>=" + lookup[c] + "</button>"; }).join(" ") : "";
    $("practiceSay").textContent = ""; show("practiceSay", false);
    saveProgress();
    var ps = CP.STAGES[petStage()];
    $("overPetLine").innerHTML = CP.petById(progress.pet).name + " (" + ps.name + ") gained <b style='color:#ffe94d'>+" + G.xpGained + " XP</b>" +
      (G.newMastered.length ? " · newly mastered: <b style='color:#fff;font-size:1.2em'>" + G.newMastered.join(" ") + "</b>" : "");
    overPetMood = isNew || G.newMastered.length ? "cheer" : "happy";
    setTimeout(function () { show("overScreen", true); show("controls", false); show("pauseBtn", false); }, 700);
  }
  function pause() { if (state !== "play") return; state = "pause"; show("pauseScreen", true); input.blur(); }
  function resume() { if (state !== "pause") return; state = "play"; show("pauseScreen", false); if (settings.input === "type" && !isTouch) input.focus(); }
  function toTitle() { state = "title"; G = null; buildPicker(); show("petScreen", false); show("pauseScreen", false); show("overScreen", false); show("controls", false); show("pauseBtn", false); show("startScreen", true); applyScript(); requestAnimationFrame(resize); }

  $("startBtn").addEventListener("click", startGame);
  $("againBtn").addEventListener("click", startGame);
  $("titleBtn").addEventListener("click", toTitle);
  $("quitBtn").addEventListener("click", toTitle);
  $("resumeBtn").addEventListener("click", resume);
  $("pauseBtn").addEventListener("click", function () { state === "pause" ? resume() : pause(); });
  $("muteBtn").addEventListener("click", function () { settings.muted = !settings.muted; save("muted", settings.muted); applyMute(); if (!settings.muted) { audio(); sfx.shoot(); } });
  $("modeToggle").addEventListener("click", function () { settings.input = settings.input === "tap" ? "type" : "tap"; save("input", settings.input); applyInputMode(); });
  document.querySelectorAll(".modeBtn").forEach(function (b) { b.addEventListener("click", function () { settings.script = b.dataset.script; save("script", settings.script); applyScript(); }); });
  document.querySelectorAll(".inBtn").forEach(function (b) { b.addEventListener("click", function () { settings.input = b.dataset.input; save("input", settings.input); applyInputMode(); }); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
  // tapping the playfield in type mode re-focuses the input (desktop)
  canvas.addEventListener("pointerdown", function () { if (state === "play" && settings.input === "type") input.focus(); });

  // ---------- boot ----------
  buildPicker(); applyScript(); applyMute(); applyInputMode(); resize();
  if (params.get("screen") === "pet") openPetScreen();
  requestAnimationFrame(loop);
  if (DEMO) startGame();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  // test hook
  window.__kanaArcade = { get state() { return state; }, get game() { return G; }, settings: settings, progress: progress, petStage: petStage,
    missFor: function (ch) { if (state === "play" && G) { var e = G.enemies[0]; if (!e) { spawn(); e = G.enemies[0]; } e.ch = ch; e.answers = [romajiOf(ch)]; missGround(e); } } };
})();
