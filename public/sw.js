/// <reference lib="webworker" />

const CACHE_VERSION = "v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const ALL_CACHES = [STATIC_CACHE, FONT_CACHE, IMAGE_CACHE, PAGE_CACHE];

// --- INSTALL ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.add("/offline"))
  );
  self.skipWaiting();
});

// --- ACTIVATE ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- FETCH ---
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== "GET") return;

  // Skip Socket.io entirely (WebSocket upgrade + polling)
  if (url.pathname.startsWith("/api/socketio")) return;

  // Skip auth API routes
  if (url.pathname.startsWith("/api/auth")) return;

  // Skip all other API routes
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: cache-first (content-hashed by Next.js, immutable)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Fonts: cache-first
  if (url.pathname.endsWith(".woff2") || url.pathname.endsWith(".woff")) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Icons and static SVGs: cache-first
  if (url.pathname.startsWith("/icons/") || url.pathname.endsWith(".svg")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Uploaded images: cache-first with eviction
  if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, 100));
    return;
  }

  // HTML navigation: network-first with offline fallback
  if (request.headers.get("Accept")?.includes("text/html")) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// --- STRATEGY: Cache-first ---
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Network error", { status: 503 });
  }
}

// --- STRATEGY: Cache-first with LRU eviction ---
async function cacheFirstWithLimit(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > maxEntries) {
        await cache.delete(keys[0]);
      }
    }
    return response;
  } catch {
    return new Response("Network error", { status: 503 });
  }
}

// --- STRATEGY: Network-first with offline fallback ---
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    return offline || new Response("Offline", { status: 503 });
  }
}

// --- STRATEGY: Network-first ---
async function networkFirst(request, cacheName) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Network error", { status: 503 });
  }
}

// --- UTILITY: Fetch with timeout ---
function fetchWithTimeout(request, timeout) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
