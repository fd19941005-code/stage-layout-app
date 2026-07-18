import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";
import { rotatedBoundsMm } from "../core/transform";
import type { SceneObject } from "../types/project";

function chair(): SceneObject {
  return {
    id: "chair-1",
    type: "chair",
    presetId: "chair",
    name: "椅子",
    xMm: 1000,
    yMm: 1000,
    widthMm: 450,
    depthMm: 450,
    heightMm: 450,
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

describe("配置物のMVP受入条件", () => {
  it("AC-005: 幅500mm・奥行550mmの椅子をAction経由で編集し、寸法表示用の外接矩形を得られる", () => {
    let state = appReducer(createInitialState(), { type: "ADD_OBJECT", object: chair() });
    state = appReducer(state, { type: "UPDATE_OBJECT", id: "chair-1", patch: { widthMm: 500, depthMm: 550 } });
    const object = state.project.objects[0];
    expect(object.widthMm).toBe(500);
    expect(object.depthMm).toBe(550);
    expect(rotatedBoundsMm(object)).toMatchObject({ minXMm: 750, maxXMm: 1250, minYMm: 725, maxYMm: 1275 });
  });

  it("AC-006: 30度回転してもwidthMm/depthMmの正本値は入れ替わらない", () => {
    let state = appReducer(createInitialState(), { type: "ADD_OBJECT", object: { ...chair(), widthMm: 500, depthMm: 550 } });
    state = appReducer(state, { type: "ROTATE_OBJECT", id: "chair-1", rotationDeg: 30 });
    expect(state.project.objects[0]).toMatchObject({ widthMm: 500, depthMm: 550, rotationDeg: 30 });
  });
});
