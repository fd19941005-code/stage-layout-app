import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";

describe("出力設定の一括更新 (Phase 3)", () => {
  it("メタデータと出力設定を1回のUndo操作へまとめる", () => {
    const initial = createInitialState();
    const next = appReducer(initial, {
      type: "SET_EXPORT_CONFIGURATION",
      metadata: { ...initial.project.metadata, hallName: "Aホール" },
      settings: { ...initial.project.exportSettings, paper: "A3", scale: "1:100" },
    });

    expect(next.past).toHaveLength(1);
    expect(next.project.metadata.hallName).toBe("Aホール");
    expect(next.project.exportSettings).toMatchObject({ paper: "A3", scale: "1:100" });
    expect(next.saveState).toBe("dirty");

    const undone = appReducer(next, { type: "UNDO" });
    expect(undone.project.metadata).toEqual(initial.project.metadata);
    expect(undone.project.exportSettings).toEqual(initial.project.exportSettings);
  });

  it("値が変わらない場合は履歴を増やさない", () => {
    const initial = createInitialState();
    const next = appReducer(initial, {
      type: "SET_EXPORT_CONFIGURATION",
      metadata: { ...initial.project.metadata },
      settings: { ...initial.project.exportSettings },
    });

    expect(next).toBe(initial);
    expect(next.past).toHaveLength(0);
  });
});
