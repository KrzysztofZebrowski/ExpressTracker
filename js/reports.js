import { Storage } from './storage.js';
import { showPrompt, showAlert, showConfirm, showDeleteConfirmModal, showManualCheckModal, hideManualCheckModal, showSessionModal, showSuccessModal } from './modal.js';

function getBillableHours(ms, isSaturday = false) {
    const totalSeconds = Math.floor(ms / 1000);
    const fullHours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    
    let extraHours = 0;
    if (remainingSeconds >= 2700) { extraHours = 1; } 
    else if (remainingSeconds >= 900) { extraHours = 0.5; }
    
    const calculatedHours = fullHours + extraHours;

    if (isSaturday) {
        return calculatedHours;
    }

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
    const fragment = document.createDocumentFragment();
    const sessions = Storage.getSessions();

    if (sessions.length === 0) {
        reportsContainer.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-calendar-x fs-1 d-block mb-3 text-secondary opacity-50"></i>
                <p class="fw-semibold fs-5 mb-1">Brak zapisanych dni pracy</p>
                <p class="small text-muted">Użyj przycisku powyżej, aby dodać swój pierwszy wpis.</p>
            </div>
        `;
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

        // Sumowanie zarobków i godzin ze wszystkich dni w tym miesiącu
        const monthTotal = days.reduce((sum, day) => {
            return sum + parseFloat(day.earned || 0);
        }, 0);

        const monthHoursTotal = days.reduce((sum, day) => {
            return sum + parseFloat(day.billableHours || 0);
        }, 0);

        const monthCard = document.createElement('div');
        monthCard.className = 'month-card shadow-sm rounded-4 overflow-hidden mb-3 bg-body';

        const monthTitle = document.createElement('div');
        monthTitle.className = 'month-title p-3 d-flex justify-content-between align-items-center cursor-pointer';
        
        // Wyświetlanie nazwy miesiąca oraz elastycznego kontenera z podsumowaniem kwoty i godzin
        monthTitle.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <span class="month-icon-badge bg-primary-subtle text-primary rounded-circle p-2 d-inline-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
                    <i class="bi bi-calendar3"></i>
                </span>
                <span class="fw-bold fs-6">${monthName}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="badge bg-success-subtle text-success fw-bold px-2 py-1 fs-6">
                    ${monthTotal.toFixed(2)} zł
                </span>
                <span class="badge bg-primary-subtle text-primary fw-semibold px-2 py-1">
                    <i class="bi bi-clock-history me-1"></i>${monthHoursTotal} h
                </span>
                <i class="bi bi-chevron-down chevron-icon text-muted ms-1"></i>
            </div>
        `;

        const monthDetails = document.createElement('div');
        monthDetails.className = 'month-details';

        days.forEach(day => {
            const dateObj = new Date(day.start);
            const dayNum = String(dateObj.getDate()).padStart(2, '0');
            
            const startStr = new Date(day.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            const endStr = new Date(day.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

            const row = document.createElement('div');
            row.className = 'day-row d-flex justify-content-between align-items-center py-2 px-3 border-bottom';
            
            row.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <div class="day-badge-circle fw-bold text-primary bg-primary-subtle rounded-circle d-flex align-items-center justify-content-center" style="width: 36px; height: 36px; min-width: 36px;">${dayNum}</div>
                    <div>
                        <div class="small text-muted d-flex align-items-center gap-1">
                            <i class="bi bi-clock"></i> ${startStr} - ${endStr}
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <div class="text-end">
                        <span class="fw-bold text-success d-block">${day.earned} zł</span>
                        <span class="small text-muted fw-semibold">${day.billableHours} h</span>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-primary rounded-circle p-1 d-inline-flex align-items-center justify-content-center btn-edit" data-index="${day.originalIndex}" style="width: 32px; height: 32px;" title="Edytuj">
                            <i class="bi bi-pencil-fill" style="font-size: 12px;"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger rounded-circle p-1 d-inline-flex align-items-center justify-content-center btn-delete" data-index="${day.originalIndex}" style="width: 32px; height: 32px;" title="Usuń">
                            <i class="bi bi-trash3-fill" style="font-size: 12px;"></i>
                        </button>
                    </div>
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
        fragment.appendChild(monthCard);
    });
    reportsContainer.appendChild(fragment);
}

async function addNewSession() {
    const result = await showSessionModal({
        title: 'Nowy dzień pracy',
        subtitle: 'Wprowadź godziny i sprawdź wyliczenie',
        isEdit: false
    });

    if (!result) return;

    Storage.addSession({
        start: result.startDate.getTime(),
        end: result.endDate.getTime(),
        durationMs: result.durationMs,
        billableHours: result.billableHours,
        earned: result.earned
    });

    renderReports();
    await showSuccessModal({
        title: 'Dodano wpis',
        message: 'Pomyślnie dodano nowy dzień pracy do historii.',
        hours: `${result.billableHours} h`,
        earned: `${result.earned} zł`,
        buttonText: 'Gotowe'
    });
}

async function deleteSession(index) {
    const sessions = Storage.getSessions();
    const session = sessions[index];
    if (!session) return;

    const startDate = new Date(session.start);
    const endDate = new Date(session.end);
    const dateFormatted = startDate.toLocaleDateString('pl-PL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const capitalizedDate = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
    const timeFormatted = `${startDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
    const billableHours = session.billableHours != null ? parseFloat(session.billableHours) : getBillableHours(session.durationMs ?? session.duration, session.isSaturday);
    const earned = session.earned != null ? Number(session.earned).toFixed(2) : '0.00';

    const detailsHtml = `
        <div class="delete-item-preview p-3 rounded-4 mb-3">
            <div class="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom border-danger-subtle">
                <span class="fw-bold text-danger d-flex align-items-center gap-2">
                    <i class="bi bi-calendar-event"></i> ${capitalizedDate}
                </span>
                ${session.isSaturday ? '<span class="badge bg-warning text-dark"><i class="bi bi-calendar2-week me-1"></i> Sobota</span>' : ''}
            </div>
            <div class="row g-2 text-center">
                <div class="col-6">
                    <div class="p-2 rounded-3 bg-body-tertiary">
                        <span class="small text-muted d-block fw-semibold">Godziny</span>
                        <strong class="text-body">${timeFormatted}</strong>
                        <div class="small text-primary fw-bold">${billableHours} h</div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="p-2 rounded-3 bg-body-tertiary">
                        <span class="small text-muted d-block fw-semibold">Zarobek</span>
                        <strong class="text-success fs-5 fw-bolder">${earned} zł</strong>
                    </div>
                </div>
            </div>
        </div>
        <div class="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 rounded-3 mb-0 small border-0">
            <i class="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0 text-danger"></i>
            <span>Czy na pewno chcesz usunąć ten dzień z historii pracy? Tej operacji nie można cofnąć.</span>
        </div>
    `;

    const isConfirmed = await showDeleteConfirmModal({
        title: 'Usuń wpis',
        subtitle: 'Tej operacji nie można cofnąć',
        detailsHtml,
        confirmBtnText: 'Usuń wpis'
    });

    if (isConfirmed) {
        sessions.splice(index, 1); 
        Storage.setSessions(sessions);
        renderReports();
    }
}

async function editSession(index) {
    const sessions = Storage.getSessions();
    const session = sessions[index];

    const currentStart = new Date(session.start);
    const currentEnd = new Date(session.end);
    const dateStr = `${currentStart.getFullYear()}-${String(currentStart.getMonth() + 1).padStart(2, '0')}-${String(currentStart.getDate()).padStart(2, '0')}`;
    const startStr = currentStart.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const endStr = currentEnd.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

    const result = await showSessionModal({
        title: 'Edytuj wpis pracy',
        subtitle: 'Zmień godziny lub popraw zarobek',
        defaultDate: dateStr,
        defaultStart: startStr,
        defaultEnd: endStr,
        defaultEarned: session.earned,
        isEdit: true
    });

    if (!result) return;

    sessions[index] = {
        ...session,
        start: result.startDate.getTime(),
        end: result.endDate.getTime(),
        durationMs: result.durationMs,
        billableHours: result.billableHours,
        earned: result.earned
    };
    Storage.setSessions(sessions);

    renderReports();
    
    await showSuccessModal({
        title: 'Zaktualizowano wpis',
        message: 'Pomyślnie zaktualizowano godziny i wynagrodzenie.',
        hours: `${result.billableHours} h`,
        earned: `${result.earned} zł`,
        buttonText: 'Gotowe'
    });
}