import { describe, expect, it } from "vitest";
import { createStageTemplate } from "./stageTemplate";
import { createEmptyProject } from "./project";
import {
  exportBoundsMm,
  mmToPdfPoints,
  pageSizePoints,
  renderProjectToSvg,
  resolvePdfScaleDenominator,
  selectExportObjects,
} from "./export";

describe("出力計算(FR-080〜085、11.4)", () => {
  it("1820mmは1:100で紙面18.2mmに対応するPDF寸法になる(AC-012)", () => {
    const points = mmToPdfPoints(1820, 100);
    expect(points * 25.4 / 72).toBeCloseTo(18.2, 6);
  });

  it("A3横のページ寸法をポイントへ変換する(AC-011)", () => {
    const size = pageSizePoints("A3", "landscape");
    expect(size.widthPt).toBeCloseTo(420 * 72 / 25.4, 5);
    expect(size.heightPt).toBeCloseTo(297 * 72 / 25.4, 5);
  });

  it("出力レイヤー選択は非表示オブジェクトを除外する", () => {
    const project = createEmptyProject("レイヤーテスト");
    project.objects.push(
      { id: "visible", type: "chair", presetId: "chair", name: "椅子", xMm: 0, yMm: 0, widthMm: 450, depthMm: 450, heightMm: 450, rotationDeg: 0, label: "", onRiserId: null, avatar: null, locked: false, visible: true, groupId: null, layerId: "layer-objects", zIndex: 0, shape: "rect" },
      { id: "hidden", type: "chair", presetId: "chair", name: "椅子", xMm: 1000, yMm: 0, widthMm: 450, depthMm: 450, heightMm: 450, rotationDeg: 0, label: "", onRiserId: null, avatar: null, locked: false, visible: false, groupId: null, layerId: "layer-objects", zIndex: 1, shape: "rect" },
    );
    expect(selectExportObjects(project, { background: false, objects: true, labels: true, grid: false }).map((item) => item.id)).toEqual(["visible"]);
  });

  it("出力SVGはmm座標から再描画し、編集ハンドルを含めない(AC-010)", () => {
    const project = createEmptyProject("PNGテスト");
    project.calibration.mmPerPixel = 1;
    project.objects.push({ id: "chair-1", type: "chair", presetId: "chair", name: "椅子", xMm: 500, yMm: 600, widthMm: 450, depthMm: 450, heightMm: 450, rotationDeg: 30, label: "Vn1", onRiserId: null, avatar: null, locked: false, visible: true, groupId: null, layerId: "layer-objects", zIndex: 0, shape: "rect" });
    const svg = renderProjectToSvg(project);
    expect(svg).toContain("translate(500 600) rotate(30)");
    expect(svg).toContain("Vn1");
    expect(svg).not.toContain("rotate-handle");
    expect(svg).not.toContain("selection-marquee");
  });

  it("出力SVGの共有defsに未宣言の名前空間接頭辞を残さない", () => {
    const project = createEmptyProject("SVG名前空間テスト");
    project.calibration.mmPerPixel = 1;
    const svg = renderProjectToSvg(project, { background: false, objects: false, labels: false, grid: false }, 100, 100);
    expect(svg).not.toMatch(/\b(?:inkscape|sodipodi|rdf|cc|dc):/);
    expect(svg).not.toContain("xlink:");
  });

  it("fitはページの使用可能領域へ収まる縮尺分母を計算する", () => {
    const project = createEmptyProject("fit");
    project.calibration.mmPerPixel = 1;
    project.objects.push({ id: "large", type: "shape", presetId: null, name: "大きな図形", xMm: 10000, yMm: 5000, widthMm: 20000, depthMm: 10000, heightMm: 0, rotationDeg: 0, label: "", onRiserId: null, avatar: null, locked: false, visible: true, groupId: null, layerId: "layer-objects", zIndex: 0, shape: "rect" });
    const denominator = resolvePdfScaleDenominator(exportBoundsMm(project, { background: false, objects: true, labels: true, grid: false }), { paper: "A3", orientation: "landscape", scale: "fit" });
    expect(denominator).toBeGreaterThan(50);
  });
  it("実寸舞台テンプレートを舞台範囲と1間グリッド付きで出力する", () => {
    const project = createEmptyProject("template export");
    project.stageTemplate = createStageTemplate(13000, 10000);

    const bounds = exportBoundsMm(project, { background: true, objects: false, labels: false, grid: true });
    expect(bounds).toMatchObject({ minXMm: 0, minYMm: 0, widthMm: 13000, heightMm: 10000 });
    const svg = renderProjectToSvg(project, { background: true, objects: false, labels: false, grid: true });
    expect(svg).toContain("stage-template-export");
    expect(svg).toContain(`x1="5590" y1="0"`);
    expect(svg).toContain(`x1="0" y1="900"`);
  });
});
