import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, MAX_HISTORY_ENTRIES } from "./appState";
import type { SceneObject } from "../types/project";

function chair(id: string, xMm = 0, yMm = 0): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: "椅子",
    xMm,
    yMm,
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

function withObjects(objects: SceneObject[]) {
  let state = createInitialState();
  for (const object of objects) state = appReducer(state, { type: "ADD_OBJECT", object });
  return state;
}

describe("Undo/Redo (FR-053、AC-008)", () => {
  it("配置・回転・削除をUndo/Redoで再現できる", () => {
    let state = withObjects([chair("a")]);
    state = appReducer(state, { type: "UPDATE_OBJECT", id: "a", patch: { rotationDeg: 30 } });
    state = appReducer(state, { type: "MOVE_OBJECT", id: "a", xMm: 1000, yMm: 2000 });
    state = appReducer(state, { type: "DELETE_OBJECT", id: "a" });
    expect(state.project.objects).toHaveLength(0);

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects[0].xMm).toBe(1000);
    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects[0].rotationDeg).toBe(30);
    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects[0].xMm).toBe(1000);
    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects).toHaveLength(0);
  });

  it("履歴は最低50操作を保持する", () => {
    let state = withObjects([chair("a")]);
    for (let index = 0; index < 60; index += 1) {
      state = appReducer(state, { type: "UPDATE_OBJECT", id: "a", patch: { xMm: index } });
    }
    expect(state.past.length).toBe(MAX_HISTORY_ENTRIES);
  });

  it("ドラッグのpreviewはpointerupのcommitで1履歴になる", () => {
    let state = withObjects([chair("a")]);
    state = appReducer(state, {
      type: "MOVE_OBJECTS",
      moves: [{ id: "a", xMm: 100, yMm: 100 }],
      preview: true,
    });
    state = appReducer(state, {
      type: "MOVE_OBJECTS",
      moves: [{ id: "a", xMm: 200, yMm: 200 }],
      preview: true,
    });
    expect(state.past.length).toBe(1);
    state = appReducer(state, { type: "COMMIT_TRANSIENT_EDIT" });
    expect(state.past.length).toBe(2);
    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects[0].xMm).toBe(0);
  });
});

describe("複数選択・一括編集 (FR-050、FR-052、FR-056)", () => {
  it("複数選択、複製、グループ化、ロック、削除をActionで実行できる", () => {
    let state = withObjects([chair("a"), chair("b", 1000), chair("c", 2000)]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    expect(state.selectedIds).toEqual(["a", "b"]);
    state = appReducer(state, { type: "GROUP_SELECTED" });
    const groupId = state.project.objects.find((object) => object.id === "a")?.groupId;
    expect(groupId).toBeTruthy();
    state = appReducer(state, { type: "SET_SELECTED_LOCKED", locked: true });
    expect(state.project.objects.filter((object) => object.groupId === groupId).every((object) => object.locked)).toBe(true);
    state = appReducer(state, { type: "DUPLICATE_SELECTED" });
    expect(state.project.objects).toHaveLength(5);
    state = appReducer(state, { type: "DELETE_SELECTED" });
    expect(state.project.objects).toHaveLength(3);
  });
});
