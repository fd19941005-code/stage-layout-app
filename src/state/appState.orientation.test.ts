import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";
import type { SceneObject } from "../types/project";

function object(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: id,
    xMm: 1000,
    yMm: 2000,
    widthMm: 450,
    depthMm: 600,
    heightMm: 450,
    rotationDeg: 10,
    label: id + "ラベル",
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

describe("左右対称複製と基準点回転のReducer Action", () => {
  it("選択物を左右対称に複製し、内部参照を置換して生成物を選択する", () => {
    let state = withObjects([
      object("riser", { type: "riser", presetId: "riser-3x6", xMm: 2000, groupId: "source-group" }),
      object("chair", { xMm: 1000, onRiserId: "riser", groupId: "source-group" }),
      object("locked", { xMm: 7000, locked: true }),
      object("center", { xMm: 5000 }),
    ]);
    const before = state;
    state = appReducer(state, { type: "SELECT_MANY", ids: ["riser", "chair", "locked", "center"] });
    state = appReducer(state, { type: "MIRROR_SELECTED", axisXMm: 5000 });

    const copies = state.project.objects.filter((item) => state.selectedIds.includes(item.id));
    expect(copies).toHaveLength(2);
    expect(copies.map((item) => item.xMm)).toEqual([8000, 9000]);
    expect(copies[1]!.onRiserId).toBe(copies[0]!.id);
    expect(copies[0]!.groupId).toBe(copies[1]!.groupId);
    expect(copies[0]!.groupId).not.toBe("source-group");
    expect(state.project.objects.some((item) => item.id === "locked" && item.xMm === 7000)).toBe(true);
    expect(state.project.objects.filter((item) => item.id === "center")).toHaveLength(1);

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects).toEqual(before.project.objects);
    expect(state.project.objects).toHaveLength(4);
  });

  it("指定点回転・角度統一・±5度を1回ずつのActionで適用し、位置と寸法を維持する", () => {
    let state = withObjects([
      object("a", { xMm: 1000, yMm: 2000, rotationDeg: 10 }),
      object("b", { xMm: 3000, yMm: 2000, rotationDeg: 20 }),
      object("locked", { xMm: 4000, locked: true, rotationDeg: 40 }),
    ]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b", "locked"] });
    state = appReducer(state, { type: "ROTATE_SELECTED_TO_POINT", point: { xMm: 1000, yMm: 0 } });
    expect(state.project.objects.map((item) => item.rotationDeg)).toEqual([0, 315, 40]);
    expect(state.project.objects.map((item) => [item.xMm, item.yMm, item.widthMm, item.depthMm])).toEqual([
      [1000, 2000, 450, 600],
      [3000, 2000, 450, 600],
      [4000, 2000, 450, 600],
    ]);

    state = appReducer(state, { type: "SET_SELECTED_ROTATION", rotationDeg: 90 });
    expect(state.project.objects.map((item) => item.rotationDeg)).toEqual([90, 90, 40]);
    state = appReducer(state, { type: "ROTATE_SELECTED_DELTA", deltaDeg: 5 });
    expect(state.project.objects.map((item) => item.rotationDeg)).toEqual([95, 95, 40]);
    state = appReducer(state, { type: "ROTATE_SELECTED_DELTA", deltaDeg: -5 });
    expect(state.project.objects.map((item) => item.rotationDeg)).toEqual([90, 90, 40]);
  });

  it("選択した指揮台の中心へ向け、指揮台自身は同一点として変更しない", () => {
    let state = withObjects([
      object("podium", { type: "podium", presetId: "podium", xMm: 1000, yMm: 1000, rotationDeg: 25 }),
      object("chair", { xMm: 1000, yMm: 2000, rotationDeg: 25 }),
    ]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["podium", "chair"] });
    state = appReducer(state, { type: "ROTATE_SELECTED_TO_PODIUM", podiumId: "podium" });
    expect(state.project.objects.find((item) => item.id === "chair")?.rotationDeg).toBe(0);
    expect(state.project.objects.find((item) => item.id === "podium")?.rotationDeg).toBe(25);
  });
});
