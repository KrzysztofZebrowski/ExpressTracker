const CACHE_NAME = 'expresstracker-v1.3.1';

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

// Pobieranie (Praca offline): gdy aplikacja prosi o plik, najpierw szukamy w Cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
        .then((response) => {
            return response || fetch(event.request);
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