import { Storage } from './storage.js';
import { showPrompt, showAlert } from './modal.js';

let intervalId = null;
let startTime = null;
let lastEarningsUpdate = 0;

let btnToggle, timeDisplay, earningsDisplay, dateDisplay, startTimeDisplay, btnEditStart;

// Ostrzeżenie o zbliżającym się progu
let thresholdWarning, thresholdCountdown, thresholdHint;

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function formatCountdown(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getBillableHours(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const fullHours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;

    let extraHours = 0;
    if (remainingSeconds >= 2700) { extraHours = 1; } 
    else if (remainingSeconds >= 900) { extraHours = 0.5; }

    const calculatedHours = fullHours + extraHours;
    
    // ZAWSZE MINIMUM 8 GODZIN
    return Math.max(8, calculatedHours);
}

// Wyszukuje ile czasu brakuje do progu, który realnie podnosi wypłatę
function getNextThresholdMs(elapsedMs) {
    const currentBillable = getBillableHours(elapsedMs);
    let checkSec = Math.floor(elapsedMs / 1000);

    for (let i = 0; i < 48; i++) { // Pętla symulująca skoki co próg w przyszłość
        const h = Math.floor(checkSec / 3600);
        const rem = checkSec % 3600;

        if (rem < 900) checkSec = h * 3600 + 900;
        else if (rem < 2700) checkSec = h * 3600 + 2700;
        else checkSec = (h + 1) * 3600 + 900;

        if (getBillableHours(checkSec * 1000) > currentBillable) {
            return (checkSec * 1000) - elapsedMs;
        }
    }
    return 0;
}

function calculateEarnings(ms, timestamp) {
    const settings = Storage.getSettings();
    const dateObj = new Date(timestamp);
    
    if (dateObj.getDay() === 6) {
        return parseFloat(settings.saturdayRate).toFixed(2);
    } else {
        const billableHours = getBillableHours(ms);
        return (billableHours * settings.hourlyRate).toFixed(2);
    }
}

function updateSessionInfo(timestamp) {
    if (!timestamp) {
        dateDisplay.textContent = 'Data: ---';
        startTimeDisplay.textContent = 'Rozpoczęto: ---';
        if (btnEditStart) btnEditStart.classList.add('hidden');
        if (thresholdWarning) thresholdWarning.classList.add('hidden');
        return;
    }
    const dateObj = new Date(timestamp);
    dateDisplay.textContent = `Data: ${dateObj.toLocaleDateString('pl-PL')}`;
    startTimeDisplay.textContent = `Rozpoczęto: ${dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
    
    // Przycisk edycji czasu rozpoczęcia jest widoczny tylko podczas aktywnej sesji
    if (btnEditStart) btnEditStart.classList.remove('hidden');
}

function updateUI() {
    const now = Date.now();
    const elapsed = now - startTime;

    timeDisplay.textContent = formatTime(elapsed);

    // Wykrywanie soboty
    const isSaturday = new Date(startTime).getDay() === 6;

    if (thresholdWarning && thresholdCountdown) {
        if (isSaturday) {
            // W sobotę progi nie obowiązują, na stałe chowamy baner
            thresholdWarning.classList.add('hidden');
        } else {
            const remainingMs = getNextThresholdMs(elapsed);
            
            // --- POBIERANIE BEZPOŚREDNIO W MILISEKUNDACH ---
            let warningThresholdMs = 300000; // Domyślnie 5 min
            if (typeof Storage.getWarningMinutes === 'function') {
                warningThresholdMs = Storage.getWarningMinutes();
            }

            if (remainingMs <= warningThresholdMs) {
                thresholdWarning.classList.remove('hidden');
                thresholdWarning.classList.add('urgent');
                thresholdCountdown.textContent = formatCountdown(remainingMs);
                thresholdHint.innerHTML = "<b>Nie kończ jeszcze!</b> Mało brakuje do wyższego progu.";
            } else {
                thresholdWarning.classList.add('hidden');
            }
        }
    }

    if (now - lastEarningsUpdate >= 100 || lastEarningsUpdate === 0) {
        earningsDisplay.textContent = `Zarobek: ${calculateEarnings(elapsed, startTime)} zł`;
        lastEarningsUpdate = now;
    }
}

async function stopWork() {
    clearInterval(intervalId);
    intervalId = null;
    
    let endObj = new Date();
    const startObj = new Date(startTime);

    // OGRANICZENIE DO 23:59
    if (endObj.getDate() !== startObj.getDate() || 
        endObj.getMonth() !== startObj.getMonth() || 
        endObj.getFullYear() !== startObj.getFullYear()) {
        
        // Czas ucina się na 23:59:59 tego samego dnia, w którym rozpoczęto pracę
        endObj = new Date(startObj);
        endObj.setHours(23, 59, 0, 0);
        await showAlert('Zakończono sesję o 23:59. Czas pracy nie może wykraczać na kolejny dzień.');
    }

    const endTime = endObj.getTime();
    const elapsed = endTime - startTime;
    
    const finalEarnings = calculateEarnings(elapsed, startTime);
    const billableTime = getBillableHours(elapsed);

    Storage.addSession({
        start: startTime,
        end: endTime,
        durationMs: elapsed,
        billableHours: billableTime,
        earned: finalEarnings
    });

    Storage.clearActiveSession();
    startTime = null;
    lastEarningsUpdate = 0;
    
    btnToggle.textContent = 'Rozpocznij pracę';
    btnToggle.classList.remove('active-btn');
    timeDisplay.textContent = '00:00:00';
    earningsDisplay.textContent = 'Zarobek: 0.00 zł';
    updateSessionInfo(null);
    
    await showAlert(
        'Trasa zakończona', 
        `Zaliczone godziny: <b>${billableTime}h</b><br><br>Zarobek: <b style="font-size: 20px; color: #4CAF50;">${finalEarnings} zł</b>`
    );
}

function startWork() {
    startTime = Date.now();
    lastEarningsUpdate = 0;
    Storage.setActiveSession(startTime);
    
    updateSessionInfo(startTime);
    
    btnToggle.textContent = 'Zakończ pracę';
    btnToggle.classList.add('active-btn');
    
    intervalId = setInterval(updateUI, 1000);
    updateUI();
}

export function initTracker() {
    btnToggle = document.getElementById('btn-toggle-work');
    timeDisplay = document.querySelector('.tracker-display');
    earningsDisplay = document.querySelector('.earnings-display');
    dateDisplay = document.getElementById('current-date');
    startTimeDisplay = document.getElementById('start-time-display');
    btnEditStart = document.getElementById('btn-edit-start');

    thresholdWarning = document.getElementById('threshold-warning');
    thresholdCountdown = document.getElementById('threshold-countdown');
    thresholdHint = document.getElementById('threshold-hint');

    // --- OBSŁUGA PRZYPOMNIENIA O EKSPORCIE ---
    const exportReminderCard = document.getElementById('export-reminder-card');
    const btnSnoozeExport = document.getElementById('btn-snooze-export');

    if (exportReminderCard && btnSnoozeExport && typeof Storage.getLastExportDate === 'function') {
        const lastExport = Storage.getLastExportDate();
        const now = Date.now();
        const days30 = 30 * 24 * 60 * 60 * 1000; // 30 dni w milisekundach

        // Jeśli minęło 30 dni
        if (now - lastExport >= days30) {
            exportReminderCard.classList.remove('hidden');
        }

        // Drzemka na 7 dni
        btnSnoozeExport.addEventListener('click', () => {
            exportReminderCard.classList.add('hidden');
            // Hack z drzemką: Zapisujemy "ostatni eksport" jako datę sprzed 23 dni. 
            // Dzięki temu (23 dni + 7 dni = 30) i karta pokaże się za równe 7 dni!
            const snoozeTime = Date.now() - (23 * 24 * 60 * 60 * 1000);
            Storage.setLastExportDate(snoozeTime);
        });
    }
    // -----------------------------------------

    // --- OBSŁUGA KARTY "CO NOWEGO" ---
    const whatsNewCard = document.getElementById('whats-new-card');
    const btnHideWhatsNew = document.getElementById('btn-hide-whats-new');

    if (whatsNewCard && btnHideWhatsNew) {
        let messageName = 'test1';
        
        if (localStorage.getItem(messageName) !== 'true') {
            whatsNewCard.classList.remove('hidden');
        }

        btnHideWhatsNew.addEventListener('click', () => {
            whatsNewCard.classList.add('hidden'); 
            localStorage.setItem(messageName, 'true');
        });
    }

    if (!btnToggle) return;

    btnToggle.addEventListener('click', async () => {
        if (intervalId) { await stopWork(); } 
        else { startWork(); }
    });

    // Edytowanie czasu rozpoczęcia pracy (tylko podczas trwania sesji)
    if (btnEditStart) {
        btnEditStart.addEventListener('click', async () => {
            if (!startTime) return;
            
            const currentStartStr = new Date(startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            
            const newStartStr = await showPrompt('Zmień godzinę rozpoczęcia pracy', currentStartStr, 'time');
            
            if (newStartStr === null) return;

            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(newStartStr)) {
                return await showAlert('Błąd', 'Nieprawidłowy format czasu! Użyj HH:MM.');
            }

            const [h, m] = newStartStr.split(':');
            const newDate = new Date(startTime);
            newDate.setHours(parseInt(h), parseInt(m), 0, 0);

            if (newDate.getTime() > Date.now()) {
                return await showAlert('Błąd', 'Czas rozpoczęcia nie może być w przyszłości!');
            }

            // Nadpisz czas i wymuś odświeżenie UI
            startTime = newDate.getTime();
            Storage.setActiveSession(startTime);
            updateSessionInfo(startTime);
            
            updateUI();
        });
    }

    const activeSession = Storage.getActiveSession();
    if (activeSession) {
        startTime = activeSession.startTime;
        updateSessionInfo(startTime);
        btnToggle.textContent = 'Zakończ pracę';
        btnToggle.classList.add('active-btn');
        intervalId = setInterval(updateUI, 1000);
        updateUI();
    } else {
        updateSessionInfo(null);
    }
}