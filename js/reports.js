import { Storage } from './storage.js';
import { showPrompt, showAlert, showConfirm } from './modal.js';

function getBillableHours(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const fullHours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    
    let extraHours = 0;
    if (remainingSeconds >= 2700) { extraHours = 1; } 
    else if (remainingSeconds >= 900) { extraHours = 0.5; }
    
    const calculatedHours = fullHours + extraHours;
    return Math.max(8, calculatedHours); // Minimum 8 godzin
}

export function renderReports() {
    const reportsContainer = document.getElementById('reports-list');
    const btnAddSession = document.getElementById('btn-add-session');

    if (!reportsContainer) return;

    if (btnAddSession) {
        btnAddSession.onclick = addNewSession;
    }

    reportsContainer.innerHTML = ''; 
    const sessions = Storage.getSessions();

    if (sessions.length === 0) {
        reportsContainer.innerHTML = '<p style="text-align:center; color:#888;">Brak zapisanych dni pracy.</p>';
        return;
    }

    const grouped = {};
    sessions.forEach((session, index) => {
        const date = new Date(session.start);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ ...session, originalIndex: index });
    });

    const sortedMonthKeys = Object.keys(grouped).sort().reverse();

    sortedMonthKeys.forEach(key => {
        const [year, month] = key.split('-');
        const monthDate = new Date(year, parseInt(month) - 1, 1);
        let monthName = monthDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
        monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        const days = grouped[key].sort((a, b) => b.start - a.start);

        // Sumowanie zarobków ze wszystkich dni w tym miesiącu
        const monthTotal = days.reduce((sum, day) => {
            return sum + parseFloat(day.earned || 0);
        }, 0);

        const monthCard = document.createElement('div');
        monthCard.className = 'month-card';

        const monthTitle = document.createElement('h2');
        monthTitle.className = 'month-title';

        monthTitle.innerHTML = `
            <span style="flex-grow: 1;">${monthName}</span>
            <span style="color: #4CAF50; font-size: 16px; margin-right: 15px;">${monthTotal.toFixed(2)} zł</span>
        `;

        const monthDetails = document.createElement('div');
        monthDetails.className = 'month-details';

        days.forEach(day => {
            const dateObj = new Date(day.start);
            const dayNum = String(dateObj.getDate()).padStart(2, '0');
            
            const startStr = new Date(day.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            const endStr = new Date(day.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

            const row = document.createElement('div');
            row.className = 'day-row';
            
            row.innerHTML = `
                <div class="day-date">${dayNum}</div>
                <div class="day-time">${startStr} - ${endStr}</div>
                <div class="day-stats">${day.billableHours}h | ${day.earned} zł</div>
                <div class="day-actions">
                    <button class="btn-edit" data-index="${day.originalIndex}">✏️</button>
                    <button class="btn-delete" data-index="${day.originalIndex}">🗑️</button>
                </div>
            `;
            monthDetails.appendChild(row);
        });

        monthTitle.addEventListener('click', () => {
            monthTitle.classList.toggle('open');
            monthDetails.classList.toggle('active');
        });

        monthDetails.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editSession(btn.getAttribute('data-index')));
        });
        
        monthDetails.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteSession(btn.getAttribute('data-index')));
        });

        monthCard.appendChild(monthTitle);
        monthCard.appendChild(monthDetails);
        reportsContainer.appendChild(monthCard);
    });
}

async function addNewSession() {

    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = await showPrompt('Wybierz datę pracy:', todayStr, 'date');
    
    if (!dateStr) return; 

    const startStr = await showPrompt('Godzina rozpoczęcia (HH:MM):', '08:00', 'time');
    if (!startStr) return;

    const endStr = await showPrompt('Godzina zakończenia (HH:MM):', '16:00', 'time');
    if (!endStr) return;

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startStr) || !timeRegex.test(endStr)) {
        return await showAlert('Błąd', 'Nieprawidłowy format czasu!');
    }

    const startDate = new Date(`${dateStr}T${startStr}:00`);
    const endDate = new Date(`${dateStr}T${endStr}:00`);

    if (endDate.getTime() < startDate.getTime()) {
        return await showAlert('Błąd', 'Czas zakończenia nie może być wcześniejszy niż czas rozpoczęcia!');
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const billableHours = getBillableHours(durationMs);
    
    const settings = Storage.getSettings();
    const isSaturday = startDate.getDay() === 6;
    
    // Jeśli sobota, daj stałą stawkę. Jak nie, mnóż z godzinami.
    const earned = isSaturday 
        ? parseFloat(settings.saturdayRate).toFixed(2) 
        : (billableHours * settings.hourlyRate).toFixed(2);

    Storage.addSession({
        start: startDate.getTime(),
        end: endDate.getTime(),
        durationMs,
        billableHours,
        earned
    });

    renderReports();
    await showAlert(
        'Dodano wpis', 
        `Pomyślnie dodano nowy dzień pracy!<br><br>` +
        `Zaliczone godziny: <b>${billableHours}h</b><br>` +
        `Zarobek: <b style="color: #4CAF50;">${earned} zł</b>`
    );
}

async function deleteSession(index) {
    const isConfirmed = await showConfirm(
        'Usuń wpis', 
        'Czy na pewno chcesz usunąć ten dzień z historii pracy? Tej operacji nie można cofnąć.'
    );

    if (isConfirmed) {
        const sessions = Storage.getSessions();

        sessions.splice(index, 1); 
        Storage.setSessions(sessions);
        
        renderReports();
    }
}

async function editSession(index) {
    const sessions = Storage.getSessions();
    const session = sessions[index];

    const currentStartStr = new Date(session.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const currentEndStr = new Date(session.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    const newStartStr = await showPrompt('Zmień czas rozpoczęcia:', currentStartStr, 'time');
    if (newStartStr === null) return; 
    if (!timeRegex.test(newStartStr)) {
        return await showAlert('Błąd', 'Nieprawidłowy format czasu! Użyj HH:MM (np. 08:30).');
    }

    const newEndStr = await showPrompt('Zmień czas zakończenia:', currentEndStr, 'time');
    if (newEndStr === null) return;
    if (!timeRegex.test(newEndStr)) {
        return await showAlert('Błąd', 'Nieprawidłowy format czasu! Użyj HH:MM (np. 16:00).');
    }

    const startDate = new Date(session.start);
    const [startH, startM] = newStartStr.split(':');
    startDate.setHours(parseInt(startH), parseInt(startM), 0, 0);

    const endDate = new Date(session.end);
    const [endH, endM] = newEndStr.split(':');
    endDate.setHours(parseInt(endH), parseInt(endM), 0, 0);

    if (endDate.getTime() < startDate.getTime()) {
        return await showAlert('Błąd', 'Czas zakończenia nie może być wcześniejszy niż czas rozpoczęcia!');
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const billableHours = getBillableHours(durationMs);
    const { hourlyRate } = Storage.getSettings();
    const earned = (billableHours * hourlyRate).toFixed(2);

    sessions[index] = {
        ...session,
        start: startDate.getTime(),
        end: endDate.getTime(),
        durationMs,
        billableHours,
        earned
    };

    Storage.setSessions(sessions);
    renderReports();
    
    await showAlert(
        'Zaktualizowano', 
        `Nowy czas: <b>${billableHours}h</b><br>` +
        `Nowe wynagrodzenie: <b style="color: #4CAF50;">${earned} zł</b>`
    );
}