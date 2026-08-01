import type { UserTemplate } from "../../types/userTemplate";
import { validateUserTemplate } from "../../core/userTemplate";
import type { UserTemplateService } from "../contracts";

export const USER_TEMPLATE_DB_NAME = "stage-layout-user-templates";
export const USER_TEMPLATE_DB_VERSION = 1;
export const USER_TEMPLATE_STORE_NAME = "templates";
export const USER_TEMPLATE_LOCAL_STORAGE_KEY = "stageLayout.userTemplates.v1";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDBが利用できません"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(USER_TEMPLATE_DB_NAME, USER_TEMPLATE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(USER_TEMPLATE_STORE_NAME)) {
        database.createObjectStore(USER_TEMPLATE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("ユーザーテンプレート保存領域を開けません"));
  });
}

function readFallback(): UserTemplate[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(USER_TEMPLATE_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(validateUserTemplate).filter((template): template is UserTemplate => template !== null);
  } catch {
    return [];
  }
}

function writeFallback(templates: readonly UserTemplate[]): void {
  if (typeof localStorage === "undefined") throw new Error("テンプレート保存が利用できません");
  try {
    localStorage.setItem(USER_TEMPLATE_LOCAL_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    throw new Error("ユーザーテンプレートの保存に失敗しました(容量超過の可能性があります)");
  }
}

/** プロジェクトのIndexedDBとは別DBへユーザーテンプレートを保存するWeb実装。 */
export class WebUserTemplateService implements UserTemplateService {
  async loadTemplates(): Promise<UserTemplate[]> {
    try {
      const database = await openDatabase();
      const records = await new Promise<unknown[]>((resolve, reject) => {
        const transaction = database.transaction(USER_TEMPLATE_STORE_NAME, "readonly");
        const request = transaction.objectStore(USER_TEMPLATE_STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return records.map(validateUserTemplate).filter((template): template is UserTemplate => template !== null);
    } catch {
      return readFallback();
    }
  }

  async saveTemplates(templates: readonly UserTemplate[]): Promise<void> {
    try {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(USER_TEMPLATE_STORE_NAME, "readwrite");
        const store = transaction.objectStore(USER_TEMPLATE_STORE_NAME);
        store.clear();
        templates.forEach((template) => store.put(template));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("ユーザーテンプレートの保存に失敗しました"));
      });
      database.close();
      return;
    } catch {
      writeFallback(templates);
    }
  }
}
