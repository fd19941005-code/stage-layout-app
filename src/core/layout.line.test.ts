import { describe, expect, it } from "vitest";
import type { SceneObject } from "../types/project";
import { arrangeObjectsInLine, lineArrangementGapFromPointer, moveSelectionIds, selectionUnits, setObjectsBackgroundFixed } from "./layout";
import { sceneObjectBoundsMm } from "./transform";

function object(id: string, xMm: number, yMm: number, overrides: Partial<SceneObject> = {}): SceneObject {
  return { id, type: "chair", presetId: "chair", name: id, xMm, yMm, widthMm: 400, depthMm: 400, heightMm: 450, rotationDeg: 0, label: "", onRiserId: null, avatar: null, locked: false, visible: true, groupId: null, layerId: "layer-objects", zIndex: Number(id.replace(/\D/g, "")) || 0, shape: "rect", ...overrides };
}

describe("line arrangement geometry", () => {
  it("keeps horizontal centers on one y and uses exact edge gaps", () => {
    const input = [object("a", 0, 100), object("b", 1200, 700), object("c", 3000, -200)];
    const result = arrangeObjectsInLine(input, ["a", "b", "c"], { axis: "x", gapMm: 250 });
    expect(result.map((item) => item.yMm)).toEqual([100, 100, 100]);
    const sorted = [...result].sort((a, b) => a.xMm - b.xMm);
    expect(sorted[1].xMm - sorted[0].xMm).toBe(650);
    expect(sorted[2].xMm - sorted[1].xMm).toBe(650);
  });

  it("aligns ungrouped object centers on the requested cross axis even when rotated bounds differ", () => {
    const input = [object("a", 0, 100, { depthMm: 1000, rotationDeg: 30 }), object("b", 1500, 700, { depthMm: 300, rotationDeg: 0 })];
    const result = arrangeObjectsInLine(input, ["a", "b"], { axis: "x", gapMm: 0 });
    expect(result.map((item) => item.yMm)).toEqual([100, 100]);
  });
  it("aligns vertical centers and preserves the requested axis gap", () => {
    const input = [object("a", 500, 0), object("b", 1400, 1800), object("c", -300, 3500)];
    const result = arrangeObjectsInLine(input, ["a", "b", "c"], { axis: "y", gapMm: 175 });
    expect(result.map((item) => item.xMm)).toEqual([500, 500, 500]);
    const sorted = [...result].sort((a, b) => a.yMm - b.yMm);
    expect(sorted[1].yMm - sorted[0].yMm).toBe(575);
    expect(sorted[2].yMm - sorted[1].yMm).toBe(575);
  });

  it("uses rotated external bounds for the requested edge gap", () => {
    const input = [object("a", 0, 0, { widthMm: 1000, depthMm: 400, rotationDeg: 45 }), object("b", 2200, 0, { widthMm: 300, depthMm: 700 })];
    const result = arrangeObjectsInLine(input, ["a", "b"], { axis: "x", gapMm: 300 });
    const first = sceneObjectBoundsMm(result[0]!);
    const second = sceneObjectBoundsMm(result[1]!);
    expect(second.minXMm - first.maxXMm).toBeCloseTo(300, 8);
  });

  it("treats an existing group as one unit and preserves its internal offset", () => {
    const input = [object("g1", 0, 0, { groupId: "g" }), object("g2", 800, 200, { groupId: "g" }), object("b", 2000, 900)];
    expect(selectionUnits(input, ["g1", "b"]).map((unit) => unit.objectIds)).toEqual([["g1", "g2"], ["b"]]);
    const result = arrangeObjectsInLine(input, ["g1", "b"], { axis: "x", gapMm: 300 });
    const g1 = result.find((item) => item.id === "g1")!;
    const g2 = result.find((item) => item.id === "g2")!;
    expect(g2.xMm - g1.xMm).toBe(800);
    expect(result.find((item) => item.id === "b")?.yMm).toBe(100);
  });

  it("derives a non-negative gap from the endpoint handle", () => {
    const input = [object("a", 0, 0), object("b", 1200, 0), object("c", 2400, 0)];
    expect(lineArrangementGapFromPointer(input, ["a", "b", "c"], "x", { xMm: 1100, yMm: 0 })).toBe(50);
    expect(lineArrangementGapFromPointer(input, ["a", "b", "c"], "x", { xMm: -100, yMm: 0 })).toBe(0);
  });

  it("expands selected groups for direct movement and sends backgroundized objects to the back", () => {
    const input = [object("other", 0, 0), object("g1", 1000, 0, { groupId: "g" }), object("g2", 1500, 0, { groupId: "g" })];
    expect(moveSelectionIds(input, ["g1"], "g1")).toEqual(["g1", "g2"]);
    const fixed = setObjectsBackgroundFixed(input, ["g1", "g2"], true);
    expect(fixed.slice(0, 2).map((item) => item.id)).toEqual(["g1", "g2"]);
    expect(fixed.filter((item) => item.id !== "other").every((item) => item.backgroundFixed)).toBe(true);
    expect(fixed.filter((item) => item.id !== "other").every((item) => !item.locked)).toBe(true);
    expect(fixed.map((item) => item.zIndex)).toEqual([0, 1, 2]);
  });

  it("背景化またはロックされたグループ員を移動対象から外す", () => {
    const input = [
      object("g1", 0, 0, { groupId: "g" }),
      object("g2", 500, 0, { groupId: "g", backgroundFixed: true }),
      object("locked", 1000, 0, { locked: true }),
    ];
    expect(moveSelectionIds(input, ["g1", "g2", "locked"], "g1")).toEqual(["g1"]);
  });
});
