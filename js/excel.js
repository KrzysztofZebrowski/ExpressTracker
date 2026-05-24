import { Storage } from './storage.js';

export function initExcel() {
    const fileInput = document.getElementById('excel-upload');
    const resultsContainer = document.getElementById('excel-results');

    if (!fileInput || !resultsContainer) return;

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                // 1. Wczytanie pliku
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, header: "A", range: 1 });

                const excelDataByDate = {};
                let targetYearMonth = ''; 
                let displayMonthName = '';

                // 2. Parsowanie Excela
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

                    // Naprawa kwoty z kolumny F
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

                // 3. Pobieranie wpisów z pamięci aplikacji
                const mySessions = Storage.getSessions();
                const myDataByDate = {};

                mySessions.forEach(session => {
                    const d = new Date(session.start);
                    const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    
                    if (!myDataByDate[localDateStr]) myDataByDate[localDateStr] = 0;
                    myDataByDate[localDateStr] += parseFloat(session.earned || 0);
                });

                // 4. Budowanie zestawienia
                const allDates = new Set([...Object.keys(excelDataByDate), ...Object.keys(myDataByDate)]);
                
                // Filtrowanie tylko dat z docelowego miesiąca
                const filteredDates = Array.from(allDates)
                    .filter(d => d.startsWith(targetYearMonth))
                    .sort(); 

                // 5. Renderowanie wyniku w HTML
                let html = `
                    <div class="excel-month-header">
                        Rozliczenie: <b>${displayMonthName}</b>
                    </div>
                    <table class="comparison-table">
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

                let totalExcel = 0;
                let totalApp = 0;

                filteredDates.forEach(date => {
                    const dayNum = date.split('-')[2];
                    const exVal = excelDataByDate[date] || 0;
                    const myVal = myDataByDate[date] || 0;
                    
                    totalExcel += exVal;
                    totalApp += myVal;

                    const diff = exVal - myVal;
                    let statusHtml = '';

                    // Tolerancja 5 groszy na ewentualne różnice w zaokrągleniach po stronie pracodawcy
                    if (Math.abs(diff) < 0.05) {
                        statusHtml = '<span class="match-ok">Zgodne ✓</span>';
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

                // Podsumowanie całego miesiąca u dołu tabeli
                const totalDiff = totalExcel - totalApp;
                let totalStatusHtml = Math.abs(totalDiff) < 0.05 
                    ? '<span class="match-ok">Wszystko się zgadza!</span>' 
                    : (totalDiff > 0 ? `<span class="match-ok">Jesteś na plus: +${totalDiff.toFixed(2)} zł</span>` 
                                     : `<span class="match-diff">Brakuje: ${totalDiff.toFixed(2)} zł</span>`);

                html += `
                        </tbody>
                        <tfoot>
                            <tr style="background: #f0f0f0; font-weight: bold;">
                                <td>SUMA</td>
                                <td>${totalExcel.toFixed(2)}</td>
                                <td>${totalApp.toFixed(2)}</td>
                                <td>${totalStatusHtml}</td>
                            </tr>
                        </tfoot>
                    </table>
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