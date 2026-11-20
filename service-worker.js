const CACHE_NAME = 'lusubs-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .filter((cacheName) => cacheName.startsWith('lusubs-shell-'))
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const responseCopy = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseCopy))
            .catch((error) => console.error('A resource could not be cached for offline use.', error)),
        );
      }
      return response;
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => cache.match(request)).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        if (request.mode === 'navigate') {
          return caches.open(CACHE_NAME)
            .then((cache) => cache.match('./index.html'))
            .then((offlinePage) => offlinePage || Promise.reject(error));
        }
        throw error;
      });
    }),
  );
});
