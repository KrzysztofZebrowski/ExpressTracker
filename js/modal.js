/**
 * ExpressTracker - Modern Bootstrap Modals Module
 * Fully resilient, async Promise-based modals for Alerts, Prompts, Confirms,
 * Tablet Checks, Month Selection, Work Sessions, and Success Celebrations.
 */

import { Storage } from './storage.js';

// Pobiera lub tworzy instancję modalu Bootstrap
function getModalInstance(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return null;
    return window.bootstrap?.Modal ? bootstrap.Modal.getOrCreateInstance(el, { backdrop: 'static', keyboard: true }) : null;
}

// Bezpieczne zamknięcie modalu z oczekiwaniem na zakończenie animacji Bootstrapa
function hideModalSafe(modalEl) {
    return new Promise((resolve) => {
        if (!modalEl || !modalEl.classList.contains('show')) {
            return resolve();
        }
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (!bsModal) {
            return resolve();
        }
        const onHidden = () => {
            modalEl.removeEventListener('hidden.bs.modal', onHidden);
            resolve();
        };
        modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
        bsModal.hide();
    });
}

/**
 * Wyświetla nowoczesne okno sukcesu / podsumowania (np. Dodano wpis, Trasa zakończona)
 * z animowaną odznaką hero, dwukolumnową kartą statystyk (godziny + kwota) i pełnowymiarowym przyciskiem.
 * @returns {Promise<void>}
 */
export function showSuccessModal({
    title = 'Dodano wpis',
    message = 'Pomyślnie dodano nowy dzień pracy do historii.',
    hours = null,
    earned = null,
    buttonText = 'Gotowe'
} = {}) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('successModal');
        const titleEl = document.getElementById('successModalTitle');
        const messageEl = document.getElementById('successModalMessage');
        const statsCard = document.getElementById('successModalStatsCard');
        const hoursEl = document.getElementById('successModalHours');
        const earnedEl = document.getElementById('successModalEarned');
        const btnConfirm = document.getElementById('successModalBtnConfirm');
        const btnText = document.getElementById('successModalBtnText');
        const badgeEl = document.getElementById('successModalBadge');

        if (!modalEl) {
            alert(`${title}\n${message}`);
            return resolve();
        }

        titleEl.textContent = title;
        messageEl.innerHTML = message;
        if (btnText) btnText.textContent = buttonText;

        // Jeśli przekazano statystyki godzin lub zarobku, wyświetlamy elegancką kartę podsumowania
        if (hours || earned) {
            statsCard.classList.remove('d-none');
            const hoursCol = hoursEl ? hoursEl.closest('.col-6, .col-12') : null;
            const earnedCol = earnedEl ? earnedEl.closest('.col-6, .col-12') : null;

            if (hours && earned) {
                if (hoursCol) { hoursCol.className = 'col-6'; hoursCol.classList.remove('d-none'); }
                if (earnedCol) { earnedCol.className = 'col-6'; earnedCol.classList.remove('d-none'); }
                if (hoursEl) hoursEl.textContent = hours;
                if (earnedEl) earnedEl.textContent = earned;
            } else if (hours) {
                if (hoursCol) { hoursCol.className = 'col-12'; hoursCol.classList.remove('d-none'); }
                if (earnedCol) { earnedCol.classList.add('d-none'); }
                if (hoursEl) hoursEl.textContent = hours;
            } else if (earned) {
                if (earnedCol) { earnedCol.className = 'col-12'; earnedCol.classList.remove('d-none'); }
                if (hoursCol) { hoursCol.classList.add('d-none'); }
                if (earnedEl) earnedEl.textContent = earned;
            }
        } else {
            statsCard.classList.add('d-none');
        }

        // Restart animacji ikony sukcesu
        if (badgeEl) {
            badgeEl.style.animation = 'none';
            void badgeEl.offsetWidth; // trigger reflow
            badgeEl.style.animation = '';
        }

        const bsModal = getModalInstance('successModal');
        let resolved = false;

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(resolve);
        };

        const handleHidden = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            resolve();
        };

        btnConfirm.addEventListener('click', handleConfirm);
        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

        if (bsModal) {
            bsModal.show();
        } else {
            resolve();
        }
    });
}

