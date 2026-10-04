// Importowanie modułów
import { Storage } from './storage.js';
import { initTracker } from './tracker.js';
import { initSettings } from './settings.js';
import { renderReports } from './reports.js';
import { initExcel } from './excel.js';

// Pobieranie elementu badge'a, aby modyfikować jego tekst i klasy.
    const networkBadge = document.getElementById('network-badge');
    
    function updateNetworkStatus() {
        if (!networkBadge) return;
        
        if (navigator.onLine) {
            networkBadge.innerHTML = '<i class="bi bi-wifi"></i> Online';
            networkBadge.classList.remove('offline');
            networkBadge.classList.add('online');
        } else {
            networkBadge.innerHTML = '<i class="bi bi-wifi-off"></i> Offline';
            networkBadge.classList.remove('online');
            networkBadge.classList.add('offline');
        }
    }

    updateNetworkStatus();

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

async function requestPersistentStorage() {
    const badge = document.getElementById('backup-badge');

    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();

        if (badge) {
            badge.innerHTML = isPersisted ? '<i class="bi bi-shield-check me-1"></i> Safe' : '<i class="bi bi-hdd me-1"></i> Lokalnie';
            badge.classList.toggle('safe', isPersisted);
        }

        if (isPersisted) {
            console.log("PWA: Dane zabezpieczone przed systemowym usunięciem.");
        } else {
            console.log("PWA: Brak zgody na trwały zapis.");
        }

        return isPersisted;
    }

    if (badge) {
        badge.innerHTML = '<i class="bi bi-hdd me-1"></i> Lokalnie';
        badge.classList.remove('safe');
    }

    return false;
}


function initApp() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(view => {
                view.classList.remove('active');
                view.classList.add('hidden');
            });

            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
            
            if (targetId === 'view-reports') {
                renderReports(); 
            }
        });
    });

    // Inicjalizacja modułów
    initTracker();
    initSettings();
    initExcel();
    requestPersistentStorage();
    loadAppVersionFromSW();
}

/**
 * Pobiera wersję aplikacji bezpośrednio z pliku Service Workera (sw.js)
 * i aktualizuje odpowiednie odznaki (w stopce oraz w nagłówkach).
 */
export async function loadAppVersionFromSW() {
    const updateBadges = (rawVersion) => {
        if (!rawVersion) return;
        const formatted = rawVersion.trim().startsWith('v') ? rawVersion.trim() : `v${rawVersion.trim()}`;
        const footerBadge = document.getElementById('app-footer-version');
        if (footerBadge) {
            footerBadge.textContent = formatted;
        }
        document.querySelectorAll('.sw-version-badge').forEach(badge => {
            badge.textContent = formatted;
        });
    };

    // 1. Bezpośredni odczyt z pliku sw.js
    try {
        const response = await fetch('./sw.js', { cache: 'no-store' });
        if (response.ok) {
            const swContent = await response.text();
            const match = swContent.match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
            if (match && match[1]) {
                updateBadges(match[1]);
            }
        }
    } catch (e) {
        console.warn('PWA: Nie udało się odczytać pliku sw.js:', e);
    }

    // 2. Pobranie wersji od zarejestrowanego Service Workera przez postMessage
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const targetWorker = registration.active || registration.waiting || registration.installing;
            if (targetWorker) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data && event.data.version) {
                        updateBadges(event.data.version);
                    }
                };
                targetWorker.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
            }
        } catch (e) {
            // Ignorujemy jeśli SW nie jest gotowy
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

/* =========================================
   OBSŁUGA INSTALACJI PWA
========================================= */
let deferredPrompt;
const installCard = document.getElementById('install-pwa-card');
const btnInstall = document.getElementById('btn-install-pwa');
const btnClose = document.getElementById('btn-close-pwa');

// Nasłuchiwanie na event systemowy (Android / Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    setTimeout(() => {
        if (localStorage.getItem('pwa_install_dismissed') !== 'true' && installCard) {
            installCard.classList.remove('hidden');
            installCard.style.display = 'flex';
        }
    }, 2000);
});

// Wykrywanie iOS (iPhone / iPad) oraz trybu Standalone
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

// Na iOS Safari event 'beforeinstallprompt' nie istnieje – wyświetlamy instrukcję dodania do ekranu początkowego
if (isIOS && !isStandalone && installCard) {
    if (localStorage.getItem('pwa_install_dismissed') !== 'true') {
        setTimeout(() => {
            const titleEl = document.getElementById('pwa-install-title');
            const descEl = document.getElementById('pwa-install-desc');
            const iconEl = document.getElementById('pwa-install-icon');
            const actionsEl = document.getElementById('pwa-install-actions');

            if (titleEl) titleEl.textContent = 'Zainstaluj na iPhone';
            if (descEl) {
                descEl.innerHTML = 'Dotknij ikony <i class="bi bi-box-arrow-up text-primary fw-bold"></i> (Udostępnij) na pasku Safari, a następnie wybierz <strong class="text-body">Do ekranu początkowego</strong> <i class="bi bi-plus-square text-primary"></i>.';
            }
            if (iconEl) {
                iconEl.className = 'bi bi-apple';
            }
            if (actionsEl) {
                actionsEl.innerHTML = `
                    <button id="btn-ios-dismiss" class="btn btn-primary rounded-pill w-100 fw-bold">
                        <i class="bi bi-check2-circle me-1"></i> Rozumiem
                    </button>
                `;
                const btnDismiss = document.getElementById('btn-ios-dismiss');
                if (btnDismiss) {
                    btnDismiss.addEventListener('click', () => {
                        installCard.classList.add('hidden');
                        installCard.style.display = 'none';
                        localStorage.setItem('pwa_install_dismissed', 'true');
                    });
                }
            }

            installCard.classList.remove('hidden');
            installCard.style.display = 'flex';
        }, 2500);
    }
}

if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Decyzja o instalacji PWA: ${outcome}`);
            
            deferredPrompt = null;
            installCard.classList.add('hidden');
            installCard.style.display = 'none';
        }
    });
}

if (btnClose) {
    btnClose.addEventListener('click', () => {
        installCard.classList.add('hidden');
        installCard.style.display = 'none';
        localStorage.setItem('pwa_install_dismissed', 'true');
    });
}