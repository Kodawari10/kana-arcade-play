/* 🎵 Arcade music for Kana Arcade: a soft, looping chiptune made right in the browser (Web Audio, no files).
   KA_MUSIC.bpmFor / volFor are pure; KA_MUSIC.create({ getCtx, mood }) returns a little player that checks
   mood() every 100 ms and schedules notes a moment ahead. mood() → { on, muted, hidden, state, level, gentle }. */
(function () {
  "use strict";
  // C major pentatonic (C D E G A), four little 8-step phrases (eighth notes), null = rest
  var PHRASES = [
    { lead: [72, 76, 79, 76, 81, 79, 76, null], bass: 48 },
    { lead: [74, 76, 79, 81, 84, 81, 79, null], bass: 43 },
    { lead: [81, 79, 76, 74, 76, 72, 74, null], bass: 45 },
    { lead: [72, 74, 76, 79, 76, 74, 72, null], bass: 48 }
  ];
  var TWINKLE = [96, 100, 103, 100]; // a tiny high sparkle at the end of each phrase
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // tempo: calm on the title screen, a little quicker each level in a game, always slow in Gentle mode
  function bpmFor(m) {
    m = m || {};
    if (m.gentle) return 84;
    if (m.state === "play" || m.state === "pause") return Math.min(140, 104 + 4 * Math.max(0, (m.level || 1) - 1));
    return 96;
  }
  // loudness (0..1 of the music bus): softer in Gentle mode, hushed while paused, silent when off/muted/hidden
  function volFor(m) {
    m = m || {};
    if (!m.on || m.muted || m.hidden) return 0;
    var v = m.gentle ? 0.6 : 1;
    if (m.state === "pause") v *= 0.35;
    return v;
  }
  var BUS = 0.09; // the whole loop stays well under the sound effects

  function create(opts) {
    var bus = null, nextT = 0, step = 0, phrase = 0, notes = 0, timer = null, last = { bpm: 0, vol: 0 };
    function note(a, type, midi, t, dur, vol) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(hz(midi), t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.03); notes++;
    }
    function playStep(a, t, eighth, m) {
      var P = PHRASES[phrase], n = P.lead[step];
      if (n !== null) note(a, "triangle", n, t, eighth * 1.6, 0.5);
      if (step % 4 === 0) note(a, "sine", P.bass, t, eighth * (m.gentle ? 3.5 : 2.4), m.gentle ? 0.45 : 0.6);
      if (step === 7) note(a, "sine", TWINKLE[phrase], t, eighth * 1.2, 0.18);
      if (++step >= 8) { step = 0; phrase = (phrase + 1) % PHRASES.length; }
    }
    function stopSound() {
      if (!bus) return;
      var b = bus, a = b.context; bus = null;
      try { b.gain.cancelScheduledValues(a.currentTime); b.gain.setTargetAtTime(0, a.currentTime, 0.08); } catch (e) {}
      setTimeout(function () { try { b.disconnect(); } catch (e) {} }, 600);
    }
    function tick() {
      var m = opts.mood() || {}, vol = volFor(m), bpm = bpmFor(m);
      last.bpm = bpm; last.vol = vol;
      var a = vol > 0 ? opts.getCtx() : null;
      if (!a || a.state !== "running") { stopSound(); return; }
      if (!bus) {
        bus = a.createGain(); bus.gain.value = 0.0001; bus.connect(a.destination);
        nextT = a.currentTime + 0.06; step = 0;
      }
      bus.gain.setTargetAtTime(BUS * vol, a.currentTime, 0.15);
      var eighth = 30 / bpm;
      if (nextT < a.currentTime - 0.2) nextT = a.currentTime + 0.05; // fell behind (tab woke up): just carry on
      while (nextT < a.currentTime + 0.3) { playStep(a, nextT, eighth, m); nextT += eighth; }
    }
    timer = setInterval(tick, 100);
    return {
      tick: tick,
      info: function () { return { playing: !!bus, bpm: last.bpm, vol: last.vol, notes: notes, phrase: phrase, step: step }; },
      destroy: function () { clearInterval(timer); stopSound(); }
    };
  }

  window.KA_MUSIC = { bpmFor: bpmFor, volFor: volFor, create: create, PHRASES: PHRASES };
})();
