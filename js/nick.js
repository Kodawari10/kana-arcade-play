/* 🏷️ Companion nicknames: give Nekomaru, Kon or Ryuta your own pet name (up to 16 letters, Japanese welcome).
   Pure logic only; game.js draws the pill and the little edit box. Saved on this device as kanaArcade.nicks
   ({ petId: "Mochi" }), never sent anywhere or on-chain. Exposes window.KA_NICK (and module.exports for tests). */
(function (root) {
  "use strict";
  var MAX = 16;
  // trim, squash spaces, drop control characters, cap at MAX characters (counting emoji / kana as one each)
  function clean(s) {
    if (typeof s !== "string") return "";
    var t = s.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, " ").replace(/\s+/g, " ").trim();
    var cs = Array.from ? Array.from(t) : t.split("");
    return cs.slice(0, MAX).join("").trim();
  }
  function length(s) { return Array.from ? Array.from(s || "").length : String(s || "").length; }
  // keep only known companions with a usable nickname that differs from the real name
  function sanitize(raw, pets) {
    var out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    (pets || []).forEach(function (P) {
      var n = clean(raw[P.id]);
      if (n && n.toLowerCase() !== String(P.name).toLowerCase() && n !== P.jp) out[P.id] = n;
    });
    return out;
  }
  // returns a new map with the nickname set (or removed when empty / same as the real name)
  function set(map, P, name) {
    var out = {}, k; for (k in map || {}) if (Object.prototype.hasOwnProperty.call(map, k)) out[k] = map[k];
    var n = clean(name);
    if (!n || n.toLowerCase() === String(P.name).toLowerCase() || n === P.jp) delete out[P.id]; else out[P.id] = n;
    return out;
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function quoted(n) { return "\u201c" + n + "\u201d"; }
  var NICK = { MAX: MAX, clean: clean, length: length, sanitize: sanitize, set: set, escapeHTML: escapeHTML, quoted: quoted };
  if (typeof module !== "undefined" && module.exports) module.exports = NICK;
  else root.KA_NICK = NICK;
})(this);
