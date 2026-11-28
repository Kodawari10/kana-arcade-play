/* 🍡 Mochi Match: a tiny daily memory game. Flip cards and pair each hiragana with its
   katakana twin. The board and the flavor are fixed for the calendar day, so clearing
   it stamps one mochi on a 7-day plate. Best tries live in kanaArcade.mochi.
   Old saves have no such key and are left alone; a broken value is ignored.
   Pure logic is window.KA_MOCHI (no DOM). The screen wires itself in the browser. */
(function (root) {
  "use strict";
  var PAIR_COUNT = 6;
  var KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "q", "w"];
  var MISS_MS = 720, CALM_MS = 180, STAMP_CAP = 60;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var STORE = "kanaArcade.mochi";
  var LINES = {
    start: { jp: "めくって", en: "Flip two cards" },
    flip: { jp: "どっちだ?", en: "Find its twin" },
    match: { jp: "ぴったり!", en: "A match!" },
    miss: { jp: "もう一回", en: "Not a pair. Try again" },
    win: { jp: "できた!", en: "You did it!" }
  };
  var FLAVORS = [
    { id: "sakura", jp: "さくら", en: "sakura", emoji: "🌸" },
    { id: "matcha", jp: "まっちゃ", en: "matcha", emoji: "🍵" },
    { id: "ichigo", jp: "いちご", en: "strawberry", emoji: "🍓" },
    { id: "yuzu", jp: "ゆず", en: "yuzu", emoji: "🍋" },
    { id: "goma", jp: "ごま", en: "sesame", emoji: "🤍" },
    { id: "milk", jp: "みるく", en: "milk", emoji: "🥛" },
    { id: "kinako", jp: "きなこ", en: "soybean", emoji: "🌾" }
  ];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function prevDay(key) {
    var p = String(key || "").split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2] - 1, 12);
    return dayKey(d);
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, random) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function poolOf(rows) {
    var out = [];
    (rows || []).forEach(function (r) {
      (r.kana || []).forEach(function (k) {
        if (k && k[0] && k[1] && k[2]) out.push({ hira: k[0], kata: k[1], romaji: k[2] });
      });
    });
    return out;
  }
  // 12 cards, 6 sounds, hiragana beside its katakana. Same seed → same board.
  function deal(seed, rows) {
    var pool = poolOf(rows);
    if (!pool.length) return [];
    var random = rng(hash("mochi:" + seed));
    var n = Math.min(PAIR_COUNT, pool.length);
    var picked = shuffle(pool.slice(), random).slice(0, n);
    var cards = [];
    picked.forEach(function (p, i) {
      cards.push({ pair: i, face: p.hira, script: "hira", romaji: p.romaji });
      cards.push({ pair: i, face: p.kata, script: "kata", romaji: p.romaji });
    });
    shuffle(cards, random);
    return cards.map(function (c, i) {
      return { pair: c.pair, face: c.face, script: c.script, romaji: c.romaji, key: KEYS[i] || "" };
    });
  }
  function fresh(seed, rows) {
    return { seed: String(seed), cards: deal(seed, rows), up: [], matched: {}, moves: 0, lock: false, won: false, practice: false };
  }
  function pairCount(state) {
    var seen = {};
    (state.cards || []).forEach(function (c) { seen[c.pair] = true; });
    return Object.keys(seen).length;
  }
  function pairInfo(state, id) {
    var hira = "", kata = "", romaji = "";
    (state.cards || []).forEach(function (c) {
      if (c.pair !== id) return;
      if (c.script === "hira") hira = c.face; else kata = c.face;
      romaji = c.romaji;
    });
    return { hira: hira, kata: kata, romaji: romaji };
  }
  function matchedCount(state) {
    var n = 0;
    for (var k in state.matched) if (state.matched[k]) n++;
    return n;
  }
  function tap(state, index) {
    var ignore = { event: "ignore", state: state };
    if (!state || state.won || state.lock || !state.cards) return ignore;
    index = +index;
    if (index < 0 || index >= state.cards.length || index !== Math.floor(index)) return ignore;
    var card = state.cards[index];
    if (state.matched[card.pair] || state.up.indexOf(index) >= 0) return ignore;
    state.up.push(index);
    if (state.up.length < 2) return { event: "flip", state: state, index: index };
    state.moves += 1;
    var a = state.cards[state.up[0]], b = state.cards[state.up[1]];
    if (a.pair === b.pair) {
      state.matched[a.pair] = true;
      state.up = [];
      var info = pairInfo(state, a.pair);
      if (matchedCount(state) >= pairCount(state)) {
        state.won = true;
        return { event: "win", state: state, moves: state.moves, stars: stars(state.moves), card: info };
      }
      return { event: "match", state: state, moves: state.moves, card: info };
    }
    state.lock = true;
    return { event: "miss", state: state, moves: state.moves };
  }
  function resolve(state) {
    if (!state || !state.lock) return state;
    state.up = [];
    state.lock = false;
    return state;
  }
  function stars(moves) {
    moves = Math.floor(+moves || 0);
    if (moves <= PAIR_COUNT) return 3;
    if (moves <= 10) return 2;
    return 1;
  }
  function starText(n) { return n >= 3 ? "★★★" : n === 2 ? "★★☆" : "★☆☆"; }
  function flavor(dateKey) { return FLAVORS[hash("mochi-flavor:" + dateKey) % FLAVORS.length]; }
  function comeback(done) {
    return done ? "Come back tomorrow for a new flavor." : "Clear today's plate to stamp a mochi.";
  }
  function goodMove(moves) { return typeof moves === "number" && isFinite(moves) && moves >= PAIR_COUNT && moves <= 200; }
  function trim(stamps) {
    stamps.sort();
    if (stamps.length > STAMP_CAP) stamps = stamps.slice(-STAMP_CAP);
    return stamps;
  }
  function normalize(saved) {
    var s = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    var best = null;
    if (typeof s.best === "number" && isFinite(s.best)) {
      var b = Math.floor(s.best);
      if (b >= PAIR_COUNT && b <= 200) best = b;
    }
    var stamps = [], seen = {};
    if (Array.isArray(s.stamps)) {
      s.stamps.forEach(function (d) {
        if (typeof d === "string" && DAY_RE.test(d) && !seen[d]) { seen[d] = true; stamps.push(d); }
      });
    }
    stamps = trim(stamps);
    var last = typeof s.last === "string" && DAY_RE.test(s.last) ? s.last : (stamps.length ? stamps[stamps.length - 1] : "");
    return { best: best, stamps: stamps, last: last };
  }
  function keepBest(saved, moves) {
    var s = normalize(saved);
    if (goodMove(moves) && (s.best == null || moves < s.best)) s.best = Math.floor(moves);
    return s;
  }
  function record(saved, dateKey, moves) {
    var s = keepBest(saved, moves);
    if (typeof dateKey === "string" && DAY_RE.test(dateKey)) {
      if (s.stamps.indexOf(dateKey) < 0) s.stamps.push(dateKey);
      s.stamps = trim(s.stamps);
      s.last = dateKey;
    }
    return s;
  }
  function stamped(saved, dateKey) { return normalize(saved).stamps.indexOf(dateKey) >= 0; }
  function plate(saved, todayKey) {
    if (!DAY_RE.test(todayKey || "")) return [];
    var s = normalize(saved), key = todayKey, keys = [];
    for (var i = 0; i < 7; i++) { keys.push(key); key = prevDay(key); }
    keys.reverse();
    return keys.map(function (d) { return { date: d, on: s.stamps.indexOf(d) >= 0, today: d === todayKey }; });
  }

  var api = {
    PAIR_COUNT: PAIR_COUNT, KEYS: KEYS, MISS_MS: MISS_MS, CALM_MS: CALM_MS, LINES: LINES, FLAVORS: FLAVORS, STORE: STORE,
    dayKey: dayKey, prevDay: prevDay, deal: deal, fresh: fresh, tap: tap, resolve: resolve,
    stars: stars, starText: starText, flavor: flavor, comeback: comeback,
    normalize: normalize, keepBest: keepBest, record: record, stamped: stamped, plate: plate
  };
  root.KA_MOCHI = api;

  if (typeof document === "undefined") return;

  var $ = function (id) { return document.getElementById(id); };
  var round = null, missT = null, practiceN = 0;

  function rows() { return (root.KANA && root.KANA.ROWS) || []; }
  function calm() {
    return document.body.classList.contains("calm") ||
      !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function readRaw() {
    try { var v = localStorage.getItem(STORE); return v == null ? null : JSON.parse(v); } catch (e) { return null; }
  }
  function write(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }
  function isOpen() { var s = $("mochiScreen"); return !!(s && !s.classList.contains("hidden")); }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function line(which) { var L = LINES[which]; return L.jp + " — " + L.en; }

  function renderPlate(el, saved, today) {
    if (!el) return;
    var days = plate(saved, today), n = 0;
    el.innerHTML = days.map(function (d) {
      if (d.on) n++;
      return '<span class="mochiBit' + (d.on ? " on" : "") + (d.today ? " today" : "") + '">' + (d.on ? "🍡" : "○") + "</span>";
    }).join("");
    el.setAttribute("aria-label", n + " of the last 7 days have a mochi");
    return n;
  }
  function paintChrome(saved) {
    var today = dayKey(new Date());
    saved = saved || normalize(readRaw());
    var flav = flavor(today), done = stamped(saved, today);
    var n = renderPlate($("mochiPlate"), saved, today);
    renderPlate($("mochiHomePlate"), saved, today);
    if ($("mochiFlavor")) $("mochiFlavor").textContent = flav.emoji + " Today's flavor: " + flav.en + " · " + flav.jp;
    if ($("mochiBest")) $("mochiBest").textContent = saved.best ? ("Best: " + saved.best + " tries " + starText(stars(saved.best))) : "Best: —";
    if ($("mochiWeek")) $("mochiWeek").textContent = n + " / 7 this week";
    if ($("mochiHomeWeek")) $("mochiHomeWeek").textContent = n + " / 7 this week · " + comeback(done);
    if ($("mochiHomeBlurb")) $("mochiHomeBlurb").textContent = done
      ? ("Today's " + flav.emoji + " " + flav.en + " mochi is ready.")
      : ("Today's flavor is " + flav.emoji + " " + flav.en + ". Pair each hiragana with its katakana twin.");
    var btn = $("mochiOpen");
    if (btn) {
      btn.classList.toggle("fresh", !done);
      btn.textContent = done ? "🍡 Mochi done today" : "🍡 Play today's mochi";
    }
    return { today: today, saved: saved, flav: flav, done: done };
  }
  function setFeedback(text, kind) {
    var el = $("mochiFeedback"); if (!el) return;
    el.textContent = text;
    el.classList.remove("good", "bad");
    if (kind) el.classList.add(kind);
  }
  function renderBoard() {
    var grid = $("mochiGrid");
    if (!grid || !round) return;
    var cards = round.cards;
    if (grid.childElementCount !== cards.length) {
      grid.innerHTML = "";
      cards.forEach(function (_, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "mochiCard"; b.dataset.i = String(i);
        grid.appendChild(b);
      });
    }
    cards.forEach(function (card, i) {
      var b = grid.children[i];
      var open = !!round.matched[card.pair] || round.up.indexOf(i) >= 0;
      b.classList.toggle("up", open);
      b.classList.toggle("yum", !!round.matched[card.pair]);
      b.disabled = !!round.won;
      if (open) {
        b.innerHTML = "<b lang='ja'>" + esc(card.face) + "</b><small>" + esc(card.romaji) + "</small>";
        b.setAttribute("aria-label", card.face + ", " + card.romaji);
      } else {
        b.innerHTML = "<span class='mochiBack' aria-hidden='true'>🍡</span><kbd>" + esc(card.key) + "</kbd>";
        b.setAttribute("aria-label", "Face-down card " + card.key);
      }
    });
  }
  function show(id, on) { var el = $(id); if (el) el.classList.toggle("hidden", !on); }
  function burst(emojis) {
    if (calm()) return;
    var box = $("mochiFloats"); if (!box) return;
    emojis.forEach(function (emoji, i) {
      var s = document.createElement("span");
      s.className = "mochiPop"; s.textContent = emoji;
      s.style.left = ["14%", "46%", "74%"][i % 3];
      s.style.top = "72%";
      box.appendChild(s);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 1100);
    });
  }
  function clearMiss() { if (missT) { clearTimeout(missT); missT = null; } }
  function startRound(seed, practice) {
    clearMiss();
    round = fresh(seed, rows());
    round.practice = !!practice;
    show("mochiDone", false);
    show("mochiWin", false);
    show("mochiBoard", true);
    show("mochiAgain", false);
    var screen = $("mochiScreen"); if (screen) screen.classList.remove("party");
    renderBoard();
    setFeedback(line("start"));
    var first = $("mochiGrid") && $("mochiGrid").querySelector("button");
    if (first) first.focus();
  }
  function showDone(info) {
    clearMiss();
    round = null;
    show("mochiBoard", false);
    show("mochiWin", false);
    show("mochiDone", true);
    show("mochiAgain", true);
    if ($("mochiDoneEn")) $("mochiDoneEn").textContent = "Today's " + info.flav.emoji + " " + info.flav.en + " mochi is ready. " + comeback(true);
    var screen = $("mochiScreen"); if (screen) screen.classList.add("party");
    if ($("mochiAgain")) $("mochiAgain").focus();
  }
  function celebrate(info) {
    var starsN = stars(round.moves);
    show("mochiWin", true);
    show("mochiAgain", true);
    if ($("mochiWinTitle")) $("mochiWinTitle").textContent = LINES.win.jp;
    if ($("mochiStars")) $("mochiStars").textContent = starText(starsN);
    if ($("mochiWinEn")) $("mochiWinEn").textContent = round.moves + " tries. " + (round.practice
      ? "Practice plate — your stamp stays put. "
      : "Today's " + info.flav.emoji + " " + info.flav.en + " mochi is stamped. ") + comeback(true);
    setFeedback(LINES.win.jp + " " + LINES.win.en, "good");
    var screen = $("mochiScreen"); if (screen) screen.classList.add("party");
    burst(["🍡", "✨", "🌸"]);
    renderBoard();
    try {
      root.dispatchEvent(new CustomEvent("ka:mochi", { detail: { win: true, moves: round.moves, practice: !!round.practice, stars: starsN } }));
    } catch (e) {}
    if ($("mochiAgain")) $("mochiAgain").focus();
  }
  function flip(index) {
    if (!round || !isOpen()) return;
    var res = tap(round, index);
    if (res.event === "ignore") return;
    renderBoard();
    if (res.event === "flip") setFeedback(line("flip"));
    else if (res.event === "match") {
      var hint = (root.KA_HINT && root.KA_HINT.hint(res.card.hira)) || "";
      var msg = LINES.match.jp + " " + res.card.hira + " · " + res.card.kata + " is " + res.card.romaji;
      if (hint) msg += "\n💡 " + hint;
      setFeedback(msg, "good");
      burst(["🍡"]);
    } else if (res.event === "miss") {
      setFeedback(line("miss"), "bad");
      var wait = calm() ? CALM_MS : MISS_MS;
      clearMiss();
      missT = setTimeout(function () {
        missT = null;
        if (!round || !round.lock) return;
        resolve(round);
        if (isOpen()) { renderBoard(); setFeedback(line("flip")); }
      }, wait);
    } else if (res.event === "win") {
      var today = dayKey(new Date());
      var next = round.practice ? keepBest(readRaw(), round.moves) : record(readRaw(), today, round.moves);
      write(next);
      var info = paintChrome(next);
      celebrate(info);
    }
  }
  function open() {
    if (isOpen()) return;
    paintChrome();
    var info = paintChrome();
    show("startScreen", false);
    show("mochiScreen", true);
    if (info.done) showDone(info);
    else startRound(info.today, false);
  }
  function close() {
    if (!isOpen()) return;
    clearMiss();
    round = null;
    show("mochiScreen", false);
    var screen = $("mochiScreen"); if (screen) screen.classList.remove("party");
    show("startScreen", true);
    var moreHidden = $("moreArea") && $("moreArea").classList.contains("hidden");
    var back = moreHidden ? $("moreBtn") : $("mochiOpen");
    if (back && back.focus) back.focus();
  }
  function again() {
    practiceN += 1;
    startRound(dayKey(new Date()) + "#" + practiceN, true);
  }

  function boot() {
    if (!$("mochiScreen") || !$("mochiOpen") || !$("mochiGrid")) return;
    paintChrome();
    $("mochiOpen").addEventListener("click", open);
    $("mochiBack").addEventListener("click", close);
    $("mochiAgain").addEventListener("click", again);
    $("mochiGrid").addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("button.mochiCard");
      if (!b || b.disabled) return;
      flip(+b.dataset.i);
    });
    root.addEventListener("keydown", function (ev) {
      if (!isOpen() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
      if (ev.key === "Enter" || ev.key === " ") { ev.stopImmediatePropagation(); return; }
      if (ev.key === "Tab") { ev.stopImmediatePropagation(); return; }
      var idx = KEYS.indexOf(String(ev.key || "").toLowerCase());
      if (idx >= 0 && round && !round.won) { ev.preventDefault(); ev.stopImmediatePropagation(); flip(idx); return; }
      ev.stopImmediatePropagation();
    }, true);
  }
  api.isOpen = isOpen;
  api.open = open;
  api.close = close;
  api.state = function () { return round; };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : globalThis);
