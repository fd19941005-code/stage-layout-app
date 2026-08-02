import { describe, expect, it } from "vitest";
import { OBJECT_PRESETS } from "./presets";
import {
  ALL_SYMBOL_ASSETS,
  DEFAULT_ASSET_VARIANT_ID_BY_PRESET,
  REPOSITORY_SYMBOL_ASSETS,
  defaultAssetVariantIdForPreset,
  isKnownSymbolAssetId,
  resolveAssetVariantId,
  symbolAssetForRuntimeKey,
  visualAssetVariantsForPreset,
} from "./symbolAssets";

describe("シンボル資産台帳", () => {
  it("現行リポジトリSVGを重複なく登録する", () => {
    const ids = REPOSITORY_SYMBOL_ASSETS.map((asset) => asset.id);
    expect(ids).toHaveLength(49);
    expect(new Set(ids).size).toBe(ids.length);
    for (const asset of REPOSITORY_SYMBOL_ASSETS) {
      expect(asset.sourcePath).toMatch(/^src\/assets\/stage-open-template\//);
      expect(asset.defaultRotationDeg).toBe(0);
      expect(asset.anchorXRatio).toBe(0.5);
      expect(asset.anchorYRatio).toBe(0.5);
      expect(isKnownSymbolAssetId(asset.id)).toBe(true);
    }
  });

  it("runtimeで使用する44 asset keyをstable IDへ解決する", () => {
    const runtimeAssets = REPOSITORY_SYMBOL_ASSETS.filter((asset) => asset.planEnabled);
    expect(runtimeAssets).toHaveLength(44);
    expect(symbolAssetForRuntimeKey("grandPianoFull")?.id).toBe("stage-open-template/grand-piano-d");
    expect(symbolAssetForRuntimeKey("grandPianoSemi")?.sourceFileName).toBe("グランドピアノBB.svg");
    expect(symbolAssetForRuntimeKey("marimba")?.sourcePath).toBe("src/assets/stage-open-template/marimba-a-derived.svg");
    expect(symbolAssetForRuntimeKey("marimba4Oct")?.sourcePath).toBe("src/assets/stage-open-template/marimba-4oct-a.svg");
    expect(symbolAssetForRuntimeKey("vibraphone")?.sourcePath).toBe("src/assets/stage-open-template/vibraphone-a-derived.svg");
    expect(symbolAssetForRuntimeKey("xylophone")?.sourcePath).toBe("src/assets/stage-open-template/xylophone-a-derived.svg");
    expect(symbolAssetForRuntimeKey("glockenspiel")?.sourcePath).toBe("src/assets/stage-open-template/glockenspiel-a-derived.svg");
    expect(symbolAssetForRuntimeKey("missing-runtime-key")).toBeUndefined();
    const targetRuntimeAssets = [
      ["snareDrum", "スネアドラムA.svg"],
      ["suspendedCymbal", "シンバル・サスペンデッドAG.svg"],
      ["crashCymbalPair", "シンバル・クラッシュ.svg"],
      ["conga2", "コンガAG.svg"],
      ["bongo", "ボンゴA.svg"],
      ["windChime", "ウィンドチャイム.svg"],
    ] as const;
    for (const [runtimeKey, sourceFileName] of targetRuntimeAssets) {
      expect(symbolAssetForRuntimeKey(runtimeKey)?.sourceFileName).toBe(sourceFileName);
    }
  });

  it("グロッケンは既存シロフォンSVGの暫定派生であることを台帳に残す", () => {
    const asset = REPOSITORY_SYMBOL_ASSETS.find((candidate) => candidate.id === "stage-open-template/glockenspiel-concert-provisional");
    expect(asset).toMatchObject({
      note: expect.stringContaining("グロッケンシュピールA原本"),
      sourcePath: "src/assets/stage-open-template/glockenspiel-a-derived.svg",
    });
    expect(defaultAssetVariantIdForPreset("glockenspiel-concert")).toBe(asset?.id);
  });

  it("全プリセットの既定variantは登録済みassetを参照する", () => {
    for (const [presetId, assetId] of Object.entries(DEFAULT_ASSET_VARIANT_ID_BY_PRESET)) {
      expect(defaultAssetVariantIdForPreset(presetId)).toBe(assetId);
      expect(isKnownSymbolAssetId(assetId)).toBe(true);
    }
    for (const preset of OBJECT_PRESETS.filter((candidate) => candidate.id !== "generic-rect" && candidate.id !== "generic-circle")) {
      expect(defaultAssetVariantIdForPreset(preset.id)).not.toBeNull();
    }
    expect(ALL_SYMBOL_ASSETS.length).toBeGreaterThan(REPOSITORY_SYMBOL_ASSETS.length);
  });

  it("未知variantとvariant欠落を既定値へ戻す", () => {
    expect(resolveAssetVariantId("stage-open-template/chair-a", "chair")).toBe("stage-open-template/chair-a");
    expect(resolveAssetVariantId("unknown/asset", "chair")).toBe("stage-open-template/chair-a");
    expect(resolveAssetVariantId(undefined, "grand-piano-full")).toBe("stage-open-template/grand-piano-d");
    expect(resolveAssetVariantId(undefined, "generic-rect")).toBeNull();
  });
});




describe("visual variant ledger", () => {
  it("returns only visual alternatives for one preset and excludes size presets", () => {
    const snare = visualAssetVariantsForPreset("snare-drum");
    expect(snare.map((variant) => variant.assetId)).toEqual([
      "stage-open-template/snare-drum-a",
      "stage-open-template/snare-drum-b",
    ]);
    expect(snare.every((variant) => isKnownSymbolAssetId(variant.assetId))).toBe(true);
    expect(visualAssetVariantsForPreset("grand-piano-full")).toEqual([]);
    expect(visualAssetVariantsForPreset("marimba-5oct").map((variant) => variant.assetId)).toEqual([
      "stage-open-template/marimba-a",
      "stage-open-template/marimba-b",
    ]);
    expect(visualAssetVariantsForPreset("grand-harp-47")).toEqual([]);
  });

  it("譜面台は既存Aに加えて×印を選べる", () => {
    const musicStand = visualAssetVariantsForPreset("music-stand");
    expect(musicStand).toEqual([
      { assetId: "stage-open-template/music-stand-a", label: "A" },
      { assetId: "generated/music-stand-cross", label: "×" },
    ]);
    expect(musicStand.every((variant) => isKnownSymbolAssetId(variant.assetId))).toBe(true);
    // 既定は従来どおりAのまま。配置時の見た目は変わらない。
    expect(defaultAssetVariantIdForPreset("music-stand")).toBe("stage-open-template/music-stand-a");
  });

  it("鍵盤打楽器4種はAとBを選べ、Bも既知assetとして解決できる", () => {
    const expected = [
      ["marimba-5oct", "stage-open-template/marimba-a", "stage-open-template/marimba-b"],
      ["vibraphone-standard", "stage-open-template/vibraphone-a", "stage-open-template/vibraphone-b"],
      ["xylophone-concert", "stage-open-template/xylophone-a", "stage-open-template/xylophone-b"],
      ["glockenspiel-concert", "stage-open-template/glockenspiel-concert-provisional", "stage-open-template/glockenspiel-b"],
    ] as const;

    for (const [presetId, a, b] of expected) {
      expect(visualAssetVariantsForPreset(presetId)).toEqual([
        { assetId: a, label: "A" },
        { assetId: b, label: "B" },
      ]);
      expect(isKnownSymbolAssetId(a)).toBe(true);
      expect(isKnownSymbolAssetId(b)).toBe(true);
    }
  });
});
