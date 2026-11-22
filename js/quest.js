/* 📜 Daily quest: one small goal per day, picked from the date, saved under kanaArcade.quest.
   Pure logic (no DOM), so it can be tested on its own. Exposes window.KA_QUEST. */
(function (root) {
  "use strict";
  var REWARD = 40;
  var QUESTS = [
    { id: "hits",     goal: 30, icon: "🎯", text: "Shoot 30 kana today", jp: "かなを 30こ!" },
    { id: "combo",    goal: 15, icon: "🔥", text: "Reach a 15 combo in one game", jp: "コンボ 15!" },
    { id: "level",    goal: 4,  icon: "🚀", text: "Reach level 4 in one game", jp: "レベル 4!" },
    { id: "kata",     goal: 15, icon: "カ", text: "Shoot 15 katakana (pick カタカナ or MIX)", jp: "カタカナ 15こ!" },
    { id: "games",    goal: 3,  icon: "🕹", text: "Play 3 games today", jp: "3かい あそぼう!" },
    { id: "practice", goal: 10, icon: "💪", text: "Shoot 10 kana you've missed before", jp: "にがてな かな 10こ!" }
  ];
  function byId(id) { for (var i = 0; i < QUESTS.length; i++) if (QUESTS[i].id === id) return QUESTS[i]; return null; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function prevDay(key) { var p = key.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2] - 1, 12); return dayKey(d); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // ctx.hasMissed: the player has kana they've missed before (otherwise the practice quest can't be done yet)
  function pick(key, ctx) {
    var list = QUESTS.filter(function (q) { return q.id !== "practice" || (ctx && ctx.hasMissed); });
    return list[hash("kana-quest:" + key) % list.length].id;
  }
  function num(v) { return typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : 0; }
  // Load a saved quest (or junk) for today. A new day gets a new quest; the streak survives only if yesterday was done.
  function normalize(saved, key, ctx) {
    var s = saved && typeof saved === "object" ? saved : {};
    var streak = num(s.streak), lastDone = typeof s.lastDone === "string" ? s.lastDone : "";
    if (lastDone !== key && lastDone !== prevDay(key)) streak = 0;
    if (s.date === key && byId(s.id)) {
      var q0 = byId(s.id);
      return { date: key, id: s.id, prog: Math.min(num(s.prog), q0.goal), done: s.done === true, streak: streak, lastDone: lastDone };
    }
    return { date: key, id: pick(key, ctx), prog: 0, done: false, streak: streak, lastDone: lastDone };
  }
  // ev: { type: "kill", kata, practiced, combo, level } or { type: "game" }. Returns true when this event completes the quest.
  function advance(q, ev) {
    var def = byId(q.id); if (!def || q.done) return false;
    var p = q.prog;
    if (ev.type === "kill") {
      if (q.id === "hits") p++;
      else if (q.id === "kata" && ev.kata) p++;
      else if (q.id === "practice" && ev.practiced) p++;
      else if (q.id === "combo") p = Math.max(p, num(ev.combo));
      else if (q.id === "level") p = Math.max(p, num(ev.level));
    } else if (ev.type === "game" && q.id === "games") p++;
    q.prog = Math.min(p, def.goal);
    if (q.prog >= def.goal) {
      q.done = true;
      q.streak = q.lastDone === prevDay(q.date) ? q.streak + 1 : (q.lastDone === q.date ? q.streak : 1);
      q.lastDone = q.date;
      return true;
    }
    return false;
  }
  root.KA_QUEST = { QUESTS: QUESTS, REWARD: REWARD, byId: byId, dayKey: dayKey, prevDay: prevDay, pick: pick, normalize: normalize, advance: advance };
})(typeof window !== "undefined" ? window : globalThis);
