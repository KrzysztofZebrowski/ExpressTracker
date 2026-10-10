/**
 * ExpressTracker - Zebra TC27 QR Code Quick Login Module
 * Generuje lokalnie kody QR szybkiego logowania dla skanerów magazynowych (Zebra TC27).
 * Format: ${selectedLogin}\t${password}\r\n
 * (Login -> Sprzętowy TAB 0x09 -> Hasło/PIN -> Sprzętowy CRLF 0x0D 0x0A)
 */

import { qrcode } from './qrcode.js';

// Predefiniowana lista tras i przypisanych loginów w systemie
export const ZEBRA_ROUTES = [
    { route: 'Z1', login: '6306346' },
    { route: 'Z2', login: '6306347' },
    { route: 'Z3', login: '6306348' },
    { route: 'Z4', login: '6306349' },
    { route: 'Z5', login: '6306350' },
    { route: 'Z6', login: '6306325' },
    { route: 'Z7', login: '6306394' },
    { route: 'Z8', login: '6306395' },
    { route: 'Z9', login: '6306396' }
];

const STORAGE_KEY_LAST_LOGIN = 'wt_zebra_last_login';
const STORAGE_KEY_LAST_ROUTE = 'wt_zebra_last_route';
const STORAGE_KEY_LAST_PIN = 'wt_zebra_last_pin';

