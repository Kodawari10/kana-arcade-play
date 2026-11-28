/* 🎃 Spooky costumes: during spooky season (Oct 15 to Nov 5) companions dress up.
   Nekomaru wears a little witch hat, Kon a pumpkin cap, Ryuta a bat-wing headband.
   Stored separately under kanaArcade.costumes ({ on: true/false, hello: <year> }),
   so the main save is never touched. Exposes window.KA_COSTUMES (pure logic + tiny store). */
(function (root) {
  "use strict";
  var KEY = "kanaArcade.costumes";
  var LOOKS = {
    neko:    { id: "witch",   emoji: "🧙", name: "a little witch" },
    kitsune: { id: "pumpkin", emoji: "🎃", name: "a pumpkin" },
    ryu:     { id: "bat",     emoji: "🦇", name: "a bat" }
  };
  function today() { return root.__kaToday ? new Date(root.__kaToday) : new Date(); }
  // Oct 15 .. Nov 5, any year (local date)
  function inSeason(d) {
    d = d || today(); var m = d.getMonth(), day = d.getDate();
    return (m === 9 && day >= 15) || (m === 10 && day <= 5);
  }
  function read() {
    try { var v = JSON.parse(root.localStorage.getItem(KEY)); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
  }
  function write(v) { try { root.localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function wanted() { return read().on !== false; }              // default on; junk = on
  function active(d) { return inSeason(d) && wanted(); }
  function setOn(on) { var v = read(); v.on = !!on; write(v); }
  function lookFor(petId) { return LOOKS[petId] || null; }
  // stage 0 (egg) gets a tiny hat too; masters (stage 4) keep their crown
  function dresses(stage) { return stage >= 0 && stage <= 3; }
  function costumeFor(petId, stage) { return active() && dresses(stage) ? lookFor(petId) : null; }
  // one-time "dressed up" hello per season (year)
  function needsHello(d) { d = d || today(); return active(d) && read().hello !== d.getFullYear(); }
  function markHello(d) { d = d || today(); var v = read(); v.hello = d.getFullYear(); write(v); }
  // calm = Gentle mode or reduce motion: costumes stay still
  function still() { return !!(root.document && root.document.body && root.document.body.classList.contains("calm")); }

  root.KA_COSTUMES = { KEY: KEY, LOOKS: LOOKS, inSeason: inSeason, wanted: wanted, active: active, setOn: setOn,
    lookFor: lookFor, dresses: dresses, costumeFor: costumeFor, needsHello: needsHello, markHello: markHello, still: still };
})(this);
