// アプリシェルをキャッシュしてオフラインでも開けるようにする。API 通信はキャッシュしない。
const VERSION = 'v1';
const CACHE = `review-inbox-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/classifier.js',
  './js/store.js',
  './js/gmail.js',
  './js/templates.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Google API 等は素通し
  // 共有ターゲットのクエリ付き起動はシェルの index を返す
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone())); return res; }).catch(() => cached);
      return cached || network;
    })
  );
});
