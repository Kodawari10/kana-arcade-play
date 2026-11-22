/* 🔥 Play streak: counts the days you actually played a game, so just showing up is its own reward.
   Different from the 📜 daily-quest streak (which needs the quest DONE) and the 🍡 Mochi 7-day plate —
   this one rewards turning up at all, the kindest kind of streak for a young learner.
   Pure date logic (no DOM), testable in node; the home-screen 🔥 chip wires itself up in the browser.
   Saved on this device as kanaArcade.streak = { days: ["2026-11-22", ...], best: 7 }. Never sent anywhere.
   Exposes window.KA_STREAK (and module.exports for tests). */
(function (root) {
  "use strict";
  var MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
  var CAP = 130; // keep storage small; "best" is stored on its own so capping the day list never loses it
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || ""); if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  // shift a date key by n whole days (calendar-date math, so it is DST-safe); null on a bad key
  function addDays(key, n) { var d = parse(key); if (!d) return null; d.setDate(d.getDate() + n); return todayKey(d); }
  function num(n) { n = Number(n); return isFinite(n) && n > 0 ? Math.floor(n) : 0; }

  // longest run of consecutive days in a sorted-ascending, unique list of valid keys
  function longestRun(days) {
    var best = 0, run = 0, prev = null;
    for (var i = 0; i < days.length; i++) {
      run = (prev && addDays(prev, 1) === days[i]) ? run + 1 : 1;
      if (run > best) best = run;
      prev = days[i];
    }
    return best;
  }
  // clean a saved blob (or junk / a legacy bare array) into { days: [sorted unique valid, <= today, capped], best: n }
  function sanitize(raw, now) {
    var today = todayKey(now || new Date());
    var arr = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && Array.isArray(raw.days) ? raw.days : []);
    var seen = {}, days = [];
    arr.forEach(function (k) { if (typeof k === "string" && parse(k) && k <= today && !seen[k]) { seen[k] = 1; days.push(k); } });
    days.sort(); // ISO date keys sort lexicographically = chronologically
    if (days.length > CAP) days = days.slice(days.length - CAP);
    var best = Math.max(num(raw && raw.best), longestRun(days));
    return { days: days, best: best };
  }
  // current streak = consecutive days ending today (or yesterday, so it stays "live" until a day is truly missed)
  function current(state, now) {
    var days = (state && state.days) || []; if (!days.length) return 0;
    var today = todayKey(now || new Date()), last = days[days.length - 1];
    if (last !== today && last !== addDays(today, -1)) return 0;
    var run = 1;
    for (var i = days.length - 2; i >= 0; i--) { if (addDays(days[i], 1) === days[i + 1]) run++; else break; }
    return run;
  }
  function playedToday(state, now) { var days = (state && state.days) || []; return days[days.length - 1] === todayKey(now || new Date()); }
  function atRisk(state, now) { return !playedToday(state, now) && current(state, now) > 0; }

  // record today as played. raw may be a saved blob or junk. Returns a summary plus the cleaned state to save.
  function record(raw, now) {
    var state = sanitize(raw, now), today = todayKey(now || new Date());
    var newDay = state.days[state.days.length - 1] !== today;
    if (newDay) { state.days.push(today); if (state.days.length > CAP) state.days = state.days.slice(state.days.length - CAP); }
    var streak = current(state, now), best0 = state.best;
    state.best = Math.max(state.best, streak);
    var milestone = newDay && MILESTONES.indexOf(streak) >= 0 ? streak : 0;
    return { state: state, newDay: newDay, bestUp: state.best > best0, streak: streak, best: state.best, milestone: milestone };
  }
  // last 7 days, oldest first and today last: [{ key, played, today }]
  function week(state, now) {
    var today = todayKey(now || new Date()), has = {}; ((state && state.days) || []).forEach(function (k) { has[k] = 1; });
    var out = [];
    for (var i = 6; i >= 0; i--) { var k = addDays(today, -i); out.push({ key: k, played: !!has[k], today: i === 0 }); }
    return out;
  }
  // everything the home-screen chip needs
  function label(raw, now) {
    var state = sanitize(raw, now), n = current(state, now), pt = playedToday(state, now), risk = atRisk(state, now);
    var head, aria, days = (n === 1 ? "day" : "days");
    if (pt) { head = "🔥 " + n + "-day streak"; aria = "Play streak: " + n + " " + days + ", including today. Nice!"; }
    else if (risk) { head = "🔥 " + n + "-day streak"; aria = "Play streak: " + n + " " + days + ". Play today to keep it going."; }
    else if (state.days.length) { head = "🔥 Start a new streak!"; aria = "No streak going right now. Play a game to start a new one."; }
    else { head = "🔥 Play to start a streak!"; aria = "Play a game to start your play streak."; }
    return { streak: n, best: state.best, playedToday: pt, atRisk: risk, started: state.days.length > 0,
      head: head, sub: risk ? "play today to keep it!" : "", bestText: state.best > 1 ? "best " + state.best : "",
      aria: aria, week: week(state, now) };
  }
  var API = { MILESTONES: MILESTONES, CAP: CAP, todayKey: todayKey, parse: parse, addDays: addDays, sanitize: sanitize,
    longestRun: longestRun, current: current, playedToday: playedToday, atRisk: atRisk, record: record, week: week, label: label };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  root.KA_STREAK = API;

  // ---------- browser: the 🔥 home-screen chip ----------
  var $ = function (id) { return document.getElementById(id); };
  function read() { try { var v = localStorage.getItem("kanaArcade.streak"); return v === null ? null : JSON.parse(v); } catch (e) { return null; } }
  function save(state) { try { localStorage.setItem("kanaArcade.streak", JSON.stringify(state)); } catch (e) {} }
  function ka() { return root.__kanaArcade || {}; }
  function calm() { var k = ka(); return !!(k.isCalm && k.isCalm()); }
  var pending = null; // a streak change made this session, celebrated when the player is back on the title

  function render() {
    var chip = $("streakChip"); if (!chip) return;
    var L = label(read());
    $("streakHead").textContent = L.head;
    $("streakBest").textContent = L.bestText;
    $("streakBest").classList.toggle("hidden", !L.bestText);
    $("streakSub").textContent = L.sub;
    $("streakSub").classList.toggle("hidden", !L.sub);
    var wk = $("streakWeek"); wk.innerHTML = "";
    L.week.forEach(function (d) {
      var s = document.createElement("span");
      s.className = "sd" + (d.played ? " on" : "") + (d.today ? " today" : "");
      wk.appendChild(s);
    });
    chip.classList.toggle("live", L.playedToday || L.atRisk);
    chip.classList.remove("hidden");
    chip.setAttribute("aria-label", L.aria);
  }

  function celebrate() {
    if (!pending) return;
    var r = pending; pending = null;
    var chip = $("streakChip");
    if (chip && !calm()) { chip.classList.remove("pop"); void chip.offsetWidth; chip.classList.add("pop"); }
    var k = ka();
    if (r.milestone) {
      if (k.toast) k.toast("🔥 " + r.milestone + "-day streak! すごい!");
      if (k.cheer) k.cheer();
    } else if (r.newDay && r.streak >= 2 && k.toast) {
      k.toast("🔥 " + r.streak + "-day streak!");
    }
  }

  function onPlay() {
    var r = record(read()); save(r.state);
    if (r.newDay) pending = r; // show it when we land back on the title
    render();
    try { root.dispatchEvent(new CustomEvent("ka:streak", { detail: { streak: r.streak, best: r.best, newDay: r.newDay, milestone: r.milestone } })); } catch (e) {}
  }

  function boot() {
    if (!$("streakChip")) return;
    save(sanitize(read())); // normalise any junk once
    render();
    root.addEventListener("ka:play", onPlay);
    // re-render (and celebrate) whenever the title screen comes back into view
    var start = $("startScreen");
    if (start && typeof MutationObserver !== "undefined") {
      var wasHidden = start.classList.contains("hidden");
      new MutationObserver(function () {
        var hidden = start.classList.contains("hidden");
        if (wasHidden && !hidden) { render(); celebrate(); }
        wasHidden = hidden;
      }).observe(start, { attributes: true, attributeFilter: ["class"] });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(this);
