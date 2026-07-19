import { describe, expect, it } from "vitest";
import {
  getSymbolDefinition,
  renderSymbolDefinitionsSvg,
  renderSymbolUseSvg,
  SYMBOL_DEFINITIONS,
  symbolIdForPreset,
} from "./symbols";

describe("配置物シンボル", () => {
  it("主要プリセットを上面図シンボルへ割り当てる", () => {
    expect(symbolIdForPreset("chair")).toBe("stage-symbol-chair");
    expect(symbolIdForPreset("grand-piano-full")).toBe("stage-symbol-grand-piano");
    expect(symbolIdForPreset("drum-set")).toBe("stage-symbol-drum-set");
    expect(symbolIdForPreset("timpani-32")).toBe("stage-symbol-timpani");
    expect(symbolIdForPreset("generic-rect")).toBeNull();
    expect(symbolIdForPreset(null)).toBeNull();
  });

  it("登録済みシンボルは定義を持ち、1000x1000座標系を逸脱しない", () => {
    for (const definition of SYMBOL_DEFINITIONS) {
      expect(getSymbolDefinition(definition.id)).toBe(definition);
      for (const node of definition.nodes) {
        switch (node.kind) {
          case "rect":
            expect(node.x).toBeGreaterThanOrEqual(0);
            expect(node.y).toBeGreaterThanOrEqual(0);
            expect(node.x + node.width).toBeLessThanOrEqual(1000);
            expect(node.y + node.height).toBeLessThanOrEqual(1000);
            break;
          case "ellipse":
            expect(node.cx - node.rx).toBeGreaterThanOrEqual(0);
            expect(node.cy - node.ry).toBeGreaterThanOrEqual(0);
            expect(node.cx + node.rx).toBeLessThanOrEqual(1000);
            expect(node.cy + node.ry).toBeLessThanOrEqual(1000);
            break;
          case "circle":
            expect(node.cx - node.r).toBeGreaterThanOrEqual(0);
            expect(node.cy - node.r).toBeGreaterThanOrEqual(0);
            expect(node.cx + node.r).toBeLessThanOrEqual(1000);
            expect(node.cy + node.r).toBeLessThanOrEqual(1000);
            break;
          case "line":
            expect([node.x1, node.y1, node.x2, node.y2].every((value) => value >= 0 && value <= 1000)).toBe(true);
            break;
          case "polyline":
            expect(node.points.every((point) => point.x >= 0 && point.x <= 1000 && point.y >= 0 && point.y <= 1000)).toBe(true);
            break;
          case "path":
            expect(node.d.length).toBeGreaterThan(0);
            break;
        }
      }
    }
  });

  it("画面と出力で共有できるSVG定義と実寸useを生成する", () => {
    const defs = renderSymbolDefinitionsSvg();
    expect(defs).toContain('<symbol id="stage-symbol-grand-piano"');
    expect(defs).toContain("preserveAspectRatio=\"none\"");
    expect(defs).not.toContain("http://");

    expect(renderSymbolUseSvg("stage-symbol-chair", 450, 520)).toContain('x="-225"');
    expect(renderSymbolUseSvg("stage-symbol-chair", 450, 520)).toContain('width="450" height="520"');
  });
});
