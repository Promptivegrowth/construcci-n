/* Grupo Cruz · Campo — service worker
   Estrategia: red primero con respaldo en caché (nunca sirve contenido viejo si hay señal);
   sin conexión, las navegaciones caen en la última copia o en /offline. */
const VERSION = "gc-campo-v1";
const SHELL = ["/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.png", "/brand/logo-holding.png", "/brand/logo-holding-dark.png", "/brand/isotipo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase y CDNs: siempre red
  if (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (res.type === "basic" || res.type === "default")) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreVary: true });
        if (cached) return cached;
        if (req.mode === "navigate") return (await caches.match("/offline")) || new Response("Sin conexión", { status: 503 });
        return new Response("", { status: 504, statusText: "offline" });
      }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
