// Otwiera proste okienko informacyjne (tylko przycisk Zatwierdź)
export function showAlert(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const inputEl = document.getElementById('modal-input');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');

        // 1. Ustawienie treści
        titleEl.innerHTML = title;
        messageEl.innerHTML = message;

        // 2. Widoczność elementów
        messageEl.classList.remove('hidden');
        inputEl.classList.add('hidden');
        btnCancel.classList.add('hidden');

        // 3. Pokaż okienko
        overlay.classList.remove('hidden');

        // 4. Obsługa kliknięcia
        const handleConfirm = () => {
            overlay.classList.add('hidden');
            btnConfirm.removeEventListener('click', handleConfirm);
            resolve();
        };

        btnConfirm.addEventListener('click', handleConfirm);
    });
}

// Otwiera okienko do wprowadzania danych (z polem tekstowym i dwoma przyciskami)
export function showPrompt(title, defaultValue = '', inputType = 'text') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const inputEl = document.getElementById('modal-input');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');

        // 1. Ustawienie treści
        titleEl.textContent = title;
        inputEl.type = inputType;
        inputEl.value = defaultValue;

        // 2. Widoczność elementów 
        messageEl.classList.add('hidden');
        inputEl.classList.remove('hidden');
        btnCancel.classList.remove('hidden'); 

        // 3. Pokaż okienko
        overlay.classList.remove('hidden');

        // Automatyczne ustawienie kursora w polu (z drobnym opóźnieniem)
        setTimeout(() => inputEl.focus(), 100);

        // 4. Obsługa kliknięć
        const cleanup = () => {
            overlay.classList.add('hidden');
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
        };

        const handleConfirm = () => {
            cleanup();
            resolve(inputEl.value);
        };

        const handleCancel = () => {
            cleanup();
            resolve(null); // Użytkownik zrezygnował
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
    });
}

// Otwiera okienko z pytaniem 
export function showConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const inputEl = document.getElementById('modal-input');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');

        // 1. Ustawienie treści
        titleEl.textContent = title;
        messageEl.innerHTML = message;

        // 2. Widoczność elementów
        messageEl.classList.remove('hidden');
        inputEl.classList.add('hidden');
        btnCancel.classList.remove('hidden');

        // 3. Pokaż okienko
        overlay.classList.remove('hidden');

        // 4. Obsługa kliknięć
        const cleanup = () => {
            overlay.classList.add('hidden');
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
        };

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
    });
}

export function showManualCheckModal(title, messageHtml, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('manual-check-modal-overlay');
        const modalBox = document.getElementById('manual-check-modal-box');
        const titleEl = document.getElementById('manual-check-title');
        const messageEl = document.getElementById('manual-check-message');
        const inputEl = document.getElementById('manual-check-input');
        const btnConfirm = document.getElementById('manual-check-btn-confirm');
        const btnCancel = document.getElementById('manual-check-btn-cancel');

        // 1. Ustawienie treści
        titleEl.textContent = title;
        messageEl.innerHTML = messageHtml;
        inputEl.value = defaultValue;

        // 2. Pokazujemy overlay bez animacji okna
        overlay.classList.remove('hidden');
        modalBox.style.animation = 'none'; 
        
        btnConfirm.classList.remove('btn-clicked');
        titleEl.classList.remove('title-pulsed');

        // Automatyczne ustawienie kursora
        setTimeout(() => inputEl.focus(), 100);

        // 3. Obsługa zatwierdzenia
        const handleConfirm = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);

            btnConfirm.classList.add('btn-clicked');
            titleEl.classList.add('title-pulsed');
            
            setTimeout(() => {
                overlay.classList.add('hidden');
                resolve(inputEl.value);
            }, 200); 
        };

        // 4. Obsługa przerwania (anulowanie)
        const handleCancel = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);

            overlay.classList.add('hidden');
            resolve(null);
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
    });
}