/**
 * Wyświetla okienko informacyjne (Alert)
 * Automatycznie kieruje do nowoczesnego showSuccessModal dla komunikatów sukcesu
 * @param {string} title Tytuł modalu
 * @param {string} message Treść komunikatu
 * @param {string} buttonText Tekst przycisku
 * @returns {Promise<void>}
 */
export function showAlert(title, message, buttonText = 'Zatwierdź') {
    if (message === undefined) {
        message = title;
        title = 'Informacja';
    }

    const lowerTitle = (title || '').toLowerCase();
    const strMessage = String(message || '');

    // Jeśli to potwierdzenie dodania wpisu, zakończenia trasy lub aktualizacji - użyj nowoczesnego Hero Success Modal!
    if (lowerTitle.includes('dodano wpis') || lowerTitle.includes('trasa zakończona') || lowerTitle.includes('zaktualizowano')) {
        const hoursMatch = strMessage.match(/(?:godziny|czas)[\s\S]*?<b[^>]*>(.*?)<\/b>/i) || strMessage.match(/(\d+(?:\.\d+)?\s*h)/i);
        const earnedMatch = strMessage.match(/(?:zarobek|wynagrodzenie)[\s\S]*?<b[^>]*>(.*?)<\/b>/i) || strMessage.match(/(\d+(?:\.\d+)?\s*zł)/i);

        return showSuccessModal({
            title,
            message: lowerTitle.includes('dodano') ? 'Pomyślnie dodano nowy dzień pracy do historii.' : 
                     lowerTitle.includes('zaktualizowano') ? 'Pomyślnie zaktualizowano godziny i wynagrodzenie.' : 
                     'Sesja pracy została pomyślnie zakończona i zapisana.',
            hours: hoursMatch ? hoursMatch[1] : null,
            earned: earnedMatch ? earnedMatch[1] : null,
            buttonText: 'Gotowe'
        });
    }

    return new Promise((resolve) => {
        const modalEl = document.getElementById('appModal');
        const titleEl = document.getElementById('appModalLabel');
        const subtitleEl = document.getElementById('appModalSubtitle');
        const messageEl = document.getElementById('appModalMessage');
        const inputWrap = document.getElementById('appModalInputWrapper');
        const btnCancel = document.getElementById('appModalBtnCancel');
        const btnConfirm = document.getElementById('appModalBtnConfirm');
        const iconBadge = document.getElementById('appModalIcon');

        if (!modalEl) {
            alert(message);
            return resolve();
        }

        titleEl.innerHTML = title;
        if (subtitleEl) subtitleEl.textContent = 'Powiadomienie systemu';
        messageEl.innerHTML = message;
        messageEl.classList.remove('d-none');
        inputWrap.classList.add('d-none');
        btnCancel.classList.add('d-none');
        btnConfirm.innerHTML = `<i class="bi bi-check-lg me-1"></i> ${buttonText}`;
        btnConfirm.className = 'btn btn-primary rounded-pill px-4 flex-grow-1 shadow-sm';

        if (lowerTitle.includes('błąd') || lowerTitle.includes('uwaga')) {
            iconBadge.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-danger fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-danger-subtle text-danger';
        } else if (lowerTitle.includes('sukces') || lowerTitle.includes('dodano') || lowerTitle.includes('zakończona') || lowerTitle.includes('zaktualizowano')) {
            iconBadge.innerHTML = '<i class="bi bi-check-circle-fill text-success fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-success-subtle text-success';
        } else if (lowerTitle.includes('stawka')) {
            iconBadge.innerHTML = '<i class="bi bi-cash-coin text-warning fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-warning-subtle text-warning';
        } else {
            iconBadge.innerHTML = '<i class="bi bi-info-circle-fill text-primary fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-primary-subtle text-primary';
        }

        const bsModal = getModalInstance('appModal');
        let resolved = false;

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(resolve);
        };

        const handleHidden = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            resolve();
        };

        btnConfirm.addEventListener('click', handleConfirm);
        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

        if (bsModal) {
            if (!modalEl.classList.contains('show')) {
                bsModal.show();
            }
        } else {
            resolve();
        }
    });
}

