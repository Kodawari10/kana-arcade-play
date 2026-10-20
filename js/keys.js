// ⌨ Keyboard shortcuts sheet for laptops: press ? (or the ? button) to see every key.
// Also adds M = sound on/off and T = switch Type/Tap. Runs after game.js; no save keys.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var screen = $("keysScreen"), lastFocus = null;
  function ka() { return window.__kanaArcade || {}; }
  function isOpen() { return !screen.classList.contains("hidden"); }
  function open() {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    if (ka().state === "play") $("pauseBtn").click(); // never let kana fall while you read
    screen.classList.remove("hidden");
    $("keysBack").focus();
  }
  function close() {
    if (!isOpen()) return;
    screen.classList.add("hidden");
    var back = ka().state === "pause" ? $("resumeBtn") : lastFocus;
    if (!back || !back.focus || back === document.body || back.offsetParent === null) back = $("startBtn").offsetParent ? $("startBtn") : null;
    if (back) back.focus();
  }
  function typingRomaji(ev) {
    var k = ka();
    var t = ev.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return true;
    return k.state === "play" && k.settings && k.settings.input === "type";
  }
  // capture phase on window, registered before the badge book's, so the sheet owns the keyboard while open
  window.addEventListener("keydown", function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var q = ev.key === "?" || (ev.key === "/" && ev.shiftKey);
    if (isOpen()) {
      if (ev.key === "Tab") { // keep focus inside the sheet
        var f = [$("keysClose"), $("keysBack")], i = f.indexOf(document.activeElement);
        ev.preventDefault(); f[(i + (ev.shiftKey ? f.length - 1 : 1)) % f.length].focus(); return;
      }
      if (ev.key === "Enter" || ev.key === " ") { // let the focused button work, but nothing underneath
        ev.stopImmediatePropagation(); return;
      }
      ev.stopImmediatePropagation(); ev.preventDefault();
      if (q || ev.key === "Escape") close();
      return;
    }
    if (window.KA_INSTALL && window.KA_INSTALL.isOpen()) return; // the 📲 home screen help owns the keyboard while open
    if (ev.target && (ev.target.id === "nickInput" || ev.target.id === "findInput" || ev.target.tagName === "TEXTAREA")) return; // typing a 🏷️ nickname, a 🔍 kana search or a 💾 save code: ? and letters are just letters
    if (q) { ev.stopImmediatePropagation(); ev.preventDefault(); open(); return; }
    if (typingRomaji(ev) || ev.repeat) return;
    var key = (ev.key || "").toLowerCase();
    if (key === "m") { ev.preventDefault(); $("muteBtn").click(); }
    else if (key === "b" && $("musicBtn")) { ev.preventDefault(); $("musicBtn").click(); }
    else if (key === "t") { ev.preventDefault(); $("modeToggle").click(); }
  }, true);
  document.querySelectorAll(".keysOpen").forEach(function (b) { b.addEventListener("click", function () { isOpen() ? close() : open(); }); });
  $("keysClose").addEventListener("click", close);
  $("keysBack").addEventListener("click", close);
  screen.addEventListener("click", function (ev) { if (ev.target === screen) close(); }); // tap outside the card
  window.KA_KEYS = { open: open, close: close, isOpen: isOpen };
})();
