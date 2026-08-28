const CACHE_NAME = 'expresstracker-v1.3.7'; 

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
    './icon.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            console.log('Zapisywanie plików w pamięci podręcznej...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
        .catch(err => console.error('Błąd zapisu do Cache (sprawdź ścieżki plików!):', err))
    );
});


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

// Network First
self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request)
        .then((networkResponse) => {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
            });
            return networkResponse;
        })
        .catch(() => {
            return caches.match(event.request).then((cachedResponse) => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});