/*
 * Service worker do app do atleta (Etapa 6, §32-33).
 *
 * Regra de ouro de segurança: NUNCA cachear /api/* (respostas autenticadas
 * podem vazar para outro atleta num aparelho compartilhado). Dados offline
 * vivem em IndexedDB no nível do app (modules/offline-sync), não aqui.
 *
 * Estratégia por tipo de request:
 *   - /api/*                → NetworkOnly (sem cache, nunca)
 *   - navegação (HTML)      → Network-First, fallback para /atleta/offline
 *   - estáticos same-origin → Cache-First (/_next/static, /brand, imagens, fontes)
 *   - resto                 → NetworkOnly
 *
 * Bump CACHE_VERSION a cada mudança de estratégia para invalidar o cache antigo.
 */
const CACHE_VERSION = "enky-atleta-v1";
const OFFLINE_URL = "/atleta/offline";
const PRECACHE = [OFFLINE_URL, "/brand/enky-app-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/exercise-gifs/") ||
    /\.(?:css|js|woff2?|png|jpe?g|svg|webp|gif|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // não interceptar terceiros

  // Nunca cachear API autenticada.
  if (url.pathname.startsWith("/api/")) return;

  // Navegações: rede primeiro, fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Estáticos: cache primeiro, revalida em background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

// Update flow (§32): a página pede skipWaiting quando o usuário aceita atualizar.
// Logout (§33/§52): a página pede CLEAR_CACHE para não deixar rastro no aparelho.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_CACHE") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

// Web Push (§14). Payload é JSON { title, body, url }. Deep-link no clique.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ENKY", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ENKY";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/brand/enky-app-icon.png",
      badge: "/brand/enky-app-icon.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Foca uma aba já aberta e navega; senão abre uma nova.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
