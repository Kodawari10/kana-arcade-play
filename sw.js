// Offline cache for Kana Arcade. Bump VERSION when files change.
var VERSION = "kana-arcade-v50";
var FILES = ["./", "./index.html", "./style.css", "./kana.js", "./js/romaji.js", "./js/voice.js", "./js/quest.js", "./js/omikuji.js", "./js/welcome.js", "./js/keys.js", "./js/install.js", "./js/swipe.js", "./js/costumes.js", "./js/words.js", "./js/vocab-data.js", "./js/data-loader.js", "./js/vocab.js", "./js/srs.js", "./js/kanji-data.js", "./js/grammar-data.js", "./js/reading-data.js", "./js/path-data.js", "./js/n3-pack.js", "./js/path.js", "./js/learn.js", "./js/review.js", "./js/chatter.js", "./js/sticker.js", "./js/music.js", "./js/near.js", "./js/lookalike.js", "./js/mnemonic.js", "./js/drill.js", "./js/pace.js", "./js/decode.js", "./js/slowspot.js", "./js/mixlog.js", "./js/skies.js", "./js/nick.js", "./js/since.js", "./js/doze.js", "./js/find.js", "./js/recap.js", "./js/twin.js", "./js/stats.js", "./js/savecode.js", "./companion.js", "./game.js", "./manifest.webmanifest",
  "./js/badges.js", "./js/badge-book.js",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    });
  }));
});
