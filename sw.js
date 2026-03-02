/**
 * AmphiGPS – Service Worker
 * Offline-first caching strategy.
 */

var CACHE_NAME = "amphigps-v2";
var APP_FILES = [
  "/",
  "/index.html",
  "/app.js",
  "/style.css",
  "/db.js",
  "/manifest.json",
];

// Install: cache app shell
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_FILES);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) {
            return k !== CACHE_NAME;
          })
          .map(function (k) {
            return caches.delete(k);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first for app files, network-first for API calls
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);

  // Network-first for Supabase API calls
  if (url.hostname.includes("supabase")) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Network-first for CDN resources (Leaflet, Supabase SDK)
  if (
    url.hostname.includes("unpkg.com") ||
    url.hostname.includes("jsdelivr.net") ||
    url.hostname.includes("tile.openstreetmap.org")
  ) {
    e.respondWith(
      fetch(e.request)
        .then(function (response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
          return response;
        })
        .catch(function () {
          return caches.match(e.request);
        })
    );
    return;
  }

  // Cache-first for app files
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, clone);
        });
        return response;
      });
    })
  );
});
