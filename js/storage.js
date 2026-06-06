const KEYS = {
    SETTINGS: 'wt_settings',
    SESSIONS: 'wt_sessions',
    ACTIVE_SESSION: 'wt_active_session',
    WARNING_MINUTES: 'wt_warning_minutes',
    LAST_EXPORT: 'wt_last_export'
};

export const Storage = {
    getSettings: () => {
        const data = localStorage.getItem(KEYS.SETTINGS);
        const parsed = data ? JSON.parse(data) : {};
        return {
            hourlyRate: parsed.hourlyRate || 34.0,
            saturdayRate: parsed.saturdayRate !== undefined ? parsed.saturdayRate : 396.0 
        };
    },
    setSettings: (settings) => { 
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    },
    saveSettings: (settings) => {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    },

    getWarningMinutes: () => {
        const val = localStorage.getItem(KEYS.WARNING_MINUTES);
        let ms = val ? parseInt(val, 10) : 300000; // Domyślnie 300000 ms (5 min)
        
        if (ms <= 60) {
            ms = ms * 60 * 1000; 
            localStorage.setItem(KEYS.WARNING_MINUTES, ms);
        }
        
        return ms;
    },
    setWarningMinutes: (mins) => {
        localStorage.setItem(KEYS.WARNING_MINUTES, mins);
    },


    // Zakończone sesje pracy
    getSessions: () => {
        const data = localStorage.getItem(KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },
    addSession: (session) => {
        const sessions = Storage.getSessions();
        sessions.push(session);
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
    },

    // Importowanie/eksportowanie danych
    setSessions: (sessions) => {
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
    },

    getLastExportDate: () => {
        const dateStr = localStorage.getItem(KEYS.LAST_EXPORT);
        if (!dateStr) {
            // Pierwsze uruhomienie
            const now = Date.now();
            localStorage.setItem(KEYS.LAST_EXPORT, now);
            return now;
        }
        return parseInt(dateStr, 10);
    },
    setLastExportDate: (timestamp) => {
        localStorage.setItem(KEYS.LAST_EXPORT, timestamp || Date.now());
    },

    // Aktywna sesja
    getActiveSession: () => {
        const data = localStorage.getItem(KEYS.ACTIVE_SESSION);
        return data ? JSON.parse(data) : null;
    },
    setActiveSession: (startTime) => {
        localStorage.setItem(KEYS.ACTIVE_SESSION, JSON.stringify({ startTime }));
    },
    clearActiveSession: () => {
        localStorage.removeItem(KEYS.ACTIVE_SESSION);
    },

    // Czyszczenie wszystkich danych
    clearAllData: () => {
        localStorage.removeItem(KEYS.SETTINGS);
        localStorage.removeItem(KEYS.SESSIONS);
        localStorage.removeItem(KEYS.ACTIVE_SESSION);
        localStorage.removeItem(KEYS.WARNING_MINUTES);
        localStorage.removeItem(KEYS.LAST_EXPORT);
    }
};