/**
 * Wyświetla okienko do wprowadzania danych (Prompt)
 * @param {string} title Tytuł modalu
 * @param {string} defaultValue Wartość domyślna
 * @param {string} inputType Typ pola (text, time, date, tel)
 * @returns {Promise<string|null>}
 */
export function showPrompt(title, defaultValue = '', inputType = 'text') {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('appModal');
        const titleEl = document.getElementById('appModalLabel');
        const subtitleEl = document.getElementById('appModalSubtitle');
        const messageEl = document.getElementById('appModalMessage');
        const inputWrap = document.getElementById('appModalInputWrapper');
        const inputLabel = document.getElementById('appModalInputLabel');
        const inputEl = document.getElementById('appModalInput');
        const btnCancel = document.getElementById('appModalBtnCancel');
        const btnConfirm = document.getElementById('appModalBtnConfirm');
        const iconBadge = document.getElementById('appModalIcon');

        if (!modalEl) {
            const val = prompt(title, defaultValue);
            return resolve(val);
        }

        titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = 'Wprowadź dane i zatwierdź';
        messageEl.classList.add('d-none');
        inputWrap.classList.remove('d-none');
        btnCancel.classList.remove('d-none');
        btnCancel.innerHTML = '<i class="bi bi-x-lg me-1"></i> Anuluj';
        btnConfirm.innerHTML = '<i class="bi bi-check-lg me-1"></i> Zatwierdź';
        btnConfirm.className = 'btn btn-primary rounded-pill px-4 flex-grow-1 shadow-sm';

        if (inputLabel) {
            inputLabel.classList.add('d-none');
        }

        if (inputType === 'time') {
            iconBadge.innerHTML = '<i class="bi bi-clock-history text-primary fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-primary-subtle text-primary';
            inputEl.placeholder = 'HH:MM';
        } else if (inputType === 'date') {
            iconBadge.innerHTML = '<i class="bi bi-calendar3 text-primary fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-primary-subtle text-primary';
            inputEl.placeholder = 'RRRR-MM-DD';
        } else if (inputType === 'tel' || inputType === 'number') {
            iconBadge.innerHTML = '<i class="bi bi-cash-coin text-warning fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-warning-subtle text-warning';
            inputEl.placeholder = '0.00';
        } else {
            iconBadge.innerHTML = '<i class="bi bi-pencil-square text-primary fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-primary-subtle text-primary';
            inputEl.placeholder = 'Wprowadź wartość';
        }

        inputEl.type = inputType;
        inputEl.value = defaultValue;

        const bsModal = getModalInstance('appModal');
        let resolved = false;

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
            inputEl.removeEventListener('keydown', handleKeydown);
            modalEl.removeEventListener('shown.bs.modal', handleShown);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;
            resolved = true;
            const val = inputEl.value;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(val));
        };

        const handleCancel = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(null));
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        };

        const handleShown = () => {
            inputEl.focus();
            if (inputType === 'text' || inputType === 'tel') {
                inputEl.select();
            }
        };

        const handleHidden = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(null);
            }
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
        inputEl.addEventListener('keydown', handleKeydown);

        if (modalEl.classList.contains('show')) {
            setTimeout(handleShown, 60);
        } else {
            modalEl.addEventListener('shown.bs.modal', handleShown, { once: true });
            if (bsModal) bsModal.show();
        }

        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });
    });
}

