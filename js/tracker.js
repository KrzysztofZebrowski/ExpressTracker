import { Storage } from './storage.js';
import { showPrompt, showAlert, showSuccessModal, showConfirm } from './modal.js';

let intervalId = null;
let startTime = null;
let lastEarningsUpdate = 0;
let cachedSettings = null;

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
    const isSaturday = new Date(startTime).getDay() === 6;

    let extraHours = 0;
    if (remainingSeconds >= 2700) { extraHours = 1; }
    else if (remainingSeconds >= 900) { extraHours = 0.5; }

    const calculatedHours = fullHours + extraHours;

    if (isSaturday) {
        return calculatedHours;
    }

    // ZAWSZE MINIMUM 8 GODZIN
    return Math.max(8, calculatedHours);
}

// Wyszukuje ile czasu brakuje do progu, który realnie podnosi wypłatę
function getNextThresholdMs(elapsedMs) {
    const currentBillable = getBillableHours(elapsedMs);
    let checkSec = Math.floor(elapsedMs / 1000);

    for (let i = 0; i < 48; i++) {
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
    if (!cachedSettings) {
        cachedSettings = Storage.getSettings();
    }

    const dateObj = new Date(timestamp);

    if (dateObj.getDay() === 6) {
        return parseFloat(cachedSettings.saturdayRate).toFixed(2);
    } else {
        const billableHours = getBillableHours(ms);
        return (billableHours * cachedSettings.hourlyRate).toFixed(2);
    }
}

function updateSessionInfo(timestamp) {
    if (!timestamp) {
        if (dateDisplay) dateDisplay.innerHTML = '<i class="bi bi-calendar3 me-1 text-primary"></i> Data: ---';
        if (startTimeDisplay) startTimeDisplay.innerHTML = '<i class="bi bi-clock-history me-1 text-primary"></i> Rozpoczęto: ---';
        if (btnEditStart) btnEditStart.classList.add('hidden');
        if (thresholdWarning) thresholdWarning.classList.add('hidden');
        return;
    }
    const dateObj = new Date(timestamp);
    if (dateDisplay) dateDisplay.innerHTML = `<i class="bi bi-calendar3 me-1 text-primary"></i> Data: ${dateObj.toLocaleDateString('pl-PL')}`;
    if (startTimeDisplay) startTimeDisplay.innerHTML = `<i class="bi bi-clock-history me-1 text-primary"></i> Rozpoczęto: ${dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;

    // Przycisk edycji czasu rozpoczęcia jest widoczny tylko podczas aktywnej sesji
    if (btnEditStart) btnEditStart.classList.remove('hidden');
}

function updateUI() {
    const now = Date.now();
    const elapsed = now - startTime;

    if (timeDisplay) timeDisplay.textContent = formatTime(elapsed);

    // Wykrywanie soboty
    const isSaturday = new Date(startTime).getDay() === 6;

    if (thresholdWarning && thresholdCountdown) {
        if (isSaturday) {
            // W sobotę progi nie obowiązują - baner schowany
            thresholdWarning.classList.add('hidden');
        } else {
            const remainingMs = getNextThresholdMs(elapsed);

            // --- POBIERANIE BEZPOŚREDNIO W MILISEKUNDACH ---
            let warningThresholdMs = 300000; // Domyślnie 5 min
            if (typeof Storage.getWarningMinutes === 'function') {
                warningThresholdMs = Storage.getWarningMinutes();
            }

            if (remainingMs > 0 && remainingMs <= warningThresholdMs) {
                thresholdWarning.classList.remove('hidden');
                thresholdWarning.classList.add('urgent');
                thresholdCountdown.textContent = formatCountdown(remainingMs);

                const currentBillable = getBillableHours(elapsed);
                const nextBillable = getBillableHours(elapsed + remainingMs + 5000);
                const extraHours = Math.max(0, nextBillable - currentBillable);
                const hourlyRate = parseFloat(cachedSettings?.hourlyRate || Storage.getSettings().hourlyRate) || 34;
                const extraEarnings = (extraHours * hourlyRate).toFixed(2);

                const bonusBadge = document.getElementById('threshold-bonus-badge');
                if (bonusBadge) {
                    bonusBadge.textContent = `+${extraEarnings} zł`;
                }

                if (thresholdHint) {
                    thresholdHint.innerHTML = `<i class="bi bi-lightning-charge-fill me-1 text-warning"></i><span><b>Nie kończ jeszcze!</b> Za chwilę wskoczy +${extraHours} h (+${extraEarnings} zł).</span>`;
                }
            } else {
                thresholdWarning.classList.add('hidden');
            }
        }
    }

    if (now - lastEarningsUpdate >= 100 || lastEarningsUpdate === 0) {
        if (earningsDisplay) earningsDisplay.innerHTML = `<i class="bi bi-wallet2 text-success me-2"></i>Zarobek: <strong class="text-success">${calculateEarnings(elapsed, startTime)} zł</strong>`;
        lastEarningsUpdate = now;
    }
}

async function stopWork() {
    // Sprawdź czy praca nie jest kończona tuż przed wyższym progiem (ostrzeżenie przed wczesnym wylogowaniem)
    const isSaturday = new Date(startTime).getDay() === 6;
    if (!isSaturday) {
        const elapsed = Date.now() - startTime;
        const remainingMs = getNextThresholdMs(elapsed);
        let warningThresholdMs = 300000; // Domyślnie 5 min
        if (typeof Storage.getWarningMinutes === 'function') {
            warningThresholdMs = Storage.getWarningMinutes();
        }

        if (remainingMs > 0 && remainingMs <= warningThresholdMs) {
            const remainingMins = Math.floor(remainingMs / 60000);
            const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
            const timeStr = remainingMins > 0 ? `${remainingMins} min ${remainingSecs} s` : `${remainingSecs} s`;

            const currentBillable = getBillableHours(elapsed);
            const nextBillable = getBillableHours(elapsed + remainingMs + 5000);
            const extraHours = Math.max(0, nextBillable - currentBillable);
            const hourlyRate = parseFloat(cachedSettings?.hourlyRate || Storage.getSettings().hourlyRate) || 34;
            const extraMoney = (extraHours * hourlyRate).toFixed(2);

            const warningHtml = `
                <div class="threshold-early-warning-modal-box p-3 rounded-4 mb-3 text-start">
                    <div class="d-flex align-items-center gap-2 mb-2 text-warning fw-bold fs-6">
                        <i class="bi bi-hourglass-split fs-4"></i>
                        <span>Zostało tylko <span class="badge bg-warning text-dark px-2 py-1 fs-6">${timeStr}</span> do progu!</span>
                    </div>
                    <p class="small text-secondary mb-3 lh-sm">
                        Twój czas pracy jest rozliczany w progach. Jeśli popracujesz jeszcze <b>${timeStr}</b>, zaliczy Ci się dodatkowe <b>+${extraHours} h</b> do wypłaty.
                    </p>
                    <div class="d-flex align-items-center justify-content-between p-2 rounded-3 bg-body-secondary border">
                        <span class="small fw-semibold text-muted">Dodatkowy zarobek:</span>
                        <span class="fs-5 fw-bold text-success">+${extraMoney} zł</span>
                    </div>
                </div>
                <div class="small text-muted text-center">Czy na pewno chcesz zakończyć trasę i stracić wyższy próg?</div>
            `;

            const confirmed = await showConfirm(
                'Mało brakuje do wyższego progu!',
                warningHtml,
                'Zakończ mimo to',
                'Kontynuuj pracę'
            );

            if (!confirmed) {
                // Anulowano zakończenie trasy - licznik pracuje bez zmian!
                return;
            }
        }
    }

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
        await showAlert('Zakończono sesję o 23:59', 'Czas pracy nie może wykraczać na kolejny dzień.');
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

    if (btnToggle) {
        btnToggle.innerHTML = '<i class="bi bi-play-circle-fill me-2 fs-4"></i><span>Rozpocznij pracę</span>';
        btnToggle.classList.remove('active-btn');
    }

    const trackerBox = document.querySelector('.tracker-box');
    if (trackerBox) trackerBox.classList.remove('timer-running');

    if (timeDisplay) timeDisplay.textContent = '00:00:00';
    if (earningsDisplay) earningsDisplay.innerHTML = '<i class="bi bi-wallet2 text-success me-2"></i>Zarobek: <strong class="text-success">0.00 zł</strong>';
    updateSessionInfo(null);

    if (isSaturday) {
        const settings = Storage.getSettings();
        const baseRate = parseFloat(settings.hourlyRate);
        const actualHours = elapsed / 3600000;
        let actualRate = 0;

        if (actualHours > 1) {
            actualRate = parseFloat(finalEarnings) / actualHours;

            let colorClass = 'text-body';
            if (actualRate > baseRate) colorClass = 'text-success';
            else if (actualRate < baseRate) colorClass = 'text-danger';
    
            const messageHtml = `Twoja rzeczywista stawka godzinowa za pracę w sobotę wynosi:<br><br><div class="fs-1 fw-bold ${colorClass} text-center">${actualRate.toFixed(2)} zł/h</div>`;
    
            await showAlert('Rzeczywista stawka', messageHtml, 'Dalej');
        }
    }

    await showSuccessModal({
        title: 'Trasa zakończona',
        message: 'Sesja pracy została pomyślnie zakończona i zapisana w historii.',
        hours: `${billableTime} h`,
        earned: `${finalEarnings} zł`,
        buttonText: 'Gotowe'
    });
}

function startWork() {
    startTime = Date.now();
    lastEarningsUpdate = 0;
    Storage.setActiveSession(startTime);

    updateSessionInfo(startTime);

    if (btnToggle) {
        btnToggle.innerHTML = '<i class="bi bi-stop-circle-fill me-2 fs-4"></i><span>Zakończ pracę</span>';
        btnToggle.classList.add('active-btn');
    }

    const trackerBox = document.querySelector('.tracker-box');
    if (trackerBox) trackerBox.classList.add('timer-running');

    intervalId = setInterval(updateUI, 1000);
    cachedSettings = Storage.getSettings();
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

    if (btnEditStart) {
        btnEditStart.innerHTML = '<i class="bi bi-pencil-square me-1"></i>Edytuj';
    }

    // --- OBSŁUGA PRZYPOMNIENIA O EKSPORCIE ---
    const exportReminderCard = document.getElementById('export-reminder-card');
    const btnSnoozeExport = document.getElementById('btn-snooze-export');
    const btnExportNow = document.getElementById('btn-export-reminder-now');

    if (exportReminderCard && typeof Storage.getLastExportDate === 'function') {
        const lastExport = Storage.getLastExportDate();
        const now = Date.now();
        const days30 = 30 * 24 * 60 * 60 * 1000; // 30 dni w milisekundach

        // Jeśli minęło 30 dni
        if (now - lastExport >= days30) {
            exportReminderCard.classList.remove('hidden');
        }

        // Pobierz kopię teraz (one-click)
        if (btnExportNow) {
            btnExportNow.addEventListener('click', async () => {
                if (typeof Storage.exportBackupData === 'function') {
                    Storage.exportBackupData();
                }
                Storage.setLastExportDate(Date.now());
                exportReminderCard.classList.add('hidden');

                await showSuccessModal({
                    title: 'Kopia zapasowa pobrana',
                    message: 'Plik JSON z Twoją historią tras i ustawieniami został pomyślnie pobrany.',
                    buttonText: 'Świetnie'
                });
            });
        }

        // Przypomnij za 7 dni
        if (btnSnoozeExport) {
            btnSnoozeExport.addEventListener('click', () => {
                exportReminderCard.classList.add('hidden');
                const snoozeTime = Date.now() - (23 * 24 * 60 * 60 * 1000);
                Storage.setLastExportDate(snoozeTime);
            });
        }
    }
    // -----------------------------------------

    // --- OBSŁUGA KARTY "CO NOWEGO" ---
    const whatsNewCard = document.getElementById('whats-new-card');
    const btnHideWhatsNew = document.getElementById('btn-hide-whats-new');

    if (whatsNewCard && btnHideWhatsNew) {
        let messageName = 'news-v2.2.1';

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
        btnToggle.innerHTML = '<i class="bi bi-stop-circle-fill me-2 fs-4"></i><span>Zakończ pracę</span>';
        btnToggle.classList.add('active-btn');

        const trackerBox = document.querySelector('.tracker-box');
        if (trackerBox) trackerBox.classList.add('timer-running');

        intervalId = setInterval(updateUI, 1000);
        updateUI();
    } else {
        updateSessionInfo(null);
    }

    // Natychmiastowe odświeżenie licznika po wybudzeniu iPhone'a lub powrocie z innej aplikacji
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && startTime && intervalId) {
            updateUI();
        }
    });
}
