// Installation support only. Do not cache authenticated data or pretend drafts save offline.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
