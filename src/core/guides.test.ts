import { describe, expect, it } from "vitest";
import {
  createArcGuide,
  createHorizontalGuide,
  createRadialGuide,
  createStageCenterGuide,
  createStageFrontGuide,
  createVerticalGuide,
  intersectGuides,
  nearestGuideSnap,
  synchronizeGeneratedGuides,
} from "./guides";

describe("editing guide geometry", () => {
  it("snaps to horizontal and vertical guides", () => {
    const horizontal = createHorizontalGuide("h", 1000);
    const vertical = createVerticalGuide("v", 2000);
    expect(nearestGuideSnap({ xMm: 1400, yMm: 1040 }, [horizontal], 80)?.point).toEqual({ xMm: 1400, yMm: 1000 });
    expect(nearestGuideSnap({ xMm: 1960, yMm: 700 }, [vertical], 80)?.point).toEqual({ xMm: 2000, yMm: 700 });
  });

  it("snaps to radial and arc guides", () => {
    const radial = createRadialGuide("r", { xMm: 0, yMm: 0 }, 45);
    const arc = createArcGuide("a", { xMm: 0, yMm: 0 }, 1000, 0, 180);
    const radialSnap = nearestGuideSnap({ xMm: 700, yMm: 740 }, [radial], 60);
    expect(radialSnap?.point.xMm).toBeCloseTo(radialSnap!.point.yMm, 5);
    const arcSnap = nearestGuideSnap({ xMm: 0, yMm: 950 }, [arc], 60);
    expect(arcSnap?.point.xMm).toBeCloseTo(0, 8);
    expect(arcSnap?.point.yMm).toBeCloseTo(1000, 8);
  });

  it("calculates intersections for lines, rays, and arcs", () => {
    const horizontal = createHorizontalGuide("h", 1000);
    const vertical = createVerticalGuide("v", 2000);
    const radial = createRadialGuide("r", { xMm: 0, yMm: 0 }, 0);
    const arc = createArcGuide("a", { xMm: 0, yMm: 0 }, 2000, 0, 180);
    expect(intersectGuides(horizontal, vertical)).toEqual([{ xMm: 2000, yMm: 1000 }]);
    expect(intersectGuides(radial, horizontal)).toEqual([]);
    expect(intersectGuides(radial, arc)).toEqual([{ xMm: 2000, yMm: 0 }]);
  });

  it("synchronizes generated center and front guides from stage settings", () => {
    const center = createStageCenterGuide("center", 6000);
    const front = createStageFrontGuide("front", 5000, 1000);
    const synced = synchronizeGeneratedGuides([center, front], { stageWidthMm: 8000, stageFrontYMm: 7000 });
    expect(synced[0]?.xMm).toBe(4000);
    expect(synced[1]?.yMm).toBe(6000);
    expect(synced[1]?.distanceMm).toBe(1000);
  });
});
