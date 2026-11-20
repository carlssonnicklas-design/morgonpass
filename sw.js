// Service worker: gör appen tillgänglig offline. Höj VERSION vid ändringar.
const VERSION = 'morgonpass-v6';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/animations.js', 'js/exercises.js', 'js/planner.js', 'js/player.js', 'js/store.js', 'js/voice.js', 'js/claude.js',
  'vendor/anthropic.js', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Nätverk först (så uppdateringar slår igenom), cache som reserv offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Videor hämtas med Range-anrop som inte går att cacha; utan nät faller appen tillbaka på streckgubben.
  if (url.pathname.includes('/videos/')) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.status === 200) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
