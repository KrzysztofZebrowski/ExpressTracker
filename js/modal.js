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