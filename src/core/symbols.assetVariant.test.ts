import { describe, expect, it } from "vitest";
import { getSymbolDefinition, symbolIdForObject } from "./symbols";

describe("assetVariantIdからのシンボル解決", () => {
  it("既知variantをpresetより優先する", () => {
    expect(symbolIdForObject({
      presetId: "grand-piano-full",
      assetVariantId: "stage-open-template/grand-piano-semi-a",
    })).toBe("stage-symbol-grand-piano-semi");
  });

  it("旧ピアノvariantは新原本へフォールバックする", () => {
    expect(symbolIdForObject({
      presetId: "grand-piano-full",
      assetVariantId: "generated/grand-piano-full-outline",
    })).toBe("stage-symbol-grand-piano");
    expect(symbolIdForObject({
      presetId: "grand-piano-full",
      assetVariantId: "stage-open-template/grand-piano-full-ab",
    })).toBe("stage-symbol-grand-piano");
    expect(symbolIdForObject({
      presetId: "grand-piano-semi",
      assetVariantId: "stage-open-template/grand-piano-semi-a",
    })).toBe("stage-symbol-grand-piano-semi");
  });

  it("variant欠落・未知variantでは旧preset経路を維持する", () => {
    expect(symbolIdForObject({ presetId: "grand-piano-full" })).toBe("stage-symbol-grand-piano");
    expect(symbolIdForObject({ presetId: "grand-piano-full", assetVariantId: "unknown/variant" })).toBe("stage-symbol-grand-piano");
  });

  it("鍵盤打楽器4種のB variantを配布元SVGへ解決する", () => {
    const expected = [
      ["marimba-5oct", "stage-open-template/marimba-b", "stage-symbol-marimba-b"],
      ["vibraphone-standard", "stage-open-template/vibraphone-b", "stage-symbol-vibraphone-b"],
      ["xylophone-concert", "stage-open-template/xylophone-b", "stage-symbol-xylophone-b"],
      ["glockenspiel-concert", "stage-open-template/glockenspiel-b", "stage-symbol-glockenspiel-b"],
    ] as const;

    for (const [presetId, assetVariantId, symbolId] of expected) {
      expect(symbolIdForObject({ presetId, assetVariantId })).toBe(symbolId);
      const definition = getSymbolDefinition(symbolId);
      expect(definition).toMatchObject({
        id: symbolId,
        assetId: assetVariantId,
        nodes: expect.any(Array),
        rawSvg: expect.any(String),
      });
      expect(definition?.rawSvg?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
