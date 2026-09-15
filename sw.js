const CACHE_NAME = 'ios-pwa-dev-v5';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
self.addEventListener('message', event => {

    if (
        event.data &&
        event.data.type === 'SKIP_WAITING'
    ) {
        self.skipWaiting();
    }

});
self.addEventListener('install', event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );

});


self.addEventListener('activate', event => {

  event.waitUntil(

    caches.keys()
      .then(keys =>
        Promise.all(

          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))

        )
      )
      .then(() => self.clients.claim())

  );

});


self.addEventListener('fetch', event => {

  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(

    caches.match(request)
      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(request)
          .then(response => {

            if (
              response &&
              response.ok &&
              new URL(request.url).origin === self.location.origin
            ) {

              const copy = response.clone();

              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(request, copy);
                })
                .catch(() => {});

            }

            return response;

          })
          .catch(() => {

            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }

            return new Response('', {
              status: 503,
              statusText: 'Offline'
            });

          });

      })

  );

});
