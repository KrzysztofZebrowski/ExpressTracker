const VERSION = '2.4.0';

const CACHE_NAME = `expresstracker-v${VERSION}`; 

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
    './js/qrcode.js',
    './js/zebra.js',
    './manifest.json',
    './icon.png'
];

// Instalacja nowego Service Workera z wymuszeniem pobrania świeżych plików z serwera
self.addEventListener('install', (event) => {
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log(`[SW] Zapisywanie wersji v${VERSION} w pamięci podręcznej...`);
                // { cache: 'reload' } omija pamięć podręczną HTTP przeglądarki i zmusza do pobrania bezpośrednio z serwera
                const fetchPromises = ASSETS_TO_CACHE.map(async (url) => {
                    try {
                        const response = await fetch(url, { cache: 'reload' });
                        if (response.ok) {
                            await cache.put(url, response);
                        } else {
                            console.warn(`[SW] Nie udało się pobrać ${url} (status: ${response.status})`);
                        }
                    } catch (err) {
                        console.warn(`[SW] Błąd pobierania ${url}:`, err);
                    }
                });
                await Promise.all(fetchPromises);
            })
            .catch(err => console.error('[SW] Błąd inicjalizacji Cache:', err))
    );
});

// Aktywacja i natychmiastowe usunięcie starych baz cache
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Przejęcie kontroli nad otwartymi kartami
            clients.claim(),
            // Usunięcie wszystkich starych wersji cache
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            console.log('[SW] Usuwanie starego cache:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
        ])
    );
});

// Obsługa żądań sieciowych: Network First z bezpiecznym zapisem tylko poprawnych odpowiedzi GET
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Zapisujemy tylko poprawne odpowiedzi 200 (lokalne i z CDN)
                if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
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

// Obsługa zapytań o wersję z poziomu aplikacji oraz natychmiastowej aktywacji
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GET_VERSION') {
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ version: VERSION });
        } else if (event.source) {
            event.source.postMessage({ type: 'VERSION', version: VERSION });
        }
    } else if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
