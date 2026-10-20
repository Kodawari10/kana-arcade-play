/* 💾 Save code: move your progress to another phone or laptop. In 📊 My stats, "Move my progress" shows a
   short code made from this device's Kana Arcade save (mastered kana, companions, words, quest, badges seen,
   high scores, settings). Copy it, paste it on the other device under "Restore" and tap twice to confirm.
   The wallet state (kanaArcade.chain) never goes into a code, so no wallet, session or key ever moves.
   Before a restore, the old save is kept in kanaArcade.beforeRestore so "Undo last restore" can bring it back.
   Pure logic (encode / decode / checks) is exported for tests. Exposes window.KA_SAVECODE. */
(function (root) {
  "use strict";
  var PREFIX = "kanaArcade.", TAG = "KANA1", KEEP = PREFIX + "beforeRestore", SKIP = [PREFIX + "chain", KEEP];
  var KEY_RE = /^kanaArcade\.[A-Za-z0-9._-]{1,48}$/, MAX = 400000;
  function b64(str) {
    var bytes = new TextEncoder().encode(str), s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  function sum(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ("0000000" + h.toString(16)).slice(-8).slice(0, 6); }
  function movable(k) { return KEY_RE.test(k) && SKIP.indexOf(k) < 0; }
  // store: { key: string value } of everything in localStorage → code string
  function encode(store) {
    var d = {}; Object.keys(store || {}).sort().forEach(function (k) { if (movable(k) && typeof store[k] === "string") d[k] = store[k]; });
    var body = b64(JSON.stringify({ v: 1, d: d }));
    return TAG + "." + body + "." + sum(body);
  }
  function hasProgress(d) {
    try { var p = JSON.parse(d[PREFIX + "progress"]); return !!p && typeof p === "object" && !!p.pets && typeof p.pets === "object"; } catch (e) { return false; }
  }
  // code → { ok: true, data: {key: value}, seen: kana met, keys: n } | { ok: false, why }
  // opts.any: also accept a save with no companion progress yet (used only for undo)
  function decode(code, opts) {
    var c = String(code || "").replace(/\s+/g, "");
    if (!c) return { ok: false, why: "empty" };
    if (c.length > MAX) return { ok: false, why: "toolong" };
    var parts = c.split(".");
    if (parts.length !== 3 || parts[0] !== TAG) return { ok: false, why: "notcode" };
    if (sum(parts[1]) !== parts[2]) return { ok: false, why: "broken" };
    var o; try { o = JSON.parse(unb64(parts[1])); } catch (e) { return { ok: false, why: "broken" }; }
    if (!o || o.v !== 1 || !o.d || typeof o.d !== "object" || Array.isArray(o.d)) return { ok: false, why: "broken" };
    var data = {}, n = 0;
    for (var k in o.d) { if (!Object.prototype.hasOwnProperty.call(o.d, k)) continue; if (!movable(k) || typeof o.d[k] !== "string") return { ok: false, why: "broken" }; data[k] = o.d[k]; n++; }
    if (!hasProgress(data)) { if (opts && opts.any) return { ok: true, data: data, keys: n, seen: 0 }; return { ok: false, why: "noprogress" }; }
    var p = JSON.parse(data[PREFIX + "progress"]), seen = 0;
    if (p.kana && typeof p.kana === "object") Object.keys(p.kana).forEach(function (ch) { var s = p.kana[ch]; if (s && typeof s === "object" && (+s.c || 0) > 0) seen++; });
    return { ok: true, data: data, keys: n, seen: seen };
  }
  var WHY = {
    empty: "Paste a code first 📋", toolong: "That's too long to be a Kana Arcade code.",
    notcode: "That doesn't look like a Kana Arcade code. It starts with KANA1.",
    broken: "That code is missing a piece. Copy the whole code again and paste it.",
    noprogress: "That code has no companion progress inside, so nothing was changed."
  };
  // read / write the real localStorage (browser only)
  function readStore(ls) { var o = {}; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(PREFIX) === 0) o[k] = ls.getItem(k); } return o; }
  function apply(ls, data) {
    var before = encode(readStore(ls));
    Object.keys(readStore(ls)).forEach(function (k) { if (movable(k)) ls.removeItem(k); });
    Object.keys(data).forEach(function (k) { ls.setItem(k, data[k]); });
    ls.setItem(KEEP, before);
    return before;
  }
  var API = { encode: encode, decode: decode, sum: sum, movable: movable, WHY: WHY, KEEP: KEEP, readStore: readStore, apply: apply };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  root.KA_SAVECODE = API;

  // ---------- UI (inside 📊 My stats) ----------
  var $ = function (id) { return document.getElementById(id); }, armed = false;
  function ka() { return root.__kanaArcade || {}; }
  function msg(t, good) { var m = $("scMsg"); m.textContent = t; m.className = "scMsg" + (good ? " good" : t ? " bad" : ""); }
  function disarm() { armed = false; var b = $("scRestore"); if (b) { b.textContent = "♻️ Restore"; b.classList.remove("armed"); } }
  function refresh() {
    $("scOut").value = encode(readStore(localStorage));
    $("scUndo").classList.toggle("hidden", !localStorage.getItem(KEEP));
  }
  function toggle(force) {
    var box = $("scBox"), show = typeof force === "boolean" ? force : box.classList.contains("hidden");
    box.classList.toggle("hidden", !show); $("scToggle").setAttribute("aria-expanded", String(show));
    disarm(); msg("");
    if (show) refresh();
  }
  function copy() {
    var out = $("scOut"), code = out.value;
    function done(ok) { msg(ok ? "Copied! Paste it on your other device ✨" : "Select the code and copy it by hand 📋", ok); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(function () { done(true); }, function () { out.select(); done(false); }); return; } } catch (e) {}
    out.focus(); out.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} done(ok);
  }
  function reload() { try { root.dispatchEvent(new CustomEvent("ka:restored")); } catch (e) {} if (!root.__kaNoReload) location.reload(); }
  function restore() {
    var r = decode($("scIn").value);
    if (!r.ok) { disarm(); msg(WHY[r.why] || WHY.broken); return; }
    if (!armed) {
      armed = true; var b = $("scRestore"); b.textContent = "⚠️ Tap again to replace this device's progress"; b.classList.add("armed");
      msg("This code has " + r.seen + " kana you've met. Tap again to use it here (you can undo).", true); return;
    }
    apply(localStorage, r.data); disarm(); msg("Restored! Loading your progress… おかえり!", true); reload();
  }
  function undo() {
    var prev = localStorage.getItem(KEEP), r = decode(prev, { any: true });
    if (!r.ok) { localStorage.removeItem(KEEP); refresh(); msg("There's nothing to undo."); return; }
    apply(localStorage, r.data); localStorage.removeItem(KEEP); msg("Back to how it was before the restore ↩", true); reload();
  }
  function boot() {
    if (!$("scToggle")) return;
    $("scToggle").addEventListener("click", function () { toggle(); });
    $("scCopy").addEventListener("click", copy);
    $("scRestore").addEventListener("click", restore);
    $("scUndo").addEventListener("click", undo);
    $("scIn").addEventListener("input", function () { disarm(); msg(""); });
    $("scOut").addEventListener("focus", function () { this.select(); });
    root.addEventListener("ka:stats", function () { toggle(false); });
  }
  API.toggle = toggle; API.refresh = refresh;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(this);
