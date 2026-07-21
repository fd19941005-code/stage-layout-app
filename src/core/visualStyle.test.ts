import { describe, expect, it } from "vitest";
import {
  defaultObjectStyle,
  parseObjectStyle,
  resolveObjectStyle,
  STYLE_PRESETS,
} from "./visualStyle";

describe("配置物の表示スタイル", () => {
  it("楽器は既定ラベルを表示し、椅子は図面を汚さない", () => {
    expect(defaultObjectStyle({ type: "instrument", annotationKind: null })).toMatchObject({
      color: "#173e43",
      labelVisible: true,
    });
    expect(defaultObjectStyle({ type: "chair", annotationKind: null }).labelVisible).toBe(false);
  });

  it("参考図向けの山台・注記プリセットを持つ", () => {
    expect(STYLE_PRESETS.find((preset) => preset.id === "riser-red")?.style.fillColor).toBe("#995c67");
    expect(STYLE_PRESETS.find((preset) => preset.id === "callout-blue")?.style.fillColor).toBe("#4e7fb6");
  });

  it("JSONから許可された表示属性だけを読み、範囲を補正する", () => {
    expect(parseObjectStyle({
      color: "#ffffff",
      fillOpacity: 2,
      labelVisible: false,
      labelFontSizeMm: 20,
      strokeWidthMm: 100,
      unknown: "ignore",
    })).toEqual({
      color: "#ffffff",
      fillOpacity: 1,
      labelVisible: false,
      labelFontSizeMm: 80,
      strokeWidthMm: 80,
    });
    expect(parseObjectStyle({ color: "red" })).toBeUndefined();
  });

  it("個別指定はプリセットの既定値へ部分適用する", () => {
    const style = resolveObjectStyle({
      type: "instrument",
      annotationKind: null,
      style: { fillColor: "#4e7fb6", labelVisible: false },
    });
    expect(style.fillColor).toBe("#4e7fb6");
    expect(style.labelVisible).toBe(false);
    expect(style.strokeWidthMm).toBe(16);
  });
});