export function initZebra() {
    const selectLogin = document.getElementById('zebraLoginSelect');
    const pinInput = document.getElementById('zebraPinInput');
    const pinCounter = document.getElementById('zebraPinCounter');
    const qrContainer = document.getElementById('zebraQrContainer');
    const qrPayloadPreview = document.getElementById('zebraQrPayloadPreview');
    const qrPayloadInfo = document.getElementById('zebraQrPayloadInfo');
    const validationFeedback = document.getElementById('zebraPinValidationFeedback');

    const zebraModalEl = document.getElementById('zebraLoginModal');
    const dataWedgeModalEl = document.getElementById('dataWedgeModal');
    const btnOpenDataWedge = document.getElementById('btn-open-datawedge-instruction');
    const btnBackToQr = document.getElementById('btn-back-to-qr');

    if (!selectLogin || !pinInput || !qrContainer) {
        return;
    }

    // 1. Inicjalizacja listy wyboru tras / loginów
    populateLoginSelect(selectLogin);

    // 2. Przywrócenie ostatnio wybranego loginu oraz hasła (PIN) z pamięci lokalnej
    const savedLogin = localStorage.getItem(STORAGE_KEY_LAST_LOGIN);
    const savedPin = localStorage.getItem(STORAGE_KEY_LAST_PIN);

    if (savedLogin) {
        const exists = Array.from(selectLogin.options).some(opt => opt.value === savedLogin);
        if (exists) {
            selectLogin.value = savedLogin;
        }
    }

    if (savedPin) {
        const sanitizedPin = savedPin.replace(/\D/g, '').slice(0, 8);
        pinInput.value = sanitizedPin;
    }

    // 3. Obsługa zmiany wyboru w dropdownie
    selectLogin.addEventListener('change', () => {
        saveSelectedLogin(selectLogin.value, 'preset');
        updateQrCodeLive();
    });

    // 4. Ograniczenie PIN wyłącznie do dokładnie 8 cyfr oraz automatyczny zapis w pamięci
    pinInput.addEventListener('input', () => {
        const sanitized = pinInput.value.replace(/\D/g, '').slice(0, 8);
        if (pinInput.value !== sanitized) {
            pinInput.value = sanitized;
        }
        saveSelectedPin(sanitized);
        updateQrCodeLive();

        // Automatyczne zamykanie klawiatury ekranowej po wpisaniu 8 cyfry hasła
        if (sanitized.length === 8) {
            pinInput.blur();
        }
    });

    pinInput.addEventListener('keydown', (e) => {
        // Zezwól na klawisze nawigacyjne: Backspace, Delete, Tab, Strzałki, Enter
        if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
            return;
        }
        // Zezwól na Ctrl/Cmd + C, V, A, X
        if (e.ctrlKey || e.metaKey) {
            return;
        }
        // Zablokuj wszystko poza cyframi 0-9
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            return;
        }
        // Zablokuj dopisanie ponad 8 cyfr
        if (pinInput.value.length >= 8 && pinInput.selectionStart === pinInput.selectionEnd) {
            e.preventDefault();
        }
    });

    pinInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const digitsOnly = text.replace(/\D/g, '');
        const start = pinInput.selectionStart;
        const end = pinInput.selectionEnd;
        const current = pinInput.value;
        const next = (current.slice(0, start) + digitsOnly + current.slice(end)).slice(0, 8);
        pinInput.value = next;
        pinInput.selectionStart = pinInput.selectionEnd = Math.min(8, start + digitsOnly.length);
        saveSelectedPin(next);
        updateQrCodeLive();

        // Automatyczne zamykanie klawiatury ekranowej po wklejeniu pełnego hasła
        if (next.length === 8) {
            pinInput.blur();
        }
    });

    // 5. Nawigacja między modalem QR a instrukcją DataWedge
    if (btnOpenDataWedge && zebraModalEl && dataWedgeModalEl) {
        btnOpenDataWedge.addEventListener('click', () => {
            const bsZebra = window.bootstrap?.Modal.getInstance(zebraModalEl);
            const bsDataWedge = window.bootstrap?.Modal.getOrCreateInstance(dataWedgeModalEl);

            if (bsZebra) {
                const onHidden = () => {
                    zebraModalEl.removeEventListener('hidden.bs.modal', onHidden);
                    if (bsDataWedge) bsDataWedge.show();
                };
                zebraModalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
                bsZebra.hide();
            } else if (bsDataWedge) {
                bsDataWedge.show();
            }
        });
    }

    if (btnBackToQr && zebraModalEl && dataWedgeModalEl) {
        btnBackToQr.addEventListener('click', () => {
            const bsDataWedge = window.bootstrap?.Modal.getInstance(dataWedgeModalEl);
            const bsZebra = window.bootstrap?.Modal.getOrCreateInstance(zebraModalEl);

            if (bsDataWedge) {
                const onHidden = () => {
                    dataWedgeModalEl.removeEventListener('hidden.bs.modal', onHidden);
                    if (bsZebra) bsZebra.show();
                };
                dataWedgeModalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
                bsDataWedge.hide();
            } else if (bsZebra) {
                bsZebra.show();
            }
        });
    }

    // 6. Odświeżenie podglądu oraz zabezpieczenie przed ostrzeżeniem aria-hidden
    if (zebraModalEl) {
        zebraModalEl.addEventListener('shown.bs.modal', () => {
            updateQrCodeLive();
        });

        zebraModalEl.addEventListener('hide.bs.modal', () => {
            if (zebraModalEl.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        });

        zebraModalEl.addEventListener('hidden.bs.modal', () => {
            const openBtn = document.getElementById('btn-open-zebra-modal');
            if (openBtn && !dataWedgeModalEl?.classList.contains('show')) {
                openBtn.focus();
            }
        });
    }

    if (dataWedgeModalEl) {
        dataWedgeModalEl.addEventListener('hide.bs.modal', () => {
            if (dataWedgeModalEl.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        });

        dataWedgeModalEl.addEventListener('hidden.bs.modal', () => {
            const openBtn = document.getElementById('btn-open-zebra-modal');
            if (openBtn && !zebraModalEl?.classList.contains('show')) {
                openBtn.focus();
            }
        });
    }

    // Pierwsze wyrenderowanie (stan początkowy lub odtworzenie zapisanego kodu QR)
    updateQrCodeLive();

    /**
     * Wypełnia pole wyboru trasami i loginami
     */
    function populateLoginSelect(selectEl) {
        selectEl.innerHTML = '';

        // Placeholder
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Wybierz trasę / login...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        selectEl.appendChild(defaultOption);

        // Predefiniowane trasy
        ZEBRA_ROUTES.forEach(({ route, login }) => {
            const opt = document.createElement('option');
            opt.value = login;
            opt.textContent = `${route} - ${login}`;
            selectEl.appendChild(opt);
        });
    }

    /**
     * Zapisuje wybrany login w pamięci podręcznej przeglądarki
     */
    function saveSelectedLogin(login, mode) {
        if (!login) return;
        localStorage.setItem(STORAGE_KEY_LAST_LOGIN, login);
        localStorage.setItem(STORAGE_KEY_LAST_ROUTE, mode);
    }

    /**
     * Zapisuje hasło (PIN) w pamięci podręcznej przeglądarki
     */
    function saveSelectedPin(pin) {
        if (pin) {
            localStorage.setItem(STORAGE_KEY_LAST_PIN, pin);
        } else {
            localStorage.removeItem(STORAGE_KEY_LAST_PIN);
        }
    }

    /**
     * Pobiera aktualnie wskazany login
     */
    function getSelectedLogin() {
        return selectLogin.value ? selectLogin.value.trim() : '';
    }

    /**
     * Wyświetla stan początkowy (przed wpisaniem PIN-u)
     */
    function renderInitialState() {
        qrContainer.innerHTML = `
            <div class="zebra-qr-empty-state d-flex flex-column align-items-center justify-content-center p-3 text-center">
                <div class="zebra-empty-icon-box mb-2">
                    <i class="bi bi-qr-code text-secondary fs-1"></i>
                </div>
                <strong class="text-body d-block mb-1">Podgląd kodu QR na żywo</strong>
                <p class="small text-secondary mb-0 lh-sm">
                    Wybierz trasę i wpisz hasło (dokładnie 8 cyfr), aby automatycznie wygenerować kod logowania dla terminala Zebra.
                </p>
            </div>
        `;
        if (qrPayloadInfo) qrPayloadInfo.classList.add('d-none');
    }

    /**
     * Waliduje dane i na bieżąco generuje kod QR
     * @param {boolean} forceFeedback Czy wymusić wyświetlenie błędów walidacji
     */
    function updateQrCodeLive(forceFeedback = false) {
        const login = getSelectedLogin();
        const pin = pinInput.value.trim();
        const ecLevel = 'Q'; // Domyślnie wysoki poziom korekcji błędów (25%)

        // Walidacja loginu
        const hasLogin = Boolean(login);

        // Walidacja PIN-u: dokładnie 8 cyfr
        const isPinDigitsOnly = /^\d+$/.test(pin);
        const isPinValidLength = pin.length === 8;
        const isPinValid = isPinDigitsOnly && isPinValidLength;

        // Aktualizacja licznika znaków
        if (pinCounter) {
            if (isPinValid) {
                pinCounter.className = 'badge bg-success text-white border border-success font-monospace';
                pinCounter.innerHTML = '8/8 cyfr <i class="bi bi-check-lg"></i>';
            } else {
                pinCounter.className = 'badge bg-secondary-subtle text-secondary border font-monospace';
                pinCounter.textContent = `${pin.length}/8 cyfr`;
            }
        }

        // Obsługa komunikatów walidacji
        if (validationFeedback) {
            if (pin.length > 0 && !isPinDigitsOnly) {
                validationFeedback.className = 'small text-danger mb-2';
                validationFeedback.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>Hasło może zawierać <b>wyłącznie cyfry</b>.';
                validationFeedback.classList.remove('d-none');
            } else if (pin.length > 0 && pin.length < 8) {
                validationFeedback.className = 'small text-warning-emphasis mb-2';
                validationFeedback.innerHTML = `<i class="bi bi-info-circle-fill me-1"></i>Wpisano <b>${pin.length}/8</b> cyfr — hasło musi mieć dokładnie <b>8 cyfr</b>.`;
                validationFeedback.classList.remove('d-none');
            } else if (forceFeedback && !hasLogin) {
                validationFeedback.className = 'small text-danger mb-2';
                validationFeedback.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i>Wybierz trasę / login z listy.';
                validationFeedback.classList.remove('d-none');
            } else if (forceFeedback && pin.length !== 8) {
                validationFeedback.className = 'small text-danger mb-2';
                validationFeedback.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i>Hasło (PIN) musi mieć <b>dokładnie 8 cyfr</b>.';
                validationFeedback.classList.remove('d-none');
            } else {
                validationFeedback.classList.add('d-none');
            }
        }

        // Jeśli brak loginu lub niepoprawny PIN -> stan oczekiwania
        if (!hasLogin || !isPinValid) {
            renderInitialState();
            return;
        }

        // Generowanie ciągu zakodowanego w kodzie QR
        // Sprzętowy TAB (0x09) oraz sprzętowy ENTER (0x0D 0x0A / CRLF) zatwierdzający logowanie
        const qrPayload = `${login}\t${pin}\r\n`;

        try {
            // qrcode(0, ecLevel): 0 oznacza auto-dobór wielkości typu QR
            const qr = qrcode(0, ecLevel);
            qr.addData(qrPayload, 'Byte');
            qr.make();

            // Obliczenie rozmiaru z zachowaniem quiet zone min. 4 moduły
            const moduleCount = qr.getModuleCount();
            const quietZoneModules = 4;
            const totalModules = moduleCount + (quietZoneModules * 2);

            // Docelowy rozmiar: min. 250x250 px (np. 264px - 280px)
            const targetMinPx = 264;
            const cellSize = Math.max(7, Math.floor(targetMinPx / totalModules));
            const margin = quietZoneModules * cellSize;
            const computedSize = (moduleCount * cellSize) + (margin * 2);

            const svgHtml = qr.createSvgTag({
                cellSize,
                margin,
                scalable: false,
                title: 'Kod logowania Zebra TC27'
            });

            qrContainer.innerHTML = `
                <div class="zebra-qr-code-rendered d-flex flex-column align-items-center">
                    <div class="zebra-qr-svg-wrapper shadow-sm rounded-3 p-2 bg-white mb-2" style="min-width: ${computedSize}px; min-height: ${computedSize}px;">
                        ${svgHtml}
                    </div>
                    <div class="d-flex align-items-center gap-2 small text-success fw-semibold mt-1">
                        <i class="bi bi-check-circle-fill"></i>
                        <span>Gotowy do zeskanowania (${computedSize}x${computedSize} px)</span>
                    </div>
                </div>
            `;

            if (qrPayloadInfo && qrPayloadPreview) {
                qrPayloadPreview.textContent = `${login} [TAB] ${pin} [ENTER]`;
                qrPayloadInfo.classList.remove('d-none');
            }

        } catch (error) {
            console.error('Błąd podczas generowania kodu QR:', error);
            qrContainer.innerHTML = `
                <div class="alert alert-danger p-3 rounded-3 small mb-0">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>
                    Błąd generowania kodu QR: ${error?.message || error}
                </div>
            `;
        }
    }
}

