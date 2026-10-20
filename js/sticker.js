/* 📸 Companion sticker: draws a cute 640×800 picture card of your companion (its name in Japanese, growth stage,
   how many kana you've mastered and a strip of them, today's date) right in the browser, then saves it as a PNG
   (share sheet on phones that can share files, normal download otherwise). Works offline, no wallet, no save keys.
   Needs window.COMPANION for the art. Exposes window.KA_STICKER. */
(function (root) {
  "use strict";
  var W = 640, H = 800;
  var JP_FONT = "'Hiragino Maru Gothic ProN','Hiragino Sans','Yu Gothic','Meiryo','Noto Sans CJK JP',sans-serif";
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dayStr(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fileName(pet, d) { return "kana-arcade-" + String(pet || "companion").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + dayStr(d) + ".png"; }
  function rr(x, cx, cy, w, h, r) { x.beginPath(); x.moveTo(cx + r, cy); x.arcTo(cx + w, cy, cx + w, cy + h, r); x.arcTo(cx + w, cy + h, cx, cy + h, r); x.arcTo(cx, cy + h, cx, cy, r); x.arcTo(cx, cy, cx + w, cy, r); x.closePath(); }
  function star(x, cx, cy, R, c) {
    x.fillStyle = c; x.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 - Math.PI / 2, rad = i % 2 ? R * 0.32 : R; x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
    x.closePath(); x.fill();
  }
  // o: { petId, name, nick, jp, ro, stage, stageName, stageJp, mastered, total, kana: [chars], costume, date }
  function make(o, canvas) {
    var CP = root.COMPANION;
    var c = canvas || document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    // card: soft pink with polka dots and a neon-pink arcade border
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#fff0f7"); g.addColorStop(1, "#ffe0ef");
    x.fillStyle = "#2a0a3d"; x.fillRect(0, 0, W, H);
    rr(x, 16, 16, W - 32, H - 32, 36); x.fillStyle = g; x.fill();
    x.save(); rr(x, 16, 16, W - 32, H - 32, 36); x.clip();
    x.fillStyle = "rgba(255,143,184,0.18)";
    for (var yy = 40, row = 0; yy < H; yy += 44, row++) for (var xx = (row % 2) ? 44 : 22; xx < W; xx += 44) { x.beginPath(); x.arc(xx, yy, 6, 0, Math.PI * 2); x.fill(); }
    x.restore();
    x.lineWidth = 6; x.strokeStyle = "#ff2bd6"; rr(x, 16, 16, W - 32, H - 32, 36); x.stroke();
    x.lineWidth = 2; x.strokeStyle = "#ffb3d1"; rr(x, 28, 28, W - 56, H - 56, 28); x.stroke();
    // header
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillStyle = "#8a2be2"; x.font = "bold 22px 'Courier New', monospace"; x.fillText("KANA ARCADE", W / 2, 72);
    x.fillStyle = "#c2185b"; x.font = "18px " + JP_FONT; x.fillText("かなアーケード", W / 2, 98);
    // spotlight + companion
    var sp = x.createRadialGradient(W / 2, 330, 20, W / 2, 330, 210); sp.addColorStop(0, "rgba(255,255,255,0.95)"); sp.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = sp; x.beginPath(); x.arc(W / 2, 330, 210, 0, Math.PI * 2); x.fill();
    x.fillStyle = "rgba(201,91,133,0.18)"; x.beginPath(); x.ellipse(W / 2, 478, 130, 18, 0, 0, Math.PI * 2); x.fill();
    if (CP) CP.draw(x, o.petId, o.stage || 0, W / 2, 476, 300, "happy", 0, { still: true, costume: o.costume || undefined });
    [[120, 170, 16, "#ffe94d"], [520, 200, 12, "#2be8ff"], [100, 400, 10, "#ff8fb8"], [540, 420, 18, "#ffe94d"], [470, 130, 9, "#ff8fb8"]].forEach(function (s) { star(x, s[0], s[1], s[2], s[3]); });
    // name
    x.fillStyle = "#c2185b"; x.font = "bold 52px " + JP_FONT; x.fillText(o.jp || "", W / 2, 548);
    x.fillStyle = "#8a2be2"; x.font = "bold 22px 'Courier New', monospace";
    var nm = (o.ro ? o.ro + " · " : "") + (o.name || "") + (o.nick ? " aka \u201c" + o.nick + "\u201d" : "");
    if (o.nick) { x.font = "bold 22px 'Courier New', " + JP_FONT; var nw = x.measureText(nm).width; if (nw > W - 80) x.font = "bold " + Math.max(13, Math.floor(22 * (W - 80) / nw)) + "px 'Courier New', " + JP_FONT; }
    x.fillText(nm, W / 2, 580);
    // stage ribbon
    var rib = (o.stage >= 4 ? "★ " : "") + "Stage " + ((o.stage || 0) + 1) + "/5 · " + (o.stageName || "") + " · " + (o.stageJp || "") + (o.stage >= 4 ? " ★" : "");
    x.font = "bold 22px " + JP_FONT; var rw = Math.min(W - 80, x.measureText(rib).width + 48);
    rr(x, (W - rw) / 2, 598, rw, 40, 20); x.fillStyle = o.stage >= 4 ? "#ffd23f" : "#ff8fb8"; x.fill();
    x.fillStyle = o.stage >= 4 ? "#6b3d00" : "#fff"; x.fillText(rib, W / 2, 626);
    // mastered kana
    x.fillStyle = "#07021a"; x.font = "bold 22px 'Courier New', monospace";
    x.fillText("★ " + (o.mastered || 0) + " / " + (o.total || 92) + " kana mastered", W / 2, 676);
    var ks = (o.kana || []).slice(0, 12);
    if (ks.length) { x.fillStyle = "#c2185b"; x.font = "30px " + JP_FONT; x.fillText(ks.join(" ") + ((o.kana || []).length > 12 ? " …" : ""), W / 2, 716); }
    else { x.fillStyle = "#8a2be2"; x.font = "20px " + JP_FONT; x.fillText("がんばって! Your first kana star is coming ✨", W / 2, 714); }
    x.fillStyle = "#b0679a"; x.font = "16px 'Courier New', monospace"; x.fillText(dayStr(o.date), W / 2, 754);
    return c;
  }

  // 📸 Group photo: a 960×760 polaroid of all your companions together on a hill, the current one front and centre.
  // o: { friends: [{ petId, name, nick, jp, stage, stageName, stageJp, met }], current, mastered, total, date }
  var GW = 960, GH = 760;
  function groupFileName(d) { return "kana-arcade-group-" + dayStr(d) + ".png"; }
  function groupOrder(friends, current) {
    var cur = null, rest = [];
    (friends || []).forEach(function (f) { if (f.petId === current && !cur) cur = f; else rest.push(f); });
    if (!cur) return rest;
    var out = rest.slice(); out.splice(Math.floor(out.length / 2), 0, cur); return out;
  }
  function groupCaption(n) { return n <= 0 ? "Pick a companion to start! ✨" : n === 1 ? "1 friend says はい、チーズ!" : n + " friends say はい、チーズ!"; }
  function fitFont(x, text, size, maxW, family) {
    x.font = "bold " + size + "px " + family; var w = x.measureText(text).width;
    if (w > maxW) x.font = "bold " + Math.max(11, Math.floor(size * maxW / w)) + "px " + family;
  }
  function makeGroup(o, canvas) {
    o = o || {};
    var CP = root.COMPANION;
    var c = canvas || document.createElement("canvas"); c.width = GW; c.height = GH;
    var x = c.getContext("2d");
    x.fillStyle = "#2a0a3d"; x.fillRect(0, 0, GW, GH);
    // polaroid
    x.save(); x.translate(GW / 2, GH / 2); x.rotate(-0.012); x.translate(-GW / 2, -GH / 2);
    x.shadowColor = "rgba(255,43,214,0.55)"; x.shadowBlur = 28;
    rr(x, 36, 30, GW - 72, GH - 60, 18); x.fillStyle = "#fffaf3"; x.fill();
    x.shadowBlur = 0;
    var PX = 64, PY = 58, PWd = GW - 128, PHt = 500;
    x.save(); rr(x, PX, PY, PWd, PHt, 10); x.clip();
    var sky = x.createLinearGradient(0, PY, 0, PY + PHt); sky.addColorStop(0, "#b9a8ff"); sky.addColorStop(0.55, "#ffc4e4"); sky.addColorStop(1, "#ffe8d6");
    x.fillStyle = sky; x.fillRect(PX, PY, PWd, PHt);
    // sun + clouds + sparkles
    x.fillStyle = "rgba(255,240,180,0.9)"; x.beginPath(); x.arc(PX + PWd - 110, PY + 90, 46, 0, Math.PI * 2); x.fill();
    x.fillStyle = "rgba(255,255,255,0.85)";
    [[PX + 120, PY + 80, 1], [PX + 360, PY + 54, 0.8], [PX + 560, PY + 110, 0.9]].forEach(function (q) {
      var cx = q[0], cy = q[1], k = q[2]; x.beginPath(); x.arc(cx, cy, 24 * k, 0, Math.PI * 2); x.arc(cx + 26 * k, cy - 10 * k, 28 * k, 0, Math.PI * 2); x.arc(cx + 56 * k, cy, 22 * k, 0, Math.PI * 2); x.fill();
    });
    [[PX + 60, PY + 170, 10, "#ffe94d"], [PX + PWd - 60, PY + 200, 12, "#2be8ff"], [PX + 250, PY + 150, 8, "#ff8fb8"], [PX + PWd - 260, PY + 160, 9, "#ffe94d"]].forEach(function (s) { star(x, s[0], s[1], s[2], s[3]); });
    // hill
    x.fillStyle = "#a8e6a1"; x.beginPath(); x.moveTo(PX, PY + PHt); x.lineTo(PX, PY + 380); x.quadraticCurveTo(PX + PWd / 2, PY + 300, PX + PWd, PY + 380); x.lineTo(PX + PWd, PY + PHt); x.closePath(); x.fill();
    x.fillStyle = "#8fd88a"; x.beginPath(); x.moveTo(PX, PY + PHt); x.lineTo(PX, PY + 440); x.quadraticCurveTo(PX + PWd / 2, PY + 390, PX + PWd, PY + 440); x.lineTo(PX + PWd, PY + PHt); x.closePath(); x.fill();
    // tiny flowers
    for (var i = 0; i < 14; i++) { var fx = PX + 30 + i * (PWd - 60) / 13, fy = PY + 455 + (i % 3) * 12; x.fillStyle = i % 2 ? "#ffffff" : "#ffd1ea"; x.beginPath(); x.arc(fx, fy, 4, 0, Math.PI * 2); x.fill(); x.fillStyle = "#ffe94d"; x.beginPath(); x.arc(fx, fy, 1.6, 0, Math.PI * 2); x.fill(); }
    // companions
    var fr = groupOrder(o.friends, o.current), n = fr.length, slot = PWd / Math.max(1, n);
    fr.forEach(function (f, idx) {
      var front = f.petId === o.current, cx = PX + slot * (idx + 0.5), base = PY + (front ? 430 : 400), size = front ? 250 : 200;
      x.fillStyle = "rgba(40,90,40,0.18)"; x.beginPath(); x.ellipse(cx, base - 2, size * 0.36, 12, 0, 0, Math.PI * 2); x.fill();
      if (CP) CP.draw(x, f.petId, f.met ? (f.stage || 0) : 0, cx, base, size, f.met ? "happy" : "idle", 0, f.met ? { still: true } : { still: true, silhouette: "rgba(90,70,150,0.35)" });
      if (!f.met) { x.fillStyle = "#6a4fc2"; x.font = "bold 44px 'Courier New', monospace"; x.textAlign = "center"; x.fillText("?", cx, base - size * 0.42); }
    });
    x.restore();
    x.lineWidth = 2; x.strokeStyle = "#e9d8ff"; rr(x, PX, PY, PWd, PHt, 10); x.stroke();
    // name tags under the photo
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    fr.forEach(function (f, idx) {
      var cx = PX + slot * (idx + 0.5), tw = Math.min(slot - 16, 260), ty = PY + PHt + 14;
      rr(x, cx - tw / 2, ty, tw, 58, 14); x.fillStyle = f.met ? (f.stage >= 4 ? "#ffd23f" : "#ffe0ef") : "#ece6ff"; x.fill();
      var label = f.met ? (f.nick || f.name || "") : "Not friends yet";
      x.fillStyle = f.met ? "#c2185b" : "#6a4fc2"; fitFont(x, label, 22, tw - 20, "'Courier New', " + JP_FONT); x.fillText(label, cx, ty + 25);
      var sub = f.met ? ((f.jp || "") + " · " + (f.stageJp || "") + " " + (f.stageName || "")) : ((f.jp || "") + " · まだ?");
      x.fillStyle = f.met && f.stage >= 4 ? "#6b3d00" : "#8a2be2"; fitFont(x, sub, 16, tw - 20, JP_FONT); x.fillText(sub, cx, ty + 48);
    });
    var met = fr.filter(function (f) { return f.met; }).length;
    x.fillStyle = "#07021a"; fitFont(x, groupCaption(met), 30, GW - 160, "'Courier New', " + JP_FONT); x.fillText(groupCaption(met), GW / 2, PY + PHt + 116);
    x.fillStyle = "#8a2be2"; x.font = "bold 18px 'Courier New', monospace";
    x.fillText("KANA ARCADE · ★ " + (o.mastered || 0) + " / " + (o.total || 92) + " kana mastered · " + dayStr(o.date), GW / 2, PY + PHt + 148);
    x.restore();
    return c;
  }
  function toBlob(c) { return new Promise(function (res) { if (c.toBlob) c.toBlob(function (b) { res(b); }, "image/png"); else res(null); }); }
  // Share sheet where files can be shared (phones), download otherwise. Resolves "shared" | "downloaded" | "cancelled".
  function save(c, name, title) {
    return toBlob(c).then(function (blob) {
      var nav = root.navigator, file = null;
      try { file = blob && typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null; } catch (e) { file = null; }
      var touch = root.matchMedia && root.matchMedia("(pointer: coarse)").matches;
      if (file && touch && nav && nav.canShare && nav.share && nav.canShare({ files: [file] })) {
        return nav.share({ files: [file], title: title || "Kana Arcade sticker" }).then(function () { return "shared"; }, function (e) { return e && e.name === "AbortError" ? "cancelled" : download(blob, c, name); });
      }
      return download(blob, c, name);
    });
  }
  function download(blob, c, name) {
    var a = document.createElement("a"), url = blob ? URL.createObjectURL(blob) : c.toDataURL("image/png");
    a.href = url; a.download = name; a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); if (blob) URL.revokeObjectURL(url); }, 1500);
    return "downloaded";
  }
  var API = { W: W, H: H, GW: GW, GH: GH, make: make, makeGroup: makeGroup, groupFileName: groupFileName, groupOrder: groupOrder, groupCaption: groupCaption, toBlob: toBlob, save: save, fileName: fileName, dayStr: dayStr };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_STICKER = API;
})(this);
