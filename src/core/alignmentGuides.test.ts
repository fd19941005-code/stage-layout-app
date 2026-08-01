import { describe, expect, it } from "vitest";
import type { SceneObject } from "../types/project";
import { findAlignmentGuides } from "./alignmentGuides";

function object(
  id: string,
  xMm: number,
  yMm: number,
  widthMm = 400,
  depthMm = 400,
  rotationDeg = 0,
): SceneObject {
  return {
    id,
    type: "shape",
    presetId: null,
    name: id,
    xMm,
    yMm,
    widthMm,
    depthMm,
    heightMm: 0,
    rotationDeg,
    label: "",
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-objects",
    zIndex: 0,
    shape: "rect",
  };
}

describe("オブジェクト整列ガイド", () => {
  it("左右と上下の辺を同時に検出し、移動量を揃える", () => {
    const moving = object("moving", 1000, 1000);
    const target = object("target", 2000, 2000, 600, 600);

    const result = findAlignmentGuides(
      [moving, target],
      [moving.id],
      { xMm: 495, yMm: 495 },
      20,
    );

    expect(result.delta).toEqual({ xMm: 500, yMm: 500 });
    expect(result.guides.map((guide) => [guide.axis, guide.positionMm, guide.label])).toEqual([
      ["vertical", 1700, "右端 = 左端"],
      ["horizontal", 1700, "下端 = 上端"],
    ]);
  });

  it("複数選択には同じ補正を適用し、選択物同士は候補にしない", () => {
    const moving = object("moving", 1000, 1000);
    const selectedTogether = object("selected-together", 5000, 1000);
    const target = object("target", 2000, 2000);

    const result = findAlignmentGuides(
      [moving, selectedTogether, target],
      [moving.id, selectedTogether.id],
      { xMm: 799, yMm: 0 },
      5,
    );

    expect(result.delta.xMm).toBe(800);
    expect(result.guides.some((guide) => guide.movingObjectId === selectedTogether.id)).toBe(false);
    expect(result.guides.some((guide) => guide.targetObjectId === target.id)).toBe(true);
  });

  it("回転後の外接矩形を使い、閾値外は吸着しない", () => {
    const rotated = object("rotated", 0, 0, 1000, 200, 90);
    const target = object("target", 600, 0, 200, 200);
    const aligned = findAlignmentGuides([rotated, target], [rotated.id], { xMm: 399, yMm: 0 }, 2);
    expect(aligned.delta.xMm).toBe(400);
    expect(aligned.guides[0]?.positionMm).toBe(500);

    const farAway = findAlignmentGuides([rotated, target], [rotated.id], { xMm: 0, yMm: 1234 }, 2);
    expect(farAway.delta).toEqual({ xMm: 0, yMm: 1234 });
    expect(farAway.guides).toHaveLength(0);
  });
});
