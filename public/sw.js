/* XArena service worker.
 * - Makes the site installable (needs a fetch handler on some browsers).
 * - Shows Web Push notifications and opens the right page when one is tapped.
 * It deliberately does NOT cache pages or API responses: this app shows wallet balances and
 * tournament rooms, and stale data there is worse than a spinner. */

const OFFLINE_HTML =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>XArena — offline</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#05070E;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
  '<div><h1 style="font-size:22px;margin:0 0 8px">You&apos;re offline</h1><p style="color:#9aa4b8;margin:0 0 20px">Check your internet connection and try again.</p>' +
  '<button onclick="location.reload()" style="background:#1E5BFF;color:#fff;border:0;border-radius:12px;padding:12px 22px;font-size:15px;font-weight:700">Retry</button></div>';

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // everything else goes straight to the network
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } })
    )
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "XArena";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || undefined, // same tag = replaces instead of stacking duplicates
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const c of clients) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })
  );
});
