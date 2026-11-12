// sw.js : lets Beat Poe! be added to a phone's home screen and played offline.
// - The page, code and pictures are fetched fresh when online (so updates show up at once),
//   with the saved copy as the fallback when offline.
// - The big, rarely-changing files (word lists and fonts) come from the saved copy first.
// Change CACHE when the list of files below changes.
const CACHE = 'beat-poe-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'css/themes.css',
  'js/lines.js',
  'js/logic.js',
  'js/main.js',
  'art/dickinson-cross.webp',
  'art/dickinson-normal.webp',
  'art/poe-cross.webp',
  'art/poe-normal.webp',
  'art/shelley-cross.webp',
  'art/shelley-normal.webp',
  'art/twain-cross.webp',
  'art/twain-normal.webp',
  'fonts/alfa-slab-one-latin-400-normal.woff2',
  'fonts/cormorant-garamond-latin-600-italic.woff2',
  'fonts/cormorant-garamond-latin-700-normal.woff2',
  'fonts/im-fell-english-sc-latin-400-normal.woff2',
  'fonts/pirata-one-latin-400-normal.woff2',
  'fonts/rye-latin-400-normal.woff2',
  'fonts/special-elite-latin-400-normal.woff2',
  'data/common.txt',
  'data/words.txt',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // one missing file must not stop the rest from being saved
    await Promise.all(FILES.map((f) => cache.add(f).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const savedFirst = /\/(data|fonts)\//.test(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = () => cache.match(req, { ignoreSearch: true });
    if (savedFirst) {
      const hit = await saved();
      if (hit) return hit;
    }
    try {
      const fresh = await fetch(req);
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      const hit = await saved();
      if (hit) return hit;
      if (req.mode === 'navigate') { const page = await cache.match('index.html'); if (page) return page; }
      throw err;
    }
  })());
});
