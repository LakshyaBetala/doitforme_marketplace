/* DoItForMe Web Push service worker.
   Receives push payloads dispatched from /api/push/dispatch and renders them as
   OS notifications, then routes the click back into the PWA / site. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "DoItForMe";
  const url = new URL(data.url || "/dashboard", self.location.origin).href;
  const options = {
    body: data.body || "You have a new update on DoItForMe.",
    icon: "/Doitforme_logo.png",
    badge: "/Doitforme_logo.png",
    data: { url },
    tag: data.tag || undefined,
    renotify: !!data.tag,
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.location.origin + "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
