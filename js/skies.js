// 🌌 Arcade skies: six playfield backgrounds you unlock by mastering kana (★ 8+ right, 80%+ accuracy).
// 🌃 Neon night (the classic look) is always there; 🌸 Sakura night, 🌊 Deep sea, 🗻 Fuji dusk, 🏮 Festival
// lanterns and 🌈 Rainbow aurora open up at 5 / 15 / 30 / 50 / 75 mastered kana. Drawn on the canvas only, so it
// works offline with no downloads and no wallet. One save key, kanaArcade.sky = { id, best }: "best" remembers the
// most kana you ever had mastered, so a sky you earned stays yours even if a kana slips. Junk falls back to neon.
// Pure logic + drawing are testable in node (module.exports); the 🌌 SKY sheet wires itself up in the browser.
(function (root) {
  "use strict";
  var SKIES = [
    { id: "neon", icon: "🌃", name: "Neon night", jp: "ネオン", need: 0, grid: "#ff2bd6" },
    { id: "sakura", icon: "🌸", name: "Sakura night", jp: "さくら", need: 5, grid: "#ff8fb8" },
    { id: "ocean", icon: "🌊", name: "Deep sea", jp: "うみ", need: 15, grid: "#2be8ff" },
    { id: "fuji", icon: "🗻", name: "Fuji dusk", jp: "ふじさん", need: 30, grid: "#ffb347" },
    { id: "matsuri", icon: "🏮", name: "Festival lanterns", jp: "まつり", need: 50, grid: "#ff6b4a" },
    { id: "rainbow", icon: "🌈", name: "Rainbow aurora", jp: "にじ", need: 75, grid: "#b98cff" }
  ];
  var DEFAULT = "neon";
  function byId(id) { for (var i = 0; i < SKIES.length; i++) if (SKIES[i].id === id) return SKIES[i]; return null; }
  function num(n) { n = Number(n); return isFinite(n) && n > 0 ? Math.floor(n) : 0; }
  // saved value → { id, best }; anything odd falls back quietly
  function normalize(v) {
    var o = v && typeof v === "object" && !Array.isArray(v) ? v : {};
    var best = Math.min(999, num(o.best)), s = byId(o.id);
    return { id: s && best >= s.need ? s.id : DEFAULT, best: best };
  }
  function isUnlocked(id, best) { var s = byId(id); return !!s && num(best) >= s.need; }
  function unlocked(best) { return SKIES.filter(function (s) { return num(best) >= s.need; }).map(function (s) { return s.id; }); }
  // skies that open up when your best goes from `before` to `after`
  function newly(before, after) { before = num(before); after = num(after); return SKIES.filter(function (s) { return s.need > before && s.need <= after; }); }
  function nextSky(best) { best = num(best); for (var i = 0; i < SKIES.length; i++) if (SKIES[i].need > best) return SKIES[i]; return null; }
  function lockText(s, best) { var left = s.need - num(best); return "🔒 master " + s.need + " kana" + (left > 0 ? " (" + left + " to go)" : ""); }

  // ---------- drawing ----------
  function grad(ctx, H, stops) { var g = ctx.createLinearGradient(0, 0, 0, H); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }
  function floor(ctx, W, H, gy, t, col, still) {
    ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    for (var i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * W * 0.04, gy); ctx.lineTo(W / 2 + i * W * 0.2, H + 4); ctx.stroke(); }
    var off = (t * 40) % 12;
    for (var j = 0; j < 6; j++) { var yy = gy + Math.pow(j + off / 12, 1.6) * 4; if (yy < H) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); } }
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); ctx.restore();
  }
  function dots(ctx, stars, rgb, alpha, sz) { stars.forEach(function (s) { ctx.fillStyle = "rgba(" + rgb + "," + (s.z * alpha) + ")"; ctx.fillRect(s.x, s.y, s.z * sz, s.z * sz); }); }
  function draw(ctx, id, o) {
    var W = o.W, H = o.H, gy = o.gy, t = o.t || 0, stars = o.stars || [], still = !!o.calm, s = byId(id) || byId(DEFAULT);
    ctx.save();
    if (s.id === "neon") {
      ctx.fillStyle = "#07021a"; ctx.fillRect(-20, -20, W + 40, H + 40);
      dots(ctx, stars, "200,220,255", 0.8, 2.5);
    } else if (s.id === "sakura") {
      ctx.fillStyle = grad(ctx, H, [[0, "#12031f"], [0.6, "#2a0833"], [1, "#3d0c3e"]]); ctx.fillRect(-20, -20, W + 40, H + 40);
      var mx = W * 0.82, my = H * 0.14, mr = Math.max(18, Math.min(W, H) * 0.07);
      ctx.shadowColor = "#ffd0e6"; ctx.shadowBlur = 30; ctx.fillStyle = "rgba(255,226,240,0.85)"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      stars.forEach(function (p, i) { // drifting petals
        var x = p.x + (still ? 0 : Math.sin(t * 1.3 + i) * 10 * p.z), r = 2 + p.z * 3.2, a = still ? i : t * (0.8 + p.z) + i;
        ctx.save(); ctx.translate(x, p.y); ctx.rotate(a); ctx.fillStyle = "rgba(255," + (150 + Math.round(p.z * 60)) + ",200," + (0.35 + p.z * 0.45) + ")";
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, 0, 0, 7); ctx.fill(); ctx.restore();
      });
    } else if (s.id === "ocean") {
      ctx.fillStyle = grad(ctx, H, [[0, "#012238"], [0.55, "#011a2e"], [1, "#000c1c"]]); ctx.fillRect(-20, -20, W + 40, H + 40);
      for (var k = 0; k < 4; k++) { // soft light rays from the surface
        var rx = W * (0.15 + k * 0.25) + (still ? 0 : Math.sin(t * 0.4 + k) * 12);
        var rw = Math.max(8, W * 0.025);
        ctx.fillStyle = "rgba(120,230,255,0.04)"; ctx.beginPath(); ctx.moveTo(rx - rw, -4); ctx.lineTo(rx + rw, -4); ctx.lineTo(rx + rw * 4, gy); ctx.lineTo(rx - rw * 0.5, gy); ctx.closePath(); ctx.fill();
      }
      ctx.lineWidth = 1;
      stars.forEach(function (p, i) { // bubbles rise (the shared star field falls, so flip it)
        var y = H - p.y, x = p.x + (still ? 0 : Math.sin(t * 2 + i) * 3), r = 1.2 + p.z * 3; if (y > gy - r) return;
        ctx.strokeStyle = "rgba(160,240,255," + (0.25 + p.z * 0.5) + ")"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
      });
    } else if (s.id === "fuji") {
      ctx.fillStyle = grad(ctx, H, [[0, "#0b0626"], [0.45, "#2a0c45"], [0.8, "#5a1648"], [1, "#7a2340"]]); ctx.fillRect(-20, -20, W + 40, H + 40);
      stars.forEach(function (p) { if (p.y < gy * 0.5) { ctx.fillStyle = "rgba(255,230,200," + (p.z * 0.7) + ")"; ctx.fillRect(p.x, p.y, p.z * 2, p.z * 2); } });
      var sr = Math.min(W, H) * 0.16; // setting sun behind the mountain
      ctx.shadowColor = "#ffb347"; ctx.shadowBlur = 30; ctx.fillStyle = "rgba(255,150,90,0.55)"; ctx.beginPath(); ctx.arc(W * 0.5, gy - sr * 0.35, sr, Math.PI, 0); ctx.fill(); ctx.shadowBlur = 0;
      var fw = Math.min(W * 0.9, H * 0.9), peak = gy - fw * 0.36, cx = W * 0.5;
      ctx.fillStyle = "#1b0b2c"; ctx.beginPath(); ctx.moveTo(cx - fw / 2, gy); ctx.lineTo(cx - fw * 0.09, peak); ctx.lineTo(cx + fw * 0.09, peak); ctx.lineTo(cx + fw / 2, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(240,235,255,0.75)"; ctx.beginPath(); ctx.moveTo(cx - fw * 0.09, peak); ctx.lineTo(cx + fw * 0.09, peak); ctx.lineTo(cx + fw * 0.16, peak + fw * 0.09);
      ctx.lineTo(cx + fw * 0.06, peak + fw * 0.06); ctx.lineTo(cx, peak + fw * 0.1); ctx.lineTo(cx - fw * 0.07, peak + fw * 0.06); ctx.lineTo(cx - fw * 0.16, peak + fw * 0.09); ctx.closePath(); ctx.fill();
    } else if (s.id === "matsuri") {
      ctx.fillStyle = grad(ctx, H, [[0, "#14040e"], [0.6, "#230818"], [1, "#2e0a14"]]); ctx.fillRect(-20, -20, W + 40, H + 40);
      stars.forEach(function (p, i) { // fireflies
        var a = still ? 0.6 : 0.35 + 0.35 * Math.sin(t * 2 + i * 1.7);
        ctx.fillStyle = "rgba(255,210,120," + (a * p.z) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, 0.8 + p.z * 1.6, 0, 7); ctx.fill();
      });
      var n = Math.max(4, Math.round(W / 90)), ly = Math.max(26, H * 0.06), lw = Math.max(12, Math.min(22, W / 26));
      ctx.strokeStyle = "rgba(255,200,150,0.35)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, ly - 10);
      for (var q = 0; q <= n; q++) ctx.quadraticCurveTo(W * (q - 0.5) / n, ly + 6, W * q / n, ly - 10); ctx.stroke();
      for (var m = 0; m < n; m++) { // swaying paper lanterns
        var lx = W * (m + 0.5) / n, sw = still ? 0 : Math.sin(t * 1.2 + m) * 0.08;
        ctx.save(); ctx.translate(lx, ly - 2); ctx.rotate(sw);
        ctx.shadowColor = "#ff5a36"; ctx.shadowBlur = 16; ctx.fillStyle = m % 2 ? "#e8343a" : "#ff6b4a";
        ctx.beginPath(); ctx.ellipse(0, lw * 0.9, lw * 0.7, lw * 0.9, 0, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = "#2a0a0a"; ctx.fillRect(-lw * 0.35, -1, lw * 0.7, 3); ctx.fillRect(-lw * 0.35, lw * 1.7, lw * 0.7, 3);
        ctx.strokeStyle = "rgba(255,230,180,0.35)"; ctx.lineWidth = 1; for (var r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(-lw * 0.68, lw * 0.45 * r); ctx.lineTo(lw * 0.68, lw * 0.45 * r); ctx.stroke(); }
        ctx.restore();
      }
    } else if (s.id === "rainbow") {
      ctx.fillStyle = "#050a1e"; ctx.fillRect(-20, -20, W + 40, H + 40);
      dots(ctx, stars, "220,230,255", 0.7, 2.2);
      var hues = [330, 280, 200, 150, 50];
      ctx.globalCompositeOperation = "lighter";
      hues.forEach(function (h, b) { // aurora ribbons
        var base = H * (0.16 + b * 0.075), ph = still ? b : t * 0.5 + b;
        ctx.fillStyle = "hsla(" + h + ",90%,60%,0.10)"; ctx.beginPath(); ctx.moveTo(0, base);
        for (var x = 0; x <= W + 20; x += 20) ctx.lineTo(x, base + Math.sin(x / W * 6 + ph) * H * 0.03);
        for (var x2 = W + 20; x2 >= 0; x2 -= 20) ctx.lineTo(x2, base + H * 0.06 + Math.sin(x2 / W * 5 + ph * 1.3) * H * 0.025);
        ctx.closePath(); ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
    floor(ctx, W, H, gy, t, s.grid, still);
  }

  var API = { SKIES: SKIES, DEFAULT: DEFAULT, byId: byId, normalize: normalize, isUnlocked: isUnlocked, unlocked: unlocked, newly: newly, nextSky: nextSky, lockText: lockText, draw: draw };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  root.KA_SKY = API;

  // ---------- browser: saved choice + the 🌌 SKY sheet ----------
  var KEY = "kanaArcade.sky", state = null;
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function store() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function ka() { return root.__kanaArcade || {}; }
  function masteredNow() { var k = ka(), C = root.COMPANION; return k.progress && C ? C.countMastered(k.progress.kana) : 0; }
  function cur() { if (!state) state = normalize(load()); return state; }
  // remember a new best mastered count; returns skies that just opened up
  function note(mastered) {
    var s = cur(), m = Math.min(999, num(mastered)); if (m <= s.best) return [];
    var fresh = newly(s.best, m); s.best = m; store(); return fresh;
  }
  API.current = function () { return cur().id; };
  API.best = function () { return cur().best; };
  API.note = note;
  API.set = function (id) { note(masteredNow()); var s = cur(); if (!isUnlocked(id, s.best)) return false; s.id = id; store(); return true; };

  var $ = function (id) { return document.getElementById(id); };
  var screen = null, lastFocus = null;
  function isOpen() { return !!screen && !screen.classList.contains("hidden"); }
  function ruby(s) { return root.KA_ROMAJI ? root.KA_ROMAJI.ruby(s) : s; }
  function romaji(s) { return root.KA_ROMAJI ? root.KA_ROMAJI.toRomaji(s) : ""; }
  function preview(cv, id) {
    var w = 132, h = 78, d = Math.min(root.devicePixelRatio || 1, 2), c = cv.getContext && cv.getContext("2d"); if (!c) return;
    cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0);
    var seed = 7, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }, st = [];
    for (var i = 0; i < 26; i++) st.push({ x: rnd() * w, y: rnd() * h, z: rnd() * 0.8 + 0.2 });
    draw(c, id, { W: w, H: h, gy: h - 14, t: 0.6, stars: st, calm: true });
  }
  function say(msg) { var el = $("skySay"); if (el) el.innerHTML = msg; }
  function render() {
    var s = cur(), list = $("skyList"); list.innerHTML = "";
    SKIES.forEach(function (k) {
      var open = s.best >= k.need, on = s.id === k.id, b = document.createElement("button");
      b.type = "button"; b.className = "skyOpt" + (on ? " on" : "") + (open ? "" : " locked"); b.dataset.sky = k.id;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (!open) b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-label", k.name + " sky, " + k.jp + " " + romaji(k.jp) + (on ? ", in use" : open ? "" : ", locked: master " + k.need + " kana, " + Math.max(0, k.need - s.best) + " to go"));
      b.innerHTML = '<canvas aria-hidden="true"></canvas><span class="skyName">' + k.icon + " " + k.name + '</span><span class="skyJp" lang="ja">' + ruby(k.jp) + "</span>" +
        '<small class="skyLock">' + (on ? "✓ in use" : open ? "tap to use" : lockText(k, s.best)) + "</small>";
      list.appendChild(b); preview(b.querySelector("canvas"), k.id);
    });
    var nx = nextSky(s.best), P = ka().pet ? ka().pet() : null, who = P ? P.name : "Your companion";
    $("skySub").textContent = who + ": " + (nx ? "Master " + (nx.need - s.best) + " more kana to open " + nx.icon + " " + nx.name + "!" : "You opened every sky! すごい ✨");
  }
  function open() {
    if (isOpen()) return; lastFocus = document.activeElement;
    note(masteredNow()); render(); say("");
    screen.classList.remove("hidden");
    var on = screen.querySelector(".skyOpt.on"); (on || $("skyBack")).focus();
  }
  function close() {
    if (!isOpen()) return; screen.classList.add("hidden");
    var back = lastFocus && lastFocus.offsetParent !== null ? lastFocus : $("skyBtn"); if (back && back.focus) back.focus();
  }
  function pick(b) {
    var id = b.dataset.sky, k = byId(id), s = cur();
    if (!isUnlocked(id, s.best)) { say("🔒 " + k.icon + " " + k.name + " opens when you have <b>" + k.need + "</b> kana ★ mastered (" + (k.need - s.best) + " to go). Keep playing!"); return; }
    var changed = s.id !== id; API.set(id); render(); say("🌌 " + k.icon + " " + k.name + " " + '<span lang="ja">' + ruby(k.jp) + "</span>" + (changed ? " is your sky now!" : " is already your sky."));
    var nb = screen.querySelector('.skyOpt[data-sky="' + id + '"]'); if (nb) nb.focus();
    if (changed) { if (ka().drop) ka().drop(); if (ka().toast) ka().toast("🌌 Sky: " + k.icon + " " + k.name); }
    applyBtn();
  }
  function applyBtn() { var b = $("skyBtn"), k = byId(cur().id); if (b) { b.textContent = "🌌 Sky: " + k.icon; b.setAttribute("aria-label", "Playfield sky: " + k.name + ". Choose a sky"); } }
  function boot() {
    screen = $("skyScreen"); if (!screen) return;
    note(masteredNow()); applyBtn();
    $("skyBtn").addEventListener("click", open);
    $("skyClose").addEventListener("click", close);
    $("skyBack").addEventListener("click", close);
    $("skyList").addEventListener("click", function (ev) { var b = ev.target.closest && ev.target.closest(".skyOpt"); if (b) pick(b); });
    screen.addEventListener("click", function (ev) { if (ev.target === screen) close(); });
    // capture on window (loaded before js/keys.js) so the sheet owns Esc / Enter / Tab while open
    root.addEventListener("keydown", function (ev) {
      if (!isOpen() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
      if (ev.key === "Enter" || ev.key === " ") { ev.stopImmediatePropagation(); return; } // the focused button works, nothing underneath
      if (ev.key === "Tab") {
        var f = [$("skyClose")].concat([].slice.call(screen.querySelectorAll(".skyOpt")), [$("skyBack")]), i = f.indexOf(document.activeElement);
        ev.preventDefault(); ev.stopImmediatePropagation(); f[(i + (ev.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus();
      }
    }, true);
  }
  API.open = open; API.close = close; API.isOpen = isOpen; API.refresh = function () { state = null; note(masteredNow()); applyBtn(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(this);
