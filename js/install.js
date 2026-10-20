// 📲 Add to Home Screen: keep Kana Arcade as a little app (opens in one tap, plays offline).
// Chrome / Edge / Android: uses the browser's own install prompt. iPhone / iPad Safari: shows 3 cute steps.
// Hidden when already running as an app, or when the browser can't install. No save keys; nothing is sent anywhere.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var deferred = null, cheered = false, lastFocus = null;
  var row = $("installRow"), btn = $("installBtn"), screen = $("installScreen");
  function ka() { return window.__kanaArcade || {}; }
  function isApp() {
    try { return !!(window.matchMedia && matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true; } catch (e) { return false; }
  }
  function ua() { return navigator.userAgent || ""; }
  // iPhone / iPod / iPad (incl. iPadOS that pretends to be a Mac) in Safari, which has no install prompt
  function isIOS() { return /iP(hone|od|ad)/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1); }
  function isIOSSafari() { return isIOS() && /Safari/.test(ua()) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua()); }
  function mode() { return isApp() ? "app" : deferred ? "prompt" : isIOSSafari() ? "ios" : "none"; }
  function toast(msg) { if (ka().toast) ka().toast(msg); }
  function refresh() {
    var m = mode();
    document.documentElement.classList.toggle("is-app", m === "app");
    row.classList.toggle("hidden", m === "app" || m === "none");
  }
  function cheer() {
    if (cheered) return; cheered = true;
    var P = ka().pet ? ka().pet() : null;
    toast("🏠 Kana Arcade is on your home screen! " + (P ? P.name + " is one tap away 💕" : "One tap away 💕"));
    if (ka().cheer) ka().cheer();
  }
  function isOpen() { return !screen.classList.contains("hidden"); }
  function openHelp() {
    lastFocus = document.activeElement;
    screen.classList.remove("hidden");
    $("installDone").focus();
  }
  function closeHelp() {
    if (!isOpen()) return;
    screen.classList.add("hidden");
    var back = lastFocus && lastFocus.offsetParent !== null ? lastFocus : $("startBtn");
    if (back && back.focus) back.focus();
  }
  function install() {
    var m = mode();
    if (m === "ios") { openHelp(); return Promise.resolve("help"); }
    if (m !== "prompt") { refresh(); return Promise.resolve("none"); }
    var ev = deferred; deferred = null;
    return Promise.resolve().then(function () { ev.prompt(); return ev.userChoice; })
      .then(function (c) { return (c && c.outcome) || "dismissed"; }, function () { return "dismissed"; })
      .then(function (outcome) {
        if (outcome === "accepted") cheer();
        else toast("Maybe later! 💕 Kana Arcade works right here too.");
        refresh();
        document.dispatchEvent(new CustomEvent("ka:install", { detail: { outcome: outcome } }));
        return outcome;
      });
  }
  // the browser can fire this before anything else is ready, so listen straight away
  window.addEventListener("beforeinstallprompt", function (ev) { ev.preventDefault(); deferred = ev; refresh(); });
  window.addEventListener("appinstalled", function () { deferred = null; refresh(); cheer(); }); // cheer() only runs once

  // while the help sheet is open it owns the keyboard (Esc closes, Tab stays inside, Enter never starts a game)
  window.addEventListener("keydown", function (ev) {
    if (!isOpen()) return;
    if (ev.key === "Tab") {
      var f = [$("installClose"), $("installDone")], i = f.indexOf(document.activeElement);
      ev.preventDefault(); ev.stopImmediatePropagation(); f[(i + (ev.shiftKey ? f.length - 1 : 1)) % f.length].focus(); return;
    }
    if (ev.key === "Enter" || ev.key === " ") { ev.stopImmediatePropagation(); return; }
    ev.stopImmediatePropagation();
    if (ev.key === "Escape") { ev.preventDefault(); closeHelp(); }
  }, true);
  btn.addEventListener("click", install);
  $("installDone").addEventListener("click", closeHelp);
  $("installClose").addEventListener("click", closeHelp);
  screen.addEventListener("click", function (ev) { if (ev.target === screen) closeHelp(); });
  try { matchMedia("(display-mode: standalone)").addEventListener("change", refresh); } catch (e) { /* old browsers */ }
  refresh();
  window.KA_INSTALL = { mode: mode, isApp: isApp, install: install, refresh: refresh, isOpen: isOpen, close: closeHelp };
})();
