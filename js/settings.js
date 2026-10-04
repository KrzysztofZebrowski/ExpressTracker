import { Storage } from './storage.js';
import { showPrompt, showConfirm, showAlert, showDeleteConfirmModal, showImportConfirmModal, showSuccessModal } from './modal.js';

export function initSettings() {
    
    // 1. Pobranie elementów DOM
    const rateDisplay = document.getElementById('current-rate-display');
    const satRateDisplay = document.getElementById('current-sat-rate-display');
    const btnChangeRate = document.getElementById('btn-change-rate');
    const btnChangeSatRate = document.getElementById('btn-change-sat-rate');
    const btnExport = document.getElementById('btn-export');
    const btnBackupSave = document.getElementById('btn-backup-save');
    const btnBackupRestore = document.getElementById('btn-backup-restore');
    const inputImport = document.getElementById('btn-import');
    const btnClearData = document.getElementById('btn-clear-data');
    const btnExportExcel = document.getElementById('btn-export-excel');
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    function applyTheme(isDark) {
        document.documentElement.classList.toggle('dark-theme', isDark);
        document.body.classList.toggle('dark-theme', isDark);
        document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', isDark ? '#0b1120' : '#0284c7');
    }

    // 2. Funkcja odświeżająca teksty ze stawkami na ekranie
    function updateDisplays() {
        const settings = Storage.getSettings();
        if (rateDisplay) rateDisplay.textContent = `${settings.hourlyRate} zł/h`;
        if (satRateDisplay) satRateDisplay.textContent = `${settings.saturdayRate} zł`;
    }

    const initialSettings = Storage.getSettings();
    applyTheme(initialSettings.darkMode);
    if (darkModeToggle) {
        darkModeToggle.checked = initialSettings.darkMode;
        darkModeToggle.addEventListener('change', () => {
            const settings = Storage.getSettings();
            settings.darkMode = darkModeToggle.checked;
            Storage.setSettings(settings);
            applyTheme(settings.darkMode);
        });
    }

    updateDisplays();

    // Wyrażenie regularne pozwalające tylko na liczby całkowite i dziesiętne (z kropką lub przecinkiem)
    const numRegex = /^[0-9]+([.,][0-9]+)?$/;

    // 3. Zmiana stawki godzinowej
    if (btnChangeRate) {
        btnChangeRate.addEventListener('click', async () => {
            const currentRate = Storage.getSettings().hourlyRate;
            const newRateStr = await showPrompt('Podaj nową stawkę (zł/h):', currentRate, 'tel');
            
            if (newRateStr !== null && newRateStr.trim() !== '') {
                
                const cleanInput = String(newRateStr).replace(/[^\d.,]/g, '').replace(',', '.');
                const newRate = parseFloat(cleanInput);

                if (!isNaN(newRate) && newRate > 0) {
                    const settings = Storage.getSettings();
                    settings.hourlyRate = newRate;
                    
                    if (typeof Storage.setSettings === 'function') {
                        Storage.setSettings(settings);
                    } else {
                        localStorage.setItem('settings', JSON.stringify(settings)); 
                    }
                    
                    updateDisplays();

                } else {
                    await showAlert('Błąd', 'Podano nieprawidłową kwotę. Wpisz np. 34.50');
                }
            }
        });
    }

    // 4. Zmiana stałej stawki za soboty
    if (btnChangeSatRate) {
        btnChangeSatRate.addEventListener('click', async () => {
            const currentRate = Storage.getSettings().saturdayRate;
            const newRateStr = await showPrompt('Podaj stałą stawkę za sobotę (zł):', currentRate, 'tel');
            
            if (newRateStr !== null && newRateStr.trim() !== '') {

                const cleanInput = String(newRateStr).replace(/[^\d.,]/g, '').replace(',', '.');
                const newRate = parseFloat(cleanInput);

                if (!isNaN(newRate) && newRate > 0) {
                    const settings = Storage.getSettings();
                    settings.saturdayRate = newRate;
                    
                    if (typeof Storage.setSettings === 'function') {
                        Storage.setSettings(settings);
                    } else {
                        localStorage.setItem('settings', JSON.stringify(settings));
                    }

                    updateDisplays();

                } else {
                    await showAlert('Błąd', 'Podano nieprawidłową kwotę. Wpisz np. 200');
                }
            }
        });
    }


    // OBSŁUGA CZASU OSTRZEGANIA (W MILISEKUNDACH)

    const warningDisplay = document.getElementById('current-early-warning-display');
    const warningButtons = document.querySelectorAll('.btn-warning-time');

    function updateWarningSettingsUI() {
        // Pobieramy czas w milisekundach (300000 ms = 5 min)
        let currentMs = 300000;
        if (typeof Storage.getWarningMinutes === 'function') {
            currentMs = Storage.getWarningMinutes();
        }

        const displayMins = currentMs / 60000;
        if (warningDisplay) warningDisplay.textContent = displayMins + ' min';
        
        warningButtons.forEach(btn => {
            if (parseInt(btn.dataset.time, 10) === currentMs) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    warningButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedMs = parseInt(e.currentTarget.dataset.time, 10);
            if (typeof Storage.setWarningMinutes === 'function') {
                Storage.setWarningMinutes(selectedMs);
            }
            updateWarningSettingsUI(); 
        });
    });

    updateWarningSettingsUI();

    if (btnBackupSave) {
        btnBackupSave.addEventListener('click', async () => {
            try {
                await Storage.saveBackup();
                await showAlert('Kopia zapasowa', 'Kopia zapasowa została zapisana na tym urządzeniu.');
            } catch (error) {
                console.error('Błąd zapisu backupu:', error);
                await showAlert('Błąd', 'Nie udało się zapisać kopii zapasowej.');
            }
        });
    }

    if (btnBackupRestore) {
        btnBackupRestore.addEventListener('click', async () => {
            const currentCount = (Storage.getSessions() || []).length;
            const entriesText = currentCount === 1 ? '1 wpis' :
                ((currentCount % 10 >= 2 && currentCount % 10 <= 4 && !(currentCount % 100 >= 12 && currentCount % 100 <= 14)) ? `${currentCount} wpisy` : `${currentCount} wpisów`);

            const isConfirmed = await showImportConfirmModal({
                title: 'Przywróć kopię zapasową',
                subtitle: 'Przywracanie ostatniej lokalnej kopii',
                detailsHtml: `
                    <div class="import-item-preview p-3 rounded-4 mb-3">
                        <div class="d-flex align-items-center gap-2 text-primary fw-bold fs-6 mb-2">
                            <i class="bi bi-device-hdd-fill fs-4"></i>
                            <span>Lokalna kopia zapasowa urządzenia</span>
                        </div>
                        <p class="small text-muted mb-0">
                            Przywrócenie ostatniej migawki bazy danych zastąpi bieżącą historię i ustawienia stanem z ostatniego zapisu na tym telefonie/komputerze.
                        </p>
                    </div>
                    <div class="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 rounded-3 mb-0 small border-0">
                        <i class="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0 text-warning mt-1"></i>
                        <div>
                            <strong>Uwaga:</strong> Bieżąca baza w aplikacji (obecnie: <strong>${entriesText}</strong>) oraz stawki zostaną zastąpione danymi z kopii.
                        </div>
                    </div>
                `,
                confirmBtnText: 'Przywróć kopię',
                iconClass: 'bi-arrow-counterclockwise'
            });

            if (!isConfirmed) {
                return;
            }

            try {
                await Storage.restoreLatestBackup();
                await showSuccessModal({
                    title: 'Kopia przywrócona',
                    message: 'Ostatnia lokalna kopia zapasowa została pomyślnie przywrócona.',
                    buttonText: 'Gotowe'
                });
                location.reload();
            } catch (error) {
                console.error('Błąd przywracania backupu:', error);
                await showAlert('Błąd', error.message || 'Nie znaleziono żadnej zapisanej kopii zapasowej.');
            }
        });
    }

    // 5. Eksport danych do pliku JSON
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            Storage.exportBackupData();

            if (typeof Storage.setLastExportDate === 'function') {
                Storage.setLastExportDate();
                document.getElementById('export-reminder-card')?.classList.add('hidden');
            }
        });
    }

    // 6. Eksport raportów do Excela
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', async () => {
            try {
                const sessions = [...Storage.getSessions()];
                
                if (!sessions || sessions.length === 0) {
                    return await showAlert('Brak danych', 'Nie masz żadnych zapisanych raportów do wyeksportowania.');
                }

                // Pobieranie biblioteki Excel
                if (!window.XLSX) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Nie udało się pobrać biblioteki Excel. Sprawdź połączenie z internetem.'));
                        document.head.appendChild(script);
                    });
                }

                // Przygotowanie danych do Excela
                sessions.sort((a, b) => new Date(b.start) - new Date(a.start));

                const excelData = sessions.map(session => {
                    const startDate = new Date(session.start);
                    const endDate = new Date(session.end);
                    const durationMs = endDate - startDate;
                    
                    const totalMins = Math.floor(durationMs / 60000);
                    const hours = Math.floor(totalMins / 60);
                    const mins = totalMins % 60;
                    const durationStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

                    return {
                        'Data': startDate.toLocaleDateString('pl-PL'),
                        'Godzina rozpoczęcia': startDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
                        'Godzina zakończenia': endDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
                        'Czas trwania': durationStr,
                        'Zarobek (zł)': parseFloat(session.earned || 0)
                    };
                });

                // Generowanie pliku XLSX
                const worksheet = XLSX.utils.json_to_sheet(excelData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Moje Raporty");

                const dateToday = new Date().toISOString().split('T')[0];
                XLSX.writeFile(workbook, `Express_Tracker_Raporty_${dateToday}.xlsx`);
            } catch (error) {
                console.error("Błąd generowania Excela:", error);
                await showAlert('Błąd', 'Wystąpił błąd podczas generowania pliku Excel.');
            }
        });
    }

    // 7. Import danych z pliku JSON
    if (inputImport) {
        inputImport.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const isJsonFile =
                file.name.toLowerCase().endsWith('.json') ||
                file.type === 'application/json' ||
                file.type === 'text/json' ||
                file.type === 'application/ld+json';

            if (!isJsonFile) {
                await showAlert('Nieprawidłowy plik', 'Wybrany plik nie jest plikiem JSON (.json). Wybierz poprawny plik kopii zapasowej.');
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let importedData;
                    try {
                        importedData = JSON.parse(e.target.result);
                    } catch (parseErr) {
                        throw new Error('Plik nie zawiera poprawnego formatu JSON (błąd składni pliku).');
                    }

                    if (!importedData || typeof importedData !== 'object' || Array.isArray(importedData)) {
                        throw new Error('Struktura pliku jest nieprawidłowa (główny element nie jest obiektem).');
                    }

                    if (!importedData.settings && !importedData.sessions) {
                        throw new Error('Plik nie zawiera konfiguracji stawek ani historii pracy ExpressTracker.');
                    }

                    const fileName = file.name;
                    const fileSize = file.size > 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`;

                    const sessionsCount = Array.isArray(importedData.sessions) ? importedData.sessions.length : 0;
                    const currentSessionsCount = (Storage.getSessions() || []).length;

                    const formatEntries = (count) => {
                        if (count === 1) return '1 wpis';
                        const lastDigit = count % 10;
                        const lastTwo = count % 100;
                        if (lastTwo >= 12 && lastTwo <= 14) return `${count} wpisów`;
                        if (lastDigit >= 2 && lastDigit <= 4) return `${count} wpisy`;
                        return `${count} wpisów`;
                    };

                    const entriesPlural = formatEntries(sessionsCount);
                    const currentEntriesPlural = formatEntries(currentSessionsCount);

                    let dateRangeStr = '';
                    let totalEarned = 0;
                    let totalHours = 0;

                    if (Array.isArray(importedData.sessions) && importedData.sessions.length > 0) {
                        const validDates = importedData.sessions
                            .map(s => new Date(s.start).getTime())
                            .filter(t => !isNaN(t));

                        if (validDates.length > 0) {
                            const minDate = new Date(Math.min(...validDates)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
                            const maxDate = new Date(Math.max(...validDates)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
                            dateRangeStr = minDate === maxDate ? minDate : `${minDate} — ${maxDate}`;
                        }

                        importedData.sessions.forEach(s => {
                            if (s.earned != null) {
                                totalEarned += Number(s.earned) || 0;
                            }

                            // 1. Sprawdzenie billableHours (najdokładniejsza wartość rozliczeniowa)
                            if (s.billableHours != null && !isNaN(parseFloat(s.billableHours))) {
                                totalHours += parseFloat(s.billableHours);
                            } else {
                                // 2. Wyliczenie na podstawie durationMs / duration lub różnicy end - start
                                const ms = Number(s.durationMs ?? s.duration ?? (new Date(s.end) - new Date(s.start)));
                                if (!isNaN(ms) && ms > 0) {
                                    const totalSeconds = Math.floor(ms / 1000);
                                    const fullHours = Math.floor(totalSeconds / 3600);
                                    const remainingSeconds = totalSeconds % 3600;
                                    let extra = 0;
                                    if (remainingSeconds >= 2700) extra = 1;
                                    else if (remainingSeconds >= 900) extra = 0.5;
                                    const calculated = fullHours + extra;
                                    const isSat = s.isSaturday ?? (new Date(s.start).getDay() === 6);
                                    totalHours += isSat ? calculated : Math.max(8, calculated);
                                }
                            }
                        });
                    }

                    const rateStr = importedData.settings?.hourlyRate != null ? `${importedData.settings.hourlyRate} zł/h` : 'Brak';
                    const satRateStr = importedData.settings?.saturdayRate != null ? `${importedData.settings.saturdayRate} zł` : 'Brak';
                    const hoursFormatted = totalHours > 0 ? (Number.isInteger(totalHours) ? `${totalHours} h` : `${totalHours.toFixed(1)} h`) : null;
                    const earnedFormatted = totalEarned > 0 ? `${totalEarned.toFixed(2)} zł` : null;

                    const detailsHtml = `
                        <div class="d-flex align-items-center justify-content-between p-2 px-3 rounded-3 bg-body-tertiary border mb-3">
                            <div class="d-flex align-items-center gap-2 text-truncate">
                                <i class="bi bi-filetype-json text-primary fs-3"></i>
                                <div class="text-truncate">
                                    <strong class="d-block text-truncate text-body small fw-bold">${fileName}</strong>
                                    <span class="text-muted small">${fileSize}</span>
                                </div>
                            </div>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small">
                                Kopia JSON
                            </span>
                        </div>

                        <div class="import-item-preview p-3 rounded-4 mb-3">
                            <span class="small text-uppercase fw-bold text-muted d-block mb-2">
                                <i class="bi bi-collection me-1 text-primary"></i> Zawartość kopii zapasowej:
                            </span>
                            
                            <div class="row g-2 mb-2">
                                <div class="col-6">
                                    <div class="p-2 rounded-3 bg-body-tertiary border text-center h-100 d-flex flex-column justify-content-center">
                                        <span class="small text-muted d-block fw-semibold">Historia pracy</span>
                                        <strong class="text-body fs-5 fw-bold">${entriesPlural}</strong>
                                        ${dateRangeStr ? `<span class="small text-muted" style="font-size: 11px;">${dateRangeStr}</span>` : ''}
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="p-2 rounded-3 bg-body-tertiary border text-center h-100 d-flex flex-column justify-content-center">
                                        <span class="small text-muted d-block fw-semibold">Czas rozliczeniowy</span>
                                        <strong class="text-primary fs-5 fw-bold">${hoursFormatted || '---'}</strong>
                                        <span class="small text-muted" style="font-size: 11px;">Stawka: ${rateStr}</span>
                                    </div>
                                </div>
                            </div>

                            ${totalEarned > 0 ? `
                            <div class="d-flex justify-content-between align-items-center px-2 py-1 small rounded-3 bg-body-tertiary border">
                                <span class="text-muted"><i class="bi bi-wallet2 text-success me-1"></i> Łączny zarobek w pliku:</span>
                                <strong class="text-success fw-bold">${totalEarned.toFixed(2)} zł</strong>
                            </div>` : ''}
                        </div>

                        <div class="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 rounded-3 mb-0 small border-0">
                            <i class="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0 text-warning mt-1"></i>
                            <div>
                                <strong>Nadpisanie danych:</strong> Zaimportowanie pliku zastąpi aktualną bazę w telefonie (obecnie: <strong>${currentEntriesPlural}</strong>) oraz zapisane stawki.
                            </div>
                        </div>
                    `;

                    const isConfirmed = await showImportConfirmModal({
                        title: 'Import danych z pliku',
                        subtitle: 'Sprawdź dane przed wczytaniem',
                        detailsHtml,
                        confirmBtnText: 'Zaimportuj dane'
                    });

                    if (!isConfirmed) {
                        event.target.value = '';
                        return;
                    }

                    Storage.importBackupData(importedData);
                    await showSuccessModal({
                        title: 'Zaimportowano dane',
                        message: `Pomyślnie wczytano ${entriesPlural} do historii oraz zaktualizowano stawki i ustawienia.`,
                        hours: hoursFormatted,
                        earned: earnedFormatted,
                        buttonText: 'Gotowe'
                    });
                    location.reload();
                } catch (error) {
                    console.error('Błąd importu:', error);
                    await showAlert(
                        'Błąd importu',
                        `Nie udało się wczytać pliku.\n\nPowód: ${error.message || 'Nieznany błąd formatu JSON.'}`
                    );
                }

                event.target.value = '';
            };

            reader.onerror = async () => {
                await showAlert('Błąd', 'Nie udało się odczytać pliku z dysku urządzenia.');
                event.target.value = '';
            };

            reader.readAsText(file);
        });
    }

    // 8. Całkowite usuwanie danych
    if (btnClearData) {
        btnClearData.addEventListener('click', async () => {
            const sessionsCount = (Storage.getSessions() || []).length;
            const entriesText = sessionsCount === 1 ? '1 wpis' :
                ((sessionsCount % 10 >= 2 && sessionsCount % 10 <= 4 && !(sessionsCount % 100 >= 12 && sessionsCount % 100 <= 14)) ? `${sessionsCount} wpisy` : `${sessionsCount} wpisów`);
            const detailsHtml = `
                <div class="delete-item-preview p-3 rounded-4 mb-3">
                    <div class="d-flex align-items-center gap-2 text-danger fw-bold fs-6 mb-2">
                        <i class="bi bi-exclamation-octagon-fill fs-4"></i>
                        <span>Całkowite wyczyszczenie aplikacji</span>
                    </div>
                    <p class="small text-muted mb-2">
                        Ta operacja trwale usunie wszystkie zgromadzone dane:
                    </p>
                    <ul class="small mb-0 ps-3 text-secondary">
                        <li>Cała historia pracy i raporty (<strong>${entriesText}</strong>)</li>
                        <li>Zapisane stawki godzinowe oraz stawka sobotnia</li>
                        <li>Wszystkie ustawienia aplikacji i motyw</li>
                    </ul>
                </div>
                <div class="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 rounded-3 mb-0 small">
                    <i class="bi bi-shield-fill-exclamation fs-5 flex-shrink-0 text-warning mt-1"></i>
                    <div>
                        <strong>Zalecenie:</strong> Przed usunięciem danych warto skorzystać z opcji <em>„Eksportuj kopię (JSON)”</em> lub <em>„Eksportuj do Excela”</em>.
                    </div>
                </div>
            `;

            const isConfirmed = await showDeleteConfirmModal({
                title: 'Usunięcie wszystkich danych',
                subtitle: 'Nieodwracalne zresetowanie aplikacji',
                detailsHtml,
                confirmBtnText: 'Usuń wszystkie dane'
            });

            if (isConfirmed) {
                Storage.clearAllData();
                await showAlert('Usunięto', 'Dane zostały trwale usunięte. Aplikacja zostanie uruchomiona ponownie.');
                location.reload(); 
            }
        });
    }

    // 8. Otwieranie karty "Co nowego w wersji 2.1"
    const btnReopenWhatsNew = document.getElementById('btn-reopen-whats-new');
    if (btnReopenWhatsNew) {
        btnReopenWhatsNew.addEventListener('click', () => {
            const whatsNewCard = document.getElementById('whats-new-card');
            if (whatsNewCard) {
                whatsNewCard.classList.remove('hidden');
            }
            // Przełącz na ekran pracy
            const navTrackerBtn = document.querySelector('.bottom-nav [data-target="view-tracker"]');
            if (navTrackerBtn) {
                navTrackerBtn.click();
            }
            setTimeout(() => {
                whatsNewCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        });
    }
}