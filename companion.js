/* Kana Arcade companions: kawaii pets drawn with canvas, plus progress/evolution logic. */
(function (root) {
  "use strict";
  var PETS = [
    { id: "neko", name: "Nekomaru", jp: "ネコまる", kind: "cat", body: "#ffe3ee", accent: "#ff8fb8", belly: "#fff7fb", dark: "#c95b85" },
    { id: "kitsune", name: "Kon", jp: "コンちゃん", kind: "fox", body: "#ffad5c", accent: "#ff7a2b", belly: "#fff4e6", dark: "#9b4a14" },
    { id: "ryu", name: "Ryuta", jp: "りゅうた", kind: "dragon", body: "#8ff0c8", accent: "#2bb98a", belly: "#fff6c0", dark: "#1d7a5c" }
  ];
  var STAGES = [
    { key: "egg",    name: "Egg",    jp: "たまご",    xp: 0,    mastered: 0 },
    { key: "baby",   name: "Baby",   jp: "あかちゃん", xp: 30,   mastered: 0 },
    { key: "kid",    name: "Kid",    jp: "こども",    xp: 300,  mastered: 5 },
    { key: "teen",   name: "Teen",   jp: "わかもの",  xp: 1200, mastered: 15 },
    { key: "master", name: "Master", jp: "せんせい",  xp: 3000, mastered: 35 }
  ];
  var MASTER_CORRECT = 8, MASTER_ACC = 0.8;

  function isMastered(st) { return !!st && st.c >= MASTER_CORRECT && st.c / (st.c + st.w) >= MASTER_ACC; }
  function countMastered(kanaStats) { var n = 0; for (var k in kanaStats) if (isMastered(kanaStats[k])) n++; return n; }
  function stageFor(xp, mastered) {
    var s = 0;
    for (var i = 1; i < STAGES.length; i++) if (xp >= STAGES[i].xp && mastered >= STAGES[i].mastered) s = i; else break;
    return s;
  }
  function petById(id) { for (var i = 0; i < PETS.length; i++) if (PETS[i].id === id) return PETS[i]; return PETS[0]; }
  function newProgress() { var p = { pet: "neko", pets: {}, kana: {} }; PETS.forEach(function (x) { p.pets[x.id] = { xp: 0 }; }); return p; }
  function normalize(p) {
    var d = newProgress(); if (!p || typeof p !== "object") return d;
    d.pet = petById(p.pet).id; d.kana = p.kana && typeof p.kana === "object" ? p.kana : {};
    PETS.forEach(function (x) { d.pets[x.id] = { xp: (p.pets && p.pets[x.id] && +p.pets[x.id].xp) || 0 }; });
    return d;
  }

  // ---------------- drawing ----------------
  function draw(ctx, id, stage, x, y, s, mood, t, opts) {
    // x,y = bottom-centre of the pet; s = nominal size in px
    opts = opts || {};
    var P = petById(id), sil = opts.silhouette;
    var C = function (c) { return sil || c; };
    t = t || 0; mood = mood || "idle";
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    var bounce = 0, squash = 1;
    if (mood === "happy") bounce = Math.abs(Math.sin(t * 12)) * s * 0.12;
    else if (mood === "cheer") bounce = Math.abs(Math.sin(t * 9)) * s * 0.22;
    else if (mood === "sad") squash = 0.92;
    else bounce = Math.abs(Math.sin(t * 2.2)) * s * 0.03;

    // 🎃 spooky-season costume (js/costumes.js); opts.costume can force one ("none" = off)
    var KC = root.KA_COSTUMES, look = sil ? null : (opts.costume ? (KC && KC.LOOKS && opts.costume !== "none" ? { id: opts.costume } : null) : (KC ? KC.costumeFor(P.id, stage) : null));
    var still = !!opts.still || !!(KC && KC.still());
    if (stage <= 0) { drawEgg(ctx, P, x, y - bounce, s, mood, t, C, look, still); ctx.restore(); return; }
    var k = [0, 0.58, 0.72, 0.86, 1][stage], r = s * 0.36 * k;
    var cx = x, cy = y - r * squash - bounce;

    if (stage >= 4 && !sil) { // aura
      for (var i = 3; i >= 1; i--) {
        ctx.globalAlpha = 0.12 + 0.05 * Math.sin(t * 3 + i);
        ell(ctx, cx, cy - r * 0.2, r * (1.3 + i * 0.28 + 0.05 * Math.sin(t * 4)), r * (1.3 + i * 0.28), i % 2 ? "#ffe94d" : "#ff8fd9");
      }
      ctx.globalAlpha = 1;
    }
    // shadow
    if (!sil) { ctx.globalAlpha = 0.25; ell(ctx, x, y + 2, r * 0.9, r * 0.18, "#000"); ctx.globalAlpha = 1; }

    // behind-body parts
    if (P.kind === "cat") {
      ctx.strokeStyle = C(P.accent); ctx.lineWidth = r * 0.22;
      ctx.beginPath(); ctx.moveTo(cx + r * 0.8, cy + r * 0.5);
      ctx.quadraticCurveTo(cx + r * 1.6, cy + r * 0.2 + Math.sin(t * 3) * r * 0.2, cx + r * 1.35, cy - r * 0.6 + Math.sin(t * 3) * r * 0.25); ctx.stroke();
    } else if (P.kind === "fox") {
      var tails = [0, 1, 1, 2, 3][stage];
      for (var j = 0; j < tails; j++) {
        var ang = -0.5 + (tails > 1 ? j / (tails - 1) : 0.5) * 1.1 + Math.sin(t * 3 + j) * 0.08;
        ctx.save(); ctx.translate(cx + r * 0.7, cy + r * 0.45); ctx.rotate(ang - 0.6);
        ell(ctx, r * 0.75, 0, r * 0.75, r * 0.32, C(P.body)); ell(ctx, r * 1.25, 0, r * 0.28, r * 0.22, C(P.belly));
        ctx.restore();
      }
    } else { // dragon wings + tail
      var wing = r * (0.5 + stage * 0.15), flap = Math.sin(t * (mood === "cheer" ? 14 : 4)) * 0.25;
      [-1, 1].forEach(function (sd) {
        ctx.save(); ctx.translate(cx + sd * r * 0.6, cy - r * 0.2); ctx.rotate(sd * (0.4 + flap)); ctx.fillStyle = C(P.accent);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sd * wing, -wing * 0.9); ctx.lineTo(sd * wing * 0.9, -wing * 0.2); ctx.lineTo(sd * wing * 1.05, wing * 0.15); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = C(P.accent); ctx.beginPath(); ctx.moveTo(cx + r * 0.7, cy + r * 0.5); ctx.lineTo(cx + r * 1.5, cy + r * 0.75); ctx.lineTo(cx + r * 0.8, cy + r * 0.85); ctx.fill();
    }
    // ears / horns
    if (P.kind === "cat" || P.kind === "fox") {
      var eh = P.kind === "fox" ? 0.85 : 0.6;
      [-1, 1].forEach(function (sd) {
        var wig = sd * Math.sin(t * 5) * r * 0.03;
        tri(ctx, cx + sd * r * 0.75 + wig, cy - r * 0.45, cx + sd * r * 0.55 + wig, cy - r * (0.8 + eh), cx + sd * r * 0.15, cy - r * 0.8, C(P.body));
        tri(ctx, cx + sd * r * 0.62 + wig, cy - r * 0.6, cx + sd * r * 0.53 + wig, cy - r * (0.7 + eh * 0.8), cx + sd * r * 0.3, cy - r * 0.8, C(P.kind === "fox" ? P.dark : P.accent));
      });
    } else {
      var hl = r * (0.25 + stage * 0.08);
      [-1, 1].forEach(function (sd) { tri(ctx, cx + sd * r * 0.5, cy - r * 0.75, cx + sd * r * 0.62, cy - r * 0.8 - hl, cx + sd * r * 0.25, cy - r * 0.9, C("#ffe27a")); });
    }
    // feet
    ell(ctx, cx - r * 0.45, cy + r * 0.88, r * 0.28, r * 0.16, C(P.accent)); ell(ctx, cx + r * 0.45, cy + r * 0.88, r * 0.28, r * 0.16, C(P.accent));
    // arms (raised when cheering)
    var up = mood === "cheer" ? -1 : (mood === "happy" ? -0.4 : 0.3);
    [-1, 1].forEach(function (sd) { ell(ctx, cx + sd * r * 0.95, cy + r * (0.15 + up * 0.5), r * 0.17, r * 0.23, C(P.body)); });
    // body
    ell(ctx, cx, cy, r * 1.02, r * squash, C(P.body));
    ell(ctx, cx, cy + r * 0.3, r * 0.6, r * 0.55, C(P.belly));
    if (P.kind === "fox" && !sil) { ell(ctx, cx - r * 0.42, cy + r * 0.05, r * 0.3, r * 0.22, P.belly); ell(ctx, cx + r * 0.42, cy + r * 0.05, r * 0.3, r * 0.22, P.belly); }
    if (sil) { ctx.restore(); return; }

    // face
    var blink = (Math.floor(t * 10) % 37) === 0;
    var ey = cy - r * 0.12, ex = r * 0.36, er = r * 0.13;
    ctx.strokeStyle = "#2a1530"; ctx.fillStyle = "#2a1530"; ctx.lineWidth = Math.max(1.5, r * 0.07);
    if (mood === "happy" || mood === "cheer") {
      [-1, 1].forEach(function (sd) { ctx.beginPath(); ctx.arc(cx + sd * ex, ey + er * 0.4, er, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
    } else if (blink) {
      [-1, 1].forEach(function (sd) { ctx.beginPath(); ctx.moveTo(cx + sd * ex - er, ey); ctx.lineTo(cx + sd * ex + er, ey); ctx.stroke(); });
    } else {
      [-1, 1].forEach(function (sd) {
        ell(ctx, cx + sd * ex, ey, er, er * 1.2, "#2a1530");
        ell(ctx, cx + sd * ex + er * 0.35, ey - er * 0.45, er * 0.38, er * 0.38, "#fff");
        ell(ctx, cx + sd * ex - er * 0.3, ey + er * 0.4, er * 0.18, er * 0.18, "#fff");
      });
      if (mood === "sad") {
        [-1, 1].forEach(function (sd) { ctx.beginPath(); ctx.moveTo(cx + sd * (ex + er), ey - er * 1.4); ctx.lineTo(cx + sd * (ex - er * 0.8), ey - er * 2); ctx.stroke(); });
        ell(ctx, cx + ex + er * 0.6, ey + er * 1.6 + (t * 30 % (r * 0.5)), er * 0.35, er * 0.5, "#6cc8ff");
      }
    }
    ctx.globalAlpha = 0.55; ell(ctx, cx - r * 0.62, cy + r * 0.12, r * 0.15, r * 0.09, "#ff6b9a"); ell(ctx, cx + r * 0.62, cy + r * 0.12, r * 0.15, r * 0.09, "#ff6b9a"); ctx.globalAlpha = 1;
    var my = cy + r * 0.12;
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    if (mood === "cheer") { ctx.fillStyle = "#c2325a"; ctx.beginPath(); ctx.arc(cx, my, r * 0.14, 0, Math.PI); ctx.fill(); }
    else if (mood === "sad") { ctx.beginPath(); ctx.arc(cx, my + r * 0.12, r * 0.1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else if (P.kind === "cat") { ctx.beginPath(); ctx.arc(cx - r * 0.07, my, r * 0.07, 0, Math.PI); ctx.arc(cx + r * 0.07, my, r * 0.07, 0, Math.PI); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(cx, my - r * 0.03, r * 0.1, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    if (P.kind === "cat") {
      ctx.strokeStyle = "rgba(42,21,48,0.5)"; ctx.lineWidth = Math.max(1, r * 0.03);
      [-1, 1].forEach(function (sd) { for (var w = -1; w <= 1; w += 2) { ctx.beginPath(); ctx.moveTo(cx + sd * r * 0.5, my + w * r * 0.03); ctx.lineTo(cx + sd * r * 0.95, my + w * r * 0.1 - r * 0.02); ctx.stroke(); } });
    }
    if (P.kind === "fox") ell(ctx, cx, my - r * 0.13, r * 0.06, r * 0.045, "#2a1530");
    if (P.kind === "dragon") { ell(ctx, cx - r * 0.1, my - r * 0.14, r * 0.03, r * 0.03, P.dark); ell(ctx, cx + r * 0.1, my - r * 0.14, r * 0.03, r * 0.03, P.dark); }

    // accessories by stage
    if (stage === 1 && !look) { // bit of eggshell on the head (a costume hat replaces it)
      ctx.fillStyle = "#fff8e6"; ctx.strokeStyle = "#e8d6a8"; ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy - r * 0.78);
      ctx.lineTo(cx - r * 0.3, cy - r * 1.02); ctx.lineTo(cx - r * 0.12, cy - r * 0.88); ctx.lineTo(cx, cy - r * 1.06); ctx.lineTo(cx + r * 0.14, cy - r * 0.88);
      ctx.lineTo(cx + r * 0.3, cy - r * 1.02); ctx.lineTo(cx + r * 0.45, cy - r * 0.78);
      ctx.quadraticCurveTo(cx, cy - r * 0.6, cx - r * 0.45, cy - r * 0.78); ctx.fill(); ctx.stroke();
    }
    if (stage === 2 || stage === 3) { // hachimaki headband
      ctx.fillStyle = "#ff3b5c"; ctx.fillRect(cx - r * 0.95, cy - r * 0.62, r * 1.9, r * 0.18);
      ell(ctx, cx, cy - r * 0.53, r * 0.1, r * 0.07, "#fff");
      ctx.strokeStyle = "#ff3b5c"; ctx.lineWidth = r * 0.1; var fl = Math.sin(t * 8) * r * 0.08;
      ctx.beginPath(); ctx.moveTo(cx + r * 0.9, cy - r * 0.55); ctx.lineTo(cx + r * 1.3, cy - r * 0.75 + fl); ctx.moveTo(cx + r * 0.9, cy - r * 0.55); ctx.lineTo(cx + r * 1.35, cy - r * 0.45 - fl); ctx.stroke();
    }
    if (stage >= 3) { // scarf
      ctx.fillStyle = "#2be8ff"; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.5, r * 0.78, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - r * 0.55, cy + r * 0.52, r * 0.18, r * 0.42 + Math.sin(t * 6) * r * 0.05);
    }
    if (stage >= 4) { // crown
      var cw = r * 0.8, ch = r * 0.45, by = cy - r * 0.82;
      ctx.fillStyle = "#ffd23d"; ctx.strokeStyle = "#c98a00"; ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath(); ctx.moveTo(cx - cw / 2, by); ctx.lineTo(cx - cw / 2, by - ch * 0.6); ctx.lineTo(cx - cw / 4, by - ch * 0.25); ctx.lineTo(cx, by - ch);
      ctx.lineTo(cx + cw / 4, by - ch * 0.25); ctx.lineTo(cx + cw / 2, by - ch * 0.6); ctx.lineTo(cx + cw / 2, by); ctx.closePath(); ctx.fill(); ctx.stroke();
      ell(ctx, cx, by - ch * 0.3, r * 0.06, r * 0.06, "#ff3b5c");
    }
    if (look) drawCostume(ctx, look.id, cx, cy - r * squash * 0.8, r, t, still);
    if (stage >= 3) sparkles(ctx, cx, cy - r * 0.2, r * 1.6, t, stage >= 4 ? 5 : 3);
    ctx.restore();
  }

  // 🎃 costumes, drawn on top of the head. hx,hy = top-centre of the head, r = head radius.
  function drawCostume(ctx, id, hx, hy, r, t, still) {
    var sway = still ? 0 : Math.sin(t * 2.2) * 0.07, lw = Math.max(1, r * 0.04);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(sway);
    if (id === "witch") {
      ctx.rotate(-0.12);
      ell(ctx, 0, 0, r * 0.82, r * 0.17, "#4a2a7a");                     // brim
      ctx.fillStyle = "#6b3fa0"; ctx.strokeStyle = "#3a1f63"; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-r * 0.46, -r * 0.04);
      ctx.quadraticCurveTo(-r * 0.2, -r * 0.7, r * 0.05, -r * 1.05);       // cone up to a bent tip
      ctx.quadraticCurveTo(r * 0.35, -r * 1.2, r * 0.6, -r * 0.98);
      ctx.quadraticCurveTo(r * 0.3, -r * 0.85, r * 0.2, -r * 0.6);
      ctx.lineTo(r * 0.46, -r * 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ff9a3d"; ctx.beginPath();                          // orange band
      ctx.moveTo(-r * 0.43, -r * 0.1); ctx.lineTo(r * 0.43, -r * 0.1); ctx.lineTo(r * 0.38, -r * 0.27); ctx.lineTo(-r * 0.36, -r * 0.27); ctx.closePath(); ctx.fill();
      star(ctx, 0, -r * 0.19, r * 0.11, "#ffe94d");                        // gold star buckle
    } else if (id === "pumpkin") {
      var py = -r * 0.25, pr = r * 0.74;
      ell(ctx, -pr * 0.45, py, pr * 0.5, pr * 0.5, "#ff8a24"); ell(ctx, pr * 0.45, py, pr * 0.5, pr * 0.5, "#ff8a24");
      ell(ctx, 0, py - pr * 0.05, pr * 0.55, pr * 0.56, "#ffa23d");
      ctx.strokeStyle = "#d9661a"; ctx.lineWidth = lw;
      [-0.28, 0.28].forEach(function (k) { ctx.beginPath(); ctx.moveTo(pr * k, py - pr * 0.5); ctx.quadraticCurveTo(pr * k * 1.6, py, pr * k, py + pr * 0.45); ctx.stroke(); });
      ell(ctx, -pr * 0.18, py - pr * 0.05, pr * 0.07, pr * 0.07, "#7a3a0c"); ell(ctx, pr * 0.18, py - pr * 0.05, pr * 0.07, pr * 0.07, "#7a3a0c"); // tiny happy face
      ctx.strokeStyle = "#7a3a0c"; ctx.beginPath(); ctx.arc(0, py + pr * 0.08, pr * 0.12, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.fillStyle = "#4f8a2a"; ctx.fillRect(-pr * 0.07, py - pr * 0.82, pr * 0.14, pr * 0.3); // stem
      ctx.save(); ctx.translate(pr * 0.12, py - pr * 0.7); ctx.rotate(-0.5); ell(ctx, pr * 0.2, 0, pr * 0.22, pr * 0.1, "#5fcf6a"); ctx.restore(); // leaf
    } else if (id === "bat") {
      ctx.strokeStyle = "#3b2a55"; ctx.lineWidth = Math.max(1.5, r * 0.1);
      ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.72, r * 0.42, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); // headband
      var flap = still ? 0 : Math.sin(t * 6) * 0.12;
      [-1, 1].forEach(function (sd) {
        ctx.save(); ctx.translate(sd * r * 0.62, -r * 0.05); ctx.rotate(sd * (0.35 + flap)); ctx.scale(sd, 1);
        ctx.fillStyle = "#3b2a55"; ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.3, -r * 0.5, r * 0.7, -r * 0.42);
        ctx.quadraticCurveTo(r * 0.6, -r * 0.2, r * 0.55, -r * 0.05);
        ctx.quadraticCurveTo(r * 0.45, -r * 0.18, r * 0.36, -r * 0.02);
        ctx.quadraticCurveTo(r * 0.25, -r * 0.14, r * 0.16, r * 0.02); ctx.closePath(); ctx.fill();
        ell(ctx, r * 0.4, -r * 0.3, r * 0.04, r * 0.04, "#b98cff");        // a little shine
        ctx.restore();
      });
    }
    ctx.restore();
  }
  function star(ctx, x, y, R, c) {
    ctx.fillStyle = c; ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  function drawEgg(ctx, P, x, y, s, mood, t, C, look, still) {
    var w = s * 0.27, h = s * 0.34, rot = Math.sin(t * (mood === "happy" || mood === "cheer" ? 14 : 2.5)) * (mood === "idle" ? 0.06 : 0.18);
    ctx.globalAlpha = 0.25; ell(ctx, x, y + 2, w * 0.9, w * 0.2, "#000"); ctx.globalAlpha = 1;
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = C("#fff8e6"); ctx.beginPath();
    ctx.moveTo(0, -h * 2); ctx.bezierCurveTo(w * 1.1, -h * 2, w * 1.2, 0, 0, 0); ctx.bezierCurveTo(-w * 1.2, 0, -w * 1.1, -h * 2, 0, -h * 2); ctx.fill();
    if (C("#000") !== "#000") return;
    ctx.save(); ctx.clip();
    ell(ctx, -w * 0.4, -h * 1.4, w * 0.22, w * 0.18, P.accent); ell(ctx, w * 0.45, -h * 0.9, w * 0.25, w * 0.2, P.accent); ell(ctx, -w * 0.2, -h * 0.45, w * 0.18, w * 0.14, P.accent);
    ctx.strokeStyle = P.dark; ctx.lineWidth = Math.max(1.5, s * 0.02); ctx.beginPath();
    for (var i = 0; i <= 8; i++) { var xx = -w + i * w / 4; ctx[i ? "lineTo" : "moveTo"](xx, -h * 1.05 + (i % 2 ? -h * 0.12 : h * 0.12)); }
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = "#2a1530"; ell(ctx, -w * 0.25, -h * 0.75, w * 0.07, w * 0.09, "#2a1530"); ell(ctx, w * 0.25, -h * 0.75, w * 0.07, w * 0.09, "#2a1530");
    ctx.globalAlpha = 0.5; ell(ctx, -w * 0.45, -h * 0.6, w * 0.1, w * 0.06, "#ff6b9a"); ell(ctx, w * 0.45, -h * 0.6, w * 0.1, w * 0.06, "#ff6b9a"); ctx.globalAlpha = 1;
    if (look) drawCostume(ctx, look.id, 0, -h * 1.9, w * 0.85, t, still); // even eggs dress up
  }
  function sparkles(ctx, x, y, R, t, n) {
    for (var i = 0; i < n; i++) {
      var a = t * 0.8 + i * Math.PI * 2 / n, px = x + Math.cos(a) * R, py = y + Math.sin(a) * R * 0.7, sz = R * 0.07 * (0.6 + 0.4 * Math.sin(t * 5 + i));
      ctx.fillStyle = i % 2 ? "#ffe94d" : "#ffffff";
      ctx.beginPath(); ctx.moveTo(px, py - sz * 2); ctx.lineTo(px + sz * 0.5, py - sz * 0.5); ctx.lineTo(px + sz * 2, py); ctx.lineTo(px + sz * 0.5, py + sz * 0.5);
      ctx.lineTo(px, py + sz * 2); ctx.lineTo(px - sz * 0.5, py + sz * 0.5); ctx.lineTo(px - sz * 2, py); ctx.lineTo(px - sz * 0.5, py - sz * 0.5); ctx.fill();
    }
  }
  function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fill(); }
  function tri(ctx, a, b, c, d, e, f, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.closePath(); ctx.fill(); }

  var API = { PETS: PETS, STAGES: STAGES, MASTER_CORRECT: MASTER_CORRECT, MASTER_ACC: MASTER_ACC,
    drawCostume: drawCostume, isMastered: isMastered, countMastered: countMastered, stageFor: stageFor, petById: petById, newProgress: newProgress, normalize: normalize, draw: draw };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.COMPANION = API;
})(this);
