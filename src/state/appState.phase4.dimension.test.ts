import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";
import type { SceneObject } from "../types/project";

function chair(id = "chair-1"): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: "椅子",
    xMm: 1000,
    yMm: 2000,
    widthMm: 450,
    depthMm: 550,
    heightMm: 450,
    rotationDeg: 30,
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

describe("Phase 4 数値寸法編集", () => {
  it("不正な寸法・座標・角度を保存せず、寸法の最小値と角度正規化を守る", () => {
    let state = appReducer(createInitialState(), { type: "ADD_OBJECT", object: chair() });
    state = appReducer(state, {
      type: "UPDATE_OBJECT",
      id: "chair-1",
      patch: {
        xMm: Number.POSITIVE_INFINITY,
        yMm: Number.NaN,
        widthMm: 0,
        depthMm: -100,
        heightMm: -1,
        rotationDeg: 450,
      },
    });

    expect(state.project.objects[0]).toMatchObject({
      xMm: 1000,
      yMm: 2000,
      widthMm: 1,
      depthMm: 1,
      heightMm: 0,
      rotationDeg: 90,
    });
  });

  it("同じ数値を再確定してもUndo履歴を増やさない", () => {
    let state = appReducer(createInitialState(), { type: "ADD_OBJECT", object: chair() });
    const before = state.project.objects[0];
    const historyLength = state.past.length;

    const next = appReducer(state, {
      type: "UPDATE_OBJECT",
      id: before.id,
      patch: {
        xMm: before.xMm,
        yMm: before.yMm,
        widthMm: before.widthMm,
        depthMm: before.depthMm,
        heightMm: before.heightMm,
        rotationDeg: before.rotationDeg,
      },
    });

    expect(next).toBe(state);
    expect(next.past).toHaveLength(historyLength);
  });

  it("数値編集後のUndoで位置・寸法・角度をまとめて元へ戻せる", () => {
    let state = appReducer(createInitialState(), { type: "ADD_OBJECT", object: chair() });
    state = appReducer(state, {
      type: "UPDATE_OBJECT",
      id: "chair-1",
      patch: { xMm: 3000, widthMm: 700, depthMm: 800, rotationDeg: 765 },
    });

    expect(state.project.objects[0]).toMatchObject({ xMm: 3000, widthMm: 700, depthMm: 800, rotationDeg: 45 });
    const undone = appReducer(state, { type: "UNDO" });
    expect(undone.project.objects[0]).toMatchObject({ xMm: 1000, widthMm: 450, depthMm: 550, rotationDeg: 30 });
  });
});
