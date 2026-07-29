const CACHE_NAME = 'expresstracker-v1.3.4';

const ASSETS_TO_CACHE = [
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/tracker.js',
    './js/storage.js',
    './js/modal.js',
    './js/settings.js',
    './js/reports.js',
    './js/excel.js',
    './manifest.json',
    './icons/icon.png',
    // 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js'
];

// Instalacja (Cache)
self.addEventListener('install', (event) => {
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            console.log('Zapisywanie plików w pamięci podręcznej...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {

    let cacheRequest = event.request;
    if (event.request.url.endsWith('/')) {
        cacheRequest = new Request('./index.html');
    }

    event.respondWith(
        fetch(event.request)
        .then((networkResponse) => {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(cacheRequest, responseClone);
            });
            
            return networkResponse;
        })
        .catch(() => {
            console.log('Brak zasięgu! Ładowanie pliku z pamięci offline:', cacheRequest.url);
            return caches.match(cacheRequest);
        })
    );
});

// Aktualizacja: usuwanie starych wersji cache, gdy aktywna jest nowa wersja
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Usuwanie starego cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});