// Importowanie modułów
import { Storage } from './storage.js';
import { initTracker } from './tracker.js';
import { initSettings } from './settings.js';
import { renderReports } from './reports.js';
import { initExcel } from './excel.js';

async function requestPersistentStorage() {
    const badge = document.getElementById('backup-badge');

    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();

        if (badge) {
            badge.textContent = isPersisted ? 'Safe' : 'Lokalnie';
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
        badge.textContent = 'Lokalnie';
        badge.classList.remove('safe');
    }

    return false;
}


document.addEventListener('DOMContentLoaded', () => {
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
});

/* =========================================
   OBSŁUGA INSTALACJI PWA
========================================= */
let deferredPrompt;
const installCard = document.getElementById('install-pwa-card');
const btnInstall = document.getElementById('btn-install-pwa');
const btnClose = document.getElementById('btn-close-pwa');

// Nasłuchiwanie na event systemowy (odpalany tylko gdy apka NIE JEST zainstalowana)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    setTimeout(() => {
        if (localStorage.getItem('pwa_install_dismissed') !== 'true' && installCard) {
            installCard.classList.remove('hidden');
        }
    }, 2000);
});

if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Decyzja o instalacji PWA: ${outcome}`);
            
            deferredPrompt = null;
            installCard.classList.add('hidden');
        }
    });
}

if (btnClose) {
    btnClose.addEventListener('click', () => {
        installCard.classList.add('hidden');
        localStorage.setItem('pwa_install_dismissed', 'true');
    });
}