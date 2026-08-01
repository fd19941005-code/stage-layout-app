import { describe, expect, it } from "vitest";
import {
  CONCERT_TOM_BODY_MASTERS,
  CONCERT_TOM_SET_BODY_SIZE,
  CONCERT_TOM_SET_LAYOUT,
  INSTRUMENT_BODY_MASTERS,
  TIMPANI_BODY_MASTERS,
  TIMPANI_SET_BODY_SIZE,
  TIMPANI_SET_LAYOUT,
} from "./instrumentCatalog";
import { defaultAssetVariantIdForPreset } from "./symbolAssets";
import { findPreset } from "./presets";
import { getSymbolDefinition, symbolIdForAssetVariantId, symbolIdForObject, symbolIdForPreset } from "./symbols";

describe("楽器シンボル仕様の寸法カタログ", () => {
  it("ピアノの寸法とvariantを変更しない", () => {
    expect(INSTRUMENT_BODY_MASTERS["grand-piano-full"]).toMatchObject({ widthMm: 1600, depthMm: 2750 });
    expect(INSTRUMENT_BODY_MASTERS["grand-piano-semi"]).toMatchObject({ widthMm: 1540, depthMm: 2120 });
    expect(INSTRUMENT_BODY_MASTERS["upright-piano"]).toMatchObject({ widthMm: 1530, depthMm: 610 });
    expect(INSTRUMENT_BODY_MASTERS.celesta).toMatchObject({ widthMm: 1050, depthMm: 650 });
    expect(INSTRUMENT_BODY_MASTERS["bass-drum"]).toMatchObject({ widthMm: 558.8, depthMm: 914.4 });
    expect(defaultAssetVariantIdForPreset("grand-piano-full")).toBe("stage-open-template/grand-piano-d");
    expect(defaultAssetVariantIdForPreset("grand-piano-semi")).toBe("stage-open-template/grand-piano-bb");
  });

  it("楽器の新しい安定IDと寸法メタデータを正本にする", () => {
    const expected = [
      ["marimba-5oct", 2610, 1030],
      ["marimba-4oct", 2030, 870],
      ["vibraphone-standard", 1430, 820],
      ["xylophone-concert", 1380, 750],
      ["glockenspiel-concert", 1062, 564],
      ["tubular-bells-concert", 800, 710],
      ["grand-harp-47", 1050, 700],
      ["drum-set-compact", 1600, 1400],
      ["drum-set-standard", 2000, 1800],
      ["drum-set-large", 2400, 2000],
    ] as const;
    for (const [presetId, widthMm, depthMm] of expected) {
      expect(INSTRUMENT_BODY_MASTERS[presetId]).toMatchObject({ widthMm, depthMm });
      expect(INSTRUMENT_BODY_MASTERS[presetId].dimensionBasis).toBeDefined();
      expect(INSTRUMENT_BODY_MASTERS[presetId].dimensionStatus).toBeDefined();
    }
    expect(INSTRUMENT_BODY_MASTERS["marimba-5oct"]).toMatchObject({
      dimensionBasis: "yamaha-reference",
      dimensionStatus: "verified-reference",
    });
    expect(INSTRUMENT_BODY_MASTERS["grand-harp-47"]).toMatchObject({
      dimensionBasis: "representative-layout",
      dimensionStatus: "representative",
    });
    expect(INSTRUMENT_BODY_MASTERS["marimba-4oct"]).toMatchObject({
      dimensionBasis: "yamaha-reference",
      dimensionStatus: "verified-reference",
    });
    expect(INSTRUMENT_BODY_MASTERS.marimba).toBeUndefined();
    expect(INSTRUMENT_BODY_MASTERS.vibraphone).toBeUndefined();
    expect(INSTRUMENT_BODY_MASTERS.xylophone).toBeUndefined();
    expect(INSTRUMENT_BODY_MASTERS.chimes).toBeUndefined();
    expect(INSTRUMENT_BODY_MASTERS["drum-set"]).toBeUndefined();
    expect(INSTRUMENT_BODY_MASTERS.harp).toBeUndefined();
  });

  it("マリンバ5オクターブと4オクターブは同じ作図縮尺で描かれる", () => {
    // preserveAspectRatio="xMidYMid meet"のため、実描画はviewBoxを本体枠へ内接させた結果になる。
    // 4オクターブSVGは5オクターブ原本の縮尺を保つよう作図してあり、両者を並べても線の太さや端部が揃う。
    const drawn = (presetId: string) => {
      const body = INSTRUMENT_BODY_MASTERS[presetId];
      const definition = getSymbolDefinition(symbolIdForPreset(presetId)!)!;
      const [, , viewBoxWidth, viewBoxHeight] = definition.viewBox!.split(" ").map(Number);
      const mmPerUnit = Math.min(body.widthMm / viewBoxWidth, body.depthMm / viewBoxHeight);
      return { mmPerUnit, widthMm: viewBoxWidth * mmPerUnit, depthMm: viewBoxHeight * mmPerUnit };
    };
    const fiveOctave = drawn("marimba-5oct");
    const fourOctave = drawn("marimba-4oct");

    expect(fourOctave.mmPerUnit / fiveOctave.mmPerUnit).toBeCloseTo(1, 2);
    // どちらも幅いっぱいまで描かれ、奥行きは本体枠の内側に収まる。
    expect(Math.round(fiveOctave.widthMm)).toBe(2610);
    expect(Math.round(fourOctave.widthMm)).toBe(2030);
    expect(fiveOctave.depthMm).toBeLessThan(INSTRUMENT_BODY_MASTERS["marimba-5oct"].depthMm);
    expect(fourOctave.depthMm).toBeLessThan(INSTRUMENT_BODY_MASTERS["marimba-4oct"].depthMm);
    // 低音側の張り出しは実寸の奥行き比(870/1030)どおりに縮む。
    expect(fourOctave.depthMm / fiveOctave.depthMm).toBeCloseTo(870 / 1030, 2);
  });

  it("小型打楽器は確定フットプリントとvisual variant分類を保持する", () => {
    const expected = [
      ["snare-drum", 450, 450, "stage-open-template/snare-drum-a"],
      ["suspended-cymbal", 550, 550, "stage-open-template/suspended-cymbal-ag"],
      ["crash-cymbal-pair", 550, 550, "stage-open-template/crash-cymbal-pair"],
      ["gong-tam-tam", 1100, 615, "stage-open-template/gong-tam-tam-ag"],
      ["conga-2", 760, 400, "stage-open-template/conga-2-ag"],
      ["bongo", 450, 300, "stage-open-template/bongo-a"],
      ["wind-chime", 600, 300, "stage-open-template/wind-chime"],
    ] as const;
    for (const [presetId, widthMm, depthMm, assetId] of expected) {
      expect(INSTRUMENT_BODY_MASTERS[presetId]).toMatchObject({ widthMm, depthMm });
      expect(findPreset(presetId)).toMatchObject({ widthMm, depthMm, resizable: false });
      expect(defaultAssetVariantIdForPreset(presetId)).toBe(assetId);
      const symbolId = symbolIdForObject({ presetId, assetVariantId: assetId });
      expect(symbolId).not.toBeNull();
      expect(getSymbolDefinition(symbolId!)).toMatchObject({
        preserveAspectRatio: "xMidYMid meet",
        rawSvg: expect.any(String),
      });
    }
    expect(INSTRUMENT_BODY_MASTERS["conga"]).toBeUndefined();
    expect(INSTRUMENT_BODY_MASTERS["gong-tam-tam"]).toMatchObject({ diameterMm: 914.4 });
    expect(findPreset("gong-tam-tam")).toMatchObject({ widthMm: 1100, depthMm: 615, resizable: false });
    expect(getSymbolDefinition("stage-symbol-gong-tam-tam-ag")).toMatchObject({
      viewBox: "0 0 12.572331 6.1849973",
      preserveAspectRatio: "xMidYMid meet",
      rawSvg: expect.any(String),
    });
    expect(symbolIdForAssetVariantId("stage-open-template/gong-tam-tam-aw")).toBe("stage-symbol-gong-tam-tam-aw");
    expect(findPreset("conga")).toBeUndefined();

    for (const assetId of [
      "stage-open-template/snare-drum-b",
      "stage-open-template/suspended-cymbal-aw",
      "stage-open-template/gong-tam-tam-aw",
      "stage-open-template/conga-2-aw",
      "stage-open-template/conga-2-b",
      "stage-open-template/bongo-b",
    ]) {
      expect(symbolIdForAssetVariantId(assetId)).not.toBeNull();
    }
  });
  it("バスドラムは元SVGを既定表示し、旧生成variantも元SVGへ寄せる", () => {
    const sourceAssetId = "stage-open-template/bass-drum-a";
    expect(defaultAssetVariantIdForPreset("bass-drum")).toBe(sourceAssetId);
    expect(symbolIdForObject({ presetId: "bass-drum", assetVariantId: sourceAssetId })).toBe("stage-symbol-bass-drum");
    expect(symbolIdForObject({ presetId: "bass-drum", assetVariantId: "generated/concert-bass-drum-36x22" })).toBe("stage-symbol-bass-drum");
    expect(getSymbolDefinition("stage-symbol-bass-drum")).toMatchObject({
      viewBox: "0 0 7.0459264 9.5052769",
      preserveAspectRatio: "xMidYMid meet",
    });
  });

  it("ティンパニは23/26/29/32の図面用直径を保持する", () => {
    const expected = [
      ["timpani-23", 750],
      ["timpani-26", 800],
      ["timpani-29", 900],
      ["timpani-32", 950],
    ] as const;
    for (const [presetId, diameterMm] of expected) {
      expect(TIMPANI_BODY_MASTERS[presetId]).toMatchObject({ widthMm: diameterMm, depthMm: diameterMm, diameterMm });
      expect(INSTRUMENT_BODY_MASTERS[presetId]).toMatchObject({ widthMm: diameterMm, depthMm: diameterMm, diameterMm });
    }
    expect(TIMPANI_SET_LAYOUT).toHaveLength(4);
    expect(TIMPANI_SET_LAYOUT.map((part) => part.presetId)).toEqual([
      "timpani-23",
      "timpani-26",
      "timpani-29",
      "timpani-32",
    ]);
    expect(TIMPANI_SET_LAYOUT.map((part) => part.centerXMm)).toEqual([375, 750, 1645, 2275]);
    expect(TIMPANI_SET_LAYOUT.map((part) => part.centerYMm)).toEqual([525, 1230, 1240, 475]);
    expect(TIMPANI_SET_BODY_SIZE).toMatchObject({ widthMm: 2750, depthMm: 1690 });
  });

  it("4トムは16/14/12/10の順で左から右へ弧状に並ぶ", () => {
    expect(CONCERT_TOM_SET_LAYOUT.map((part) => part.presetId)).toEqual([
      "concert-tom-16",
      "concert-tom-14",
      "concert-tom-12",
      "concert-tom-10",
    ]);
    expect(CONCERT_TOM_SET_LAYOUT.map((part) => part.centerXMm)).toEqual([215, 635, 1005, 1320]);
    expect(CONCERT_TOM_SET_LAYOUT.map((part) => part.centerYMm)).toEqual([320, 240, 210, 290]);
    expect(CONCERT_TOM_SET_BODY_SIZE).toMatchObject({ widthMm: 1460, depthMm: 490 });
    const tomGaps = CONCERT_TOM_SET_LAYOUT.slice(0, -1).map((part, index) => {
      const nextPart = CONCERT_TOM_SET_LAYOUT[index + 1];
      const currentDiameter = CONCERT_TOM_BODY_MASTERS[part.presetId].diameterMm!;
      const nextDiameter = CONCERT_TOM_BODY_MASTERS[nextPart.presetId].diameterMm!;
      return nextPart.centerXMm - part.centerXMm - (currentDiameter + nextDiameter) / 2;
    });
    expect(tomGaps).toEqual([15, 15, 10]);
    const tomDiameters = [
      ["concert-tom-16", 430],
      ["concert-tom-14", 380],
      ["concert-tom-12", 330],
      ["concert-tom-10", 280],
    ] as const;
    for (const [presetId, diameterMm] of tomDiameters) {
      expect(CONCERT_TOM_BODY_MASTERS[presetId]).toMatchObject({ widthMm: diameterMm, depthMm: diameterMm, diameterMm });
    }
  });
});
