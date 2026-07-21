import { describe, expect, it } from "vitest";
import { findPreset } from "./presets";

describe("Added stage presets", () => {
  it("registers a 6x6 shoji riser with real dimensions", () => {
    expect(findPreset("riser-6x6")).toMatchObject({ widthMm: 1820, depthMm: 1820, heightMm: 300, type: "riser" });
  });

  it("keeps individual timpani separate from the four-piece set", () => {
    expect(findPreset("timpani-32")).toMatchObject({ widthMm: 910, depthMm: 910, shape: "circle" });
    expect(findPreset("timpani-set-4")).toMatchObject({ widthMm: 2400, depthMm: 1500, shape: "rect" });
  });
});
