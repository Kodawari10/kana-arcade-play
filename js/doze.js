/* 💤 Sleepy companion: leave the ★ companion screen quiet for a while and your companion dozes off with little
   floating "z"s; any tap, key, scroll or mouse move wakes it with a stretch and a Japanese "good morning".
   Pure logic only (timer + lines + z positions); game.js draws it. Nothing is saved. Exposes window.KA_DOZE. */
(function (root) {
  "use strict";
  var DELAY = 40000;
  function create(delay) {
    var d = delay > 0 ? delay : DELAY, last = 0, armed = false, dozing = false;
    return {
      reset: function (now) { last = now; armed = true; dozing = false; },
      // any activity: returns true if it woke a dozing companion
      poke: function (now) { var w = dozing; last = now; dozing = false; return w; },
      // call every frame: returns true on the frame it dozes off
      tick: function (now) { if (!dozing && armed && now - last >= d) { dozing = true; return true; } return false; },
      force: function () { dozing = true; },
      isDozing: function () { return dozing; },
      setDelay: function (ms) { if (ms > 0) d = ms; },
      delay: function () { return d; }
    };
  }
  function night(h) { return h >= 22 || h < 5; }
  function sleepLine(hour, name) {
    return night(hour)
      ? { id: "oyasumi", jp: "おやすみ…", en: name + " dozed off. Good night! Tap to wake.", speak: "おやすみ" }
      : { id: "suyasuya", jp: "すやすや…", en: name + " dozed off (that's the sound of sweet sleep). Tap to wake!", speak: "すやすや" };
  }
  function wakeLine(hour, name) {
    if (hour >= 5 && hour < 11) return { id: "ohayou", jp: "おはよう!", en: "Good morning! " + name + " is awake.", speak: "おはよう" };
    if (night(hour)) return { id: "nemui", jp: "ねむい…", en: name + " is so sleepy… one more round?", speak: "ねむい" };
    return { id: "nechatta", jp: "ねちゃった!", en: "Oops, I fell asleep! " + name + " is awake.", speak: "ねちゃった" };
  }
  // floating z's: x,y as fractions of the canvas, size factor, alpha. calm = one still z.
  function zs(t, calm) {
    if (calm) return [{ x: 0.7, y: 0.22, size: 1, alpha: 0.9, ch: "z" }];
    var out = [];
    for (var i = 0; i < 3; i++) {
      var p = ((t * 0.45) + i / 3) % 1;
      out.push({ x: 0.6 + p * 0.2 + Math.sin(p * 6 + i) * 0.02, y: 0.4 - p * 0.32, size: 0.6 + p * 0.7, alpha: p < 0.15 ? p / 0.15 : (p > 0.8 ? (1 - p) / 0.2 : 1), ch: i === 1 ? "Z" : "z" });
    }
    return out;
  }
  var api = { DELAY: DELAY, create: create, sleepLine: sleepLine, wakeLine: wakeLine, zs: zs, isNight: night };
  root.KA_DOZE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
