// 👇 Swipe down to close: on phones and tablets every sheet (companion, badge book, omikuji, home screen help,
// shortcuts) gets a little pink grab bar. Pull it down and it follows your finger while the backdrop fades,
// then tucks away with a soft drop sound; a little tug springs back. Scrolled lists just scroll until you're
// back at the top (or grab the bar). Gentle mode / reduce motion close straight away. Mouse screens unchanged.
// Closing reuses each sheet's own ◀ BACK / ✕ button, so nothing else changes. No save keys.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var SHEETS = [
    { id: "petScreen", close: "petBack" },
    { id: "badgeScreen", close: "badgeBack" },
    { id: "omikujiScreen", close: "omikujiBack" },
    { id: "keysScreen", panel: "keysSheet", close: "keysClose" },
    { id: "installScreen", panel: "installSheet", close: "installClose" },
    { id: "skyScreen", panel: "skySheet", close: "skyClose" },
    { id: "statsScreen", panel: "statsSheet", close: "statsClose" }
  ];
  function ka() { return window.__kanaArcade || {}; }
  function calm() { return !!(ka().isCalm && ka().isCalm()); }

  function setup(cfg) {
    var screen = $(cfg.id), panel = cfg.panel ? $(cfg.panel) : screen, btn = $(cfg.close);
    if (!screen || !panel || !btn) return;
    var full = panel === screen, d = null, closing = false;
    var bar = document.createElement("div");
    bar.className = "grabBar"; bar.setAttribute("aria-hidden", "true"); bar.title = "Swipe down to close";
    panel.insertBefore(bar, panel.firstChild);

    function h() { return panel.getBoundingClientRect().height || window.innerHeight || 600; }
    function apply(dy) {
      panel.style.transform = dy ? "translateY(" + dy + "px)" : "";
      var f = Math.min(1, dy / (h() * 0.9));
      if (full) screen.style.opacity = dy ? String(1 - f * 0.7) : "";
      else screen.style.backgroundColor = dy ? "rgba(7,2,26," + (0.8 * (1 - f)).toFixed(3) + ")" : "";
    }
    function reset() {
      panel.classList.remove("dragging", "springBack", "swipeOut");
      panel.style.transform = ""; screen.style.opacity = ""; screen.style.backgroundColor = "";
    }
    function spring() {
      if (calm()) { reset(); return; }
      panel.classList.add("springBack"); apply(0);
      setTimeout(function () { panel.classList.remove("springBack"); }, 280);
    }
    function close() {
      closing = true;
      if (ka().drop) ka().drop();
      var done = function () {
        closing = false; btn.click(); reset();
        document.dispatchEvent(new CustomEvent("ka:swipeclose", { detail: { id: cfg.id } }));
      };
      if (calm()) { done(); return; }
      panel.classList.add("swipeOut");
      panel.style.transform = "translateY(" + Math.round(h() + 40) + "px)";
      if (full) screen.style.opacity = "0"; else screen.style.backgroundColor = "rgba(7,2,26,0)";
      setTimeout(done, 210);
    }

    panel.addEventListener("touchstart", function (ev) {
      d = null;
      if (closing || ev.touches.length !== 1 || screen.classList.contains("hidden")) return;
      var t = ev.target;
      if (t.closest && t.closest("input, textarea, select")) return;
      var onBar = !!(t.closest && t.closest(".grabBar"));
      if (!onBar) {
        if (screen.scrollTop > 2) return; // scrolled down: let the list scroll back up first
        for (var el = t; el && el !== panel; el = el.parentElement) {
          if (el.scrollHeight > el.clientHeight + 2 && el.scrollTop > 2) return;
        }
      }
      var p = ev.touches[0], now = Date.now();
      d = { x: p.clientX, y: p.clientY, dy: 0, on: false, last: p.clientY, lastT: now, v: 0 };
    }, { passive: true });

    panel.addEventListener("touchmove", function (ev) {
      if (!d) return;
      var p = ev.touches[0], dx = p.clientX - d.x, dy = p.clientY - d.y;
      if (!d.on) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (dy > 0 && dy > Math.abs(dx) * 1.2) { d.on = true; panel.classList.add("dragging"); }
        else { d = null; return; } // sideways or upwards: not a close gesture
      }
      if (ev.cancelable) ev.preventDefault();
      var now = Date.now();
      d.v = (p.clientY - d.last) / Math.max(1, now - d.lastT); d.last = p.clientY; d.lastT = now;
      d.dy = Math.max(0, dy); apply(d.dy);
    }, { passive: false });

    panel.addEventListener("touchend", function () {
      if (!d) return;
      var dd = d; d = null;
      if (!dd.on) return;
      panel.classList.remove("dragging");
      if (dd.dy > Math.min(140, h() * 0.25) || (dd.v > 0.6 && dd.dy > 40)) close(); else spring();
    });
    panel.addEventListener("touchcancel", function () { var on = d && d.on; d = null; panel.classList.remove("dragging"); if (on) spring(); });
  }

  SHEETS.forEach(setup);
  window.KA_SWIPE = { sheets: SHEETS.map(function (s) { return s.id; }) };
})();
