import { describe, expect, it } from "vitest";
import { createGridCopies, createPultArcObjects } from "./arrangement";
import type { SceneObject } from "../types/project";

function object(id: string, type: SceneObject["type"], overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type,
    presetId: type === "chair" ? "chair" : "music-stand",
    name: type === "chair" ? "椅子" : "譜面台",
    xMm: 1000,
    yMm: 2000,
    widthMm: type === "chair" ? 450 : 480,
    depthMm: 450,
    heightMm: type === "chair" ? 450 : 1300,
    rotationDeg: 0,
    label: "",
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-objects",
    zIndex: 1,
    shape: "rect",
    ...overrides,
  };
}

describe("Phase 4の一括配置", () => {
  it("行列配置は元オブジェクトを含めず、外形間隔をmmで複製する", () => {
    const copies = createGridCopies(object("chair", "chair"), { rows: 2, columns: 3, gapXMm: 100, gapYMm: 200 }, (index) => `copy-${index}`);
    expect(copies).toHaveLength(5);
    expect(copies.map((item) => [item.xMm, item.yMm])).toEqual([
      [1550, 2000], [2100, 2000], [1000, 2650], [1550, 2650], [2100, 2650],
    ]);
  });

  it("14プルトは椅子28脚+譜面台14台を生成し、弧上の角度を保持する", () => {
    const result = createPultArcObjects(object("chair", "chair"), object("stand", "musicStand"), {
      center: { xMm: 5000, yMm: 4000 },
      radiusMm: 6000,
      startDeg: -45,
      endDeg: 45,
      pultCount: 14,
      pultSpacingMm: 900,
      layerId: "layer-objects",
    }, (index, role, pultIndex = 0) => `${role}-${pultIndex}-${index}`);
    expect(result).toHaveLength(42);
    expect(result.filter((item) => item.type === "chair")).toHaveLength(28);
    expect(result.filter((item) => item.type === "musicStand")).toHaveLength(14);
    expect(result[0].rotationDeg).toBeCloseTo(45);
    expect(result[39].rotationDeg).toBeCloseTo(135);
  });
});
