import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject, serializeProject } from "../core/project";
import type { FileSaveRequest, FileService } from "./contracts";
import { isPdfFile, isSupportedBackgroundFile } from "./fileTypes";
import { createWebServices } from "./web/createWebServices";
import { WebAutosaveService } from "./web/autosaveService";
import { WebFileService } from "./web/fileService";
import { WebProjectService } from "./web/projectService";
import { WebSettingsService } from "./web/settingsService";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("サービス境界", () => {
  it("Webサービス集合はUIから差し替え可能な各サービスを公開する", () => {
    const services = createWebServices();

    expect(services.file).toBeDefined();
    expect(services.image).toBeDefined();
    expect(services.pdf).toBeDefined();
    expect(services.exporter).toBeDefined();
    expect(services.autosave).toBeDefined();
    expect(services.settings).toBeDefined();
    expect(services.project).toBeDefined();
  });

  it("背景ファイルの判定は実行環境に依存しない", () => {
    expect(isSupportedBackgroundFile({ name: "舞台図.png", type: "" })).toBe(true);
    expect(isSupportedBackgroundFile({ name: "舞台図.pdf", type: "application/octet-stream" })).toBe(true);
    expect(isPdfFile({ name: "舞台図.pdf", type: "" })).toBe(true);
    expect(isSupportedBackgroundFile({ name: "舞台図.dwg", type: "application/octet-stream" })).toBe(false);
  });
});

describe("WebProjectService", () => {
  it("JSONのシリアライズとファイルサービスを接続する", async () => {
    const project = createEmptyProject("ホール配置");
    let saved: FileSaveRequest | undefined;
    const files: FileService = {
      openFile: vi.fn(async () => ({
        name: "project.stage.json",
        type: "application/json",
        size: serializeProject(project).length,
        lastModified: null,
        bytes: new TextEncoder().encode(serializeProject(project)),
      })),
      saveFile: vi.fn(async (request) => { saved = request; }),
    };
    const service = new WebProjectService(files);

    const loaded = await service.openProject();
    await service.saveProject(project);

    expect(loaded?.name).toBe("ホール配置");
    expect(saved?.filename).toBe("ホール配置.stage.json");
    expect(saved?.mimeType).toBe("application/json");
    expect(typeof saved?.data).toBe("string");
  });

  it("キャンセルされたファイル選択はキャンセルとして返す", async () => {
    const files: FileService = {
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(),
    };
    const service = new WebProjectService(files);

    await expect(service.openProject()).resolves.toBeNull();
  });
});

describe("WebSettingsService", () => {
  it("IndexedDBが使えない環境ではlocalStorageへフォールバックする", async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("localStorage", createMemoryStorage());
    const service = new WebSettingsService();

    await service.write("last-view", { zoom: 1.25 });

    await expect(service.read<{ zoom: number }>("last-view")).resolves.toEqual({ zoom: 1.25 });
    await service.remove("last-view");
    await expect(service.read("last-view")).resolves.toBeUndefined();
  });
});

describe("WebAutosaveService", () => {
  it("既存のIndexedDB/localStorage自動保存をサービス契約から利用する", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    const service = new WebAutosaveService();
    const project = createEmptyProject("自動保存");

    await service.saveProject(project);

    await expect(service.loadProject()).resolves.toMatchObject({ name: "自動保存" });
  });
});

describe("WebFileService", () => {
  it("DOMのない実行環境ではファイル選択を実行しない", async () => {
    await expect(new WebFileService().openFile({ accept: [".json"] })).rejects.toThrow("ファイル選択");
  });
});
