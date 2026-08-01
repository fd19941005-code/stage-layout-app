import { describe, expect, it } from "vitest";
import type { SceneObject } from "../types/project";
import { alignObjects, boundsIntersectMm, distributeObjects, marqueeBoundsMm, selectionBoundsMm } from "./layout";

function object(id: string, xMm: number, yMm: number, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: "椅子",
    xMm,
    yMm,
    widthMm: 400,
    depthMm: 400,
    heightMm: 450,
    rotationDeg: 0,
    label: id,
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-objects",
    zIndex: 0,
    shape: "rect",
    ...overrides,
  };
}

describe("整列・等間隔配置(FR-057、FR-058)", () => {
  it("3個以上を水平中央線へ整列する", () => {
    const input = [object("a", 0, 100), object("b", 1000, 500), object("c", 2000, 900)];
    const result = alignObjects(input, ["a", "b", "c"], "centerY");
    expect(result.map((item) => item.yMm)).toEqual([500, 500, 500]);
  });

  it("10個の選択物を水平等間隔に配置できる(AC-007)", () => {
    const input = Array.from({ length: 10 }, (_, index) => object(`o-${index}`, index * 1000, 0));
    input[4] = object("o-4", 7777, 0);
    const result = distributeObjects(input, input.map((item) => item.id), "x");
    expect(result.map((item) => item.xMm).sort((a, b) => a - b)).toEqual(input.map((_, index) => index * 1000));
  });

  it("回転した外接矩形を含む選択範囲を返す", () => {
    const input = [object("a", 100, 100), object("b", 1000, 1000, { rotationDeg: 45 })];
    const bounds = selectionBoundsMm(input, ["a", "b"]);
    expect(bounds?.minXMm).toBeLessThan(100);
    expect(bounds?.maxYMm).toBeGreaterThan(1100);
  });

  it("uses both Y endpoints for marquee height", () => {
    expect(marqueeBoundsMm({ xMm: 800, yMm: 900 }, { xMm: 200, yMm: 150 })).toEqual({
      minXMm: 200, minYMm: 150, maxXMm: 800, maxYMm: 900,
    });
  });
  it("外接矩形が枠に少しでも重なれば範囲選択対象になる", () => {
    const marquee = { minXMm: 0, minYMm: 0, maxXMm: 1000, maxYMm: 1000 };
    expect(boundsIntersectMm({ minXMm: 900, minYMm: 100, maxXMm: 1400, maxYMm: 500 }, marquee)).toBe(true);
    expect(boundsIntersectMm({ minXMm: 1000, minYMm: 100, maxXMm: 1400, maxYMm: 500 }, marquee)).toBe(true);
    expect(boundsIntersectMm({ minXMm: 1001, minYMm: 100, maxXMm: 1400, maxYMm: 500 }, marquee)).toBe(false);
  });

});
