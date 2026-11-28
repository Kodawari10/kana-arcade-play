/* 🔊 Hear the kana: speaks kana in Japanese with the browser's built-in speech (no files, works offline
   when the device has a Japanese voice). Respects the game's mute switch. Exposes window.KA_VOICE.
   👩/👨 Voice choice: picks a real female or male ja-JP voice when the device has one; otherwise it uses
   the Japanese voice it has with a pitch shift (higher for female, lower for male) so they still sound different.
   The choice lives in its own key (kanaArcade.voice = "female" | "male", default female). */
(function (root) {
  "use strict";
  var synth = root.speechSynthesis, U = root.SpeechSynthesisUtterance;
  var supported = !!(synth && U);
  var KEY = "kanaArcade.voice";
  // known voice names (Apple, Microsoft, Google, Amazon-style names that browsers expose)
  var FEMALE = /female|kyoko|o-?ren|haruka|ayumi|nanami|mizuki|sayaka|kaori|aoi|shiori|mayu|nozomi|google\s*日本語|\bwoman\b|女性/i;
  var MALE = /(^|[^a-z])male|otoya|hattori|ichiro|keita|takumi|daichi|naoki|\bman\b|男性/i;
  // pitch: a real voice of that gender keeps a natural pitch; a stand-in voice gets shifted
  var PITCH = { female: { real: 1.15, shift: 1.25 }, male: { real: 0.95, shift: 0.75 } };
  function genderOf(v) {
    var n = (v && (v.name || "") + " " + (v.voiceURI || "")) || "";
    if (FEMALE.test(n)) return "female"; // check female first: "female" contains "male"
    if (MALE.test(n)) return "male";
    return null;
  }
  function gender() {
    try { var g = localStorage.getItem(KEY); return g === "male" ? "male" : "female"; } catch (e) { return "female"; }
  }
  function isJa(v) { return /^ja(-|_|$)/i.test((v && v.lang) || ""); }
  var jaVoices = [], pick = { voice: null, exact: false, gender: "female" };
  function byLocal(a, b) { return (b.localService ? 1 : 0) - (a.localService ? 1 : 0); }
  function pickVoice() {
    var g = gender();
    pick = { voice: null, exact: false, gender: g };
    if (!supported) return null;
    try { jaVoices = (synth.getVoices() || []).filter(isJa).sort(byLocal); } catch (e) { jaVoices = []; }
    var same = jaVoices.filter(function (v) { return genderOf(v) === g; });
    if (same.length) { pick.voice = same[0]; pick.exact = true; return pick.voice; }
    // no voice of that gender: prefer one whose gender is unknown, then any Japanese voice
    var unknown = jaVoices.filter(function (v) { return !genderOf(v); });
    pick.voice = unknown[0] || jaVoices[0] || null;
    return pick.voice;
  }
  function current() { if (!pick.voice || pick.gender !== gender()) pickVoice(); return pick; }
  if (supported) {
    pickVoice();
    // voices often arrive a moment after page load (Chrome, Android): pick again when they do
    try { if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice); else synth.onvoiceschanged = pickVoice; } catch (e) {}
  }
  function muted() {
    try { return JSON.parse(localStorage.getItem("kanaArcade.muted") || "false") === true; } catch (e) { return false; }
  }
  function setGender(g) {
    g = g === "male" ? "male" : "female";
    try { localStorage.setItem(KEY, g); } catch (e) {}
    pickVoice();
    return info();
  }
  function info() {
    var p = current();
    return { gender: p.gender, voice: p.voice ? p.voice.name : null, exact: p.exact, hasJapaneseVoice: !!p.voice,
      pitch: PITCH[p.gender][p.exact ? "real" : "shift"] };
  }
  var last = { text: "", at: 0 };
  // speak(text, {force}) → true if it was handed to the speech engine
  function speak(text, opts) {
    opts = opts || {};
    if (!supported || !text || muted()) return false;
    var now = Date.now();
    if (!opts.force && text === last.text && now - last.at < 400) return false; // ignore double taps
    last = { text: text, at: now };
    try {
      if (opts.interrupt !== false) synth.cancel();
      var p = current(), u = new U(text);
      u.lang = "ja-JP"; u.rate = opts.rate || 0.8; u.volume = 1;
      u.pitch = PITCH[p.gender][p.exact ? "real" : "shift"];
      if (p.voice) u.voice = p.voice;
      synth.speak(u);
      var sp = root.KA_VOICE.spoken; sp.push(text); if (sp.length > 20) sp.shift();
      return true;
    } catch (e) { return false; }
  }
  root.KA_VOICE = {
    get supported() { return supported; },
    get hasJapaneseVoice() { return !!current().voice; },
    get gender() { return gender(); },
    setGender: setGender, info: info, genderOf: genderOf, refresh: pickVoice,
    speak: speak, muted: muted, spoken: []
  };
})(window);
