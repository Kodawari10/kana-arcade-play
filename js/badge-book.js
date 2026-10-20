/* Kana Arcade: 🏅 Badge book (offline). Shows the 32 badges you can earn (20 kana-row badges + 12 companion
 * growth stamps), with your companion explaining them. The optional Starknet layer (js/starknet.js) plugs in
 * through KA_BOOK.setChain(...) to mark badges that are stamped on-chain; without it everything still works. */
(function () {
  "use strict";
  var B = window.KA_BADGES, CP = window.COMPANION, A = window.__kanaArcade;
  if (!B || !CP || !A) return;
  var $ = function (id) { return document.getElementById(id); };
  var SEEN_KEY = "kanaArcade.badgesSeen";
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var chain = null; // { minted: Set<number>, connected: bool, configured: bool, holders(id), tokenUrl(id) }
  var from = "startScreen", selected = null, tipI = 0, sayT = 0;

  function progress() { return A.progress; }
  function earned() { return B.earned(progress()); }
  function pet() { return CP.petById(progress().pet); }
  function stage() { var p = progress(); return CP.stageFor(p.pets[p.pet].xp, CP.countMastered(p.kana)); }

  var TIPS = [
    function () { return "Master every kana in a row to earn its badge! ★"; },
    function () { return "When I grow up, you get a growth stamp. Let's grow together ♡"; },
    function () { return "Badges live right here on this device. No internet needed!"; },
    function () { return chain && chain.enabled ? "Want to keep them forever? Connect a wallet and stamp them on Starknet ✦ (totally optional)" : "Keep playing, more badges are waiting!"; },
    function () { return chain && chain.enabled ? "On Starknet, badges are soulbound: nobody can sell or move them. They just say “I learned this!”" : "がんばって! You can do it!"; },
    function () { return chain && chain.enabled ? "With Cartridge you sign in with a passkey, no seed phrase. Minting can even be free when it's sponsored!" : "Tap a badge and I'll tell you about it."; },
    function () { return "Tap a badge and I'll tell you about it."; }
  ];
  function say(msg, hold) {
    var el = $("badgeSay"); if (!el) return;
    el.textContent = msg; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    sayT = hold ? 9 : 6;
  }
  function nextTip() { say(TIPS[tipI++ % TIPS.length]()); }

  function render() {
    var got = new Set(earned()), on = chain && chain.minted ? chain.minted : new Set();
    var n = 0, html = "";
    B.ALL.forEach(function (b, i) {
      if (i === 20) html += '<div class="bdgSep">' + "COMPANION GROWTH STAMPS" + "</div>";
      if (i === 0) html += '<div class="bdgSep">' + "KANA ROW BADGES" + "</div>";
      var has = got.has(b.id), oc = on.has(b.id); if (has || oc) n++;
      var cls = "bdg " + b.kind + (has || oc ? " got" : "") + (oc ? " onchain" : "") + (selected === b.id ? " sel" : "");
      html += '<button type="button" role="listitem" class="' + cls + '" data-id="' + b.id + '" aria-label="' + esc(b.title + (has || oc ? ", earned" : ", not earned yet") + (oc ? ", on Starknet" : "")) + '">' +
        '<b>' + esc(b.icon) + '</b><i>' + esc(b.kind === "row" ? (b.script === "hiragana" ? "ひら" : "カタ") : b.name.split(" · ")[1]) + '</i>' +
        (b.kind === "stamp" ? '<u>' + esc(b.name.split(" · ")[0]) + '</u>' : "") + (oc ? '<em aria-hidden="true">✦</em>' : "") + "</button>";
    });
    $("badgeGrid").innerHTML = html;
    $("badgeSub").textContent = n + " / " + B.count + " badges earned" + (on.size ? "  ·  ✦ " + on.size + " on Starknet" : "");
    $("badgeGrid").querySelectorAll(".bdg").forEach(function (el) { el.addEventListener("click", function () { explain(+el.dataset.id); }); });
  }

  function explain(id) {
    var b = B.BY_ID[id]; if (!b) return; selected = id; render();
    var got = earned().indexOf(id) >= 0, oc = chain && chain.minted && chain.minted.has(id);
    var msg = b.desc + ". ";
    if (oc) msg += "It's stamped on Starknet as a soulbound badge ✦";
    else if (got) msg += chain && chain.enabled ? "You earned it! It can be stamped on Starknet if you like ✦" : "You earned it! すごい!";
    else if (b.kind === "row") msg += "Not yet: master all " + b.chars.length + " of these kana to earn it.";
    else msg += "Not yet: keep learning and " + b.name.split(" · ")[0] + " will grow!";
    say(msg, true);
    if (chain && chain.describe) chain.describe(id).then(function (extra) { if (extra && selected === id) say(msg + " " + extra, true); }).catch(function () {});
  }

  var visibleFrom = function () { return ["startScreen", "overScreen"].filter(function (k) { return !$(k).classList.contains("hidden"); })[0] || "startScreen"; };
  function open() {
    from = visibleFrom();
    ["startScreen", "overScreen", "petScreen"].forEach(function (k) { $(k).classList.add("hidden"); });
    $("badgeScreen").classList.remove("hidden");
    markSeen(); selected = null; render();
    var n = earned().length;
    say(n ? "Look at all your badges, " + n + " so far! ♡ Tap me for tips." : "No badges yet. Master a whole kana row and I'll pin one on you! ♡");
    document.dispatchEvent(new CustomEvent("ka:badges-open"));
    raf();
  }
  function close() {
    $("badgeScreen").classList.add("hidden");
    $(from).classList.remove("hidden");
    var btn = $(from === "overScreen" ? "overBadgeBtn" : "badgeBtn"); if (btn) btn.focus();
  }
  function isOpen() { return !$("badgeScreen").classList.contains("hidden"); }

  // little companion that talks in the badge book
  var rafOn = false;
  function raf() {
    if (rafOn) return; rafOn = true;
    var last = 0;
    (function tick(ts) {
      if (!isOpen()) { rafOn = false; return; }
      var t = ts / 1000, dt = last ? Math.min(0.05, t - last) : 0; last = t;
      var c = $("badgePet"), sz = +c.dataset.size || 96, d = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== sz * d) { c.width = sz * d; c.height = sz * d; c.style.width = sz + "px"; c.style.height = sz + "px"; }
      var x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, sz, sz);
      sayT = Math.max(0, sayT - dt);
      CP.draw(x, progress().pet, stage(), sz / 2, sz * 0.92, sz * 0.8, sayT > 0 ? "happy" : "idle", t);
      requestAnimationFrame(tick);
    })(performance.now());
  }

  // "new badge" note on the game-over screen (diffs against the badges you've already seen)
  function seen() { try { var v = JSON.parse(localStorage.getItem(SEEN_KEY)); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, JSON.stringify(earned())); } catch (e) { /* ignore */ } }
  if (!seen()) markSeen(); // first run with badges: don't celebrate old progress as "new"
  function checkNew() {
    var before = new Set(seen() || []), fresh = earned().filter(function (id) { return !before.has(id); }), el = $("overBadges");
    if (!fresh.length) { el.classList.add("hidden"); return; }
    el.innerHTML = "🏅 New badge" + (fresh.length > 1 ? "s" : "") + ": " + fresh.map(function (id) { return "<b style='color:#ffe94d'>" + esc(B.BY_ID[id].name) + "</b>"; }).join(", ") + " · tap 🏅 BADGES";
    el.classList.remove("hidden");
    document.dispatchEvent(new CustomEvent("ka:new-badges", { detail: { ids: fresh } }));
  }
  new MutationObserver(function () { if (!$("overScreen").classList.contains("hidden")) checkNew(); else $("overBadges").classList.add("hidden"); })
    .observe($("overScreen"), { attributes: true, attributeFilter: ["class"] });

  var toastT = null;
  function toast(msg) {
    var el = $("kaToast"); el.textContent = msg; el.classList.remove("hidden");
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.add("hidden"); }, 3200);
  }

  $("badgeBtn").addEventListener("click", open);
  $("overBadgeBtn").addEventListener("click", open);
  $("badgeBack").addEventListener("click", close);
  $("badgePet").addEventListener("pointerdown", nextTip);
  // keep the game's Enter-to-start / Esc handlers from firing underneath the badge book
  window.addEventListener("keydown", function (ev) {
    if (!isOpen()) return;
    if (ev.key === "Escape") { ev.stopPropagation(); ev.preventDefault(); close(); }
    else if (ev.key === "Enter") ev.stopPropagation();
  }, true);

  window.KA_BOOK = {
    open: open, close: close, isOpen: isOpen, render: function () { if (isOpen()) render(); }, say: say, toast: toast, earned: earned, explain: explain,
    setChain: function (c) { chain = c; if (isOpen()) render(); }
  };
})();
