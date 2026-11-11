/* Compras Coletivas — service worker
   Estratégia:
   - App shell (HTML/CSS/JS) precacheado no install.
   - Navegação same-origin: network-first com fallback para o shell em cache.
   - App shell em JS/CSS: network-first (sempre fresco) com fallback offline.
   - Demais estáticos same-origin (ícones, imagens, vendor): stale-while-revalidate.
   - Fontes e imagens externas: stale-while-revalidate com limite.
   - API (/api e /api/*): sempre rede; nunca cacheia dados autenticados. */

const VERSION = "cc-2026-11-11.2";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const IMAGE_CACHE = `${VERSION}-images`;
const CURRENT_CACHES = new Set([STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE]);

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/styles.css",
  "/auth-recovery.css",
  "/app.js",
  "/auth-recovery.js",
  "/pwa.js",
  "/produtos.js",
  "/variantes.js",
  "/groups.js",
  "/manifest.webmanifest",
  "/icons/favicon-32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

// Arquivos do app shell que nunca podem ficar defasados em relação ao HTML.
const APP_SHELL_ASSETS = new Set([
  "/index.html",
  "/styles.css",
  "/auth-recovery.css",
  "/app.js",
  "/auth-recovery.js",
  "/pwa.js",
  "/produtos.js",
  "/variantes.js",
  "/groups.js",
  "/manifest.webmanifest",
]);

const IMAGE_CACHE_LIMIT = 140;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "no-cache" })))
      );
      // Não chamamos skipWaiting aqui: em uma atualização o novo worker deve
      // ficar em waiting até o usuário aceitar pelo banner.
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !CURRENT_CACHES.has(key))
          .map((key) => caches.delete(key))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data === "PING" && event.ports?.[0]) {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        event.ports[0].postMessage({ version: VERSION, caches: keys });
      })()
    );
  }
});

function canCache(response) {
  if (!response) return false;
  if (response.type === "opaque") return true;
  return response.ok && response.status !== 206;
}

async function safePut(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch (error) {
    /* resposta não cacheável (Vary: *, 206 etc.) — segue sem quebrar */
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (canCache(response)) {
        safePut(cache, request, response.clone());
        if (cacheName === IMAGE_CACHE) trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT);
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (canCache(response)) {
      const copy = response.clone();
      await safePut(cache, request, copy);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function networkFirstNavigation(request) {
  const url = new URL(request.url);
  const isShell =
    url.origin === self.location.origin &&
    (url.pathname === "/" || url.pathname === "/index.html");
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (isShell && canCache(response)) {
      const copy = response.clone();
      await safePut(cache, "/index.html", copy);
    }
    return response;
  } catch (error) {
    if (!isShell) throw error;
    const cached = await cache.match("/index.html");
    if (cached) return cached;
    const fallback = await cache.match("/");
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && (url.pathname === "/api" || url.pathname.startsWith("/api/"))) {
    return;
  }

  if (request.mode === "navigate") {
    // Navegação para outro domínio segue direto para a rede, sem cache.
    if (!sameOrigin) return;
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (sameOrigin) {
    if (APP_SHELL_ASSETS.has(url.pathname)) {
      event.respondWith(networkFirstStatic(request));
    } else {
      event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    }
    return;
  }

  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  if (url.hostname === "vteximg.com.br" || url.hostname.endsWith(".vteximg.com.br")) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }
});
