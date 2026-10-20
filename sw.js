// Offline cache for Kana Arcade. Bump VERSION when files change.
// The wallet bundles in js/vendor/ are NOT precached (about 1 MB); they are cached the first time you tap Connect.
var VERSION = "kana-arcade-v13";
var FILES = ["./", "./index.html", "./style.css", "./kana.js", "./js/romaji.js", "./js/voice.js", "./js/quest.js", "./js/omikuji.js", "./js/welcome.js", "./js/keys.js", "./js/install.js", "./companion.js", "./game.js", "./manifest.webmanifest",
  "./js/badges.js", "./js/badge-book.js", "./js/starknet-config.js", "./js/starknet-abi.js", "./js/starknet.js",
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
