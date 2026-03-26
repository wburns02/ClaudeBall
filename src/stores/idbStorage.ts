/**
 * IndexedDB storage adapter for Zustand persist middleware.
 * Replaces localStorage — no 5MB limit, effectively unlimited.
 *
 * Uses a simple key-value store in IndexedDB.
 * Async operations are handled via Zustand's async storage support.
 */

const DB_NAME = 'claudeball';
const STORE_NAME = 'zustand';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(name);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Fallback to localStorage if IndexedDB unavailable
      try { return localStorage.getItem(name); } catch { return null; }
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(value, name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Fallback to localStorage
      try { localStorage.setItem(name, value); } catch { /* silent */ }
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try { localStorage.removeItem(name); } catch { /* silent */ }
    }
  },
};

/**
 * Migrate existing localStorage data to IndexedDB (one-time).
 * Call on app startup. Safe to call multiple times.
 */
export async function migrateLocalStorageToIDB(): Promise<void> {
  const keys = ['claudeball-franchise', 'claudeball-stats', 'claudeball-morale', 'claudeball-inbox-v1', 'claudeball-achievements'];

  for (const key of keys) {
    try {
      const lsData = localStorage.getItem(key);
      if (lsData) {
        // Check if IDB already has this key
        const idbData = await idbStorage.getItem(key);
        if (!idbData) {
          await idbStorage.setItem(key, lsData);
          console.log(`Migrated ${key} to IndexedDB (${Math.round(lsData.length / 1024)}KB)`);
        }
        // Remove from localStorage to free space
        localStorage.removeItem(key);
      }
    } catch {
      // Non-critical — old data stays in localStorage
    }
  }
}
