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
  // o: { petId, name, jp, ro, stage, stageName, stageJp, mastered, total, kana: [chars], costume, date }
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
    x.fillText((o.ro ? o.ro + " · " : "") + (o.name || ""), W / 2, 580);
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
  function toBlob(c) { return new Promise(function (res) { if (c.toBlob) c.toBlob(function (b) { res(b); }, "image/png"); else res(null); }); }
  // Share sheet where files can be shared (phones), download otherwise. Resolves "shared" | "downloaded" | "cancelled".
  function save(c, name) {
    return toBlob(c).then(function (blob) {
      var nav = root.navigator, file = null;
      try { file = blob && typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null; } catch (e) { file = null; }
      var touch = root.matchMedia && root.matchMedia("(pointer: coarse)").matches;
      if (file && touch && nav && nav.canShare && nav.share && nav.canShare({ files: [file] })) {
        return nav.share({ files: [file], title: "Kana Arcade sticker" }).then(function () { return "shared"; }, function (e) { return e && e.name === "AbortError" ? "cancelled" : download(blob, c, name); });
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
  var API = { W: W, H: H, make: make, toBlob: toBlob, save: save, fileName: fileName, dayStr: dayStr };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_STICKER = API;
})(this);
