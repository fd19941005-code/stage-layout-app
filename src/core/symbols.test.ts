import { describe, expect, it } from "vitest";
import { INSTRUMENT_BODY_MASTERS, TIMPANI_SET_BODY_SIZE, TIMPANI_SET_LAYOUT } from "./instrumentCatalog";
import {
  getSymbolDefinition,
  renderSymbolDefinitionsSvg,
  getSymbolLabelLayout,
  renderSymbolUseSvg,
  SYMBOL_DEFINITIONS,
  symbolLabelForPreset,
  symbolIdForPreset,
} from "./symbols";

describe("配置物シンボル", () => {
  it("主要プリセットを上面図シンボルへ割り当てる", () => {
    expect(symbolIdForPreset("chair")).toBe("stage-symbol-chair");
    expect(symbolIdForPreset("grand-piano-full")).toBe("stage-symbol-grand-piano");
    expect(symbolIdForPreset("grand-piano-semi")).toBe("stage-symbol-grand-piano-semi");
    expect(symbolIdForPreset("drum-set")).toBe("stage-symbol-drum-set");
    expect(symbolIdForPreset("timpani-32")).toBe("stage-symbol-timpani");
    expect(symbolIdForPreset("timpani-set-4")).toBe("stage-symbol-timpani-set");
    expect(symbolIdForPreset("riser-6x6")).toBe("stage-symbol-riser-6x6");
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

  it("シンボル名は短い既定名へ整形し、収まる場合だけ内側レイアウトを返す", () => {
    expect(symbolLabelForPreset("grand-piano-full", "グランドピアノ(フル)")).toBe("ピアノ");
    expect(symbolLabelForPreset("timpani-26", "ティンパニ 26\"")).toBe("ティンパニ\n26\"");
    expect(symbolLabelForPreset("timpani-set-4", "timpani set")).toBe("ティンパニ\n4個セット");
    expect(symbolLabelForPreset("grand-piano-full", "Piano", true)).toBe("Piano");
    expect(getSymbolLabelLayout("ティンパニ\n26\"", 760, 760, 160)?.lines).toEqual(["ティンパニ", "26\""]);
    expect(getSymbolLabelLayout("\u975e\u5e38\u306b\u9577\u3044\u4efb\u610f\u30e9\u30d9\u30eb", 300, 300, 160)).toBeNull();
  });

  it("画面と出力で共有できるSVG定義と実寸useを生成する", () => {
    const defs = renderSymbolDefinitionsSvg();
    expect(defs).toContain('<symbol id="stage-symbol-grand-piano"');
    expect(defs).toContain('<symbol id="stage-symbol-grand-piano-semi"');
    expect(defs).toContain('<symbol id="stage-symbol-timpani-set"');
    expect(defs).toContain('<symbol id="stage-symbol-riser-6x6"');
    expect(defs).toContain("preserveAspectRatio=\"xMidYMid meet\"");
    expect(defs).not.toContain("http://");

    expect(renderSymbolUseSvg("stage-symbol-chair", 450, 520)).toContain('x="-225"');
    expect(renderSymbolUseSvg("stage-symbol-chair", 450, 520)).toContain('width="450" height="520"');
  });
  it("uses one physical scale for every timpani body", () => {
    const single = getSymbolDefinition("stage-symbol-timpani")!;
    const set = getSymbolDefinition("stage-symbol-timpani-set")!;
    const singleBody = single.nodes.find((node) => node.kind === "ellipse" && node.paint === "body");
    const setBodies = set.nodes.filter((node) => node.kind === "ellipse" && node.paint === "body");
    expect(singleBody).toMatchObject({ rx: 500, ry: 500 });
    expect(setBodies).toHaveLength(TIMPANI_SET_LAYOUT.length);
    for (const [index, part] of TIMPANI_SET_LAYOUT.entries()) {
      const body = setBodies[index];
      if (!body || body.kind !== "ellipse") throw new Error("missing timpani body");
      const master = INSTRUMENT_BODY_MASTERS[part.presetId];
      expect((body.rx * 2 * TIMPANI_SET_BODY_SIZE.widthMm) / 1000).toBeCloseTo(master.diameterMm!, 6);
      expect((body.ry * 2 * TIMPANI_SET_BODY_SIZE.depthMm) / 1000).toBeCloseTo(master.diameterMm!, 6);
    }
  });

  it("uses the physical footprint for imported instrument assets", () => {
    expect(getSymbolDefinition("stage-symbol-grand-piano")?.preserveAspectRatio).toBe("none");
    expect(getSymbolDefinition("stage-symbol-grand-piano-semi")?.preserveAspectRatio).toBe("none");
    expect(getSymbolDefinition("stage-symbol-marimba")?.preserveAspectRatio).toBe("none");
  });

});
