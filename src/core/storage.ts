// ローカル保存(FR-002、NFR-007、NFR-008)。Phase 3ではIndexedDBを正本にし、
// IndexedDBが使えない環境だけlocalStorageへフォールバックする。

import type { Project } from "../types/project";
import { deserializeProject, serializeProject } from "./project";

export const STORAGE_DB_NAME = "stage-layout-app";
export const STORAGE_DB_VERSION = 1;
export const STORAGE_STORE_NAME = "projects";
export const AUTOSAVE_RECORD_KEY = "autosave";
export const LEGACY_AUTOSAVE_KEY = "stageLayout.autosave.v1";

interface AutosaveRecord {
  key: string;
  json: string;
  updatedAt: string;
}

function indexedDb(): IDBFactory | null {
  return typeof window !== "undefined" && window.indexedDB ? window.indexedDB : null;
}

function openDatabase(): Promise<IDBDatabase> {
  const factory = indexedDb();
  if (!factory) return Promise.reject(new Error("IndexedDBが利用できません"));
  return new Promise((resolve, reject) => {
    const request = factory.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORAGE_STORE_NAME)) {
        database.createObjectStore(STORAGE_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDBを開けません"));
  });
}

function readLegacyAutosave(): Project | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const json = localStorage.getItem(LEGACY_AUTOSAVE_KEY);
    return json ? deserializeProject(json) : undefined;
  } catch {
    return undefined;
  }
}

export async function loadAutosavedProject(): Promise<Project | undefined> {
  try {
    const database = await openDatabase();
    const record = await new Promise<AutosaveRecord | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORAGE_STORE_NAME, "readonly");
      const request = transaction.objectStore(STORAGE_STORE_NAME).get(AUTOSAVE_RECORD_KEY);
      request.onsuccess = () => resolve(request.result as AutosaveRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (record?.json) return deserializeProject(record.json);
  } catch {
    // 既存localStorageまたはプライベートブラウズの容量制限へフォールバックする。
  }
  return readLegacyAutosave();
}

export async function saveAutosavedProject(project: Project): Promise<void> {
  const json = serializeProject(project);
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORAGE_STORE_NAME, "readwrite");
      transaction.objectStore(STORAGE_STORE_NAME).put({
        key: AUTOSAVE_RECORD_KEY,
        json,
        updatedAt: project.updatedAt,
      } satisfies AutosaveRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDBへの保存に失敗しました"));
    });
    database.close();
    return;
  } catch {
    if (typeof localStorage === "undefined") throw new Error("ローカル保存が利用できません");
    try {
      localStorage.setItem(LEGACY_AUTOSAVE_KEY, json);
    } catch {
      throw new Error("自動保存に失敗しました(容量超過の可能性があります)");
    }
  }
}
