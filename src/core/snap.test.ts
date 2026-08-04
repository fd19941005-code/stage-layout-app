import { describe, expect, it } from "vitest";
import { snapPointMm } from "./snap";
import type { SceneObject, SnapSettings } from "../types/project";

const settings: SnapSettings = { grid: true, objects: true, stageCenter: true, gridIntervalMm: 910, thresholdMm: 80 };
const other: SceneObject = {
  id: "other", type: "chair", presetId: "chair", name: "椅子", xMm: 2000, yMm: 3000,
  widthMm: 450, depthMm: 450, heightMm: 450, rotationDeg: 0, label: "", onRiserId: null,
  avatar: null, locked: false, visible: true, groupId: null, layerId: "layer-objects", zIndex: 0, shape: "rect",
};

describe("実寸スナップ", () => {
  it("グリッド・他オブジェクト・舞台中心線へmmで吸着する", () => {
    expect(snapPointMm({ xMm: 1825, yMm: 1825 }, { settings, otherObjects: [other], stageWidthMm: 4000 })).toEqual({ xMm: 1820, yMm: 1820 });
    expect(snapPointMm({ xMm: 1980, yMm: 3010 }, { settings, otherObjects: [other], stageWidthMm: 4000 })).toEqual({ xMm: 2000, yMm: 3000 });
    expect(snapPointMm({ xMm: 1980, yMm: 2500 }, { settings: { ...settings, grid: false, objects: false }, otherObjects: [], stageWidthMm: 4000 })).toEqual({ xMm: 2000, yMm: 2500 });
  });

  it("無効なスナップ設定では入力点を変えない", () => {
    const point = { xMm: 1234, yMm: 5678 };
    expect(snapPointMm(point, { settings: { ...settings, grid: false, objects: false, stageCenter: false }, otherObjects: [], stageWidthMm: 4000 })).toEqual(point);
  });
  it("テンプレートの中央寄せ・下端寄せグリッド原点に吸着する", () => {
    const templateSettings = { ...settings, objects: false, stageCenter: false, gridIntervalMm: 1820 };
    const snapped = snapPointMm(
      { xMm: 5605, yMm: 905 },
      {
        settings: templateSettings,
        otherObjects: [],
        gridOriginXMm: 5590,
        gridOriginYMm: 10000,
      },
    );
    expect(snapped).toEqual({ xMm: 5590, yMm: 900 });
  });
});