/**
 * Wyświetla nowoczesne okienko potwierdzenia usunięcia (Danger Confirm)
 * z dedykowanym czerwonym akcentem, podglądem usuwanego elementu i ostrzeżeniem.
 * @param {Object} options
 * @param {string} options.title Tytuł okna (np. "Usuń wpis")
 * @param {string} options.subtitle Podtytuł (np. "Tej operacji nie można cofnąć")
 * @param {string} options.detailsHtml Zawartość HTML z podglądem usuwanych danych
 * @param {string} options.confirmBtnText Tekst przycisku potwierdzenia
 * @param {string} options.iconClass Klasa ikony Bootstrap Icons
 * @returns {Promise<boolean>}
 */
export function showDeleteConfirmModal({
    title = 'Usuń wpis',
    subtitle = 'Tej operacji nie można cofnąć',
    detailsHtml = '',
    confirmBtnText = 'Usuń',
    iconClass = 'bi-trash3-fill'
} = {}) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('deleteConfirmModal');
        const titleEl = document.getElementById('deleteConfirmModalLabel');
        const subtitleEl = document.getElementById('deleteConfirmModalSubtitle');
        const detailsEl = document.getElementById('deleteConfirmModalDetails');
        const btnCancel = document.getElementById('deleteConfirmModalBtnCancel');
        const btnConfirm = document.getElementById('deleteConfirmModalBtnConfirm');
        const btnText = document.getElementById('deleteConfirmModalBtnText');
        const iconEl = document.getElementById('deleteConfirmModalIcon');

        if (!modalEl) {
            const fallback = confirm(`${title}\n\n${subtitle}`);
            return resolve(fallback);
        }

        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = subtitle;
        if (detailsEl) detailsEl.innerHTML = detailsHtml;
        if (btnText) btnText.textContent = confirmBtnText;
        if (iconEl && iconClass) {
            iconEl.className = `bi ${iconClass} fs-4`;
        }

        const bsModal = getModalInstance('deleteConfirmModal');
        let resolved = false;

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(true));
        };

        const handleCancel = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(false));
        };

        const handleHidden = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(false);
            }
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

        if (bsModal) {
            bsModal.show();
        } else {
            resolve(false);
        }
    });
}

/**
 * Wyświetla nowoczesne okienko potwierdzenia importu danych
 * z podglądem zawartości pliku, statystykami i ostrzeżeniem.
 * @param {Object} options
 * @param {string} options.title Tytuł okna (np. "Import danych")
 * @param {string} options.subtitle Podtytuł
 * @param {string} options.detailsHtml Zawartość HTML z podglądem danych pliku
 * @param {string} options.confirmBtnText Tekst przycisku potwierdzenia
 * @param {string} options.iconClass Klasa ikony Bootstrap Icons
 * @returns {Promise<boolean>}
 */
export function showImportConfirmModal({
    title = 'Import danych z pliku',
    subtitle = 'Weryfikacja zawartości kopii zapasowej',
    detailsHtml = '',
    confirmBtnText = 'Zaimportuj dane',
    iconClass = 'bi-cloud-arrow-up-fill'
} = {}) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('importConfirmModal');
        const titleEl = document.getElementById('importConfirmModalLabel');
        const subtitleEl = document.getElementById('importConfirmModalSubtitle');
        const detailsEl = document.getElementById('importConfirmModalDetails');
        const btnCancel = document.getElementById('importConfirmModalBtnCancel');
        const btnConfirm = document.getElementById('importConfirmModalBtnConfirm');
        const btnText = document.getElementById('importConfirmModalBtnText');
        const iconEl = document.getElementById('importConfirmModalIcon');

        if (!modalEl) {
            const fallback = confirm(`${title}\n\n${subtitle}`);
            return resolve(fallback);
        }

        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = subtitle;
        if (detailsEl) detailsEl.innerHTML = detailsHtml;
        if (btnText) btnText.textContent = confirmBtnText;
        if (iconEl && iconClass) {
            iconEl.className = `bi ${iconClass} fs-4`;
        }

        const bsModal = getModalInstance('importConfirmModal');
        let resolved = false;

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(true));
        };

        const handleCancel = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(false));
        };

        const handleHidden = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(false);
            }
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

        if (bsModal) {
            bsModal.show();
        } else {
            resolve(false);
        }
    });
}

