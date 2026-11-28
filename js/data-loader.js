/* Lazy-load Learn/Path data packs so the kana arcade first paint stays light.
   Exposes window.KA_DATA.ensure(names) -> Promise */
(function (root) {
  "use strict";
  var FILES = {
    vocab: "js/vocab-data.js",
    kanji: "js/kanji-data.js",
    grammar: "js/grammar-data.js",
    reading: "js/reading-data.js",
    path: "js/path-data.js",
    n3: "js/n3-pack.js"
  };
  var CORE = ["vocab", "kanji", "grammar", "reading", "path"];
  var loaded = {}, inflight = {};

  function loadOne(name) {
    if (loaded[name]) return Promise.resolve(name);
    if (inflight[name]) return inflight[name];
    var src = FILES[name];
    if (!src) return Promise.reject(new Error("unknown pack " + name));
    inflight[name] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        loaded[name] = true; delete inflight[name];
        resolve(name);
      };
      s.onerror = function () { delete inflight[name]; reject(new Error("failed " + src)); };
      document.head.appendChild(s);
    });
    return inflight[name];
  }

  function ensure(names) {
    names = names || CORE;
    return Promise.all(names.map(loadOne)).then(function () {
      if (root.KA_VOCAB && root.KA_VOCAB.syncData) root.KA_VOCAB.syncData();
      if (root.KA_PATH && root.KA_PATH.syncData) root.KA_PATH.syncData();
      return true;
    });
  }

  root.KA_DATA = { ensure: ensure, FILES: FILES, CORE: CORE, loaded: loaded };
})(typeof window !== "undefined" ? window : this);
