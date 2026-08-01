// 配置時に指揮台へ向ける設定と、セット配置の剛体回転。
// 角度計算そのものはcore/orientationのrotationDegTowardPointが正本。

import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";
import { createEmptyProject } from "../core/project";
import { rotationDegTowardPoint } from "../core/orientation";

function calibratedState() {
  const project = createEmptyProject("配置向きテスト");
  return createInitialState({ ...project, calibration: { ...project.calibration, mmPerPixel: 1 } });
}

describe("配置時の向き", () => {
  it("既定はオフで、Actionで切り替えられる", () => {
    const initial = createInitialState();
    expect(initial.placementFacePodium).toBe(false);

    const enabled = appReducer(initial, { type: "SET_PLACEMENT_FACE_PODIUM", facePodium: true });
    expect(enabled.placementFacePodium).toBe(true);
    expect(appReducer(enabled, { type: "SET_PLACEMENT_FACE_PODIUM", facePodium: false }).placementFacePodium).toBe(false);
  });

  it("Projectと履歴・保存状態を変えない表示側の設定である", () => {
    const initial = createInitialState();
    const enabled = appReducer(initial, { type: "SET_PLACEMENT_FACE_PODIUM", facePodium: true });

    expect(enabled.project).toBe(initial.project);
    expect(enabled.past).toHaveLength(0);
    expect(enabled.saveState).toBe("saved");
  });

  it("指揮台の真下に置いたオブジェクトは0度(画面上向き)で指揮台を向く", () => {
    expect(rotationDegTowardPoint({ xMm: 5000, yMm: 6000 }, { xMm: 5000, yMm: 4000 })).toBe(0);
    expect(rotationDegTowardPoint({ xMm: 3000, yMm: 4000 }, { xMm: 5000, yMm: 4000 })).toBe(90);
    expect(rotationDegTowardPoint({ xMm: 5000, yMm: 4000 }, { xMm: 5000, yMm: 4000 })).toBeNull();
  });
});

describe("セット配置の剛体回転", () => {
  it("rotationDeg未指定のときは従来どおり0度で配置する", () => {
    const state = appReducer(createInitialState(), {
      type: "ADD_GROUP_PRESET",
      presetId: "concert-tom-set-4",
      centerXMm: 3000,
      centerYMm: 2500,
      layerId: "layer-objects",
    });

    expect(state.project.objects.every((object) => object.rotationDeg === 0)).toBe(true);
    expect(state.project.objects.map((object) => object.xMm)).toEqual([2485, 2905, 3275, 3590]);
    expect(state.project.objects.map((object) => object.yMm)).toEqual([2530, 2450, 2420, 2500]);
  });

  it("rotationDegを渡すと、内部の相対配置を保ったままセット中心まわりに回る", () => {
    const base = appReducer(createInitialState(), {
      type: "ADD_GROUP_PRESET",
      presetId: "concert-tom-set-4",
      centerXMm: 3000,
      centerYMm: 2500,
      layerId: "layer-objects",
    });
    const rotated = appReducer(createInitialState(), {
      type: "ADD_GROUP_PRESET",
      presetId: "concert-tom-set-4",
      centerXMm: 3000,
      centerYMm: 2500,
      layerId: "layer-objects",
      rotationDeg: 90,
    });

    expect(rotated.project.objects.every((object) => object.rotationDeg === 90)).toBe(true);
    expect(rotated.project.objects.map((object) => object.presetId)).toEqual(base.project.objects.map((object) => object.presetId));
    rotated.project.objects.forEach((object, index) => {
      const original = base.project.objects[index];
      expect(object.xMm).toBe(3000 - (original.yMm - 2500));
      expect(object.yMm).toBe(2500 + (original.xMm - 3000));
      // 寸法は回転で入れ替えない(AC-006)。
      expect(object.widthMm).toBe(original.widthMm);
      expect(object.depthMm).toBe(original.depthMm);
    });
  });

  it("椅子＋譜面台セットもrotationDegで向きを合わせて配置できる", () => {
    const state = appReducer(calibratedState(), {
      type: "ADD_CHAIR_MUSIC_STAND_SET",
      centerXMm: 4000,
      centerYMm: 3000,
      layerId: "layer-objects",
      rotationDeg: 180,
    });

    expect(state.project.objects).toHaveLength(2);
    expect(state.project.objects.every((object) => object.rotationDeg === 180)).toBe(true);
    const chair = state.project.objects.find((object) => object.presetId === "chair");
    const stand = state.project.objects.find((object) => object.presetId === "music-stand");
    expect(chair).toBeDefined();
    expect(stand).toBeDefined();
    // 180度では椅子が上、譜面台が下。0度(椅子が下)の逆になる。
    expect(chair!.yMm).toBeLessThan(stand!.yMm);
  });
});