/**
 * Wyświetla okienko potwierdzenia (Confirm)
 * @param {string} title Tytuł okna
 * @param {string} message Treść zapytania
 * @param {string} confirmText Opcjonalny własny tekst przycisku potwierdzenia
 * @param {string} cancelText Opcjonalny własny tekst przycisku anulowania
 * @returns {Promise<boolean>}
 */
export function showConfirm(title, message, confirmText = null, cancelText = null) {
    const lowerTitle = (title || '').toLowerCase();
    if (lowerTitle.includes('usuń') || lowerTitle.includes('usunięcie')) {
        return showDeleteConfirmModal({
            title: title || 'Usuń',
            subtitle: 'Tej operacji nie można cofnąć',
            detailsHtml: `<div class="p-3 rounded-4 delete-item-preview text-body mb-0 fs-6">${(message || '').replace(/\n/g, '<br>')}</div>`,
            confirmBtnText: confirmText || 'Usuń'
        });
    }

    if (lowerTitle.includes('import') || lowerTitle.includes('przywróć')) {
        return showImportConfirmModal({
            title: title || 'Import danych',
            subtitle: 'Weryfikacja zawartości kopii zapasowej',
            detailsHtml: `<div class="p-3 rounded-4 import-item-preview text-body mb-0 fs-6">${(message || '').replace(/\n/g, '<br>')}</div>`,
            confirmBtnText: confirmText || 'Zatwierdź'
        });
    }

    return new Promise((resolve) => {
        const modalEl = document.getElementById('appModal');
        const titleEl = document.getElementById('appModalLabel');
        const subtitleEl = document.getElementById('appModalSubtitle');
        const messageEl = document.getElementById('appModalMessage');
        const inputWrap = document.getElementById('appModalInputWrapper');
        const btnCancel = document.getElementById('appModalBtnCancel');
        const btnConfirm = document.getElementById('appModalBtnConfirm');
        const iconBadge = document.getElementById('appModalIcon');

        if (!modalEl) {
            const res = confirm(`${title}\n\n${message}`);
            return resolve(res);
        }

        titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = 'Potwierdzenie operacji';
        messageEl.innerHTML = (message || '').replace(/\n/g, '<br>');
        messageEl.classList.remove('d-none');
        inputWrap.classList.add('d-none');
        btnCancel.classList.remove('d-none');
        btnCancel.innerHTML = cancelText ? `<i class="bi bi-x-lg me-1"></i> ${cancelText}` : '<i class="bi bi-x-lg me-1"></i> Anuluj';
        btnConfirm.innerHTML = confirmText ? `<i class="bi bi-check-lg me-1"></i> ${confirmText}` : '<i class="bi bi-check-lg me-1"></i> Zatwierdź';

        if (lowerTitle.includes('próg') || lowerTitle.includes('progu') || lowerTitle.includes('wylogowan')) {
            btnCancel.className = 'btn btn-primary rounded-pill px-4 flex-grow-1 shadow-sm fw-bold';
            btnConfirm.className = 'btn btn-outline-danger rounded-pill px-3';
            btnCancel.innerHTML = cancelText ? `<i class="bi bi-play-circle-fill me-1"></i> ${cancelText}` : '<i class="bi bi-arrow-left me-1"></i> Kontynuuj pracę';
            btnConfirm.innerHTML = confirmText ? `<i class="bi bi-stop-circle me-1"></i> ${confirmText}` : '<i class="bi bi-check-lg me-1"></i> Zakończ mimo to';
            iconBadge.innerHTML = '<i class="bi bi-hourglass-split text-warning fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-warning-subtle text-warning';
        } else if (lowerTitle.includes('uwaga') || lowerTitle.includes('przerwano')) {
            btnCancel.className = 'btn btn-secondary rounded-pill px-4 flex-grow-1';
            btnConfirm.className = 'btn btn-warning text-dark rounded-pill px-4 flex-grow-1 shadow-sm';
            iconBadge.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-warning fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-warning-subtle text-warning';
        } else {
            btnCancel.className = 'btn btn-secondary rounded-pill px-4 flex-grow-1';
            btnConfirm.className = 'btn btn-primary rounded-pill px-4 flex-grow-1 shadow-sm';
            iconBadge.innerHTML = '<i class="bi bi-question-circle-fill text-primary fs-4"></i>';
            iconBadge.className = 'modal-icon-badge bg-primary-subtle text-primary';
        }

        const bsModal = getModalInstance('appModal');
        let resolved = false;

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(true));
        };

        const handleCancel = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(false));
        };

        const handleHidden = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(false);
            }
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

        if (bsModal) {
            if (!modalEl.classList.contains('show')) {
                bsModal.show();
            }
        } else {
            resolve(false);
        }
    });
}

