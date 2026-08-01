import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";
import type { SceneObject } from "../types/project";

function object(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: id,
    xMm: 0,
    yMm: 0,
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
    ...overrides,
  };
}

function withObjects(objects: SceneObject[]) {
  let state = createInitialState();
  for (const item of objects) state = appReducer(state, { type: "ADD_OBJECT", object: item });
  return state;
}

describe("クリップボード関連Action", () => {
  it("複数オブジェクトの貼り付けをUndo 1回で戻し、Undo後も再度貼り付けられる", () => {
    let state = withObjects([object("source")]);
    const beforePasteHistory = state.past.length;
    state = appReducer(state, {
      type: "ADD_OBJECTS",
      objects: [object("paste-a", { xMm: 500 }), object("paste-b", { xMm: 1000 })],
    });

    expect(state.project.objects.map((item) => item.id)).toEqual(["source", "paste-a", "paste-b"]);
    expect(state.selectedIds).toEqual(["paste-a", "paste-b"]);
    expect(state.past).toHaveLength(beforePasteHistory + 1);

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects.map((item) => item.id)).toEqual(["source"]);
    expect(state.future).toHaveLength(1);

    state = appReducer(state, {
      type: "ADD_OBJECTS",
      objects: [object("paste-again-a", { xMm: 1500 }), object("paste-again-b", { xMm: 2000 })],
    });
    expect(state.project.objects.map((item) => item.id)).toEqual(["source", "paste-again-a", "paste-again-b"]);
    expect(state.selectedIds).toEqual(["paste-again-a", "paste-again-b"]);
  });

  it("切り取りはロック物を1個でも含む場合に全体を中止し、部分削除しない", () => {
    let state = withObjects([
      object("editable"),
      object("locked", { locked: true, xMm: 1000 }),
    ]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["editable", "locked"] });
    const beforeHistory = state.past.length;
    state = appReducer(state, { type: "CUT_SELECTED" });

    expect(state.project.objects.map((item) => item.id)).toEqual(["editable", "locked"]);
    expect(state.past).toHaveLength(beforeHistory);
  });

  it("ロックされていない選択の切り取りはUndo 1回で復元できる", () => {
    let state = withObjects([object("a"), object("b", { xMm: 500 })]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    const beforeHistory = state.past.length;
    state = appReducer(state, { type: "CUT_SELECTED" });

    expect(state.project.objects).toHaveLength(0);
    expect(state.past).toHaveLength(beforeHistory + 1);
    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("貼り付けActionは重複IDを受け取った場合に部分追加しない", () => {
    const state = withObjects([object("source")]);
    const next = appReducer(state, {
      type: "ADD_OBJECTS",
      objects: [object("new"), object("source", { xMm: 100 })],
    });
    expect(next).toBe(state);
    expect(next.project.objects).toHaveLength(1);
    expect(next.past).toHaveLength(state.past.length);
  });
});
