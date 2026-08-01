import { describe, expect, it } from "vitest";
import {
  CHAIR_LINE_DEFAULT_GAP_MM,
  DEFAULT_CHAIR_FACING_ROTATION_DEG,
  chairLineMusicStandPlacement,
  createChairLineObjects,
  fitChairLineStartMm,
  createChairLinePlacements,
  validateChairLineOptions,
  type ChairLineOptions,
} from "./arrangement";
import type { SceneObject } from "../types/project";

function chair(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: "template-chair",
    type: "chair",
    presetId: "chair",
    name: "chair",
    xMm: 0,
    yMm: 0,
    widthMm: 450,
    depthMm: 450,
    heightMm: 450,
    rotationDeg: 0,
    label: "",
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-objects",
    zIndex: 3,
    shape: "rect",
    ...overrides,
  };
}

function options(overrides: Partial<ChairLineOptions> = {}): ChairLineOptions {
  return {
    start: { xMm: 1000, yMm: 2000 },
    count: 4,
    gapMm: 150,
    rotationDeg: 370,
    layerId: "layer-objects",
    ...overrides,
  };
}

describe("chair line arrangement", () => {
  it("uses the 500mm default gap and centers the complete row inside the stage", () => {
    const lineOptions = options({ count: 6, gapMm: CHAIR_LINE_DEFAULT_GAP_MM, rotationDeg: DEFAULT_CHAIR_FACING_ROTATION_DEG });
    const start = fitChairLineStartMm(
      { xMm: 5000, yMm: 3000 },
      chair(),
      lineOptions,
      { minXMm: 0, minYMm: 0, maxXMm: 10000, maxYMm: 6000 },
    );
    const placements = createChairLinePlacements(chair(), { ...lineOptions, start });

    expect(CHAIR_LINE_DEFAULT_GAP_MM).toBe(500);
    expect(DEFAULT_CHAIR_FACING_ROTATION_DEG).toBe(180);
    expect(start).toEqual({ xMm: 2625, yMm: 3000 });
    expect(placements.map((placement) => [placement.xMm, placement.yMm])).toEqual([
      [2625, 3000],
      [3575, 3000],
      [4525, 3000],
      [5475, 3000],
      [6425, 3000],
      [7375, 3000],
    ]);
  });

  it("places an arbitrary count on one horizontal line using edge gaps", () => {
    const placements = createChairLinePlacements(chair(), options());

    expect(placements).toHaveLength(4);
    expect(placements.map((placement) => [placement.xMm, placement.yMm])).toEqual([
      [1000, 2000],
      [1600, 2000],
      [2200, 2000],
      [2800, 2000],
    ]);
    expect(placements.every((placement) => placement.rotationDeg === 10)).toBe(true);
  });

  it("inherits the chair template and resets placement-specific fields", () => {
    const objects = createChairLineObjects(chair({ locked: true, groupId: "old-group" }), options(), (placement) => `line-${placement.chairIndex}`);

    expect(objects.map((object) => object.id)).toEqual(["line-0", "line-1", "line-2", "line-3"]);
    expect(objects.every((object) => object.layerId === "layer-objects")).toBe(true);
    expect(objects.every((object) => !object.locked && object.groupId === null)).toBe(true);
    expect(objects.map((object) => object.zIndex)).toEqual([3, 4, 5, 6]);
  });

  it("adds one music stand in front of every chair when requested", () => {
    const chairTemplate = chair();
    const standTemplate = chair({
      id: "template-stand",
      type: "musicStand",
      presetId: "music-stand",
      name: "music stand",
      widthMm: 480,
      depthMm: 450,
      heightMm: 1300,
    });
    const lineOptions = options({ count: 2, rotationDeg: 0, includeMusicStands: true });
    const placements = createChairLinePlacements(chairTemplate, lineOptions);
    const standPlacement = chairLineMusicStandPlacement(placements[0], chairTemplate, standTemplate);
    const objects = createChairLineObjects(
      chairTemplate,
      lineOptions,
      undefined,
      standTemplate,
      (placement) => "stand-" + placement.chairIndex,
    );

    expect(standPlacement).toEqual({ xMm: 1000, yMm: 1450, rotationDeg: 0 });
    expect(objects).toHaveLength(4);
    expect(objects.filter((object) => object.type === "chair")).toHaveLength(2);
    expect(objects.filter((object) => object.type === "musicStand").map((object) => [object.xMm, object.yMm])).toEqual([
      [1000, 1450],
      [1600, 1450],
    ]);
    expect(objects.filter((object) => object.type === "musicStand").every((object) => object.rotationDeg === 0)).toBe(true);
  });
  it("rejects invalid count, gap, and anchor values", () => {
    expect(validateChairLineOptions(options({ count: 0 }))).not.toEqual([]);
    expect(validateChairLineOptions(options({ gapMm: -1 }))).not.toEqual([]);
    expect(validateChairLineOptions(options({ start: { xMm: Number.NaN, yMm: 0 } }))).not.toEqual([]);
    expect(createChairLinePlacements(chair(), options({ count: 101 }))).toEqual([]);
  });

  it("does not exchange width and depth when the row is rotated", () => {
    const template = chair({ widthMm: 700, depthMm: 330 });
    const placements = createChairLinePlacements(template, options({ count: 2, gapMm: 0, rotationDeg: 90 }));

    expect(placements.map((placement) => placement.xMm)).toEqual([1000, 1700]);
    expect(template.widthMm).toBe(700);
    expect(template.depthMm).toBe(330);
  });
});
