import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./project";
import {
  KEN_MM,
  createStageTemplate,
  isProjectReadyForPlacement,
  stageDimensionToMm,
  stageTemplateBoundsMm,
  stageTemplateGridLines,
  stageTemplateGridOrigins,
} from "./stageTemplate";

describe("実寸舞台テンプレート", () => {
  it("入力単位をmmへ変換する", () => {
    expect(stageDimensionToMm("10", "m")).toBe(10000);
    expect(stageDimensionToMm("13", "m")).toBe(13000);
    expect(stageDimensionToMm("8", "ken")).toBe(8 * KEN_MM);
    expect(stageDimensionToMm("1.5", "ken")).toBe(2730);
    expect(stageDimensionToMm("0", "m")).toBeNull();
    expect(stageDimensionToMm("not-a-number", "m")).toBeNull();
  });

  it("横は中央のマス、縦は下端基準で1間グリッドを作る", () => {
    const template = createStageTemplate(13000, 10000);
    expect(template).not.toBeNull();
    expect(stageTemplateGridLines(template)).toEqual({
      verticalLinesMm: [130, 1950, 3770, 5590, 7410, 9230, 11050, 12870],
      horizontalLinesMm: [900, 2720, 4540, 6360, 8180],
    });
    expect(stageTemplateGridOrigins(template)).toEqual({ xMm: 5590, yMm: 10000 });
  });

  it("有限の舞台範囲を返し、テンプレートを配置可能と判定する", () => {
    const template = createStageTemplate(13000, 10000);
    expect(stageTemplateBoundsMm(template)).toEqual({ minXMm: 0, minYMm: 0, maxXMm: 13000, maxYMm: 10000 });
    expect(isProjectReadyForPlacement({ ...createEmptyProject("template"), stageTemplate: template })).toBe(true);
    expect(stageTemplateBoundsMm(null)).toBeNull();
  });
});
