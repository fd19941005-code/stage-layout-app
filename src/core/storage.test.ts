import { describe, expect, it } from "vitest";
import { AUTOSAVE_RECORD_KEY, STORAGE_DB_NAME, STORAGE_DB_VERSION, STORAGE_STORE_NAME } from "./storage";

describe("IndexedDB保存の定数契約(FR-002、NFR-007)", () => {
  it("アプリ専用DBとautosaveレコードを使う", () => {
    expect(STORAGE_DB_NAME).toBe("stage-layout-app");
    expect(STORAGE_DB_VERSION).toBe(1);
    expect(STORAGE_STORE_NAME).toBe("projects");
    expect(AUTOSAVE_RECORD_KEY).toBe("autosave");
  });
});
