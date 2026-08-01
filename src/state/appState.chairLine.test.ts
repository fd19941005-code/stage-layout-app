import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, type AppState } from "./appState";
import { createEmptyProject } from "../core/project";

function calibratedState(): AppState {
  const project = createEmptyProject("chair line test");
  return createInitialState({
    ...project,
    calibration: { ...project.calibration, mmPerPixel: 1, realDistanceMm: 1820 },
  });
}

const options = {
  start: { xMm: 1200, yMm: 2400 },
  count: 5,
  gapMm: 150,
  rotationDeg: 90,
  layerId: "layer-objects",
};

describe("ADD_CHAIR_LINE", () => {
  it("adds all chairs in one history entry and selects the result", () => {
    const before = calibratedState();
    const state = appReducer(before, { type: "ADD_CHAIR_LINE", options });
    const chairs = state.project.objects.filter((object) => object.type === "chair");

    expect(chairs).toHaveLength(5);
    expect(chairs.map((chair) => [chair.xMm, chair.yMm])).toEqual([
      [1200, 2400],
      [1800, 2400],
      [2400, 2400],
      [3000, 2400],
      [3600, 2400],
    ]);
    expect(chairs.every((chair) => chair.rotationDeg === 90)).toBe(true);
    expect(state.selectedIds).toEqual(chairs.map((chair) => chair.id));
    expect(state.past).toHaveLength(1);
    expect(state.past[0]?.objects).toHaveLength(0);
  });

  it("adds one music stand per chair in the same action and history entry", () => {
    const state = appReducer(calibratedState(), {
      type: "ADD_CHAIR_LINE",
      options: { ...options, count: 2, rotationDeg: 0, includeMusicStands: true },
    });
    const chairs = state.project.objects.filter((object) => object.type === "chair");
    const stands = state.project.objects.filter((object) => object.type === "musicStand");

    expect(chairs).toHaveLength(2);
    expect(stands).toHaveLength(2);
    expect(stands.map((stand) => [stand.xMm, stand.yMm])).toEqual([
      [1200, 1850],
      [1800, 1850],
    ]);
    expect(state.selectedIds).toHaveLength(4);
    expect(state.past).toHaveLength(1);
  });
  it("undoes and redoes the complete row as one operation", () => {
    let state = appReducer(calibratedState(), { type: "ADD_CHAIR_LINE", options });
    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects).toHaveLength(0);
    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects.filter((object) => object.type === "chair")).toHaveLength(5);
  });

  it("rejects uncalibrated projects and invalid placement layers", () => {
    const uncalibrated = createInitialState(createEmptyProject("uncalibrated"));
    expect(appReducer(uncalibrated, { type: "ADD_CHAIR_LINE", options })).toBe(uncalibrated);

    const locked = appReducer(calibratedState(), { type: "SET_LAYER_LOCKED", layerId: "layer-objects", locked: true });
    expect(appReducer(locked, { type: "ADD_CHAIR_LINE", options })).toBe(locked);

    const hidden = appReducer(calibratedState(), { type: "SET_LAYER_VISIBLE", layerId: "layer-objects", visible: false });
    expect(appReducer(hidden, { type: "ADD_CHAIR_LINE", options })).toBe(hidden);
  });

  it("uses the standard chair preset fields", () => {
    const state = appReducer(calibratedState(), { type: "ADD_CHAIR_LINE", options: { ...options, count: 1 } });
    const chair = state.project.objects[0];

    expect(chair?.presetId).toBe("chair");
    expect(chair?.widthMm).toBe(450);
    expect(chair?.depthMm).toBe(450);
    expect(chair?.locked).toBe(false);
    expect(chair?.groupId).toBeNull();
  });
});
