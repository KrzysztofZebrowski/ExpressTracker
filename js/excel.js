import { Storage } from './storage.js';
import { showPrompt, showConfirm, showAlert, showManualCheckModal, hideManualCheckModal, showMonthSelector } from './modal.js';

// Funkcja asynchronicznie pobierająca bibliotekę Excela
function loadExcelLibrary() {
    return new Promise((resolve, reject) => {
        // Sprawdzenie czy biblioteka jest już załadowana
        if (window.XLSX) {
            return resolve(true);
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error('Nie udało się pobrać biblioteki Excel. Sprawdź połączenie z internetem.'));
        
        document.head.appendChild(script);
    });
}

export function initExcel() {
    const fileInput = document.getElementById('excel-upload');
    const resultsContainer = document.getElementById('excel-results');
    
    const btnManualCheck = document.getElementById('btn-manual-check');
    const manualResultsContainer = document.getElementById('manual-check-results');

    if (manualResultsContainer) {
        renderManualChecks();
    }

    // ==========================================
    // 1. OBSŁUGA PLIKU EXCEL (.XLSX)
    // ==========================================
    if (fileInput && resultsContainer) {
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // Pobieranie biblioteki Excel
            try {
                await loadExcelLibrary();
            } catch (err) {
                showAlert('Błąd', err.message);
                event.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, header: "A", range: 1 });

                    const excelDataByDate = {};
                    let targetYearMonth = ''; 
                    let displayMonthName = '';

                    rawRows.forEach(row => {
                        if (!row['B'] || !row['F']) return;

                        let dateOnly = '';
                        const dateVal = String(row['B']).trim();
                        const parsedDate = new Date(dateVal);

                        if (!isNaN(parsedDate.getTime())) {
                            dateOnly = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
                        } else {
                            dateOnly = dateVal.split(' ')[0];
                        }

                        if (!targetYearMonth && dateOnly.includes('-')) {
                            targetYearMonth = dateOnly.substring(0, 7); 
                            const tempDate = new Date(`${targetYearMonth}-01`);
                            const monthWord = tempDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
                            displayMonthName = monthWord.charAt(0).toUpperCase() + monthWord.slice(1);
                        }

                        const amountStr = String(row['F']).replace(/\s/g, '').replace(',', '.');
                        const amount = parseFloat(amountStr);

                        if (!isNaN(amount) && dateOnly) {
                            if (!excelDataByDate[dateOnly]) excelDataByDate[dateOnly] = 0;
                            excelDataByDate[dateOnly] += amount;
                        }
                    });

                    if (Object.keys(excelDataByDate).length === 0) {
                        showAlert('Błąd odczytu', 'Nie udało się odczytać żadnych kwot. Upewnij się, że plik ma poprawne dane w kolumnach B (Data) i F (Kwota).');
                        return;
                    }

                    const mySessions = Storage.getSessions();
                    const myDataByDate = {};

                    mySessions.forEach(session => {
                        const d = new Date(session.start);
                        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        
                        if (!myDataByDate[localDateStr]) myDataByDate[localDateStr] = 0;
                        myDataByDate[localDateStr] += parseFloat(session.earned || 0);
                    });

                    const allDates = new Set([...Object.keys(excelDataByDate), ...Object.keys(myDataByDate)]);
                    
                    const filteredDates = Array.from(allDates)
                        .filter(d => d.startsWith(targetYearMonth))
                        .sort(); 

                    let totalExcel = 0;
                    let totalApp = 0;

                    filteredDates.forEach(date => {
                        const exVal = excelDataByDate[date] || 0;
                        const myVal = myDataByDate[date] || 0;
                        totalExcel += exVal;
                        totalApp += myVal;
                    });

                    const totalDiff = totalExcel - totalApp;

                    let html = `
                        <div class="month-card excel-result-card shadow-sm rounded-4 overflow-hidden mb-4">
                            <div class="excel-month-header p-3 text-center text-white fw-bold d-flex align-items-center justify-content-center gap-2">
                                <i class="bi bi-file-earmark-spreadsheet-fill fs-5"></i>
                                <span>Rozliczenie: <b>${displayMonthName}</b></span>
                            </div>

                            <div class="comparison-summary d-flex justify-content-around p-3 border-bottom text-center">
                                <div>
                                    <span class="small text-muted d-block"><i class="bi bi-file-earmark-excel text-success me-1"></i>Excel</span>
                                    <span class="comparison-summary-value fw-bold fs-5">${totalExcel.toFixed(2)} zł</span>
                                </div>
                                <div>
                                    <span class="small text-muted d-block"><i class="bi bi-phone text-primary me-1"></i>Aplikacja</span>
                                    <span class="comparison-summary-value fw-bold fs-5">${totalApp.toFixed(2)} zł</span>
                                </div>
                                <div>
                                    <span class="small text-muted d-block"><i class="bi bi-plus-slash-minus me-1"></i>Różnica</span>
                                    <span class="comparison-summary-value fw-bold fs-5 ${totalDiff >= 0 ? 'text-success' : 'text-danger'}">${totalDiff >= 0 ? '+' : ''}${totalDiff.toFixed(2)} zł</span>
                                </div>
                            </div>

                            <div class="table-responsive m-0">
                                <table class="comparison-table table table-hover align-middle text-center mb-0">
                                    <thead class="comparison-table-head text-uppercase small">
                                        <tr>
                                            <th>Dzień</th>
                                            <th>Excel</th>
                                            <th>Aplikacja</th>
                                            <th>Różnica</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;

                    filteredDates.forEach(date => {
                        const dayNum = date.split('-')[2];
                        const exVal = excelDataByDate[date] || 0;
                        const myVal = myDataByDate[date] || 0;

                        const diff = exVal - myVal;
                        let statusHtml = '';

                        if (Math.abs(diff) < 0.05) {
                            statusHtml = '<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> Zgodne</span>';
                        } else if (diff > 0) {
                            statusHtml = `<span class="text-success fw-bold"><i class="bi bi-arrow-up-circle-fill me-1"></i>+${diff.toFixed(2)} zł</span>`;
                        } else {
                            statusHtml = `<span class="text-danger fw-bold"><i class="bi bi-arrow-down-circle-fill me-1"></i>${diff.toFixed(2)} zł</span>`;
                        }

                        html += `
                            <tr>
                                <td class="fw-bold">${dayNum}</td>
                                <td>${exVal.toFixed(2)} zł</td>
                                <td>${myVal.toFixed(2)} zł</td>
                                <td>${statusHtml}</td>
                            </tr>
                        `;
                    });

                    html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;

                    resultsContainer.innerHTML = html;
                    event.target.value = ''; 

                } catch (err) {
                    console.error(err);
                    showAlert("Błąd", "Wystąpił błąd podczas analizy pliku. Zobacz szczegóły w konsoli (F12).");
                }
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // ==========================================
    // 2. OBSŁUGA RĘCZNEGO SPRAWDZANIA Z TABLETU
    // ==========================================
    if (btnManualCheck) {
        btnManualCheck.addEventListener('click', async () => {
            const sessions = Storage.getSessions();
            if (sessions.length === 0) {
                return await showAlert('Brak danych', 'Nie masz jeszcze żadnych dni pracy w historii.');
            }

            const availableMonths = [...new Set(sessions.map(s => {
                const d = new Date(s.start);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }))].sort().reverse();
            
            const targetMonth = await showMonthSelector(availableMonths);

            if (!targetMonth) return;

            const monthSessions = sessions
                .filter(s => {
                    const d = new Date(s.start);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === targetMonth;
                })
                .sort((a, b) => a.start - b.start);

            if (monthSessions.length === 0) {
                return await showAlert('Brak wpisów', `Brak tras w wybranym miesiącu.`);
            }

            const manualData = [];

            for (let i = 0; i < monthSessions.length; i++) {
                const session = monthSessions[i];
                const dateObj = new Date(session.start);
                const dateStr = dateObj.toLocaleDateString('pl-PL');
                const appEarned = parseFloat(session.earned || 0).toFixed(2);
                
                const tabletEarnedStr = await showManualCheckModal(
                    `Dzień ${i + 1} z ${monthSessions.length}`,
                    `Data: <b>${dateStr}</b><br>Podaj kwotę wpisaną na tablecie (zł):`,
                    appEarned
                );

                if (tabletEarnedStr === null) {
                    hideManualCheckModal();
                    const savePartial = await showConfirm('Przerwano sprawdzanie', 'Czy chcesz zapisać wyniki tylko do momentu przerwania?');
                    if (!savePartial) return; 
                    break; 
                }

                const cleanInput = String(tabletEarnedStr).replace(/[^\d.,]/g, '').replace(',', '.');
                let tabletEarned = parseFloat(cleanInput);
                if (isNaN(tabletEarned)) tabletEarned = 0;

                manualData.push({
                    sessionId: session.start,
                    dateStr: dateStr,
                    appEarned: appEarned,
                    tabletEarned: tabletEarned.toFixed(2)
                });
            }

            hideManualCheckModal();
            saveManualData(targetMonth, manualData);
            renderManualChecks();
        });
    }

    // ==========================================
    // 3. FUNKCJE POMOCNICZE
    // ==========================================

    function saveManualData(month, data) {
        const singleCheck = {
            [month]: data
        };
        localStorage.setItem('et_manual_checks', JSON.stringify(singleCheck));
    }

    function getManualData() {
        return JSON.parse(localStorage.getItem('et_manual_checks') || '{}');
    }

    function renderManualChecks() {
        if (!manualResultsContainer) return;
        
        const allChecks = getManualData();
        const months = Object.keys(allChecks).sort().reverse();
        
        if (months.length === 0) {
            manualResultsContainer.innerHTML = '';
            return;
        }

        let html = '';
        
        months.forEach(month => {
            const data = allChecks[month];
            
            const totalApp = data.reduce((sum, item) => sum + parseFloat(item.appEarned), 0);
            const totalTablet = data.reduce((sum, item) => sum + parseFloat(item.tabletEarned), 0);
            const diff = totalTablet - totalApp;
            const diffClass = diff >= -0.05 ? 'text-success' : 'text-danger';
            const diffSign = diff > 0.05 ? '+' : '';

            const monthDate = new Date(`${month}-01`);
            const monthName = monthDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
            const capMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            let rowsHtml = data.map((item, index) => {
                const rowDiff = parseFloat(item.tabletEarned) - parseFloat(item.appEarned);
                let statusHtml = '<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> Zgodne</span>';
                
                if (Math.abs(rowDiff) >= 0.05) {
                    const sign = rowDiff > 0 ? '+' : '';
                    const rowDiffClass = rowDiff > 0 ? 'text-success' : 'text-danger';
                    const rowIcon = rowDiff > 0 ? 'bi-arrow-up-circle-fill' : 'bi-arrow-down-circle-fill';
                    statusHtml = `<span class="${rowDiffClass} fw-bold"><i class="bi ${rowIcon} me-1"></i>${sign}${rowDiff.toFixed(2)} zł</span>`;
                }

                return `
                <tr>
                    <td class="fw-bold">${item.dateStr.split('.').slice(0, 2).join('.')}</td>
                    <td>${item.appEarned} zł</td>
                    <td class="tablet-cell">
                        <div class="d-inline-flex align-items-center justify-content-center gap-2">
                            <span class="fw-semibold">${item.tabletEarned} zł</span>
                            <button class="btn btn-sm btn-outline-primary rounded-circle p-1 d-inline-flex align-items-center justify-content-center btn-edit-tablet" data-month="${month}" data-index="${index}" style="width: 28px; height: 28px;" title="Edytuj">
                                <i class="bi bi-pencil-fill" style="font-size: 11px;"></i>
                            </button>
                        </div>
                    </td>
                    <td>${statusHtml}</td>
                </tr>
                `;
            }).join('');

            html += `
            <div class="month-card shadow-sm rounded-4 overflow-hidden mb-4">
                <div class="manual-check-header p-3 text-center text-white fw-bold d-flex align-items-center justify-content-center gap-2">
                    <i class="bi bi-tablet-landscape-fill fs-5"></i>
                    <span>Ręczne sprawdzenie: <b>${capMonthName}</b></span>
                </div>
                
                <div class="comparison-summary d-flex justify-content-around p-3 border-bottom text-center">
                    <div>
                        <span class="small text-muted d-block"><i class="bi bi-phone text-primary me-1"></i>Aplikacja</span>
                        <span class="comparison-summary-value fw-bold fs-5">${totalApp.toFixed(2)} zł</span>
                    </div>
                    <div>
                        <span class="small text-muted d-block"><i class="bi bi-tablet text-info me-1"></i>Tablet</span>
                        <span class="comparison-summary-value fw-bold fs-5">${totalTablet.toFixed(2)} zł</span>
                    </div>
                    <div>
                        <span class="small text-muted d-block"><i class="bi bi-plus-slash-minus me-1"></i>Różnica</span>
                        <span class="comparison-summary-value fw-bold fs-5 ${diffClass}">${diffSign}${diff.toFixed(2)} zł</span>
                    </div>
                </div>

                <div class="table-responsive m-0">
                    <table class="comparison-table table table-hover align-middle text-center mb-0">
                        <thead class="comparison-table-head text-uppercase small">
                            <tr>
                                <th>Data</th>
                                <th>Apka</th>
                                <th>Tablet</th>
                                <th>Różnica</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
            `;
        });

        manualResultsContainer.innerHTML = html;

        document.querySelectorAll('.btn-edit-tablet').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const month = e.currentTarget.getAttribute('data-month');
                const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
                
                const checks = getManualData();
                const record = checks[month][index];

                const newValStr = await showManualCheckModal(
                    `Korekta: ${record.dateStr}`,
                    `Podaj kwotę wpisaną na tablecie (zł):`,
                    record.tabletEarned || record.appEarned
                );
                
                hideManualCheckModal();

                if (newValStr !== null && newValStr.trim() !== '') {
                    const cleanInput = String(newValStr).replace(/[^\d.,]/g, '').replace(',', '.');
                    const newEarned = parseFloat(cleanInput);
                    
                    if (!isNaN(newEarned)) {
                        checks[month][index].tabletEarned = newEarned.toFixed(2);
                        localStorage.setItem('et_manual_checks', JSON.stringify(checks));
                        renderManualChecks();
                    } else {
                        await showAlert('Błąd', 'Podano nieprawidłową kwotę.');
                    }
                }
            });
        });
    }
}