// ローカル保存(FR-002、NFR-007、NFR-008)。Web版のIndexedDB実装をここへ閉じ込める。
// IndexedDBが使えない環境だけ、既存互換のlocalStorageへフォールバックする。

import type { Project } from "../../types/project";
import { deserializeProject, serializeProject } from "../../core/project";

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

interface AutosaveSnapshot {
  project: Project;
  savedAtMs: number;
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

function autosaveSnapshot(json: string | undefined): AutosaveSnapshot | undefined {
  if (!json) return undefined;
  try {
    const raw = JSON.parse(json) as unknown;
    const project = deserializeProject(json);
    const rawUpdatedAt = typeof raw === "object" && raw !== null && !Array.isArray(raw)
      && typeof (raw as Record<string, unknown>).updatedAt === "string"
      ? (raw as Record<string, unknown>).updatedAt as string
      : "";
    const parsedTime = Date.parse(rawUpdatedAt);
    return {
      project,
      savedAtMs: Number.isFinite(parsedTime) ? parsedTime : Number.NEGATIVE_INFINITY,
    };
  } catch {
    return undefined;
  }
}

function readLegacyAutosave(): AutosaveSnapshot | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    return autosaveSnapshot(localStorage.getItem(LEGACY_AUTOSAVE_KEY) ?? undefined);
  } catch {
    return undefined;
  }
}

export async function loadAutosavedProject(): Promise<Project | undefined> {
  let indexedDbSnapshot: AutosaveSnapshot | undefined;
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    const record = await new Promise<AutosaveRecord | undefined>((resolve, reject) => {
      const transaction = database!.transaction(STORAGE_STORE_NAME, "readonly");
      const request = transaction.objectStore(STORAGE_STORE_NAME).get(AUTOSAVE_RECORD_KEY);
      request.onsuccess = () => resolve(request.result as AutosaveRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    database = undefined;
    indexedDbSnapshot = autosaveSnapshot(record?.json);
  } catch {
    database?.close();
    // 既存localStorageまたはプライベートブラウズの容量制限へフォールバックする。
  }

  const legacySnapshot = readLegacyAutosave();
  if (!indexedDbSnapshot) return legacySnapshot?.project;
  if (!legacySnapshot) return indexedDbSnapshot.project;
  // IDBの書き込み失敗時にlocalStorageへ退避した最新スナップショットを優先する。
  return legacySnapshot.savedAtMs > indexedDbSnapshot.savedAtMs
    ? legacySnapshot.project
    : indexedDbSnapshot.project;
}

/**
 * 自動保存の書き込みを呼び出し順に直列化する。
 *
 * IndexedDBのトランザクション自体は非同期なので、短時間に発生した複数の
 * 編集を並行して保存すると、古い要求が最後に完了して新しい状態を上書き
 * する可能性がある。ここで要求を一本のキューに通し、最新のスナップショット
 * が必ず最後に書き込まれるようにする。
 */
let autosaveWriteQueue: Promise<void> = Promise.resolve();

async function persistAutosave(json: string, updatedAt: string): Promise<void> {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORAGE_STORE_NAME, "readwrite");
      transaction.objectStore(STORAGE_STORE_NAME).put({
        key: AUTOSAVE_RECORD_KEY,
        json,
        updatedAt,
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

export function saveAutosavedProject(project: Project): Promise<void> {
  const json = serializeProject(project);
  const task = autosaveWriteQueue.then(() => persistAutosave(json, project.updatedAt));
  // 失敗した要求でキュー全体が永久に止まらないようにする。呼び出し元には
  // taskを返すため、個々の保存失敗は従来どおり通知できる。
  autosaveWriteQueue = task.catch(() => undefined);
  return task;
}
