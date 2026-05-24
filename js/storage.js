
const KEYS = {
    SETTINGS: 'wt_settings',
    SESSIONS: 'wt_sessions',
    ACTIVE_SESSION: 'wt_active_session'
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
    }
};