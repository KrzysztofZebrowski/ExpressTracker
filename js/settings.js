import { Storage } from './storage.js';
import { showPrompt, showConfirm, showAlert } from './modal.js';

export function initSettings() {
    
    // 1. Pobranie elementów DOM
    const rateDisplay = document.getElementById('current-rate-display');
    const satRateDisplay = document.getElementById('current-sat-rate-display');
    const btnChangeRate = document.getElementById('btn-change-rate');
    const btnChangeSatRate = document.getElementById('btn-change-sat-rate');
    const btnExport = document.getElementById('btn-export');
    const inputImport = document.getElementById('btn-import');
    const btnClearData = document.getElementById('btn-clear-data');
    const btnExportExcel = document.getElementById('btn-export-excel');

    // 2. Funkcja odświeżająca teksty ze stawkami na ekranie
    function updateDisplays() {
        const settings = Storage.getSettings();
        if (rateDisplay) rateDisplay.textContent = `${settings.hourlyRate} zł/h`;
        if (satRateDisplay) satRateDisplay.textContent = `${settings.saturdayRate} zł`;
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

    // 5. Eksport danych do pliku JSON
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const exportData = {
                settings: Storage.getSettings(),
                sessions: Storage.getSessions()
            };
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);

            downloadAnchorNode.setAttribute("download", `rozliczenie_kopia_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
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
                XLSX.writeFile(workbook, `ExpressTracker_Raporty_${dateToday}.xlsx`);
            } catch (error) {
                console.error("Błąd generowania Excela:", error);
                await showAlert('Błąd', 'Wystąpił błąd podczas generowania pliku Excel.');
            }
        });
    }

    // 7. Import danych z pliku JSON
    if (inputImport) {
        inputImport.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    if (importedData.settings) {
                        Storage.setSettings(importedData.settings);
                    }
                    if (importedData.sessions) {
                        Storage.setSessions(importedData.sessions);
                    }
                    
                    await showAlert('Sukces', 'Dane zostały pomyślnie zaimportowane!');
                    // Odświeżenie strony, aby załadować nowe dane w trackerze i raportach
                    location.reload(); 
                } catch (error) {
                    console.error("Błąd importu:", error);
                    await showAlert('Błąd', 'Nieprawidłowy plik. Upewnij się, że to poprawny plik JSON wygenerowany przez tę aplikację.');
                }
                
                event.target.value = '';
            };
            reader.readAsText(file);
        });
    }

    // 8. Całkowite usuwanie danych
    if (btnClearData) {
        btnClearData.addEventListener('click', async () => {
            const isConfirmed = await showConfirm(
                'Usunięcie danych', 
                'UWAGA! Czy na pewno chcesz trwale usunąć WSZYSTKIE dane z aplikacji (historię pracy i ustawienia)?\n\n' +
                'Polecam najpierw użyć opcji "Eksportuj". Tej operacji NIE można cofnąć.'
            );

            if (isConfirmed) {
                Storage.clearAllData();
                await showAlert('Usunięto', 'Dane zostały trwale usunięte. Aplikacja zostanie uruchomiona ponownie.');
                location.reload(); 
            }
        });
    }
}