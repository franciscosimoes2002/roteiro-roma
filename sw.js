/* ============================================================
   Service worker — é isto que faz a app abrir sem rede.

   Estratégia:
     · ficheiros da app  → cache primeiro, rede em segundo plano
     · APIs (Google, OpenAI, meteo) → só rede, nunca guardadas
   ============================================================ */

const VERSION = 'roteiro-roma-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/config.js',
  './js/food.js',
  './js/links.js',
  './js/maps.js',
  './js/places.js',
  './js/ai.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

/* Domínios que nunca devem ser servidos da cache. */
const LIVE_ONLY = [
  'googleapis.com',
  'gstatic.com',
  'google.com',
  'api.openai.com',
  'api.anthropic.com',
  'open-meteo.com',
  'cdn.jsdelivr.net',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // addAll falha inteiro se um único ficheiro falhar: pedimos um a um
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (LIVE_ONLY.some((d) => url.hostname.endsWith(d))) return;   // deixa passar à rede
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request, { ignoreSearch: true });

    // atualiza em segundo plano para a próxima abertura
    const fresh = fetch(request)
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      })
      .catch(() => null);

    if (hit) return hit;

    const res = await fresh;
    if (res) return res;

    // sem cache e sem rede: se for uma navegação, devolve a app
    if (request.mode === 'navigate') {
      return (await cache.match('./index.html'))
        || new Response('Sem ligação.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return new Response('', { status: 504 });
  })());
});

/* A página pede a atualização imediata quando o utilizador aceita. */
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
