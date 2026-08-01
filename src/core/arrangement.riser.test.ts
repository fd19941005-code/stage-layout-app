import { describe, expect, it } from "vitest";
import { createRiserGroupPlacements, fitRiserGroupCenterMm, riserGroupBoundsMm, type RiserDimensions } from "./arrangement";

const dimensions: RiserDimensions = {
  "riser-3x6": { widthMm: 910, depthMm: 1820 },
  "riser-4x6": { widthMm: 1220, depthMm: 1820 },
  "riser-6x6": { widthMm: 1820, depthMm: 1820 },
};

describe("custom riser group placement", () => {
  it("expands an ordered segment sequence without gaps and centers it", () => {
    const options = {
      center: { xMm: 10000, yMm: 20000 },
      segments: [
        { presetId: "riser-3x6" as const, count: 1 },
        { presetId: "riser-6x6" as const, count: 5 },
        { presetId: "riser-3x6" as const, count: 1 },
      ] as const,
      heightMm: 300,
      direction: "horizontal" as const,
    };
    const placements = createRiserGroupPlacements(options, dimensions);
    expect(placements).toHaveLength(7);
    expect(placements[0]).toMatchObject({ presetId: "riser-3x6", rotationDeg: 0, yMm: 20000 });
    expect(placements[1]).toMatchObject({ presetId: "riser-6x6", rotationDeg: 0, yMm: 20000 });
    expect(placements[6]).toMatchObject({ presetId: "riser-3x6", rotationDeg: 0, yMm: 20000 });
    const bounds = riserGroupBoundsMm(options, dimensions);
    expect(bounds).toEqual({ widthMm: 10920, depthMm: 1820 });
    const leftEdge = placements[0].xMm - dimensions[placements[0].presetId].widthMm / 2;
    const rightEdge = placements[6].xMm + dimensions[placements[6].presetId].widthMm / 2;
    expect(leftEdge).toBe(4540);
    expect(rightEdge).toBe(15460);
  });

  it("fits the default center inside the stage bounds even when the pointer is outside", () => {
    const center = fitRiserGroupCenterMm(
      { xMm: -500, yMm: 9000 },
      { widthMm: 1820, depthMm: 1820 },
      { minXMm: 0, minYMm: 0, maxXMm: 10000, maxYMm: 6000 },
    );
    expect(center).toEqual({ xMm: 910, yMm: 5090 });
    expect(fitRiserGroupCenterMm(
      { xMm: 0, yMm: 0 },
      { widthMm: 12000, depthMm: 2000 },
      { minXMm: 0, minYMm: 0, maxXMm: 10000, maxYMm: 6000 },
    )).toEqual({ xMm: 5000, yMm: 1000 });
  });

  it("uses a 90-degree drawing rotation for vertical mode without swapping dimensions", () => {
    const options = { center: { xMm: 0, yMm: 0 }, segments: [{ presetId: "riser-4x6" as const, count: 2 }], heightMm: 600, direction: "vertical" as const };
    const placements = createRiserGroupPlacements(options, dimensions);
    expect(placements.map((placement) => placement.rotationDeg)).toEqual([90, 90]);
    expect(riserGroupBoundsMm(options, dimensions)).toEqual({ widthMm: 1820, depthMm: 2440 });
  });

  it("rotates 3x6 and 4x6 risers into a horizontal long-side row", () => {
    const options = {
      center: { xMm: 5000, yMm: 3000 },
      segments: [
        { presetId: "riser-3x6" as const, count: 2, rotationDeg: 90 as const },
        { presetId: "riser-4x6" as const, count: 1, rotationDeg: 90 as const },
      ],
      heightMm: 300,
      direction: "horizontal" as const,
    };
    const placements = createRiserGroupPlacements(options, dimensions);
    expect(placements.map((placement) => placement.rotationDeg)).toEqual([90, 90, 90]);
    expect(placements.map((placement) => placement.xMm)).toEqual([3180, 5000, 6820]);
    expect(placements.every((placement) => placement.yMm === 3000)).toBe(true);
    expect(riserGroupBoundsMm(options, dimensions)).toEqual({ widthMm: 5460, depthMm: 1220 });
  });
  it("rejects a segment above the safe count limit", () => {
    const options = { center: { xMm: 0, yMm: 0 }, segments: [{ presetId: "riser-6x6" as const, count: 51 }], heightMm: 300, direction: "horizontal" as const };
    expect(createRiserGroupPlacements(options, dimensions)).toEqual([]);
  });
});
