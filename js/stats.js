// 📊 My stats: a cozy sheet of colourful tiles showing how your kana learning is going: kana mastered (and per
// script), right answers, accuracy, kana met, best score, words cleared, companions met, badges, daily quest streak
// and nicknames, plus a gold "⭐ Your best kana" card and a "😅 Trickiest kana" card (tap either to hear it), and a
// "📅 Learning since" line. It only READS what the game already keeps on this device, so it never changes your save.
// Offline, no wallet. Pure logic (KA_STATS.snapshot) is testable in node; the 📊 STATS sheet wires itself up in the browser.
(function (root) {
  "use strict";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function num(n) { n = Number(n); return isFinite(n) && n > 0 ? Math.floor(n) : 0; }
  function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseDay(k) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }

  // d = { progress, words, highs: { "high.hiragana": n, ... }, quest, met, nicks, now }; K = KANA, CP = COMPANION, B = KA_BADGES
  function snapshot(d, K, CP, B) {
    d = d || {}; var progress = obj(d.progress), kana = obj(progress.kana), now = d.now ? new Date(d.now) : new Date();
    var info = {}, rows = (K && K.ALL) || [];
    rows.forEach(function (r) { r.kana.forEach(function (k) { info[k[0]] = { ch: k[0], ro: k[2], script: "hiragana" }; info[k[1]] = { ch: k[1], ro: k[2], script: "katakana" }; }); });
    var perScript = rows.reduce(function (n, r) { return n + r.kana.length; }, 0);
    var s = { mastered: 0, hira: 0, kata: 0, total: perScript * 2, perScript: perScript, right: 0, wrong: 0, seen: 0, best: null, tricky: null };
    Object.keys(kana).forEach(function (ch) {
      var I = info[ch], st = kana[ch]; if (!I || !st || typeof st !== "object") return;
      var c = num(st.c), w = num(st.w); if (!c && !w) return;
      s.seen++; s.right += c; s.wrong += w;
      if (CP && CP.isMastered({ c: c, w: w })) { s.mastered++; if (I.script === "hiragana") s.hira++; else s.kata++; }
      if (c && (!s.best || c > s.best.c || (c === s.best.c && w < s.best.w))) s.best = { ch: ch, ro: I.ro, c: c, w: w };
      if (w && (!s.tricky || w > s.tricky.w || (w === s.tricky.w && c < s.tricky.c))) s.tricky = { ch: ch, ro: I.ro, c: c, w: w };
    });
    s.acc = s.right + s.wrong ? Math.round(100 * s.right / (s.right + s.wrong)) : null;
    // best score across scripts (normal games; gentle best kept separately)
    var NAMES = { hiragana: "ひらがな", katakana: "カタカナ", both: "MIX" }, highs = obj(d.highs);
    s.high = 0; s.highScript = null; s.gentleHigh = 0;
    Object.keys(highs).forEach(function (k) {
      var m = /^high\.(hiragana|katakana|both)(\.gentle)?$/.exec(k), v = num(highs[k]); if (!m || !v) return;
      if (m[2]) { if (v > s.gentleHigh) s.gentleHigh = v; } else if (v > s.high) { s.high = v; s.highScript = NAMES[m[1]]; }
    });
    var words = obj(d.words); s.words = Object.keys(words).filter(function (k) { return num(obj(words[k]).c) > 0; }).length;
    var pets = (CP && CP.PETS) || [], pp = obj(progress.pets);
    s.pets = pets.length; s.petsMet = pets.filter(function (P) { return num(obj(pp[P.id]).xp) > 0; }).length;
    s.xp = pets.reduce(function (n, P) { return n + num(obj(pp[P.id]).xp); }, 0);
    s.badges = B && B.earned ? B.earned({ pet: progress.pet, pets: pp, kana: kana }).length : 0; s.badgeCount = B ? B.count : 0;
    var q = obj(d.quest), today = dayKey(now), y = new Date(now); y.setDate(y.getDate() - 1);
    s.streak = q.lastDone === today || q.lastDone === dayKey(y) ? num(q.streak) : 0;
    var nicks = obj(d.nicks); s.nicks = pets.filter(function (P) { return typeof nicks[P.id] === "string" && nicks[P.id].trim(); }).length;
    // learning since: earliest real date among companions met ("old" = before we kept dates)
    var met = obj(d.met), first = null, old = false;
    pets.forEach(function (P) { var v = met[P.id]; if (v === "old") old = true; var dd = parseDay(v); if (dd && dd <= now && (!first || dd < first)) first = dd; });
    if (old) s.since = { old: true, text: "📅 Learning kana since before we kept dates. An old friend!" };
    else if (first) {
      var days = Math.round((parseDay(today) - first) / 86400000);
      var when = MONTHS[first.getMonth()] + " " + first.getDate() + (first.getFullYear() !== now.getFullYear() ? ", " + first.getFullYear() : "");
      s.since = { old: false, days: days, text: "📅 Learning kana since " + (days <= 0 ? "today! はじめまして" : days === 1 ? "yesterday (" + when + ")" : when + ", " + days + " days ago") };
    } else s.since = null;
    return s;
  }
  // tiles in display order: { id, icon, value, label, sub? }
  function tiles(s) {
    return [
      { id: "mastered", icon: "★", value: s.mastered + " / " + s.total, label: "kana mastered" },
      { id: "hira", icon: "あ", value: s.hira + " / " + s.perScript, label: "hiragana mastered", jp: true },
      { id: "kata", icon: "ア", value: s.kata + " / " + s.perScript, label: "katakana mastered", jp: true },
      { id: "right", icon: "✔", value: String(s.right), label: "right answers" },
      { id: "acc", icon: "🎯", value: s.acc == null ? "–" : s.acc + "%", label: "accuracy" },
      { id: "seen", icon: "👀", value: String(s.seen), label: "kana met" },
      { id: "high", icon: "🏆", value: String(s.high), label: "best score", sub: s.highScript ? s.highScript : (s.gentleHigh ? "🫧 gentle " + s.gentleHigh : "") },
      { id: "words", icon: "💬", value: String(s.words), label: "words cleared" },
      { id: "pets", icon: "🐾", value: s.petsMet + " / " + s.pets, label: "companions met", sub: s.xp + " XP" },
      { id: "badges", icon: "🏅", value: s.badges + " / " + s.badgeCount, label: "badges" },
      { id: "streak", icon: "📜", value: String(s.streak), label: "quest streak", sub: s.streak === 1 ? "day" : "days" },
      { id: "nicks", icon: "🏷️", value: String(s.nicks), label: "nicknames given" }
    ];
  }
  // 🎖️ Kana rank: a cute title that grows with kana mastered (out of 142)
  var RANKS = [
    { at: 0, icon: "🌱", name: "Kana Sprout", jp: "めばえ", ro: "mebae" },
    { at: 10, icon: "🐣", name: "Kana Chick", jp: "ひよこ", ro: "hiyoko" },
    { at: 30, icon: "🎒", name: "Kana Student", jp: "せいと", ro: "seito" },
    { at: 60, icon: "🥷", name: "Kana Ninja", jp: "にんじゃ", ro: "ninja" },
    { at: 100, icon: "🏯", name: "Kana Samurai", jp: "さむらい", ro: "samurai" },
    { at: 142, icon: "👑", name: "Kana Sensei", jp: "せんせい", ro: "sensei" }
  ];
  function rank(mastered, total) {
    total = num(total) || 142; mastered = Math.min(num(mastered), total);
    var i = 0; RANKS.forEach(function (r, j) { if (mastered >= Math.min(r.at, total)) i = j; });
    var r = RANKS[i], nx = RANKS[i + 1] || null, need = nx ? Math.min(nx.at, total) - mastered : 0;
    return { index: i, icon: r.icon, name: r.name, jp: r.jp, ro: r.ro, mastered: mastered, total: total, pct: Math.round(100 * mastered / total), top: !nx,
      next: nx ? { icon: nx.icon, name: nx.name, need: need } : null,
      line: nx ? need + " more kana to become " + nx.icon + " " + nx.name : "You know every kana! すごい 👑" };
  }
  var API = { snapshot: snapshot, tiles: tiles, rank: rank, RANKS: RANKS };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  root.KA_STATS = API;

  // ---------- browser: the 📊 STATS sheet ----------
  var $ = function (id) { return document.getElementById(id); };
  var screen = null, lastFocus = null, last = null;
  function ka() { return root.__kanaArcade || {}; }
  function read(k) { try { var v = localStorage.getItem("kanaArcade." + k); return v === null ? null : JSON.parse(v); } catch (e) { return null; } }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function gather() {
    var highs = {}; ["hiragana", "katakana", "both"].forEach(function (s) { highs["high." + s] = read("high." + s); highs["high." + s + ".gentle"] = read("high." + s + ".gentle"); });
    var k = ka();
    return { progress: k.progress || read("progress"), words: k.wordStats ? k.wordStats() : read("words"), highs: highs, quest: k.quest || read("quest"), met: read("met"), nicks: read("nicks"), now: Date.now() };
  }
  function isOpen() { return !!screen && !screen.classList.contains("hidden"); }
  function render() {
    var s = snapshot(gather(), root.KANA, root.COMPANION, root.KA_BADGES); last = s;
    var grid = $("statsGrid"); grid.innerHTML = "";
    tiles(s).forEach(function (t) {
      var li = document.createElement("li"); li.className = "statTile st-" + t.id; li.dataset.stat = t.id;
      li.innerHTML = '<span class="stIcon" aria-hidden="true"' + (t.jp ? ' lang="ja"' : "") + ">" + t.icon + '</span><b class="stVal">' + esc(t.value) + '</b><span class="stLbl">' + t.label + "</span>" +
        (t.sub ? '<small class="stSub"' + (/[ぁ-ン]/.test(t.sub) ? ' lang="ja"' : "") + ">" + esc(t.sub) + "</small>" : "");
      li.setAttribute("aria-label", t.label + ": " + t.value.replace(" / ", " of ") + (t.sub ? ", " + t.sub : ""));
      grid.appendChild(li);
    });
    [["statBest", s.best, "⭐ Your best kana", function (b) { return b.c + " right" + (b.w ? ", " + b.w + " missed" : ""); }],
     ["statTricky", s.tricky, "😅 Trickiest kana", function (b) { return b.w + " missed, " + b.c + " right · practise it!"; }]].forEach(function (a) {
      var el = $(a[0]), b = a[1]; el.classList.toggle("hidden", !b); if (!b) return;
      el.dataset.ch = b.ch;
      el.innerHTML = '<span class="sbHead">' + a[2] + '</span><b class="sbKana" lang="ja">' + b.ch + '</b><span class="sbRo">' + b.ro + '</span><small class="sbLine">' + a[3](b) + "</small>";
      el.setAttribute("aria-label", a[2].replace(/^\S+ /, "") + ": " + b.ch + ", " + b.ro + ", " + a[3](b) + ". Tap to hear it.");
    });
    $("statKana").classList.toggle("hidden", !s.best && !s.tricky);
    var R = rank(s.mastered, s.total), rb = $("statsRank");
    if (rb) {
      rb.classList.toggle("top", R.top); rb.dataset.rank = String(R.index);
      rb.style.setProperty("--pct", R.pct);
      $("rankIcon").textContent = R.icon; $("rankName").textContent = R.name;
      $("rankJp").textContent = R.jp; $("rankJp").setAttribute("aria-label", R.jp + ", " + R.ro);
      $("rankPct").textContent = R.pct + "%"; $("rankNext").textContent = R.line;
      rb.classList.remove("sweep"); void rb.offsetWidth; rb.classList.add("sweep");
    }
    s.rank = R;
    $("statsSince").textContent = s.since ? s.since.text : "";
    $("statsSince").classList.toggle("hidden", !s.since);
    var P = ka().pet ? ka().pet() : null, nick = ka().nickOf && P ? ka().nickOf(P.id) : "", who = nick || (P ? P.name : "Your companion");
    $("statsSub").textContent = who + ": " + (s.seen ? (s.mastered ? "Look how much you know! すごい ✨" : "Every kana you meet makes me grow! がんばって") : "Play a game and your stats will bloom here 🌱");
    $("statsSay").textContent = "";
    $("statsSr").textContent = "Your kana rank: " + R.name + ", " + R.pct + " percent. " + R.line.replace(/ [^\w\s.!,]+ /g, " ") + ". Your stats: " + s.mastered + " of " + s.total + " kana mastered, " + s.right + " right answers" + (s.acc == null ? "" : ", " + s.acc + " percent accuracy") + ", best score " + s.high + ".";
    return s;
  }
  function open() {
    if (isOpen()) return; lastFocus = document.activeElement;
    render(); screen.classList.remove("hidden"); try { $("statsBack").focus({ preventScroll: true }); } catch (e) { $("statsBack").focus(); } $("statsSheet").scrollTop = 0;
    try { root.dispatchEvent(new CustomEvent("ka:stats", { detail: last })); } catch (e) {}
  }
  function close() {
    if (!isOpen()) return; screen.classList.add("hidden");
    var back = lastFocus && lastFocus.offsetParent !== null ? lastFocus : $("statsBtn"); if (back && back.focus) back.focus();
  }
  function hear(btn) {
    var ch = btn.dataset.ch; if (!ch) return; var line = $("statsSay"), V = root.KA_VOICE, k = ka(), muted = k.settings && k.settings.muted;
    var ro = btn.querySelector(".sbRo") ? btn.querySelector(".sbRo").textContent : "";
    var calm = k.isCalm && k.isCalm();
    if (!calm) { btn.classList.remove("hear"); void btn.offsetWidth; btn.classList.add("hear"); }
    if (!V || !V.supported) line.innerHTML = "<b lang='ja'>" + ch + "</b> = " + ro + " · your browser can't speak Japanese yet";
    else if (muted) line.innerHTML = "<b lang='ja'>" + ch + "</b> = " + ro + " · sound is off, tap 🔇 to hear it";
    else { V.speak(ch, { force: true }); line.innerHTML = "🔊 <b lang='ja'>" + ch + "</b> = " + ro; }
  }
  function boot() {
    screen = $("statsScreen"); if (!screen) return;
    $("statsBtn").addEventListener("click", open);
    $("statsClose").addEventListener("click", close);
    $("statsBack").addEventListener("click", close);
    $("statBest").addEventListener("click", function () { hear($("statBest")); });
    $("statTricky").addEventListener("click", function () { hear($("statTricky")); });
    screen.addEventListener("click", function (ev) { if (ev.target === screen) close(); });
    // capture on window (loaded before js/keys.js) so the sheet owns Esc / Enter / Tab while open
    root.addEventListener("keydown", function (ev) {
      if (!isOpen() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
      var tg = ev.target && ev.target.tagName; if (tg === "TEXTAREA" && ev.key !== "Tab") { ev.stopImmediatePropagation(); return; } // 💾 typing a save code
      if (ev.key === "Enter" || ev.key === " ") { ev.stopImmediatePropagation(); return; }
      if (ev.key === "Tab") {
        var f = [$("statsClose"), $("statBest"), $("statTricky"), $("scToggle"), $("scOut"), $("scCopy"), $("scIn"), $("scRestore"), $("scUndo"), $("statsBack")].filter(function (e) { return e && e.offsetParent !== null; }), i = f.indexOf(document.activeElement);
        ev.preventDefault(); ev.stopImmediatePropagation(); f[(i + (ev.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus();
      }
    }, true);
  }
  API.open = open; API.close = close; API.isOpen = isOpen; API.render = render; API.last = function () { return last; };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(this);
