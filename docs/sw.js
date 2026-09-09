// Service worker: кэширует оболочку приложения, чтобы оно открывалось без интернета.
// Стратегия: отдаём из кэша сразу, в фоне обновляем из сети — новая версия подхватится при следующем запуске.
const VERSION = 'health-v1';
const SHELL = ['./', './index.html', './app.js', './localapi.js', './style.css', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return cached || (await network) || new Response('Нет сети', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
