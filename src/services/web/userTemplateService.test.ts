import { afterEach, describe, expect, it, vi } from "vitest";
import {
  USER_TEMPLATE_LOCAL_STORAGE_KEY,
  WebUserTemplateService,
} from "./userTemplateService";
import {
  USER_TEMPLATE_KIND,
  USER_TEMPLATE_ORIGIN,
  USER_TEMPLATE_SCHEMA_VERSION,
  type UserTemplate,
} from "../../types/userTemplate";

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

function createTemplate(id = "template-1"): UserTemplate {
  return {
    kind: USER_TEMPLATE_KIND,
    schemaVersion: USER_TEMPLATE_SCHEMA_VERSION,
    origin: USER_TEMPLATE_ORIGIN,
    id,
    name: "小編成",
    objects: [{
      id: "object-1",
      type: "chair",
      presetId: "chair-standard",
      name: "椅子",
      xMm: 0,
      yMm: 0,
      widthMm: 500,
      depthMm: 500,
      heightMm: 450,
      rotationDeg: 0,
      label: "椅子",
      onRiserId: null,
      avatar: null,
      visible: true,
      groupId: null,
      zIndex: 0,
      shape: "rect",
      annotationKind: null,
      endXMm: null,
      endYMm: null,
    }],
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebUserTemplateService", () => {
  it("IndexedDBが使えない環境では別のlocalStorage領域へ保存・復元する", async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("localStorage", createMemoryStorage());
    const service = new WebUserTemplateService();

    await service.saveTemplates([createTemplate()]);

    await expect(service.loadTemplates()).resolves.toEqual([createTemplate()]);
    expect(localStorage.getItem(USER_TEMPLATE_LOCAL_STORAGE_KEY)).toContain("小編成");
  });

  it("破損したフォールバックデータは安全に空配列として扱う", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const storage = createMemoryStorage();
    storage.setItem(USER_TEMPLATE_LOCAL_STORAGE_KEY, JSON.stringify([{ id: "broken" }]));
    vi.stubGlobal("localStorage", storage);

    await expect(new WebUserTemplateService().loadTemplates()).resolves.toEqual([]);
  });
});