/**
 * Zaawansowane, jednolite okno modalne do dodawania i edycji dnia pracy
 * Zawiera datę, godziny i kalkulację kwoty na żywo w jednym oknie!
 * @returns {Promise<{startDate: Date, endDate: Date, durationMs: number, billableHours: number, earned: string}|null>}
 */
export function showSessionModal({
    title = 'Nowy dzień pracy',
    subtitle = 'Wprowadź godziny i sprawdź wyliczenie',
    defaultDate = '',
    defaultStart = '08:00',
    defaultEnd = '16:00',
    defaultEarned = null,
    isEdit = false
} = {}) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('sessionModal');
        const titleEl = document.getElementById('sessionModalLabel');
        const subtitleEl = document.getElementById('sessionModalSubtitle');
        const iconEl = document.getElementById('sessionModalIcon');
        const iconBadge = document.getElementById('sessionModalIconBadge');
        const dateInput = document.getElementById('sessionModalDate');
        const startInput = document.getElementById('sessionModalStart');
        const endInput = document.getElementById('sessionModalEnd');
        const hoursDisplay = document.getElementById('sessionModalHoursDisplay');
        const earnedInput = document.getElementById('sessionModalEarnedInput');
        const satBadge = document.getElementById('sessionModalSatBadge');
        const btnConfirm = document.getElementById('sessionModalBtnConfirm');
        const btnConfirmText = document.getElementById('sessionModalBtnConfirmText');
        const btnCancel = document.getElementById('sessionModalBtnCancel');
        const btnToday = document.getElementById('btn-session-today');
        const btnYesterday = document.getElementById('btn-session-yesterday');

        if (!modalEl) {
            return resolve(null);
        }

        // Tytuły i ikony
        titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = subtitle;
        if (btnConfirmText) btnConfirmText.textContent = isEdit ? 'Zapisz zmiany' : 'Zapisz dzień';
        if (iconEl && iconBadge) {
            iconEl.className = isEdit ? 'bi bi-pencil-square fs-4' : 'bi bi-calendar-plus-fill fs-4';
        }

        // Domyślna data: dzisiaj jeśli brak
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        dateInput.value = defaultDate || todayStr;
        startInput.value = defaultStart || '08:00';
        endInput.value = defaultEnd || '16:00';

        // Śledzenie czy użytkownik ręcznie zmodyfikował kwotę
        let isUserEarnedCustom = defaultEarned !== null;
        if (defaultEarned !== null) {
            earnedInput.value = parseFloat(defaultEarned).toFixed(2);
        }

        // Funkcja kalkulacji godzin wg zasad ExpressTracker
        function getBillable(ms, isSaturday) {
            const totalSec = Math.floor(ms / 1000);
            const fullH = Math.floor(totalSec / 3600);
            const remSec = totalSec % 3600;
            let extra = 0;
            if (remSec >= 2700) extra = 1;
            else if (remSec >= 900) extra = 0.5;
            const calc = fullH + extra;
            if (isSaturday) return calc;
            return Math.max(8, calc);
        }

        // Przeliczenie na żywo
        function recalculate() {
            const dateVal = dateInput.value;
            const startVal = startInput.value;
            const endVal = endInput.value;

            if (!dateVal || !startVal || !endVal) return;

            const startObj = new Date(`${dateVal}T${startVal}:00`);
            const endObj = new Date(`${dateVal}T${endVal}:00`);
            const isSaturday = startObj.getDay() === 6;

            if (satBadge) {
                satBadge.classList.toggle('d-none', !isSaturday);
            }

            if (endObj.getTime() <= startObj.getTime()) {
                if (hoursDisplay) hoursDisplay.innerHTML = '<span class="text-danger small">Błąd: Koniec < Start</span>';
                return;
            }

            const durationMs = endObj.getTime() - startObj.getTime();
            const billableHours = getBillable(durationMs, isSaturday);

            if (hoursDisplay) {
                hoursDisplay.textContent = `${billableHours} h`;
            }

            // Automatyczne wyliczenie kwoty jeśli użytkownik sam jej nie nadpisał
            if (!isUserEarnedCustom) {
                const settings = Storage.getSettings();
                const autoEarned = isSaturday
                    ? parseFloat(settings.saturdayRate || 396).toFixed(2)
                    : (billableHours * parseFloat(settings.hourlyRate || 34)).toFixed(2);
                earnedInput.value = autoEarned;
            }
        }

        // Nasłuchiwanie zmian w polach
        const onInputChange = () => recalculate();
        dateInput.addEventListener('input', onInputChange);
        startInput.addEventListener('input', onInputChange);
        endInput.addEventListener('input', onInputChange);

        earnedInput.addEventListener('input', () => {
            isUserEarnedCustom = true;
        });

        // Przyciski szybkiej daty
        const onTodayClick = () => {
            dateInput.value = todayStr;
            recalculate();
        };
        const onYesterdayClick = () => {
            const yDate = new Date(Date.now() - 86400000);
            dateInput.value = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, '0')}-${String(yDate.getDate()).padStart(2, '0')}`;
            recalculate();
        };

        if (btnToday) btnToday.addEventListener('click', onTodayClick);
        if (btnYesterday) btnYesterday.addEventListener('click', onYesterdayClick);

        recalculate();

        const bsModal = getModalInstance('sessionModal');
        let resolved = false;

        const cleanup = () => {
            dateInput.removeEventListener('input', onInputChange);
            startInput.removeEventListener('input', onInputChange);
            endInput.removeEventListener('input', onInputChange);
            if (btnToday) btnToday.removeEventListener('click', onTodayClick);
            if (btnYesterday) btnYesterday.removeEventListener('click', onYesterdayClick);
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;

            const dateVal = dateInput.value;
            const startVal = startInput.value;
            const endVal = endInput.value;

            if (!dateVal || !startVal || !endVal) {
                alert('Wszystkie pola są wymagane!');
                return;
            }

            const startObj = new Date(`${dateVal}T${startVal}:00`);
            const endObj = new Date(`${dateVal}T${endVal}:00`);

            if (endObj.getTime() <= startObj.getTime()) {
                alert('Czas zakończenia nie może być wcześniejszy lub równy czasowi rozpoczęcia!');
                return;
            }

            const cleanEarned = String(earnedInput.value).replace(/[^\d.,]/g, '').replace(',', '.');
            const finalEarnedNum = parseFloat(cleanEarned);
            if (isNaN(finalEarnedNum) || finalEarnedNum < 0) {
                alert('Wprowadź poprawną kwotę zarobku!');
                return;
            }

            const isSaturday = startObj.getDay() === 6;
            const durationMs = endObj.getTime() - startObj.getTime();
            const billableHours = getBillable(durationMs, isSaturday);
            const finalEarned = finalEarnedNum.toFixed(2);

            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => {
                resolve({
                    startDate: startObj,
                    endDate: endObj,
                    dateStr: dateVal,
                    startStr: startVal,
                    endStr: endVal,
                    durationMs,
                    billableHours,
                    earned: finalEarned
                });
            });
        };

        const handleCancel = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(null));
        };

        const handleHidden = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(null);
            }
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

        if (bsModal) {
            bsModal.show();
        } else {
            resolve(null);
        }
    });
}

/**
 * Dedykowane okienko do ręcznego sprawdzania dni z tabletem
 * @returns {Promise<string|null>}
 */
export function showManualCheckModal(title, messageHtml, defaultValue = '') {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('manualCheckModal');
        const titleEl = document.getElementById('manualCheckModalLabel');
        const messageEl = document.getElementById('manualCheckMessage');
        const inputEl = document.getElementById('manualCheckInput');
        const btnCancel = document.getElementById('manualCheckBtnCancel');
        const btnConfirm = document.getElementById('manualCheckBtnConfirm');

        if (!modalEl) {
            const val = prompt(title, defaultValue);
            return resolve(val);
        }

        titleEl.textContent = title;
        messageEl.innerHTML = messageHtml;
        inputEl.value = defaultValue;

        titleEl.classList.remove('title-pulsed');
        btnConfirm.classList.remove('btn-clicked');

        const bsModal = getModalInstance('manualCheckModal');
        let resolved = false;

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
            inputEl.removeEventListener('keydown', handleKeydown);
            modalEl.removeEventListener('shown.bs.modal', handleShown);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;
            resolved = true;

            btnConfirm.classList.add('btn-clicked');
            titleEl.classList.add('title-pulsed');

            const val = inputEl.value;
            cleanup();
            resolve(val);
        };

        const handleCancel = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(null));
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        };

        const handleShown = () => {
            inputEl.focus();
            inputEl.select();
        };

        const handleHidden = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(null);
            }
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
        inputEl.addEventListener('keydown', handleKeydown);

        if (modalEl.classList.contains('show')) {
            setTimeout(handleShown, 50);
        } else {
            modalEl.addEventListener('shown.bs.modal', handleShown, { once: true });
            if (bsModal) bsModal.show();
        }

        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });
    });
}

/**
 * Zamknięcie okna manual check (po zakończeniu sekwencji sprawdzania)
 */
export function hideManualCheckModal() {
    const modalEl = document.getElementById('manualCheckModal');
    if (modalEl && modalEl.classList.contains('show')) {
        const bsModal = getModalInstance('manualCheckModal');
        if (bsModal) bsModal.hide();
    }
}

/**
 * Wyświetla Bootstrap modal z listą miesięcy do wyboru
 * @param {string[]} monthsArray Tablica miesięcy ['2026-10', '2026-09']
 * @returns {Promise<string|null>}
 */
export function showMonthSelector(monthsArray) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('monthSelectModal');
        const selectEl = document.getElementById('monthSelectInput');
        const btnCancel = document.getElementById('monthSelectBtnCancel');
        const btnConfirm = document.getElementById('monthSelectBtnConfirm');

        if (!modalEl || !selectEl) {
            return resolve(monthsArray[0] || null);
        }

        selectEl.innerHTML = monthsArray.map(m => {
            const [year, month] = m.split('-');
            const d = new Date(year, parseInt(month) - 1, 1);
            let monthName = d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
            monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            return `<option value="${m}">${monthName}</option>`;
        }).join('');

        const bsModal = getModalInstance('monthSelectModal');
        let resolved = false;

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleConfirm = () => {
            if (resolved) return;
            resolved = true;
            const chosen = selectEl.value;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(chosen));
        };

        const handleCancel = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            hideModalSafe(modalEl).then(() => resolve(null));
        };

        const handleHidden = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(null);
            }
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
        modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

        if (bsModal) {
            bsModal.show();
        } else {
            resolve(null);
        }
    });
}