import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject, deserializeProject, serializeProject } from "./project";
import { WebAutosaveService } from "../services/web/autosaveService";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

function createIndexedDbWithSecondWriteFailure(): IDBFactory {
  let stored: Record<string, unknown> | undefined;
  let writeCount = 0;
  return {
    open: () => {
      const request: any = {
        result: undefined,
        error: null,
        onupgradeneeded: undefined,
        onsuccess: undefined,
        onerror: undefined,
      };
      queueMicrotask(() => {
        const database: any = {
          objectStoreNames: { contains: () => false },
          createObjectStore: () => undefined,
          close: () => undefined,
          transaction: (_storeName: string, mode: "readonly" | "readwrite") => {
            const transaction: any = {
              error: null,
              oncomplete: undefined,
              onerror: undefined,
            };
            const objectStore = {
              put: (record: Record<string, unknown>) => {
                if (mode === "readwrite" && writeCount++ === 1) {
                  transaction.error = new Error("transaction failed");
                  queueMicrotask(() => transaction.onerror?.());
                  return;
                }
                stored = record;
                queueMicrotask(() => transaction.oncomplete?.());
              },
              get: (_key: string) => {
                const getRequest: any = { result: undefined, error: null, onsuccess: undefined, onerror: undefined };
                queueMicrotask(() => {
                  getRequest.result = stored;
                  getRequest.onsuccess?.();
                });
                return getRequest;
              },
            };
            transaction.objectStore = () => objectStore;
            return transaction;
          },
        };
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  } as unknown as IDBFactory;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("保存・復元の最終回帰 (Phase 5)", () => {
  it("復元時のオブジェクト角度を0〜360度へ正規化する", () => {
    const project = createEmptyProject("角度補正");
    project.objects.push({
      id: "object-angle",
      type: "shape",
      presetId: null,
      name: "角度テスト",
      xMm: 0,
      yMm: 0,
      widthMm: 1000,
      depthMm: 500,
      heightMm: 0,
      rotationDeg: 0,
      label: "",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId: null,
      layerId: "layer-objects",
      zIndex: 0,
      shape: "rect",
    });
    const raw = JSON.parse(serializeProject(project)) as {
      objects: Array<Record<string, unknown>>;
    };

    raw.objects[0].rotationDeg = 450;
    expect(deserializeProject(JSON.stringify(raw)).objects[0].rotationDeg).toBe(90);

    raw.objects[0].rotationDeg = -30;
    expect(deserializeProject(JSON.stringify(raw)).objects[0].rotationDeg).toBe(330);
  });

  it("短時間に発生した自動保存を呼び出し順に確定する", async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("localStorage", storage);

    const first = createEmptyProject("先行スナップショット");
    const second = createEmptyProject("後続スナップショット");
    const service = new WebAutosaveService();

    await Promise.all([service.saveProject(first), service.saveProject(second)]);

    await expect(service.loadProject()).resolves.toMatchObject({
      name: "後続スナップショット",
    });
  });

  it("IndexedDB書き込み失敗時も新しいlocalStorage退避を復元する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T00:00:00.000Z"));
    vi.stubGlobal("window", { indexedDB: createIndexedDbWithSecondWriteFailure() });
    vi.stubGlobal("localStorage", createMemoryStorage());
    const service = new WebAutosaveService();

    await service.saveProject(createEmptyProject("IndexedDBの旧状態"));
    vi.setSystemTime(new Date("2026-08-02T00:00:01.000Z"));
    await service.saveProject(createEmptyProject("退避した新状態"));

    await expect(service.loadProject()).resolves.toMatchObject({ name: "退避した新状態" });
  });
});
