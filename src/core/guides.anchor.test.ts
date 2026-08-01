import { describe, expect, it } from "vitest";
import { createRadialGuide, resolveGuideAnchor, nearestGuideSnap } from "./guides";

describe("指揮台に紐づく放射線", () => {
  it("指揮台を移動した位置を放射線の始点へ反映する", () => {
    const guide = createRadialGuide("radial", { xMm: 0, yMm: 0 }, 0, "podium-1");
    const resolved = resolveGuideAnchor(guide, [{ id: "podium-1", xMm: 1000, yMm: 2000 }]);
    expect(resolved.xMm).toBe(1000);
    expect(resolved.yMm).toBe(2000);
    expect(nearestGuideSnap({ xMm: 1500, yMm: 2040 }, [guide], 50, [{ id: "podium-1", xMm: 1000, yMm: 2000 }])?.point).toEqual({ xMm: 1500, yMm: 2000 });
  });
});
