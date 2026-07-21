import type { SettingsService } from "../contracts";

export const SETTINGS_DB_NAME = "stage-layout-app-settings";
export const SETTINGS_DB_VERSION = 1;
export const SETTINGS_STORE_NAME = "settings";
export const SETTINGS_LOCAL_STORAGE_PREFIX = "stageLayout.settings.";

interface SettingsRecord {
  key: string;
  value: unknown;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDBが利用できません"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SETTINGS_DB_NAME, SETTINGS_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("設定保存領域を開けません"));
  });
}

function localStorageKey(key: string): string {
  return `${SETTINGS_LOCAL_STORAGE_PREFIX}${key}`;
}

function readLocal<T>(key: string): T | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const raw = localStorage.getItem(localStorageKey(key));
    return raw === null ? undefined : JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Web版の設定保存。IndexedDBを優先し、利用できない環境ではlocalStorageへ退避する。 */
export class WebSettingsService implements SettingsService {
  async read<T>(key: string): Promise<T | undefined> {
    try {
      const database = await openDatabase();
      const record = await new Promise<SettingsRecord | undefined>((resolve, reject) => {
        const transaction = database.transaction(SETTINGS_STORE_NAME, "readonly");
        const request = transaction.objectStore(SETTINGS_STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result as SettingsRecord | undefined);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return record?.value as T | undefined;
    } catch {
      return readLocal<T>(key);
    }
  }

  async write<T>(key: string, value: T): Promise<void> {
    try {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(SETTINGS_STORE_NAME, "readwrite");
        transaction.objectStore(SETTINGS_STORE_NAME).put({ key, value } satisfies SettingsRecord);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("設定の保存に失敗しました"));
      });
      database.close();
      return;
    } catch {
      if (typeof localStorage === "undefined") throw new Error("設定保存が利用できません");
      try {
        localStorage.setItem(localStorageKey(key), JSON.stringify(value));
      } catch {
        throw new Error("設定の保存に失敗しました");
      }
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(SETTINGS_STORE_NAME, "readwrite");
        transaction.objectStore(SETTINGS_STORE_NAME).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("設定の削除に失敗しました"));
      });
      database.close();
      return;
    } catch {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem(localStorageKey(key));
    }
  }
}
