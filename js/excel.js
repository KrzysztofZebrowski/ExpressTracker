import { Storage } from './storage.js';
import { showPrompt, showConfirm, showAlert, showManualCheckModal } from './modal.js';

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
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

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
                        alert('Nie udało się odczytać żadnych kwot. Upewnij się, że plik ma poprawne dane w kolumnach B (Data) i F (Kwota).');
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
                        <div class="month-card excel-result-card">
                            <div class="excel-month-header">
                                Rozliczenie: <b>${displayMonthName}</b>
                            </div>

                            <div class="comparison-summary">
                                <div>Excel<br><span class="comparison-summary-value">${totalExcel.toFixed(2)}</span></div>
                                <div>Aplikacja<br><span class="comparison-summary-value">${totalApp.toFixed(2)}</span></div>
                                <div>Różnica<br><span class="comparison-summary-value ${totalDiff >= 0 ? 'match-ok' : 'match-diff'}">${totalDiff >= 0 ? '+' : ''}${totalDiff.toFixed(2)}</span></div>
                            </div>

                            <table class="comparison-table" style="box-shadow: none; border-radius: 0;">
                                <thead>
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
                            statusHtml = '<span class="match-ok">✓</span>';
                        } else if (diff > 0) {
                            statusHtml = `<span class="match-ok">+${diff.toFixed(2)} zł</span>`;
                        } else {
                            statusHtml = `<span class="match-diff">${diff.toFixed(2)} zł</span>`;
                        }

                        html += `
                            <tr>
                                <td><b>${dayNum}</b></td>
                                <td>${exVal.toFixed(2)}</td>
                                <td>${myVal.toFixed(2)}</td>
                                <td>${statusHtml}</td>
                            </tr>
                        `;
                    });

                    html += `
                            </tbody>
                        </table>
                        </div>
                    `;

                    resultsContainer.innerHTML = html;
                    event.target.value = ''; 

                } catch (err) {
                    console.error(err);
                    alert("Wystąpił błąd podczas analizy pliku. Zobacz szczegóły w konsoli (F12).");
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

            saveManualData(targetMonth, manualData);
            renderManualChecks();
        });
    }

    // ==========================================
    // 3. FUNKCJE POMOCNICZE
    // ==========================================
    
    function showMonthSelector(monthsArray) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.zIndex = '99999';

            const optionsHtml = monthsArray.map(m => {
                const [year, month] = m.split('-');
                const d = new Date(year, parseInt(month) - 1, 1);
                let monthName = d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
                monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                return `<option value="${m}">${monthName}</option>`;
            }).join('');

            overlay.innerHTML = `
                <div class="modal-box" style="animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;">
                    <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 20px; font-weight: 800; color: var(--text);">Wybierz miesiąc</h3>
                    <p style="font-size: 15px; color: var(--text-muted); margin-bottom: 20px;">Dla jakiego miesiąca chcesz sprawdzić zarobki z tabletu?</p>
                    
                    <select id="month-select-input" style="width: 100%; padding: 14px; margin-bottom: 20px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; font-weight: bold; color: var(--text); background: white; outline: none;">
                        ${optionsHtml}
                    </select>
                    
                    <div class="modal-actions" style="display: flex; gap: 12px;">
                        <button id="btn-month-confirm" class="btn-blue" style="flex: 1; margin: 0;">Zatwierdź</button>
                        <button id="btn-month-cancel" class="btn-secondary" style="flex: 1; margin: 0;">Anuluj</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const btnConfirm = overlay.querySelector('#btn-month-confirm');
            const btnCancel = overlay.querySelector('#btn-month-cancel');
            const select = overlay.querySelector('#month-select-input');

            const closeModal = (value) => {
                overlay.remove();
                resolve(value);
            };

            btnConfirm.onclick = () => closeModal(select.value);
            btnCancel.onclick = () => closeModal(null);
        });
    }

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
            const diffColor = diff >= -0.05 ? 'var(--primary)' : 'var(--danger)';
            const diffSign = diff > 0.05 ? '+' : '';

            const monthDate = new Date(`${month}-01`);
            const monthName = monthDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
            const capMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            let rowsHtml = data.map((item, index) => {
                const rowDiff = parseFloat(item.tabletEarned) - parseFloat(item.appEarned);
                let statusHtml = '<span class="match-ok">✓</span>';
                
                if (Math.abs(rowDiff) >= 0.05) {
                    const sign = rowDiff > 0 ? '+' : '';
                    const rowDiffColor = rowDiff > 0 ? 'var(--primary)' : 'var(--danger)';
                    statusHtml = `<span class="match-diff" style="color:${rowDiffColor};">${sign}${rowDiff.toFixed(2)}</span>`;
                }

                return `
                <tr>
                    <td style="font-weight: bold;">${item.dateStr.split('.').slice(0, 2).join('.')}</td>
                    <td>${item.appEarned}</td>
                    <td class="tablet-cell">
                        <div class="tablet-cell-content">
                            <span>${item.tabletEarned}</span>
                            <button class="btn-edit-tablet" data-month="${month}" data-index="${index}" style="background: none; border: none; padding: 2px; cursor: pointer; font-size: 14px;">✏️</button>
                        </div>
                    </td>
                    <td>${statusHtml}</td>
                </tr>
                `;
            }).join('');

            html += `
            <div class="month-card" style="margin-top: 25px; box-shadow: var(--shadow-md); border-radius: var(--radius-lg); overflow: hidden; background: white;">
                <div class="manual-check-header">
                    Ręczne sprawdzenie: <b>${capMonthName}</b>
                </div>
                
                <div style="display: flex; justify-content: space-around; padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: center; font-size: 13px;">
                    <div>Aplikacja<br><span style="color:var(--text); font-size: 15px;">${totalApp.toFixed(2)}</span></div>
                    <div>Tablet<br><span style="color:var(--text); font-size: 15px;">${totalTablet.toFixed(2)}</span></div>
                    <div>Różnica<br><span style="color:${diffColor}; font-size: 15px;">${diffSign}${diff.toFixed(2)}</span></div>
                </div>

                <table class="comparison-table" style="box-shadow: none; border-radius: 0;">
                    <thead>
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
                    record.appEarned
                );

                
                
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