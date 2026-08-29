const KEYS = {
    SETTINGS: 'wt_settings',
    SESSIONS: 'wt_sessions',
    ACTIVE_SESSION: 'wt_active_session',
    WARNING_MINUTES: 'wt_warning_minutes',
    LAST_EXPORT: 'wt_last_export',
    BACKUP_FALLBACK: 'wt_backup_fallback'
};

const BACKUP_DB_NAME = 'express_tracker_backup_db';
const BACKUP_STORE_NAME = 'backups';
const BACKUP_LIMIT = 5;

function openBackupDatabase() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('IndexedDB nie jest wspierane w tej przeglądarce.'));
            return;
        }

        const request = indexedDB.open(BACKUP_DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
                const store = db.createObjectStore(BACKUP_STORE_NAME, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Nie udało się otworzyć bazy backupów.'));
    });
}

async function getAllBackupRecords() {
    try {
        const db = await openBackupDatabase();

        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(BACKUP_STORE_NAME, 'readonly');
            const store = transaction.objectStore(BACKUP_STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const records = (request.result || []).sort((a, b) => b.createdAt - a.createdAt);
                resolve(records);
            };

            request.onerror = () => reject(request.error || new Error('Nie udało się odczytać backupów.'));
        });
    } catch (error) {
        return [];
    }
}

async function pruneBackupRecords(records) {
    if (records.length <= BACKUP_LIMIT) {
        return;
    }

    const db = await openBackupDatabase();
    const overflow = records.slice(BACKUP_LIMIT);

    await Promise.all(overflow.map((record) => new Promise((resolve, reject) => {
        const transaction = db.transaction(BACKUP_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(BACKUP_STORE_NAME);
        const request = store.delete(record.id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error('Nie udało się usunąć starego backupu.'));
    })));
}

async function persistBackupSnapshot(backupData) {
    const snapshot = {
        settings: backupData.settings,
        sessions: backupData.sessions
    };

    try {
        if (!('indexedDB' in window)) {
            localStorage.setItem(KEYS.BACKUP_FALLBACK, JSON.stringify(snapshot));
            return snapshot;
        }

        const db = await openBackupDatabase();
        const backupRecord = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: Date.now(),
            data: snapshot
        };

        await new Promise((resolve, reject) => {
            const transaction = db.transaction(BACKUP_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(BACKUP_STORE_NAME);
            const request = store.put(backupRecord);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error('Nie udało się zapisać backupu.'));
        });

        const records = await getAllBackupRecords();
        await pruneBackupRecords(records);
        localStorage.setItem(KEYS.BACKUP_FALLBACK, JSON.stringify(snapshot));

        return snapshot;
    } catch (error) {
        localStorage.setItem(KEYS.BACKUP_FALLBACK, JSON.stringify(snapshot));
        return snapshot;
    }
}

async function getLatestBackupRecord() {
    const records = await getAllBackupRecords();
    return records[0] || null;
}

export const Storage = {
    getSettings: () => {
        const data = localStorage.getItem(KEYS.SETTINGS);
        const parsed = data ? JSON.parse(data) : {};
        return {
            hourlyRate: parsed.hourlyRate || 34.0,
            saturdayRate: parsed.saturdayRate !== undefined ? parsed.saturdayRate : 396.0,
            darkMode: parsed.darkMode === true
        };
    },
    setSettings: (settings) => {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
        void persistBackupSnapshot(Storage.getBackupData());
    },
    saveSettings: (settings) => {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
        void persistBackupSnapshot(Storage.getBackupData());
    },

    getBackupData: () => ({
        settings: Storage.getSettings(),
        sessions: Storage.getSessions()
    }),

    saveBackup: async () => {
        const backup = Storage.getBackupData();
        return await persistBackupSnapshot(backup);
    },

    getBackupList: async () => {
        return await getAllBackupRecords();
    },

    restoreLatestBackup: async () => {
        const latestRecord = await getLatestBackupRecord();
        const fallback = localStorage.getItem(KEYS.BACKUP_FALLBACK);
        const latestBackup = latestRecord ? latestRecord.data : fallback ? JSON.parse(fallback) : null;

        if (!latestBackup) {
            throw new Error('Brak zapisanych kopii zapasowych.');
        }

        Storage.importBackupData(latestBackup);
        return latestBackup;
    },

    exportBackupData: () => {
        const backup = Storage.getBackupData();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `Express_Tracker_save_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        return backup;
    },

    importBackupData: (importedData) => {
        if (!importedData || typeof importedData !== 'object' || Array.isArray(importedData)) {
            throw new Error('Główny element pliku nie jest obiektem.');
        }

        if (!importedData.settings && !importedData.sessions) {
            throw new Error('Plik nie zawiera danych ustawień ani historii pracy (brak kluczy settings/sessions).');
        }

        if (importedData.settings && typeof importedData.settings !== 'object') {
            throw new Error('Ustawienia są uszkodzone (settings nie jest obiektem).');
        }

        if (importedData.sessions && !Array.isArray(importedData.sessions)) {
            throw new Error('Historia pracy (sessions) jest uszkodzona (nie jest tablicą).');
        }

        if (importedData.settings) {
            Storage.setSettings(importedData.settings);
        }

        if (importedData.sessions) {
            Storage.setSessions(importedData.sessions);
        }

        localStorage.setItem(KEYS.BACKUP_FALLBACK, JSON.stringify(Storage.getBackupData()));
        return Storage.getBackupData();
    },

    getWarningMinutes: () => {
        const val = localStorage.getItem(KEYS.WARNING_MINUTES);
        let ms = val ? parseInt(val, 10) : 300000;

        if (ms <= 60) {
            ms = ms * 60 * 1000;
            localStorage.setItem(KEYS.WARNING_MINUTES, ms);
        }

        return ms;
    },
    setWarningMinutes: (mins) => {
        localStorage.setItem(KEYS.WARNING_MINUTES, mins);
    },

    getSessions: () => {
        const data = localStorage.getItem(KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },
    addSession: (session) => {
        const sessions = Storage.getSessions();
        sessions.push(session);
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
        void persistBackupSnapshot(Storage.getBackupData());
    },

    setSessions: (sessions) => {
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
        void persistBackupSnapshot(Storage.getBackupData());
    },

    getLastExportDate: () => {
        const dateStr = localStorage.getItem(KEYS.LAST_EXPORT);
        if (!dateStr) {
            const now = Date.now();
            localStorage.setItem(KEYS.LAST_EXPORT, now);
            return now;
        }
        return parseInt(dateStr, 10);
    },
    setLastExportDate: (timestamp) => {
        localStorage.setItem(KEYS.LAST_EXPORT, timestamp || Date.now());
    },

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

    clearAllData: () => {
        localStorage.removeItem(KEYS.SETTINGS);
        localStorage.removeItem(KEYS.SESSIONS);
        localStorage.removeItem(KEYS.ACTIVE_SESSION);
        localStorage.removeItem(KEYS.WARNING_MINUTES);
        localStorage.removeItem(KEYS.LAST_EXPORT);
        localStorage.removeItem(KEYS.BACKUP_FALLBACK);
    }
};