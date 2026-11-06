/* 📚 Learn Japanese: vocab decks, meaning quiz, listening, situation phrases + SRS.
   Opens from the home 📚 Learn button. Offline. Exposes window.KA_LEARN. */
(function (root) {
  "use strict";
  var V = root.KA_VOCAB, SRS = root.KA_SRS, $ = function (id) { return document.getElementById(id); };
  if (!V || !SRS) return;
  var screen, deckId = null, mode = null, queue = [], qi = 0, score = { ok: 0, n: 0 }, lock = false, lastFocus = null;

  function isOpen() { return screen && !screen.classList.contains("hidden"); }
  function show(view) {
    // learnDone lives inside learnPlay
    $("learnHub").classList.toggle("hidden", view !== "learnHub");
    $("learnPlay").classList.toggle("hidden", view === "learnHub");
    if (view === "learnHub") { $("learnCard").classList.add("hidden"); $("learnDone").classList.add("hidden"); $("learnModes").classList.remove("hidden"); }
    if (view === "learnDone") { $("learnPlay").classList.remove("hidden"); $("learnModes").classList.add("hidden"); $("learnCard").classList.add("hidden"); $("learnDone").classList.remove("hidden"); }
  }
  function speak(text) {
    var VO = root.KA_VOICE, ka = root.__kanaArcade;
    if (!VO || !VO.supported) return false;
    if (ka && ka.settings && ka.settings.muted) return false;
    try { VO.speak(text, { force: true }); return true; } catch (e) { return false; }
  }
  function renderHub() {
    var dueN = 0, html = "";
    V.DECKS.forEach(function (d) {
      var its = V.items(d.id), prog = SRS.deckProgress(SRS.read(), its);
      var due = SRS.dueList(SRS.read(), its.map(function (x) { return x.id; }), null, 99).length;
      dueN += due;
      html += '<button type="button" class="learnDeck" data-deck="' + d.id + '">' +
        '<span class="ldIcon" aria-hidden="true">' + d.icon + '</span>' +
        '<span class="ldName">' + d.name + ' <small lang="ja">' + d.jp + '</small></span>' +
        '<span class="ldProg">' + prog.seen + '/' + prog.total + (due ? ' · 🔁' + due : '') + '</span></button>';
    });
    $("learnDecks").innerHTML = html;
    $("learnDue").textContent = dueN ? ("🔁 " + dueN + " due for review today") : "Pick a deck to start learning real Japanese ✨";
    $("learnCounts").textContent = V.counts().words + " words · " + V.counts().phrases + " phrases · " + V.counts().situations + " situations";
  }
  function open() {
    if (isOpen()) return; lastFocus = document.activeElement;
    ["startScreen", "overScreen", "petScreen", "statsScreen", "badgeScreen"].forEach(function (id) { var e = $(id); if (e) e.classList.add("hidden"); });
    screen.classList.remove("hidden"); show("learnHub"); renderHub();
    try { $("learnClose").focus({ preventScroll: true }); } catch (e) {}
    try { root.dispatchEvent(new CustomEvent("ka:learn", { detail: { open: true } })); } catch (e) {}
  }
  function close() {
    if (!isOpen()) return; screen.classList.add("hidden"); show("learnHub");
    var back = (lastFocus && lastFocus.offsetParent !== null) ? lastFocus : $("learnBtn");
    if (back && back.focus) back.focus();
    var st = $("startScreen"); if (st) st.classList.remove("hidden");
  }
  function openDeck(id) {
    deckId = id; var d = V.deck(id); if (!d) return;
    $("learnDeckTitle").textContent = d.icon + " " + d.name;
    show("learnPlay");
    $("learnModes").classList.remove("hidden");
    $("learnCard").classList.add("hidden");
    $("learnDone").classList.add("hidden");
  }
  function buildQueue(m) {
    mode = m; score = { ok: 0, n: 0 }; qi = 0;
    var map = SRS.read(), ids;
    if (m === "review") {
      ids = SRS.dueList(map, V.items(deckId).map(function (x) { return x.id; }), null, 12);
      if (!ids.length) ids = V.items(deckId).slice(0, 8).map(function (x) { return x.id; });
      queue = ids.map(byId).filter(Boolean);
    } else if (m === "situations") {
      queue = V.shuffle(V.SITUATIONS.filter(function (s) { return !deckId || s.deck === deckId || true; })).slice(0, 8);
      // prefer this deck's situations, then fill
      var own = V.SITUATIONS.filter(function (s) { return s.deck === deckId; });
      var rest = V.SITUATIONS.filter(function (s) { return s.deck !== deckId; });
      queue = V.shuffle(own.concat(rest)).slice(0, 8);
    } else {
      var pool = V.items(deckId, m === "phrases" ? "p" : null);
      if (m === "words") pool = V.items(deckId, "w");
      if (m === "listen") pool = V.items(deckId);
      var due = SRS.dueList(map, pool.map(function (x) { return x.id; }), null, 10);
      var picks = due.length ? due.map(byId) : V.shuffle(pool).slice(0, 10);
      if (picks.length < 8) picks = V.shuffle(pool).slice(0, 10);
      queue = picks.filter(Boolean).slice(0, 10);
    }
  }
  function byId(id) { return typeof id === "string" ? V.byId(id) : id; }
  function startMode(m) {
    buildQueue(m); if (!queue.length) { $("learnFeedback").textContent = "This deck is empty for that mode."; return; }
    $("learnModes").classList.add("hidden"); $("learnCard").classList.remove("hidden"); $("learnDone").classList.add("hidden");
    nextCard();
  }
  function nextCard() {
    lock = false;
    if (qi >= queue.length) return finish();
    var item = queue[qi];
    $("learnProgress").textContent = (qi + 1) + " / " + queue.length;
    $("learnFeedback").textContent = ""; $("learnFeedback").className = "learnFeedback";
    $("learnPrompt").innerHTML = ""; $("learnSub").textContent = ""; $("learnChoices").innerHTML = "";
    $("learnTypeRow").classList.add("hidden"); $("learnHear").classList.add("hidden");
    if (mode === "situations") {
      $("learnPrompt").textContent = item.prompt;
      $("learnSub").textContent = "Type the Japanese phrase (kana or romaji)";
      $("learnTypeRow").classList.remove("hidden");
      $("learnType").value = ""; $("learnType").placeholder = "e.g. sumimasen or すみません";
      setTimeout(function () { $("learnType").focus(); }, 50);
    } else if (mode === "listen") {
      $("learnPrompt").innerHTML = "🔊 <span class='learnListenLbl'>Listen, then pick the meaning</span>";
      $("learnSub").textContent = item.kana.length > 1 ? "Tap 🔊 again if you need a replay" : "";
      $("learnHear").classList.remove("hidden");
      renderChoices(item, true);
      speak(item.kana);
    } else {
      // meaning: see Japanese → pick English (words or phrases)
      var ruby = item.kanji ? ("<span class='learnKanji'>" + esc(item.kanji) + "</span> ") : "";
      $("learnPrompt").innerHTML = ruby + "<b lang='ja' class='learnKana'>" + esc(item.kana) + "</b>";
      $("learnSub").textContent = item.note || (item.kind === "p" ? "What does this phrase mean?" : "What does this mean?");
      $("learnHear").classList.remove("hidden");
      renderChoices(item, false);
    }
  }
  function renderChoices(item, hideKana) {
    var opts = V.quizChoices(item, 4);
    $("learnChoices").innerHTML = opts.map(function (o, i) {
      return '<button type="button" class="learnAns" data-id="' + o.id + '" data-i="' + (i + 1) + '"><small>' + (i + 1) + '</small>' + esc(o.en) + '</button>';
    }).join("");
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function answerChoice(id) {
    if (lock || mode === "situations") return;
    var item = queue[qi], ok = id === item.id;
    lock = true; score.n++; if (ok) score.ok++;
    SRS.write(SRS.grade(SRS.read(), item.id, ok));
    Array.prototype.forEach.call($("learnChoices").querySelectorAll(".learnAns"), function (b) {
      if (b.dataset.id === item.id) b.classList.add("right");
      else if (b.dataset.id === id) b.classList.add("wrong");
      b.disabled = true;
    });
    $("learnFeedback").className = "learnFeedback " + (ok ? "good" : "bad");
    $("learnFeedback").innerHTML = ok ? ("✓ " + esc(item.en)) : ("✗ " + esc(item.en) + " · <b lang='ja'>" + esc(item.kana) + "</b> = " + esc(item.ro));
    if (!ok) speak(item.kana);
    setTimeout(function () { qi++; nextCard(); }, ok ? 700 : 1400);
  }
  function answerTyped() {
    if (lock || mode !== "situations") return;
    var sit = queue[qi], typed = $("learnType").value, ok = V.situationMatch(sit, typed);
    lock = true; score.n++; if (ok) score.ok++;
    // grade the matching vocab item if we have one
    var linked = V.ITEMS.filter(function (it) { return it.kana === sit.answer || (sit.alts || []).indexOf(it.kana) >= 0; })[0];
    if (linked) SRS.write(SRS.grade(SRS.read(), linked.id, ok));
    $("learnFeedback").className = "learnFeedback " + (ok ? "good" : "bad");
    $("learnFeedback").innerHTML = ok ? ("✓ " + esc(sit.answer)) : ("✗ " + esc(sit.answer) + (sit.alts && sit.alts[0] ? " (or " + esc(sit.alts[0]) + ")" : ""));
    speak(sit.answer);
    setTimeout(function () { qi++; nextCard(); }, ok ? 800 : 1600);
  }
  function finish() {
    show("learnDone");
    $("learnScore").textContent = "✨ " + score.ok + " / " + score.n + " correct";
    $("learnScoreSub").textContent = score.ok === score.n ? "Perfect! すごい!" : "Keep going — due cards will come back.";
    renderHub();
    try { root.dispatchEvent(new CustomEvent("ka:learn", { detail: { done: true, ok: score.ok, n: score.n, mode: mode, deck: deckId } })); } catch (e) {}
  }
  function boot() {
    screen = $("learnScreen"); if (!screen || !$("learnBtn")) return;
    $("learnBtn").addEventListener("click", open);
    $("learnClose").addEventListener("click", close);
    $("learnBackHub").addEventListener("click", function () { show("learnHub"); renderHub(); });
    $("learnDecks").addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest(".learnDeck"); if (b) openDeck(b.dataset.deck);
    });
    $("learnModes").addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("[data-mode]"); if (b) startMode(b.dataset.mode);
    });
    $("learnChoices").addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest(".learnAns"); if (b && !b.disabled) answerChoice(b.dataset.id);
    });
    $("learnTypeGo").addEventListener("click", answerTyped);
    $("learnType").addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); answerTyped(); } });
    $("learnHear").addEventListener("click", function () {
      var item = queue[qi]; if (!item) return;
      speak(item.kana || item.answer);
    });
    $("learnAgain").addEventListener("click", function () { if (mode) startMode(mode); else show("learnHub"); });
    $("learnToHub").addEventListener("click", function () { show("learnHub"); renderHub(); });
    screen.addEventListener("click", function (ev) { if (ev.target === screen) close(); });
    root.addEventListener("keydown", function (ev) {
      if (!isOpen()) return;
      if (ev.key === "Escape") {
        ev.preventDefault(); ev.stopImmediatePropagation();
        if (!$("learnHub").classList.contains("hidden")) close();
        else { show("learnHub"); renderHub(); }
        return;
      }
      if (/^[1-4]$/.test(ev.key) && !$("learnCard").classList.contains("hidden")) {
        var b = $("learnChoices").querySelector('.learnAns[data-i="' + ev.key + '"]');
        if (b && !b.disabled) { ev.preventDefault(); answerChoice(b.dataset.id); }
      }
      if (ev.key === "Enter") ev.stopImmediatePropagation();
    }, true);
  }
  var API = { open: open, close: close, isOpen: isOpen, startMode: startMode, openDeck: openDeck };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  root.KA_LEARN = API;
})(typeof window !== "undefined" ? window : this);
