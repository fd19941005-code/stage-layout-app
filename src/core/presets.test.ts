import { describe, expect, it } from "vitest";
import { findPreset, instrumentLabelForPreset, isObjectResizable, OBJECT_PRESETS } from "./presets";
import { INSTRUMENT_BODY_MASTERS, TIMPANI_SET_BODY_SIZE } from "./instrumentCatalog";
import { defaultAssetVariantIdForPreset } from "./symbolAssets";
import { symbolIdForPreset, symbolLabelForPreset } from "./symbols";

describe("Instrument body masters", () => {
  it("uses the master dimensions for pianos and marimba", () => {
    expect(findPreset("grand-piano-full")).toMatchObject({ widthMm: INSTRUMENT_BODY_MASTERS["grand-piano-full"].widthMm, depthMm: INSTRUMENT_BODY_MASTERS["grand-piano-full"].depthMm });
    expect(findPreset("grand-piano-semi")).toMatchObject({ widthMm: INSTRUMENT_BODY_MASTERS["grand-piano-semi"].widthMm, depthMm: INSTRUMENT_BODY_MASTERS["grand-piano-semi"].depthMm });
    expect(findPreset("grand-piano-full")!.depthMm).toBeGreaterThan(findPreset("grand-piano-semi")!.depthMm);
    expect(findPreset("marimba-5oct")).toMatchObject({ widthMm: 2610, depthMm: 1030 });
  });

  it("マリンバは5オクターブと4オクターブを別サイズプリセットとして選べる", () => {
    expect(findPreset("marimba-5oct")).toMatchObject({ name: "マリンバ（5オクターブ）", widthMm: 2610, depthMm: 1030, resizable: false });
    expect(findPreset("marimba-4oct")).toMatchObject({ name: "マリンバ（4オクターブ）", widthMm: 2030, depthMm: 870, resizable: false });
    // 図面へ出る短縮ラベルは従来どおり「マリンバ」で共通。
    expect(symbolLabelForPreset("marimba-4oct", "マリンバ（4オクターブ）")).toBe("マリンバ");
    expect(symbolLabelForPreset("marimba-5oct", "マリンバ（5オクターブ）")).toBe("マリンバ");
    // サイズごとに専用SVGを持ち、切替で寸法が入れ替わらない。
    expect(defaultAssetVariantIdForPreset("marimba-4oct")).toBe("stage-open-template/marimba-4oct-a");
    expect(symbolIdForPreset("marimba-4oct")).toBe("stage-symbol-marimba-4oct");
    expect(symbolIdForPreset("marimba-5oct")).toBe("stage-symbol-marimba");
  });

  it("registers separated keyboard percussion and three fixed drum-set footprints", () => {
    expect(findPreset("xylophone-concert")).toMatchObject({ name: "シロフォン", widthMm: 1380, depthMm: 750, resizable: false });
    expect(findPreset("glockenspiel-concert")).toMatchObject({ name: "グロッケンシュピール", widthMm: 1062, depthMm: 564, resizable: false });
    expect(findPreset("drum-set-compact")).toMatchObject({ name: "ドラムセット（コンパクト）", widthMm: 1600, depthMm: 1400, resizable: false });
    expect(findPreset("drum-set-standard")).toMatchObject({ name: "ドラムセット（標準）", widthMm: 2000, depthMm: 1800, resizable: false });
    expect(findPreset("drum-set-large")).toMatchObject({ name: "ドラムセット（大型）", widthMm: 2400, depthMm: 2000, resizable: false });
    expect(findPreset("xylophone")).toBeUndefined();
    expect(findPreset("drum-set")).toBeUndefined();
  });

  it("uses the preset definition as the shared size-editability rule", () => {
    expect(isObjectResizable({ type: "instrument", presetId: "grand-piano-full" })).toBe(false);
    expect(isObjectResizable({ type: "shape", presetId: "generic-rect" })).toBe(true);
    expect(isObjectResizable({ type: "instrument", presetId: "legacy-xylophone-glockenspiel" })).toBe(false);
    expect(isObjectResizable({ type: "instrument", presetId: "unknown-old-instrument" })).toBe(false);
    expect(isObjectResizable({ type: "shape", presetId: null })).toBe(true);
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

  it("keeps the four-tom preset names generic", () => {
    expect(findPreset("concert-tom-set-4")).toMatchObject({ name: "トムトム", isGroupPreset: true });
    for (const id of ["concert-tom-16", "concert-tom-14", "concert-tom-12", "concert-tom-10"]) {
      expect(findPreset(id)).toMatchObject({ name: "トムトム" });
    }
  });

  it("registers the 6x6 riser with real dimensions", () => {
    expect(findPreset("riser-6x6")).toMatchObject({ widthMm: 1820, depthMm: 1820, heightMm: 300, type: "riser" });
  });
});


describe("explicit instrument display labels", () => {
  it("keeps explicit Japanese and English-short labels on every instrument preset", () => {
    const instruments = OBJECT_PRESETS.filter((preset) => preset.type === "instrument");
    expect(instruments.length).toBeGreaterThan(0);
    for (const preset of instruments) {
      expect(preset.labelJa).toBe(preset.name);
      expect(preset.labelEnShort).toEqual(expect.any(String));
      expect(preset.labelEnShort?.trim()).not.toBe("");
    }
    expect(instrumentLabelForPreset("grand-piano-full", "ja")).toBe("\u30b0\u30e9\u30f3\u30c9\u30d4\u30a2\u30ce(\u30d5\u30eb)");
    expect(instrumentLabelForPreset("grand-piano-full", "enShort")).toBe("GP Full");
  });
});
