import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";
import type { SceneObject } from "../types/project";

function object(id: string, type: SceneObject["type"], xMm = 0, yMm = 0): SceneObject {
  return {
    id,
    type,
    presetId: type === "riser" ? "riser-3x6" : "chair",
    name: type === "riser" ? "山台" : "椅子",
    xMm,
    yMm,
    widthMm: type === "riser" ? 910 : 450,
    depthMm: type === "riser" ? 1820 : 450,
    heightMm: type === "riser" ? 300 : 450,
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
  };
}

describe("Phase 4 reducer受入条件", () => {
  it("行列配置は元オブジェクトを含めた行列を1 Actionで生成する", () => {
    let state = appReducer(createInitialState(), { type: "ADD_OBJECT", object: object("source", "chair") });
    state = appReducer(state, {
      type: "DUPLICATE_GRID",
      sourceId: "source",
      options: { rows: 2, columns: 3, gapXMm: 100, gapYMm: 200 },
    });

    expect(state.project.objects).toHaveLength(6);
    expect(state.project.objects.filter((item) => item.id !== "source")).toHaveLength(5);
    expect(state.project.objects.find((item) => item.xMm === 550 && item.yMm === 650)).toBeTruthy();
  });

  it("AC-101: 14プルトを弧状配置すると椅子28脚と譜面台14台を生成する", () => {
    const state = appReducer(createInitialState(), {
      type: "ADD_PULT_ARC",
      options: {
        center: { xMm: 6000, yMm: 5000 },
        radiusMm: 6000,
        startDeg: -45,
        endDeg: 45,
        pultCount: 14,
        pultSpacingMm: 900,
        layerId: "layer-objects",
      },
    });

    expect(state.project.objects).toHaveLength(42);
    expect(state.project.objects.filter((item) => item.type === "chair")).toHaveLength(28);
    expect(state.project.objects.filter((item) => item.type === "musicStand")).toHaveLength(14);
    expect(new Set(state.project.objects.map((item) => item.layerId))).toEqual(new Set(["layer-objects"]));
    expect(state.selectedIds).toHaveLength(42);
  });

  it("レイヤーの非表示・ロックを選択と編集可否へ反映し、山台関連付けを保存する", () => {
    let state = createInitialState();
    state = appReducer(state, { type: "ADD_OBJECT", object: object("riser", "riser", 1000, 1000) });
    state = appReducer(state, { type: "ADD_OBJECT", object: object("chair", "chair", 1000, 1000) });
    state = appReducer(state, { type: "UPDATE_OBJECT", id: "chair", patch: { onRiserId: "riser" } });
    expect(state.project.objects.find((item) => item.id === "chair")?.onRiserId).toBe("riser");

    state = appReducer(state, { type: "SELECT", id: "chair" });
    state = appReducer(state, { type: "SET_LAYER_LOCKED", layerId: "layer-objects", locked: true });
    state = appReducer(state, { type: "MOVE_OBJECT", id: "chair", xMm: 3000, yMm: 3000 });
    expect(state.project.objects.find((item) => item.id === "chair")?.xMm).toBe(1000);

    state = appReducer(state, { type: "SET_LAYER_VISIBLE", layerId: "layer-objects", visible: false });
    expect(state.selectedIds).toEqual([]);
  });
});



