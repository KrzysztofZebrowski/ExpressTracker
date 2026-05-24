// Importowanie modułów
import { Storage } from './storage.js';
import { initTracker } from './tracker.js';
import { initSettings } from './settings.js';
import { renderReports } from './reports.js';
import { initExcel } from './excel.js';


document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Usuń klasę active ze wszystkich przycisków i widoków
            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(view => {
                view.classList.remove('active');
                view.classList.add('hidden');
            });

            // Dodaj klase active do klikniętego przycisku i odpowiedniego widoku
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
            
            // Renderuj raporty przy przejściu do widoku raportów
            if (targetId === 'view-reports') {
                renderReports(); 
            }
        });
    });

    // Inicjalizacja modułów
    initTracker();
    initSettings();
    initExcel();
});