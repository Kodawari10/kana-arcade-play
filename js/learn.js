/* 📚 Learn Japanese: proficiency Path (JLPT) + vocab decks, SRS, kanji, grammar, reading.
   Opens from the home 📚 Learn button. Offline. Exposes window.KA_LEARN. */
(function (root) {
  "use strict";
  var V = root.KA_VOCAB, SRS = root.KA_SRS, P = root.KA_PATH;
  var $ = function (id) { return document.getElementById(id); };
  if (!V || !SRS) return;
  var screen, deckId = null, mode = null, queue = [], qi = 0, score = { ok: 0, n: 0 }, lock = false, lastFocus = null;
  var tab = "path", unitId = null, pathMode = null; // pathMode: study|checkpoint|leveltest

  function isOpen() { return screen && !screen.classList.contains("hidden"); }
  function show(view) {
    $("learnHub").classList.toggle("hidden", view !== "learnHub");
    $("learnPlay").classList.toggle("hidden", view === "learnHub");
    if (view === "learnHub") {
      $("learnCard").classList.add("hidden");
      $("learnDone").classList.add("hidden");
      $("learnModes").classList.remove("hidden");
      var ps = $("pathStudy"); if (ps) ps.classList.add("hidden");
    }
    if (view === "learnDone") {
      $("learnPlay").classList.remove("hidden");
      $("learnModes").classList.add("hidden");
      $("learnCard").classList.add("hidden");
      var ps2 = $("pathStudy"); if (ps2) ps2.classList.add("hidden");
      $("learnDone").classList.remove("hidden");
    }
  }
  function speak(text) {
    var VO = root.KA_VOICE, ka = root.__kanaArcade;
    if (!VO || !VO.supported) return false;
    if (ka && ka.settings && ka.settings.muted) return false;
    try { VO.speak(text, { force: true }); return true; } catch (e) { return false; }
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  function setTab(t) {
    tab = t;
    var tabs = screen.querySelectorAll(".learnTab");
    Array.prototype.forEach.call(tabs, function (b) {
      var on = b.dataset.tab === t;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("learnPath").classList.toggle("hidden", t !== "path");
    $("learnDecksWrap").classList.toggle("hidden", t !== "decks");
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
    $("learnDue").textContent = dueN ? ("🔁 " + dueN + " due for review today") : "Follow the Path, or pick a deck ✨";
    $("learnCounts").textContent = V.counts().words + " words · " + V.counts().phrases + " phrases · " + V.counts().situations + " situations";
    if (P) {
      var c = P.counts();
      $("learnProf").textContent = "🎯 " + P.proficiency(P.load()) + " · " + c.kanjiN5 + " N5 kanji · " + c.grammar + " grammar · " + c.readings + " readings";
      var f = $("learnFuri"); if (f) f.checked = P.furiganaOn();
      renderPath();
    } else {
      $("learnProf").textContent = "";
    }
    setTab(tab);
  }

  function renderPath() {
    if (!P) return;
    var st = P.load(), html = "";
    P.LEVELS.forEach(function (lv) {
      var unlocked = P.isLevelUnlocked(st, lv.id);
      var passed = st.levels[lv.id] && st.levels[lv.id].passed;
      var badge = passed ? "🏅 Passed" : (unlocked ? "▶ Open" : "🔒 Locked");
      html += '<button type="button" class="pathLevel' + (unlocked ? "" : " locked") + '" data-level="' + lv.id + '"' + (unlocked ? "" : " disabled") + '>' +
        '<span class="plHead"><span>' + esc(lv.name) + ' <span class="plJp" lang="ja">' + esc(lv.nameJp) + '</span></span><span class="plBadge">' + badge + '</span></span>' +
        '<span class="plBlurb">' + esc(lv.blurb) + '</span></button>';
    });
    $("learnPath").innerHTML = html;
  }

  function openLevel(levelId) {
    if (!P) return;
    var st = P.load();
    if (!P.isLevelUnlocked(st, levelId)) return;
    var lv = P.levelById(levelId);
    $("learnDeckTitle").textContent = (lv ? lv.name : levelId) + " path";
    show("learnPlay");
    $("learnModes").classList.add("hidden");
    $("learnCard").classList.add("hidden");
    $("learnDone").classList.add("hidden");
    var ps = $("pathStudy"); ps.classList.remove("hidden");
    if (levelId === "kana") {
      ps.innerHTML = '<div class="psBlock"><h3>かな Arcade</h3><p class="tips">Play the main game to master hiragana &amp; katakana. Path treats kana as your foundation.</p>' +
        '<div class="psActions"><button type="button" id="pathMarkKana" class="alt">✓ Mark kana as started</button></div></div>';
      $("pathMarkKana").onclick = function () { P.markKanaDone(); openLevel("N5"); };
      return;
    }
    var units = P.unitsFor(levelId);
    if (!units.length) {
      ps.innerHTML = '<div class="psBlock"><h3>' + esc(lv.name) + '</h3><p class="tips">Content for this level is on the roadmap — finish N5 first!</p></div>';
      return;
    }
    var html = '<p class="tips">' + esc(lv.blurb) + '</p><div class="pathUnits">';
    units.forEach(function (u) {
      var unlocked = P.isUnitUnlocked(st, u.id);
      var prog = st.units[u.id];
      var kinds = (u.kinds || []).join(" · ");
      var stat = prog && prog.best != null ? (prog.best + "%") : (unlocked ? "Study" : "🔒");
      html += '<button type="button" class="pathUnit' + (unlocked ? "" : " locked") + '" data-unit="' + u.id + '"' + (unlocked ? "" : " disabled") + '>' +
        '<span><span class="puTitle">' + u.order + ". " + esc(u.title) + '</span><span class="puMeta">' + esc(kinds) + '</span></span>' +
        '<span class="puStat">' + esc(stat) + '</span></button>';
    });
    html += "</div>";
    var allDone = units.every(function (u) { return st.units[u.id] && st.units[u.id].best >= 60; });
    var lp = st.levels[levelId];
    if (allDone) {
      html += '<div class="psActions"><button type="button" id="pathLevelTest" class="learnMode">📝 ' + esc(lv.name) + ' level test<span>JLPT-style · pass ~60%</span></button></div>';
      if (lp && lp.passed) html += '<p class="tips">🏅 Badge earned · best ' + lp.best + "%</p>";
    } else {
      html += '<p class="tips">Pass each unit checkpoint (≥60%) to unlock the level test.</p>';
    }
    ps.innerHTML = html;
    ps.querySelectorAll(".pathUnit").forEach(function (b) {
      b.addEventListener("click", function () { if (!b.disabled) openUnit(b.dataset.unit); });
    });
    var lt = $("pathLevelTest");
    if (lt) lt.onclick = function () { startPathQuiz("leveltest", levelId); };
  }

  function openUnit(id) {
    unitId = id;
    var u = P.unitById(id); if (!u) return;
    $("learnDeckTitle").textContent = u.order + ". " + u.title;
    show("learnPlay");
    $("learnModes").classList.add("hidden");
    $("learnCard").classList.add("hidden");
    $("learnDone").classList.add("hidden");
    var ps = $("pathStudy"); ps.classList.remove("hidden");
    var html = "";

    // Grammar
    if (u.grammar && u.grammar.length) {
      html += '<div class="psBlock"><h3>📖 Grammar</h3>';
      u.grammar.forEach(function (gid) {
        var g = P.grammarById(gid); if (!g) return;
        html += '<div class="psGram"><div class="psTitle">' + esc(g.title) + '</div><p class="psExpl">' + esc(g.explain) + '</p>';
        (g.examples || []).forEach(function (ex) {
          var jp = (P.furiganaOn() && ex.kj) ? P.rubyHtml(ex.kj, ex.jp) : ("<span lang='ja' class='jp'>" + esc(ex.jp) + "</span>");
          html += '<div class="psEx">' + jp + '<div class="ro">' + esc(ex.ro) + '</div><div class="en">' + esc(ex.en) + '</div></div>';
        });
        html += "</div>";
      });
      html += "</div>";
    }

    // Kanji
    if (u.kanji && u.kanji.length) {
      html += '<div class="psBlock"><h3>㊥ Kanji</h3><div class="psKanji">';
      u.kanji.forEach(function (ch) {
        html += '<button type="button" class="psKanjiBtn" data-ch="' + esc(ch) + '" lang="ja">' + esc(ch) + "</button>";
      });
      html += '</div><div id="psKanjiDetail" class="psKanjiDetail tips">Tap a kanji</div></div>';
    }

    // Vocab decks shortcut
    if (u.decks && u.decks.length) {
      html += '<div class="psBlock"><h3>💬 Vocab decks</h3><div class="psActions">';
      u.decks.forEach(function (did) {
        var d = V.deck(did); if (!d) return;
        html += '<button type="button" class="alt small pathDeck" data-deck="' + did + '">' + d.icon + " " + esc(d.name) + "</button>";
      });
      html += "</div></div>";
    }

    // Reading / listening
    if (u.reading) {
      var r = P.readingById(u.reading);
      if (r) {
        html += '<div class="psBlock"><h3>📰 ' + esc(r.title) + '</h3>';
        var rtxt = r.text || r.kana || r.jp || "";
        var rkj = r.textKj || r.kj;
        html += '<div class="psRead" lang="ja">' + (P.furiganaOn() && rkj ? esc(rkj) + "<div class=\"tips\" style=\"margin-top:6px\">" + esc(rtxt) + "</div>" : esc(rtxt)) + "</div>";
        if (r.en) html += '<p class="tips">' + esc(r.en) + "</p>";
        html += '<div class="psActions"><button type="button" class="alt small" id="pathListen">🔊 Listen</button></div></div>';
      }
    }

    html += '<div class="psActions"><button type="button" id="pathCheckpoint" class="learnMode">✅ Unit checkpoint<span>~' + (u.checkpoint || 8) + " questions · pass 60%</span></button>" +
      '<button type="button" id="pathBackLevel" class="alt">◀ Units</button></div>';
    ps.innerHTML = html;

    ps.querySelectorAll(".psKanjiBtn").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = P.kanjiByCh(b.dataset.ch); if (!k) return;
        var det = $("psKanjiDetail");
        var on = (Array.isArray(k.on) ? k.on.join("、") : (k.on || "")) || "—";
        var kun = (Array.isArray(k.kun) ? k.kun.join("、") : (k.kun || "")) || "—";
        var ex = (k.examples || []).map(function (e) {
          var kj = e.kanji || e.kj || e.kana || e.jp || "";
          var ka = e.kana || e.jp || "";
          return "<div>" + (P.furiganaOn() ? P.rubyHtml(kj, ka) : esc(kj)) + " · " + esc(e.ro) + " — " + esc(e.en) + "</div>";
        }).join("");
        det.innerHTML = "<b lang='ja' style='font-size:1.6em'>" + esc(k.ch) + "</b> " + esc(k.meaning) +
          "<br>音 <span lang='ja'>" + esc(on) + "</span> · 訓 <span lang='ja'>" + esc(kun) + "</span> · " + (k.strokes || "?") + " strokes" +
          (ex ? "<div style='margin-top:6px'>" + ex + "</div>" : "");
      });
    });
    ps.querySelectorAll(".pathDeck").forEach(function (b) {
      b.addEventListener("click", function () { openDeck(b.dataset.deck); });
    });
    var lis = $("pathListen");
    if (lis) lis.onclick = function () {
      var r = P.readingById(u.reading);
      if (r) speak(r.text || r.kana || r.jp);
    };
    $("pathCheckpoint").onclick = function () { startPathQuiz("checkpoint", id); };
    $("pathBackLevel").onclick = function () { openLevel(u.level); };
  }

  function startPathQuiz(kind, ref) {
    pathMode = kind; mode = "pathquiz"; score = { ok: 0, n: 0 }; qi = 0; lock = false;
    var raw = kind === "leveltest" ? P.levelTest(ref) : P.checkpointQuiz(ref);
    queue = raw.map(function (q) { return P.withOptions(q); });
    if (!queue.length) {
      $("pathStudy").innerHTML = '<p class="tips">No questions yet for this unit — study the material first.</p>';
      return;
    }
    unitId = ref;
    $("learnDeckTitle").textContent = kind === "leveltest" ? "📝 Level test" : "✅ Checkpoint";
    $("pathStudy").classList.add("hidden");
    $("learnModes").classList.add("hidden");
    $("learnDone").classList.add("hidden");
    $("learnCard").classList.remove("hidden");
    $("learnPlay").classList.remove("hidden");
    nextPathQ();
  }

  function nextPathQ() {
    lock = false;
    if (qi >= queue.length) return finishPath();
    var item = queue[qi];
    $("learnProgress").textContent = (qi + 1) + " / " + queue.length;
    $("learnFeedback").textContent = ""; $("learnFeedback").className = "learnFeedback";
    $("learnPrompt").innerHTML = esc(item.prompt);
    $("learnSub").textContent = item.kind === "kanji" ? "Pick the meaning" : (item.kind === "grammar" ? "Grammar" : "Comprehension");
    $("learnTypeRow").classList.add("hidden");
    $("learnHear").classList.add("hidden");
    var opts = item.options || [item.answer];
    $("learnChoices").innerHTML = opts.map(function (o, i) {
      return '<button type="button" class="learnAns" data-ans="' + esc(o) + '" data-i="' + (i + 1) + '"><small>' + (i + 1) + "</small>" + esc(o) + "</button>";
    }).join("");
  }

  function answerPath(ans) {
    if (lock) return;
    var item = queue[qi], ok = ans === item.answer;
    lock = true; score.n++; if (ok) score.ok++;
    Array.prototype.forEach.call($("learnChoices").querySelectorAll(".learnAns"), function (b) {
      if (b.dataset.ans === item.answer) b.classList.add("right");
      else if (b.dataset.ans === ans) b.classList.add("wrong");
      b.disabled = true;
    });
    $("learnFeedback").className = "learnFeedback " + (ok ? "good" : "bad");
    $("learnFeedback").textContent = ok ? "✓" : ("✗ " + item.answer);
    setTimeout(function () { qi++; nextPathQ(); }, ok ? 600 : 1200);
  }

  function finishPath() {
    show("learnDone");
    var pct = score.n ? Math.round(100 * score.ok / score.n) : 0;
    var passed = pct >= 60;
    $("learnScore").textContent = (passed ? "✨ " : "💪 ") + score.ok + " / " + score.n + " (" + pct + "%)";
    if (pathMode === "checkpoint" && unitId) {
      P.unitPass(P.load(), unitId, score.ok, score.n);
      $("learnScoreSub").textContent = passed ? "Unit checkpoint passed! Next unit unlocked if ready." : "Need ~60% to pass — review and try again.";
    } else if (pathMode === "leveltest" && unitId) {
      P.levelPass(P.load(), unitId, score.ok, score.n);
      $("learnScoreSub").textContent = passed ? "🏅 Level badge earned! " + unitId + " complete." : "Almost — review weak units and retake (≥60%).";
    } else {
      $("learnScoreSub").textContent = "";
    }
    try { root.dispatchEvent(new CustomEvent("ka:learn", { detail: { path: pathMode, ok: score.ok, n: score.n, ref: unitId } })); } catch (e) {}
  }

  function open() {
    if (isOpen()) return; lastFocus = document.activeElement;
    ["startScreen", "overScreen", "petScreen", "statsScreen", "badgeScreen"].forEach(function (id) { var e = $(id); if (e) e.classList.add("hidden"); });
    screen.classList.remove("hidden"); show("learnHub"); tab = "path"; renderHub();
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
    var ps = $("pathStudy"); if (ps) ps.classList.add("hidden");
  }
  function buildQueue(m) {
    mode = m; pathMode = null; score = { ok: 0, n: 0 }; qi = 0;
    var map = SRS.read(), ids;
    if (m === "review") {
      ids = SRS.dueList(map, V.items(deckId).map(function (x) { return x.id; }), null, 12);
      if (!ids.length) ids = V.items(deckId).slice(0, 8).map(function (x) { return x.id; });
      queue = ids.map(byId).filter(Boolean);
    } else if (m === "situations") {
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
    var ps = $("pathStudy"); if (ps) ps.classList.add("hidden");
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
      var ruby = "";
      if (item.kanji) {
        ruby = (P && P.furiganaOn()) ? (P.rubyHtml(item.kanji, item.kana) + " ") : ("<span class='learnKanji'>" + esc(item.kanji) + "</span> ");
      }
      $("learnPrompt").innerHTML = ruby + "<b lang='ja' class='learnKana'>" + esc(item.kana) + "</b>";
      $("learnSub").textContent = item.note || (item.kind === "p" ? "What does this phrase mean?" : "What does this mean?");
      $("learnHear").classList.remove("hidden");
      renderChoices(item, false);
    }
  }
  function renderChoices(item, hideKana) {
    var opts = V.quizChoices(item, 4);
    $("learnChoices").innerHTML = opts.map(function (o, i) {
      return '<button type="button" class="learnAns" data-id="' + o.id + '" data-i="' + (i + 1) + '"><small>' + (i + 1) + "</small>" + esc(o.en) + "</button>";
    }).join("");
  }
  function answerChoice(id) {
    if (lock || mode === "situations" || mode === "pathquiz") return;
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
    $("learnBackHub").addEventListener("click", function () {
      if (pathMode && unitId && P) {
        var u = P.unitById(unitId);
        if (pathMode === "leveltest") { openLevel(unitId); return; }
        if (u) { openLevel(u.level); return; }
      }
      show("learnHub"); renderHub();
    });
    screen.addEventListener("click", function (ev) {
      var tabBtn = ev.target.closest && ev.target.closest(".learnTab");
      if (tabBtn) { setTab(tabBtn.dataset.tab); return; }
      var lv = ev.target.closest && ev.target.closest(".pathLevel");
      if (lv && !lv.disabled) { openLevel(lv.dataset.level); return; }
    });
    $("learnDecks").addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest(".learnDeck"); if (b) openDeck(b.dataset.deck);
    });
    $("learnModes").addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("[data-mode]"); if (b) startMode(b.dataset.mode);
    });
    $("learnChoices").addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest(".learnAns"); if (!b || b.disabled) return;
      if (mode === "pathquiz") answerPath(b.dataset.ans);
      else answerChoice(b.dataset.id);
    });
    $("learnTypeGo").addEventListener("click", answerTyped);
    $("learnType").addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); answerTyped(); } });
    $("learnHear").addEventListener("click", function () {
      var item = queue[qi]; if (!item) return;
      speak(item.kana || item.answer);
    });
    $("learnAgain").addEventListener("click", function () {
      if (mode === "pathquiz" && pathMode) startPathQuiz(pathMode, unitId);
      else if (mode) startMode(mode);
      else show("learnHub");
    });
    $("learnToHub").addEventListener("click", function () { show("learnHub"); renderHub(); });
    var furi = $("learnFuri");
    if (furi && P) {
      furi.checked = P.furiganaOn();
      furi.addEventListener("change", function () { P.setFurigana(furi.checked); });
    }
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
        if (b && !b.disabled) {
          ev.preventDefault();
          if (mode === "pathquiz") answerPath(b.dataset.ans);
          else answerChoice(b.dataset.id);
        }
      }
      if (ev.key === "Enter") ev.stopImmediatePropagation();
    }, true);
  }
  var API = { open: open, close: close, isOpen: isOpen, startMode: startMode, openDeck: openDeck, openLevel: openLevel, openUnit: openUnit };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  root.KA_LEARN = API;
})(typeof window !== "undefined" ? window : this);
