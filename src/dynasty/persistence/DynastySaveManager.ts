import type { EntityManager } from '../ecs/EntityManager.ts';
import type { PhaseState } from '../phases/PhaseRunner.ts';
import type { InboxItem } from '../phases/OffseasonInbox.ts';
import type { ConversationResult } from '../conversations/types.ts';
import type { DynastyMode } from '../ecs/types.ts';

/** Complete dynasty save data */
export interface DynastySaveData {
  version: number;
  mode: DynastyMode;
  createdAt: string;
  updatedAt: string;
  entityManagerSnapshot: ReturnType<EntityManager['serialize']>;
  phaseState: PhaseState;
  inboxItems: InboxItem[];
  conversationLog: ConversationResult[];
  settings: Record<string, unknown>;
  dynastyYear: number;
}

const SAVE_VERSION = 1;
const DB_NAME = 'claudeball_dynasty';
const STORE_NAME = 'saves';

/**
 * Manages dynasty save/load using IndexedDB.
 * Falls back to localStorage export/import for older browsers.
 */
export class DynastySaveManager {
  private db: IDBDatabase | null = null;

  /** Open the IndexedDB database */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /** Save a dynasty to IndexedDB */
  async save(id: string, data: DynastySaveData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id, ...data, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Load a dynasty from IndexedDB */
  async load(id: string): Promise<DynastySaveData | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /** List all saved dynasties */
  async listSaves(): Promise<{ id: string; mode: DynastyMode; updatedAt: string; dynastyYear: number }[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const saves = (request.result ?? []).map((s: DynastySaveData & { id: string }) => ({
          id: s.id,
          mode: s.mode,
          updatedAt: s.updatedAt,
          dynastyYear: s.dynastyYear,
        }));
        resolve(saves);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Delete a saved dynasty */
  async deleteSave(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Export a save as a compressed JSON string (.claudeball format) */
  static exportToJSON(data: DynastySaveData): string {
    return JSON.stringify(data);
  }

  /** Import a save from a JSON string */
  static importFromJSON(json: string): DynastySaveData | null {
    try {
      const data = JSON.parse(json) as DynastySaveData;
      if (!data.version || !data.mode || !data.entityManagerSnapshot) return null;
      return data;
    } catch {
      return null;
    }
  }

  /** Create a fresh save data object from current state */
  static createSaveData(
    mode: DynastyMode,
    entityManager: EntityManager,
    phaseState: PhaseState,
    inboxItems: InboxItem[] = [],
    conversationLog: ConversationResult[] = [],
    settings: Record<string, unknown> = {},
    dynastyYear = 1,
  ): DynastySaveData {
    return {
      version: SAVE_VERSION,
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entityManagerSnapshot: entityManager.serialize(),
      phaseState,
      inboxItems,
      conversationLog,
      settings,
      dynastyYear,
    };
  }
}
