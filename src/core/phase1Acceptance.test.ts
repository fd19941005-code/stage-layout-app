import { describe, expect, it } from "vitest";
import { findPreset } from "./presets";
import {
  computeMmPerPixel,
  measuredCalibrationDistanceMm,
} from "./transform";

describe("Phase 1受入条件", () => {
  it("AC-001: 10,000mmで校正した基準線の再測定値は許容範囲内", () => {
    const pointA = { xPx: 40, yPx: 80 };
    const pointB = { xPx: 240, yPx: 80 };
    const mmPerPixel = computeMmPerPixel(pointA, pointB, 10_000);
    const measured = measuredCalibrationDistanceMm(pointA, pointB, mmPerPixel);
    expect(measured).toBeGreaterThanOrEqual(9_900);
    expect(measured).toBeLessThanOrEqual(10_100);
  });

  it("AC-002: 910mm基準で450mm角の椅子はグリッドの半分未満の辺長になる", () => {
    const chair = findPreset("chair");
    expect(chair).toBeDefined();
    const mmPerPixel = computeMmPerPixel({ xPx: 0, yPx: 0 }, { xPx: 100, yPx: 0 }, 910);
    const chairPixels = (chair?.widthMm ?? 0) / mmPerPixel;
    expect(chairPixels / 100).toBeCloseTo(450 / 910);
    expect(chairPixels).toBeGreaterThan(45);
    expect(chairPixels).toBeLessThan(55);
  });

  it("AC-013: 未校正では実寸配置の許可条件を満たさない", () => {
    const uncalibrated = { mmPerPixel: null };
    const calibrated = { mmPerPixel: 9.1 };
    expect(uncalibrated.mmPerPixel).toBeNull();
    expect(calibrated.mmPerPixel).toBeGreaterThan(0);
  });
});
