/* 🔊 Hear the kana: speaks kana in Japanese with the browser's built-in speech (no files, works offline
   when the device has a Japanese voice). Respects the game's mute switch. Exposes window.KA_VOICE. */
(function (root) {
  "use strict";
  var synth = root.speechSynthesis, U = root.SpeechSynthesisUtterance;
  var supported = !!(synth && U);
  var jaVoice = null;
  function pickVoice() {
    if (!supported) return null;
    try {
      var vs = synth.getVoices() || [];
      jaVoice = vs.filter(function (v) { return /^ja(-|_|$)/i.test(v.lang || ""); })
        .sort(function (a, b) { return (b.localService ? 1 : 0) - (a.localService ? 1 : 0); })[0] || null;
    } catch (e) { jaVoice = null; }
    return jaVoice;
  }
  if (supported) {
    pickVoice();
    try { if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice); else synth.onvoiceschanged = pickVoice; } catch (e) {}
  }
  function muted() {
    try { return JSON.parse(localStorage.getItem("kanaArcade.muted") || "false") === true; } catch (e) { return false; }
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
      var u = new U(text);
      u.lang = "ja-JP"; u.rate = opts.rate || 0.8; u.pitch = 1.15; u.volume = 1;
      if (jaVoice || pickVoice()) u.voice = jaVoice;
      synth.speak(u);
      var sp = root.KA_VOICE.spoken; sp.push(text); if (sp.length > 20) sp.shift();
      return true;
    } catch (e) { return false; }
  }
  root.KA_VOICE = {
    get supported() { return supported; },
    get hasJapaneseVoice() { return !!(jaVoice || pickVoice()); },
    speak: speak, muted: muted, spoken: []
  };
})(window);
