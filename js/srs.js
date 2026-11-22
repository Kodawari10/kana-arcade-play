/* Simple Leitner SRS for vocab items. Boxes 0..4; due dates in localStorage kanaArcade.srs.
   Pure logic. Exposes window.KA_SRS / module.exports. */
(function (root) {
  "use strict";
  var KEY = "kanaArcade.srs", BOX_DAYS = [0, 1, 3, 7, 21]; // box 0 = due now
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function parseDay(k) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function daysBetween(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 86400000); }
  function load(raw) {
    var out = {}; if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (id) {
      var e = raw[id]; if (!e || typeof e !== "object") return;
      var box = Math.max(0, Math.min(4, Math.floor(Number(e.box) || 0)));
      var due = typeof e.due === "string" && parseDay(e.due) ? e.due : dayKey();
      out[id] = { box: box, due: due, seen: Math.max(0, Math.floor(Number(e.seen) || 0)), correct: Math.max(0, Math.floor(Number(e.correct) || 0)) };
    });
    return out;
  }
  function read() { try { return load(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return {}; } }
  function write(map) { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {} return map; }
  function entry(map, id) { return map[id] || { box: 0, due: dayKey(), seen: 0, correct: 0 }; }
  function grade(map, id, ok, today) {
    today = today || dayKey(); map = load(map); var e = entry(map, id);
    e.seen++; if (ok) e.correct++;
    e.box = ok ? Math.min(4, e.box + 1) : 0;
    var d = parseDay(today) || new Date();
    d.setDate(d.getDate() + BOX_DAYS[e.box]);
    e.due = dayKey(d); map[id] = e; return map;
  }
  function dueList(map, ids, today, max) {
    today = today || dayKey(); map = load(map); max = max || 20;
    var due = [], later = [];
    (ids || Object.keys(map)).forEach(function (id) {
      var e = entry(map, id);
      if (!parseDay(e.due) || daysBetween(e.due, today) >= 0) due.push(id); else later.push(id);
    });
    // new cards (never seen) first among due
    due.sort(function (a, b) { return (entry(map, a).seen - entry(map, b).seen) || (entry(map, a).box - entry(map, b).box); });
    return due.slice(0, max);
  }
  function deckProgress(map, items) {
    map = load(map); var total = items.length, seen = 0, mastered = 0, due = 0, today = dayKey();
    items.forEach(function (it) {
      var e = map[it.id]; if (!e) return; seen++;
      if (e.box >= 3) mastered++;
      if (!parseDay(e.due) || daysBetween(e.due, today) >= 0) due++;
    });
    return { total: total, seen: seen, mastered: mastered, due: due, pct: total ? Math.round(100 * seen / total) : 0 };
  }
  var API = { KEY: KEY, BOX_DAYS: BOX_DAYS, dayKey: dayKey, load: load, read: read, write: write, grade: grade, dueList: dueList, deckProgress: deckProgress, entry: entry };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.KA_SRS = API;
})(typeof window !== "undefined" ? window : this);
