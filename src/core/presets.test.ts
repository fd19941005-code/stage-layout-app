import { describe, expect, it } from "vitest";
import { findPreset } from "./presets";
import { INSTRUMENT_BODY_MASTERS, TIMPANI_SET_BODY_SIZE } from "./instrumentCatalog";

describe("Instrument body masters", () => {
  it("uses the master dimensions for pianos and marimba", () => {
    expect(findPreset("grand-piano-full")).toMatchObject(INSTRUMENT_BODY_MASTERS["grand-piano-full"]);
    expect(findPreset("grand-piano-semi")).toMatchObject(INSTRUMENT_BODY_MASTERS["grand-piano-semi"]);
    expect(findPreset("grand-piano-full")!.depthMm).toBeGreaterThan(findPreset("grand-piano-semi")!.depthMm);
    expect(findPreset("marimba")).toMatchObject({ widthMm: 2600, depthMm: 900 });
  });

  it("keeps timpani body diameters identical between single presets and the set envelope", () => {
    for (const id of ["timpani-23", "timpani-26", "timpani-29", "timpani-32"]) {
      expect(findPreset(id)).toMatchObject({
        widthMm: INSTRUMENT_BODY_MASTERS[id].diameterMm,
        depthMm: INSTRUMENT_BODY_MASTERS[id].diameterMm,
        shape: "circle",
      });
    }
    expect(findPreset("timpani-set-4")).toMatchObject({
      widthMm: TIMPANI_SET_BODY_SIZE.widthMm,
      depthMm: TIMPANI_SET_BODY_SIZE.depthMm,
      shape: "rect",
    });
  });

  it("registers the 6x6 riser with real dimensions", () => {
    expect(findPreset("riser-6x6")).toMatchObject({ widthMm: 1820, depthMm: 1820, heightMm: 300, type: "riser" });
  });
});
