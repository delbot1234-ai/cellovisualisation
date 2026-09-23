// Network-first service worker: always serves the latest files when online,
// falls back to the cached copy offline. Bump CACHE_VERSION when the file
// list changes so stale caches get cleaned up.

var CACHE_VERSION = "cello-bow-v1";
var APP_SHELL = [
  "./",
  "index.html",
  "privacy.html",
  "manifest.webmanifest",
  "css/styles.css",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "js/physics.js",
  "js/audio.js",
  "js/visualizer.js",
  "js/diagram.js",
  "js/witmotionParser.js",
  "js/sensorFileParser.js",
  "js/bleConnector.js",
  "js/sensorChart.js",
  "js/noteUtils.js",
  "js/pitchDetector.js",
  "js/micTuner.js",
  "js/main.js",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_VERSION;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      })
      .catch(function () {
        return caches.match(request).then(function (cached) {
          if (cached) return cached;
          if (request.mode === "navigate") return caches.match("index.html");
          return Response.error();
        });
      })
  );
});
