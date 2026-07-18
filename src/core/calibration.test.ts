import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./project";
import { calibrationDistanceLabel } from "./presets";
import { computeMmPerPixel, measuredCalibrationDistanceMm, sourcePxToDisplayedPx } from "./transform";

describe("校正確認の座標系", () => {
  it("切り抜き・90度回転後も元画像pxの校正点を表示pxへ戻して同じ距離を測れる", () => {
    const project = createEmptyProject("校正座標");
    project.background = {
      ...project.background,
      naturalWidthPx: 1200,
      naturalHeightPx: 800,
      crop: { xPx: 100, yPx: 50, widthPx: 900, heightPx: 600 },
      rotationDeg: 90,
    };
    const pointA = { xPx: 100, yPx: 50 };
    const pointB = { xPx: 100, yPx: 150 };
    const mmPerPixel = computeMmPerPixel({ xPx: 0, yPx: 0 }, { xPx: 0, yPx: 100 }, 910);
    expect(measuredCalibrationDistanceMm(sourcePxToDisplayedPx(pointA, project.background), sourcePxToDisplayedPx(pointB, project.background), mmPerPixel)).toBeCloseTo(910);
  });
});


describe("校正距離プリセットの説明 (UX-005)", () => {
  it("910mmと1820mmに半間・1間の意味を併記する", () => {
    expect(calibrationDistanceLabel(910)).toBe("半間・3尺（910mm）");
    expect(calibrationDistanceLabel(1820)).toBe("1間（1820mm）");
  });

  it("その他の距離は数値をそのまま表示する", () => {
    expect(calibrationDistanceLabel(1000)).toBe("1000mm");
  });
});
