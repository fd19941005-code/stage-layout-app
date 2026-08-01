import { describe, expect, it } from "vitest";
import { createChairMusicStandSetObjects } from "./chairMusicStandSet";
import { CHAIR_MUSIC_STAND_SET_PRESET_ID, findPreset } from "./presets";
import { sceneObjectBoundsMm } from "./transform";
import type { SceneObject } from "../types/project";

function template(presetId: "chair" | "music-stand", zIndex: number): SceneObject {
  const preset = findPreset(presetId);
  if (!preset) throw new Error("missing preset");
  return {
    id: "template-" + presetId,
    type: preset.type,
    presetId,
    name: preset.name,
    xMm: 0,
    yMm: 0,
    widthMm: preset.widthMm,
    depthMm: preset.depthMm,
    heightMm: preset.heightMm,
    rotationDeg: 0,
    label: "",
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-objects",
    zIndex,
    shape: preset.shape,
  };
}

describe("椅子＋譜面台セット配置", () => {
  it("セット中心から100mm離して2つを同じグループへ生成する", () => {
    const objects = createChairMusicStandSetObjects(
      template("chair", 0),
      template("music-stand", 1),
      {
        center: { xMm: 5000, yMm: 4000 },
        rotationDeg: 0,
        layerId: "layer-objects",
        baseZIndex: 8,
        groupId: "set-1",
      },
      (role) => "set-1-" + role,
    );

    expect(objects).toHaveLength(2);
    expect(objects.map((object) => object.presetId)).toEqual(["chair", "music-stand"]);
    expect(objects.map((object) => [object.xMm, object.yMm])).toEqual([
      [5000, 4275],
      [5000, 3725],
    ]);
    expect(objects.every((object) => object.groupId === "set-1")).toBe(true);
    expect(objects.map((object) => object.zIndex)).toEqual([8, 9]);
    expect(sceneObjectBoundsMm(objects[0])).toMatchObject({ minYMm: 4050, maxYMm: 4500 });
    expect(sceneObjectBoundsMm(objects[1])).toMatchObject({ minYMm: 3500, maxYMm: 3950 });
  });

  it("回転しても子オブジェクトの寸法を入れ替えず相対位置だけを回す", () => {
    const objects = createChairMusicStandSetObjects(
      template("chair", 0),
      template("music-stand", 1),
      {
        center: { xMm: 5000, yMm: 4000 },
        rotationDeg: 90,
        layerId: "layer-objects",
        baseZIndex: 0,
        groupId: "set-2",
      },
      (role) => "set-2-" + role,
    );

    expect(objects.map((object) => [Math.round(object.xMm), Math.round(object.yMm)])).toEqual([
      [4725, 4000],
      [5275, 4000],
    ]);
    expect(objects.map((object) => [object.widthMm, object.depthMm, object.rotationDeg])).toEqual([
      [450, 450, 90],
      [480, 450, 90],
    ]);
  });

  it("ライブラリにはセット用の仮想プリセットを登録する", () => {
    expect(findPreset(CHAIR_MUSIC_STAND_SET_PRESET_ID)).toMatchObject({
      name: "椅子＋譜面台セット",
      isGroupPreset: true,
      widthMm: 480,
      depthMm: 1000,
    });
  });
});
