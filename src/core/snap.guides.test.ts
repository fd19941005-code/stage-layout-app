import { describe, expect, it } from "vitest";
import { createArcGuide, createHorizontalGuide, createRadialGuide, createVerticalGuide } from "./guides";
import { snapPointMm } from "./snap";
import type { SnapSettings } from "../types/project";

const guideSettings: SnapSettings = {
  grid: false,
  objects: false,
  stageCenter: false,
  gridIntervalMm: 910,
  thresholdMm: 80,
  guides: true,
  guideThresholdMm: 80,
};

describe("編集ガイドへの実寸スナップ", () => {
  it("水平線・垂直線・放射線・円弧へ吸着する", () => {
    expect(snapPointMm({ xMm: 1200, yMm: 1040 }, { settings: guideSettings, otherObjects: [], guides: [createHorizontalGuide("h", 1000)] })).toEqual({ xMm: 1200, yMm: 1000 });
    expect(snapPointMm({ xMm: 2040, yMm: 1200 }, { settings: guideSettings, otherObjects: [], guides: [createVerticalGuide("v", 2000)] })).toEqual({ xMm: 2000, yMm: 1200 });
    expect(snapPointMm({ xMm: 700, yMm: 740 }, { settings: guideSettings, otherObjects: [], guides: [createRadialGuide("r", { xMm: 0, yMm: 0 }, 45)] }).xMm).toBeCloseTo(720, 0);
    const arcPoint = snapPointMm({ xMm: 0, yMm: 950 }, { settings: guideSettings, otherObjects: [], guides: [createArcGuide("a", { xMm: 0, yMm: 0 }, 1000, 0, 180)] });
    expect(arcPoint.xMm).toBeCloseTo(0, 8);
    expect(arcPoint.yMm).toBeCloseTo(1000, 8);
  });

  it("スナップOFFではガイドがあっても入力点を維持する", () => {
    const point = { xMm: 1200, yMm: 1040 };
    expect(snapPointMm(point, { settings: { ...guideSettings, guides: false }, otherObjects: [], guides: [createHorizontalGuide("h", 1000)] })).toEqual(point);
  });
});
