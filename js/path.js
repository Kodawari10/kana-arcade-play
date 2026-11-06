/* Proficiency path: unlock units, checkpoints, level tests, furigana helper.
   Save key: kanaArcade.path. Exposes window.KA_PATH / module.exports. */
(function (root) {
  "use strict";
  var PD = root.KA_PATH_DATA || (typeof require === "function" ? require("./path-data.js") : null);
  var KD = root.KA_KANJI_DATA || (typeof require === "function" ? require("./kanji-data.js") : null);
  var GD = root.KA_GRAMMAR_DATA || (typeof require === "function" ? require("./grammar-data.js") : null);
  var RD = root.KA_READING_DATA || (typeof require === "function" ? require("./reading-data.js") : null);
  if (!PD) return;
  var KEY = "kanaArcade.path", FURI_KEY = "kanaArcade.furigana";

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "{}");
      return {
        units: v.units && typeof v.units === "object" ? v.units : {},
        levels: v.levels && typeof v.levels === "object" ? v.levels : {},
        kanaDone: !!v.kanaDone
      };
    } catch (e) { return { units: {}, levels: {}, kanaDone: false }; }
  }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} return st; }
  function furiganaOn() { try { return JSON.parse(localStorage.getItem(FURI_KEY) || "true") !== false; } catch (e) { return true; } }
  function setFurigana(on) { try { localStorage.setItem(FURI_KEY, JSON.stringify(!!on)); } catch (e) {} return !!on; }

  function levelById(id) { return PD.LEVELS.filter(function (l) { return l.id === id; })[0] || null; }
  function unitsFor(level) { return PD.UNITS.filter(function (u) { return u.level === level; }).sort(function (a, b) { return a.order - b.order; }); }
  function unitById(id) { return PD.UNITS.filter(function (u) { return u.id === id; })[0] || null; }
  function kanjiByCh(ch) { return (KD && KD.KANJI || []).filter(function (k) { return k.ch === ch; })[0] || null; }
  function kanjiForLevel(lv) { return (KD && KD.KANJI || []).filter(function (k) { return k.level === lv; }); }
  function grammarById(id) { return (GD && GD.GRAMMAR || []).filter(function (g) { return g.id === id; })[0] || null; }
  function readingById(id) { return (RD && RD.READINGS || []).filter(function (r) { return r.id === id; })[0] || null; }

  function markKanaDone(st) { st = st || load(); st.kanaDone = true; return save(st); }
  function unitPass(st, unitId, score, total) {
    st = st || load(); var pct = total ? Math.round(100 * score / total) : 0;
    var prev = st.units[unitId] || { best: 0, passes: 0 };
    st.units[unitId] = { best: Math.max(prev.best || 0, pct), passes: (prev.passes || 0) + (pct >= 60 ? 1 : 0), last: pct };
    return save(st);
  }
  function levelPass(st, levelId, score, total) {
    st = st || load(); var pct = total ? Math.round(100 * score / total) : 0;
    var prev = st.levels[levelId] || { best: 0, passed: false };
    st.levels[levelId] = { best: Math.max(prev.best || 0, pct), passed: prev.passed || pct >= 60, last: pct };
    return save(st);
  }

  function isLevelUnlocked(st, levelId) {
    st = st || load(); var lv = levelById(levelId); if (!lv) return false;
    if (lv.unlock === "free") return true;
    if (lv.unlock === "kana") return !!st.kanaDone || true; // kana arcade always available; path treats as unlocked
    var prev = st.levels[lv.unlock];
    return !!(prev && prev.passed);
  }
  function isUnitUnlocked(st, unitId) {
    st = st || load(); var u = unitById(unitId); if (!u) return false;
    if (!isLevelUnlocked(st, u.level)) return false;
    var list = unitsFor(u.level);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === unitId) return true;
      var p = st.units[list[i].id];
      if (!p || (p.best || 0) < 60) return false;
    }
    return false;
  }
  function proficiency(st) {
    st = st || load();
    var order = ["N1", "N2", "N3", "N4", "N5"];
    for (var i = 0; i < order.length; i++) {
      if (st.levels[order[i]] && st.levels[order[i]].passed) return order[i];
    }
    var n5 = unitsFor("N5"), done = 0;
    n5.forEach(function (u) { if (st.units[u.id] && st.units[u.id].best >= 60) done++; });
    if (done >= n5.length) return "N5 ready";
    if (done > 0) return "N5 in progress (" + done + "/" + n5.length + " units)";
    return "Kana learner";
  }

  // Build a short checkpoint quiz from unit content
  function checkpointQuiz(unitId) {
    var u = unitById(unitId); if (!u) return [];
    var q = [], n = u.checkpoint || 8;
    (u.grammar || []).forEach(function (gid) {
      var g = grammarById(gid); if (!g) return;
      (g.drills || []).forEach(function (d) {
        q.push({ kind: "grammar", id: gid, type: d.type, prompt: g.title + ": " + d.q, options: d.options.slice(), answer: d.answer });
      });
    });
    (u.kanji || []).forEach(function (ch) {
      var k = kanjiByCh(ch); if (!k) return;
      q.push({ kind: "kanji", id: k.id, type: "meaning", prompt: "What does 「" + k.ch + "」 mean?", options: null, answer: k.meaning, ch: k.ch });
    });
    if (u.reading) {
      var r = readingById(u.reading);
      if (r) r.questions.forEach(function (qq) {
        q.push({ kind: "reading", id: r.id, type: "comp", prompt: qq.q, options: qq.options.slice(), answer: qq.answer });
      });
    }
    // fill with vocab meaning from decks if short
    var V = root.KA_VOCAB;
    if (V && q.length < n) {
      (u.decks || []).forEach(function (deck) {
        V.items(deck).slice(0, 6).forEach(function (it) {
          q.push({ kind: "vocab", id: it.id, type: "meaning", prompt: it.kana + (it.kanji ? "（" + it.kanji + "）" : ""), options: null, answer: it.en, item: it });
        });
      });
    }
    // shuffle & trim; for items without options, create distractors later in UI
    for (var i = q.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = q[i]; q[i] = q[j]; q[j] = t; }
    return q.slice(0, n);
  }

  function levelTest(levelId) {
    var q = [], units = unitsFor(levelId);
    units.forEach(function (u) { checkpointQuiz(u.id).slice(0, 3).forEach(function (x) { q.push(x); }); });
    for (var i = q.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = q[i]; q[i] = q[j]; q[j] = t; }
    return q.slice(0, Math.min(20, Math.max(12, q.length)));
  }

  function withOptions(item) {
    if (item.options && item.options.length) return item;
    var opts = [], ans = item.answer;
    if (item.kind === "kanji") {
      var pool = (KD && KD.KANJI || []).map(function (k) { return k.meaning; });
      opts = [ans];
      while (opts.length < 4 && pool.length) {
        var m = pool[Math.floor(Math.random() * pool.length)];
        if (opts.indexOf(m) < 0) opts.push(m);
      }
    } else if (item.kind === "vocab" && item.item && root.KA_VOCAB) {
      opts = root.KA_VOCAB.quizChoices(item.item, 4).map(function (o) { return o.en; });
      return Object.assign({}, item, { options: opts, answer: item.item.en });
    } else {
      opts = [ans, "—", "—", "—"];
    }
    for (var i = opts.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = opts[i]; opts[i] = opts[j]; opts[j] = t; }
    return Object.assign({}, item, { options: opts });
  }

  // Furigana HTML: wrap kanji with ruby using parallel kana string when lengths allow; else show kana below
  function rubyHtml(kanji, kana) {
    if (!furiganaOn() || !kanji) return escape(kanji || kana || "");
    if (!kana || kanji === kana) return "<span lang='ja'>" + escape(kanji) + "</span>";
    return "<ruby lang='ja'>" + escape(kanji) + "<rt>" + escape(kana) + "</rt></ruby>";
  }
  function escape(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  var API = {
    KEY: KEY, LEVELS: PD.LEVELS, UNITS: PD.UNITS,
    load: load, save: save, furiganaOn: furiganaOn, setFurigana: setFurigana,
    levelById: levelById, unitsFor: unitsFor, unitById: unitById,
    kanjiByCh: kanjiByCh, kanjiForLevel: kanjiForLevel, grammarById: grammarById, readingById: readingById,
    markKanaDone: markKanaDone, unitPass: unitPass, levelPass: levelPass,
    isLevelUnlocked: isLevelUnlocked, isUnitUnlocked: isUnitUnlocked, proficiency: proficiency,
    checkpointQuiz: checkpointQuiz, levelTest: levelTest, withOptions: withOptions, rubyHtml: rubyHtml,
    counts: function () {
      var g = (GD && GD.GRAMMAR) || [];
      var r = (RD && RD.READINGS) || [];
      return {
        kanjiN5: kanjiForLevel("N5").length,
        kanjiN4: kanjiForLevel("N4").length,
        grammar: g.length,
        grammarN5: g.filter(function (x) { return x.level === "N5"; }).length,
        grammarN4: g.filter(function (x) { return x.level === "N4"; }).length,
        readings: r.length,
        readingsN5: r.filter(function (x) { return x.level === "N5"; }).length,
        readingsN4: r.filter(function (x) { return x.level === "N4"; }).length,
        unitsN5: unitsFor("N5").length,
        unitsN4: unitsFor("N4").length
      };
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.KA_PATH = API;
})(typeof window !== "undefined" ? window : this);
