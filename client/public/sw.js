const CACHE_NAME = "lead-forge-shell-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexResponse = await fetch("/index.html", { cache: "no-cache" });
  const indexText = await indexResponse.text();
  await cache.put(
    "/index.html",
    new Response(indexText, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );

  const assetPaths = [...indexText.matchAll(/(?:src|href)="(\/[^"?]+)"/g)]
    .map(match => match[1])
    .filter(path => !path.startsWith("/api/") && !path.startsWith("/src/"));
  const paths = [...new Set([...STATIC_ASSETS, ...assetPaths])];
  await Promise.allSettled(
    paths.map(async path => {
      const response = await fetch(path, { cache: "no-cache" });
      if (response.ok) await cache.put(path, response);
    })
  );
}

self.addEventListener("install", event => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(cached => cached || caches.match("/index.html"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
