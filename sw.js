/* Service worker stub — push + offline shell later */
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => clients.claim());
self.addEventListener("push", (event) => {
  let data = { title: "Desk", body: "" };
  try { data = event.data ? event.data.json() : data; } catch (e) {}
  event.waitUntil(self.registration.showNotification(data.title || "Desk", {
    body: data.body || "",
    data: { url: data.url || "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});
