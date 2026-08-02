import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";
import type { SceneObject } from "../types/project";
import { deserializeProject, serializeProject } from "../core/project";

function object(id: string, xMm = 0, yMm = 0, overrides: Partial<SceneObject> = {}): SceneObject {
  return { id, type: "chair", presetId: "chair", name: id, xMm, yMm, widthMm: 450, depthMm: 450, heightMm: 450, rotationDeg: 0, label: "", onRiserId: null, avatar: null, locked: false, visible: true, groupId: null, layerId: "layer-objects", zIndex: 0, shape: "rect", ...overrides };
}

function calibratedState(objects: SceneObject[]) {
  const project = { ...createInitialState().project, calibration: { mmPerPixel: 1, pointA: null, pointB: null, realDistanceMm: 1000, calibratedAt: null }, objects };
  return createInitialState(project);
}

describe("custom riser and line actions", () => {
  it("creates an ordered riser group, selects all children, and records one history entry", () => {
    let state = calibratedState([object("chair", 0)]);
    state = appReducer(state, { type: "ADD_RISER_GROUP", layerId: "layer-objects", fixedToBack: true, options: { center: { xMm: 5000, yMm: 2000 }, segments: [{ presetId: "riser-3x6", count: 1 }, { presetId: "riser-6x6", count: 2 }, { presetId: "riser-3x6", count: 1 }], heightMm: 450, direction: "horizontal" } });
    const risers = state.project.objects.filter((object) => object.type === "riser");
    expect(risers).toHaveLength(4);
    expect(new Set(risers.map((object) => object.groupId)).size).toBe(1);
    expect(risers.every((object) => object.heightMm === 450 && object.backgroundFixed)).toBe(true);
    expect(risers.every((object) => !object.locked)).toBe(true);
    expect(state.selectedIds).toEqual(risers.map((object) => object.id));
    expect(state.past).toHaveLength(1);
    expect(state.project.objects.slice(0, 4).every((object) => object.type === "riser")).toBe(true);
  });

  it("creates a repeated riser row block as one grouped undoable placement", () => {
    let state = calibratedState([]);
    state = appReducer(state, { type: "ADD_RISER_GROUP", layerId: "layer-objects", fixedToBack: false, options: {
      center: { xMm: 5000, yMm: 3000 },
      segments: [{ presetId: "riser-3x6", count: 2, rotationDeg: 90 }],
      heightMm: 300,
      direction: "horizontal",
      parallelCount: 2,
      parallelGapMm: 100,
    } });
    const risers = state.project.objects.filter((item) => item.type === "riser");
    expect(risers).toHaveLength(4);
    expect(new Set(risers.map((item) => item.groupId)).size).toBe(1);
    expect(risers.every((item) => item.rotationDeg === 90)).toBe(true);
    expect(state.selectedIds).toEqual(risers.map((item) => item.id));
    expect(state.past).toHaveLength(1);
  });

  it("creates custom compositions for separate riser rows", () => {
    let state = calibratedState([]);
    state = appReducer(state, { type: "ADD_RISER_GROUP", layerId: "layer-objects", fixedToBack: false, options: {
      center: { xMm: 5000, yMm: 3000 },
      segments: [{ presetId: "riser-6x6", count: 1 }],
      parallelRows: [
        { segments: [{ presetId: "riser-6x6", count: 1 }] },
        { segments: [{ presetId: "riser-4x6", count: 1 }] },
      ],
      heightMm: 300,
      direction: "horizontal",
      parallelCount: 2,
      parallelGapMm: 100,
    } });
    const risers = state.project.objects.filter((item) => item.type === "riser");
    expect(risers.map((item) => item.presetId)).toEqual(["riser-6x6", "riser-4x6"]);
    expect(new Set(risers.map((item) => item.groupId)).size).toBe(1);
  });

  it("preserves fixed riser group state through JSON round trip", () => {
    let state = calibratedState([object("chair", 0)]);
    state = appReducer(state, { type: "ADD_RISER_GROUP", layerId: "layer-objects", fixedToBack: true, options: { center: { xMm: 5000, yMm: 2000 }, segments: [{ presetId: "riser-3x6", count: 2 }], heightMm: 300, direction: "horizontal" } });
    const restored = deserializeProject(serializeProject(state.project));
    const risers = restored.objects.filter((item) => item.type === "riser");
    expect(risers).toHaveLength(2);
    expect(new Set(risers.map((item) => item.groupId)).size).toBe(1);
    expect(risers.every((item) => item.backgroundFixed)).toBe(true);
    expect(risers.every((item) => !item.locked)).toBe(true);
    expect(risers.map((item) => item.zIndex)).toEqual([0, 1]);
  });

  it("previews line spacing from an immutable base and cancels without adding history", () => {
    let state = calibratedState([object("a", 0, 0), object("b", 1500, 900), object("c", 3000, -500)]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b", "c"] });
    state = appReducer(state, { type: "ARRANGE_SELECTED_LINE", ids: ["a", "b", "c"], options: { axis: "x", gapMm: 200 }, preview: true });
    state = appReducer(state, { type: "ARRANGE_SELECTED_LINE", ids: ["a", "b", "c"], options: { axis: "x", gapMm: 600 }, preview: true });
    expect(state.project.objects.map((object) => object.yMm)).toEqual([0, 0, 0]);
    expect(state.past).toHaveLength(0);
    state = appReducer(state, { type: "CANCEL_TRANSIENT_EDIT" });
    expect(state.project.objects.map((object) => object.yMm)).toEqual([0, 900, -500]);
    expect(state.past).toHaveLength(0);
  });

  it("cancels a move preview without committing it", () => {
    let state = calibratedState([object("a", 0, 0)]);
    state = appReducer(state, { type: "MOVE_OBJECTS", moves: [{ id: "a", xMm: 900, yMm: 800 }], preview: true });
    state = appReducer(state, { type: "CANCEL_TRANSIENT_EDIT" });
    expect(state.project.objects[0]).toMatchObject({ xMm: 0, yMm: 0 });
    expect(state.past).toHaveLength(0);
  });
  it("suppresses a line operation when the selection mixes locked objects", () => {
    let state = calibratedState([object("editable", 0, 0), object("locked", 1000, 500, { locked: true })]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["editable", "locked"] });
    const next = appReducer(state, { type: "ARRANGE_SELECTED_LINE", ids: ["editable", "locked"], options: { axis: "x", gapMm: 100 }, preview: true });
    expect(next.project.objects.map((item) => item.yMm)).toEqual([0, 500]);
    expect(next.transientBaseProject).toBeNull();
  });
  it("commits a line preview as one undoable operation", () => {
    let state = calibratedState([object("a", 0, 0), object("b", 1000, 800)]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    state = appReducer(state, { type: "ARRANGE_SELECTED_LINE", ids: ["a", "b"], options: { axis: "y", gapMm: 300 }, preview: true });
    state = appReducer(state, { type: "COMMIT_TRANSIENT_EDIT" });
    expect(state.past).toHaveLength(1);
    expect(state.project.objects.map((object) => object.xMm)).toEqual([0, 0]);
    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects.map((object) => object.yMm)).toEqual([0, 800]);
  });
  it("背景化した山台は範囲選択・混在移動・複製から除外される", () => {
    let state = calibratedState([
      object("chair", 3000, 0),
      object("riser", 0, 0, { type: "riser", presetId: "riser-6x6", widthMm: 1820, depthMm: 1820, groupId: "riser-group", backgroundFixed: true }),
    ]);
    state = appReducer(state, { type: "SELECT_RECT", bounds: { minXMm: -1000, minYMm: -1000, maxXMm: 4000, maxYMm: 1000 } });
    expect(state.selectedIds).toEqual(["chair"]);
    state = appReducer(state, { type: "SELECT", id: "riser", additive: true });
    state = appReducer(state, { type: "NUDGE_SELECTED", dxMm: 100, dyMm: 50 });
    expect(state.project.objects.find((item) => item.id === "chair")).toMatchObject({ xMm: 3100, yMm: 50 });
    expect(state.project.objects.find((item) => item.id === "riser")).toMatchObject({ xMm: 0, yMm: 0 });
    const beforeDuplicateCount = state.project.objects.length;
    state = appReducer(state, { type: "DUPLICATE_SELECTED" });
    expect(state.project.objects).toHaveLength(beforeDuplicateCount + 1);
    expect(state.project.objects.filter((item) => item.type === "riser")).toHaveLength(1);
  });

  it("選択した山台だけ背景化し、背景化解除で通常編集へ戻せる", () => {
    let state = calibratedState([
      object("riser-a", 0, 0, { type: "riser", presetId: "riser-6x6", groupId: "riser-group" }),
      object("riser-b", 2000, 0, { type: "riser", presetId: "riser-6x6", groupId: "riser-group" }),
    ]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["riser-a", "riser-b"] });
    state = appReducer(state, { type: "SET_SELECTED_BACKGROUND_FIXED", fixed: true });
    expect(state.project.objects.every((item) => item.backgroundFixed)).toBe(true);
    state = appReducer(state, { type: "SET_SELECTED_BACKGROUND_FIXED", fixed: false });
    expect(state.project.objects.every((item) => !item.backgroundFixed)).toBe(true);
  });
});
