const CACHE_NAME = 'ios-pwa-dev-v9';

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

/* =====================================================
   SKIP WAITING
===================================================== */

self.addEventListener(
    'message',
    event => {

        if (
            event.data &&
            event.data.type === 'SKIP_WAITING'
        ) {

            self.skipWaiting();

        }

    }
);


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
    'install',
    event => {

        event.waitUntil(

            caches.open(
                CACHE_NAME
            ).then(
                cache => cache.addAll(
                    APP_SHELL
                )
            )

        );

    }
);


/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener(
    'activate',
    event => {

        event.waitUntil(

            caches.keys().then(
                keys => Promise.all(

                    keys
                        .filter(
                            key =>
                                key !== CACHE_NAME
                        )
                        .map(
                            key =>
                                caches.delete(key)
                        )

                )
            ).then(
                () =>
                    self.clients.claim()
            )

        );

    }
);


/* =====================================================
   FETCH
===================================================== */

self.addEventListener(
    'fetch',
    event => {

        const request =
            event.request;

        if (
            request.method !== 'GET'
        ) {

            return;

        }


        /*
         * Always check the network first
         * for JavaScript and CSS.
         *
         * This allows development changes
         * to appear without clearing site data.
         */

        const url =
            new URL(
                request.url
            );

        if (
            url.pathname.endsWith(
                '/app.js'
            ) ||
            url.pathname.endsWith(
                '/style.css'
            ) ||
            url.pathname.endsWith(
                '/index.html'
            ) ||
            url.pathname.endsWith(
                '/manifest.json'
            )
        ) {

            event.respondWith(

                fetch(
                    request,
                    {
                        cache: 'no-cache'
                    }
                ).then(
                    response => {

                        if (
                            response &&
                            response.ok &&
                            url.origin ===
                                self.location.origin
                        ) {

                            const copy =
                                response.clone();

                            caches.open(
                                CACHE_NAME
                            ).then(
                                cache =>
                                    cache.put(
                                        request,
                                        copy
                                    )
                            ).catch(
                                () => {}
                            );

                        }

                        return response;

                    }
                ).catch(
                    () =>
                        caches.match(
                            request
                        )
                )

            );

            return;

        }


        /*
         * Other files use the normal
         * cache-first strategy.
         */

        event.respondWith(

            caches.match(
                request
            ).then(
                cached => {

                    if (
                        cached
                    ) {

                        return cached;

                    }

                    return fetch(
                        request
                    ).then(
                        response => {

                            if (
                                response &&
                                response.ok &&
                                url.origin ===
                                    self.location.origin
                            ) {

                                const copy =
                                    response.clone();

                                caches.open(
                                    CACHE_NAME
                                ).then(
                                    cache =>
                                        cache.put(
                                            request,
                                            copy
                                        )
                                ).catch(
                                    () => {}
                                );

                            }

                            return response;

                        }
                    ).catch(
                        () => {

                            if (
                                request.mode ===
                                'navigate'
                            ) {

                                return caches.match(
                                    './index.html'
                                );

                            }

                            return new Response(
                                '',
                                {
                                    status: 503,
                                    statusText:
                                        'Offline'
                                }
                            );

                        }
                    );

                }
            )

        );

    }
);
