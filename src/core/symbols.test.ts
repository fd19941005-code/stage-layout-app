import { describe, expect, it } from "vitest";
import { INSTRUMENT_BODY_MASTERS, TIMPANI_SET_LAYOUT } from "./instrumentCatalog";
import {
  getSymbolDefinition,
  renderSymbolDefinitionsSvg,
  getSymbolLabelLayout,
  isConcertTomSetGroup,
  renderSymbolUseSvg,
  SYMBOL_DEFINITIONS,
  symbolLabelForPreset,
  symbolIdForAssetVariantId,
  symbolIdForPreset,
} from "./symbols";

describe("配置物シンボル", () => {
  it("主要プリセットを上面図シンボルへ割り当てる", () => {
    expect(symbolIdForPreset("chair")).toBe("stage-symbol-chair");
    expect(symbolIdForPreset("grand-piano-full")).toBe("stage-symbol-grand-piano");
    expect(symbolIdForPreset("grand-piano-semi")).toBe("stage-symbol-grand-piano-semi");
    expect(symbolIdForPreset("drum-set")).toBe("stage-symbol-drum-set");
    expect(symbolIdForPreset("xylophone-concert")).toBe("stage-symbol-keyboard-percussion");
    expect(symbolIdForPreset("glockenspiel-concert")).toBe("stage-symbol-glockenspiel");
    expect(symbolIdForPreset("drum-set-compact")).toBe("stage-symbol-drum-set");
    expect(symbolIdForPreset("drum-set-standard")).toBe("stage-symbol-drum-set");
    expect(symbolIdForPreset("drum-set-large")).toBe("stage-symbol-drum-set");
    expect(symbolIdForPreset("timpani-32")).toBe("stage-symbol-timpani");
    expect(symbolIdForPreset("timpani-set-4")).toBe("stage-symbol-timpani-set");
    expect(symbolIdForPreset("riser-6x6")).toBe("stage-symbol-riser-6x6");
    expect(symbolIdForPreset("generic-rect")).toBeNull();
    expect(symbolIdForPreset(null)).toBeNull();
  });

  it("登録済みシンボルは定義を持ち、1000x1000座標系を逸脱しない", () => {
    for (const definition of SYMBOL_DEFINITIONS) {
      expect(getSymbolDefinition(definition.id)).toBe(definition);
      const viewBoxValues = (definition.viewBox ?? "0 0 1000 1000").split(/\s+/).map(Number);
      const viewBoxWidth = viewBoxValues[2] ?? 1000;
      const viewBoxHeight = viewBoxValues[3] ?? 1000;
      for (const node of definition.nodes) {
        switch (node.kind) {
          case "rect":
            expect(node.x).toBeGreaterThanOrEqual(0);
            expect(node.y).toBeGreaterThanOrEqual(0);
            expect(node.x + node.width).toBeLessThanOrEqual(viewBoxWidth);
            expect(node.y + node.height).toBeLessThanOrEqual(viewBoxHeight);
            break;
          case "ellipse":
            expect(node.cx - node.rx).toBeGreaterThanOrEqual(0);
            expect(node.cy - node.ry).toBeGreaterThanOrEqual(0);
            expect(node.cx + node.rx).toBeLessThanOrEqual(viewBoxWidth);
            expect(node.cy + node.ry).toBeLessThanOrEqual(viewBoxHeight);
            break;
          case "circle":
            expect(node.cx - node.r).toBeGreaterThanOrEqual(0);
            expect(node.cy - node.r).toBeGreaterThanOrEqual(0);
            expect(node.cx + node.r).toBeLessThanOrEqual(viewBoxWidth);
            expect(node.cy + node.r).toBeLessThanOrEqual(viewBoxHeight);
            break;
          case "line":
            expect([node.x1, node.y1, node.x2, node.y2].every((value) => value >= 0 && value <= Math.max(viewBoxWidth, viewBoxHeight))).toBe(true);
            break;
          case "polyline":
            expect(node.points.every((point) => point.x >= 0 && point.x <= viewBoxWidth && point.y >= 0 && point.y <= viewBoxHeight)).toBe(true);
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
    expect(symbolLabelForPreset("timpani-26", "ティンパニ 26\"")).toBe("26");
    expect(symbolLabelForPreset("timpani-26", "Timp 26", false, "enShort")).toBe("Timp 26");
    expect(symbolLabelForPreset("timpani-29", "custom-label", true)).toBe("custom-label\n29");
    expect(symbolLabelForPreset("timpani-set-4", "timpani set")).toBe("ティンパニ\n4個セット");
    expect(symbolLabelForPreset("concert-tom-set-4", "tom set")).toBe("トムトム");
    expect(symbolLabelForPreset("concert-tom-16", "トムトム")).toBe("");
    expect(symbolLabelForPreset("concert-tom-14", "トムトム")).toBe("");
    expect(symbolLabelForPreset("concert-tom-12", "トムトム")).toBe("");
    expect(symbolLabelForPreset("concert-tom-10", "トムトム")).toBe("");
    expect(isConcertTomSetGroup([
      { groupId: "group-1", presetId: "concert-tom-16" },
      { groupId: "group-1", presetId: "concert-tom-14" },
      { groupId: "group-1", presetId: "concert-tom-12" },
      { groupId: "group-1", presetId: "concert-tom-10" },
    ])).toBe(true);
    expect(symbolLabelForPreset("grand-piano-full", "Piano", true)).toBe("Piano");
    expect(getSymbolLabelLayout("26", 800, 800, 160)?.lines).toEqual(["26"]);
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

  it("普通の椅子は向きを持たない正円だけで描く", () => {
    const definition = getSymbolDefinition("stage-symbol-chair")!;
    // 円1個のみ。背もたれ・脚・座面方向の線は持たない。
    expect(definition.nodes).toEqual([{ kind: "circle", cx: 500, cy: 500, r: 500, paint: "whiteBody" }]);
    // 原本SVGを埋め込まないので、rawSvg由来の向きが出ない。
    expect(definition.rawSvg).toBeUndefined();
    // 幅と奥行が異なってもmeetで正円のまま。楕円にはならない。
    expect(definition.preserveAspectRatio).toBe("xMidYMid meet");
    // 保存済みJSONのassetVariantIdは従来どおり解決できる。
    expect(definition.assetId).toBe("stage-open-template/chair-a");
    expect(symbolIdForAssetVariantId("stage-open-template/chair-a")).toBe("stage-symbol-chair");

    const chairSymbol = renderSymbolDefinitionsSvg().match(/<symbol id="stage-symbol-chair".*?<\/symbol>/s)![0];
    expect(chairSymbol).toContain('<circle cx="500" cy="500" r="500"');
    expect(chairSymbol).toContain('fill="#ffffff" fill-opacity="1"');
    expect(chairSymbol).not.toContain("<line");
    expect(chairSymbol).not.toContain("<rect");
  });
  it("譜面台の×シンボルは細線2本の交差で描く", () => {
    const definition = getSymbolDefinition("stage-symbol-music-stand-cross")!;
    expect(symbolIdForAssetVariantId("generated/music-stand-cross")).toBe("stage-symbol-music-stand-cross");
    // 太さは既定のdetailストロークに任せ、線は2本だけ。
    expect(definition.nodes).toEqual([
      { kind: "line", x1: 160, y1: 160, x2: 840, y2: 840, paint: "detail" },
      { kind: "line", x1: 840, y1: 160, x2: 160, y2: 840, paint: "detail" },
    ]);
    // 既存の譜面台シンボルは無変更のまま残す。
    expect(symbolIdForPreset("music-stand")).toBe("stage-symbol-music-stand");
    expect(getSymbolDefinition("stage-symbol-music-stand")!.rawSvg).toBeTruthy();

    const defs = renderSymbolDefinitionsSvg();
    expect(defs).toContain('<symbol id="stage-symbol-music-stand-cross"');
  });

  it("uses one physical scale for every timpani body", () => {
    const single = getSymbolDefinition("stage-symbol-timpani")!;
    const set = getSymbolDefinition("stage-symbol-timpani-set")!;
    const singleBody = single.nodes.find((node) => node.kind === "circle" && node.paint === "body");
    const setBodies = set.nodes.filter((node) => node.kind === "ellipse" && node.paint === "body");
    expect(single.nodes).toEqual([{ kind: "circle", cx: 500, cy: 500, r: 500, paint: "body" }]);
    expect(single.preserveAspectRatio).toBe("xMidYMid meet");
    expect(singleBody).toMatchObject({ r: 500 });
    expect(setBodies).toHaveLength(TIMPANI_SET_LAYOUT.length);
    for (const [index, part] of TIMPANI_SET_LAYOUT.entries()) {
      const body = setBodies[index];
      if (!body || body.kind !== "ellipse") throw new Error("missing timpani body");
      const master = INSTRUMENT_BODY_MASTERS[part.presetId];
      expect(body.rx * 2).toBeCloseTo(master.diameterMm!, 6);
      expect(body.ry * 2).toBeCloseTo(master.diameterMm!, 6);
    }
  });

  it("uses the physical footprint for imported instrument assets", () => {
    const full = getSymbolDefinition("stage-symbol-grand-piano");
    const semi = getSymbolDefinition("stage-symbol-grand-piano-semi");
    expect(full?.assetId).toBe("stage-open-template/grand-piano-d");
    expect(full?.viewBox).toBe("0 0 16.406787 28.272829");
    expect(full?.rawSvg).toContain("matrix(0 1 -1 0");
    expect(full?.preserveAspectRatio).toBe("xMidYMid meet");
    expect(semi?.assetId).toBe("stage-open-template/grand-piano-bb");
    expect(semi?.viewBox).toBe("0 0 15.551068 21.371962");
    expect(semi?.rawSvg).toContain("matrix(0 1 -1 0");
    expect(semi?.preserveAspectRatio).toBe("xMidYMid meet");
    expect(getSymbolDefinition("stage-symbol-marimba")?.preserveAspectRatio).toBe("xMidYMid meet");
    expect(getSymbolDefinition("stage-symbol-glockenspiel")?.assetId).toBe("stage-open-template/glockenspiel-concert-provisional");
  });

});
