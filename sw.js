/**
 * AmphiGPS – Service Worker (Decommissioned)
 * This SW only exists to clean up old caches and unregister itself.
 * The app is now cloud-only and requires a network connection.
 */

// On activate: delete all caches and unregister
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.registration.unregister();
    })
  );
});

// Do not intercept any fetches — let everything go to the network
self.addEventListener("fetch", function () {
  // no-op: all requests go through the network normally
});
