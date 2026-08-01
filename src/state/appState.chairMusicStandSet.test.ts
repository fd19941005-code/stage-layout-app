import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, createPresetObject } from "./appState";
import { createEmptyProject } from "../core/project";
import { CHAIR_MUSIC_STAND_SET_PRESET_ID } from "../core/presets";

function calibratedState() {
  const project = createEmptyProject("セット配置テスト");
  return createInitialState({
    ...project,
    calibration: {
      ...project.calibration,
      mmPerPixel: 1,
    },
  });
}

describe("椅子＋譜面台セットのreducer Action", () => {
  it("2つを1回のUndo単位で追加し、同じグループとして選択する", () => {
    let state = appReducer(calibratedState(), {
      type: "ADD_CHAIR_MUSIC_STAND_SET",
      centerXMm: 5000,
      centerYMm: 4000,
      layerId: "layer-objects",
    });

    expect(state.project.objects).toHaveLength(2);
    expect(state.project.objects.map((object) => object.presetId)).toEqual(["chair", "music-stand"]);
    expect(state.project.objects.map((object) => [object.presetId, object.xMm, object.yMm, object.rotationDeg])).toEqual([
      ["chair", 5000, 3725, 180],
      ["music-stand", 5000, 4275, 180],
    ]);
    expect(new Set(state.project.objects.map((object) => object.groupId)).size).toBe(1);
    expect(state.selectedIds).toEqual(state.project.objects.map((object) => object.id));
    expect(state.past).toHaveLength(1);

    state = appReducer(state, { type: "SELECT_GROUP", id: state.project.objects[0].id });
    expect(state.selectedIds).toEqual(state.project.objects.map((object) => object.id));

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects).toHaveLength(0);
    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects).toHaveLength(2);
  });

  it("セット回転でも椅子と譜面台の実寸値を保持する", () => {
    let state = appReducer(calibratedState(), {
      type: "ADD_CHAIR_MUSIC_STAND_SET",
      centerXMm: 5000,
      centerYMm: 4000,
      layerId: "layer-objects",
    });
    const before = state.project.objects.map((object) => [object.widthMm, object.depthMm]);
    state = appReducer(state, { type: "ROTATE_OBJECT", id: state.project.objects[0].id, rotationDeg: 90 });
    expect(state.project.objects.map((object) => [object.widthMm, object.depthMm])).toEqual(before);
    expect(state.project.objects.every((object) => object.rotationDeg === 90)).toBe(true);
  });

  it("校正前とセット仮想プリセットの単体生成は安全に拒否する", () => {
    const uncalibrated = createInitialState();
    expect(appReducer(uncalibrated, {
      type: "ADD_CHAIR_MUSIC_STAND_SET",
      centerXMm: 0,
      centerYMm: 0,
      layerId: "layer-objects",
    })).toBe(uncalibrated);
    expect(createPresetObject(CHAIR_MUSIC_STAND_SET_PRESET_ID, "layer-objects", 0)).toBeNull();
  });
});
