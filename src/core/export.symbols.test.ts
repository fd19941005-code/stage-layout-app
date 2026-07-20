import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./project";
import { renderProjectToSvg } from "./export";

describe("シンボル付きSVG出力", () => {
  it("プリセットの上面図と実寸のuseを出力する", () => {
    const project = createEmptyProject("シンボル出力");
    project.calibration.mmPerPixel = 1;
    project.objects.push({
      id: "piano-1",
      type: "instrument",
      presetId: "grand-piano-full",
      name: "グランドピアノ(フル)",
      xMm: 1200,
      yMm: 1800,
      widthMm: 1560,
      depthMm: 2740,
      heightMm: 1020,
      rotationDeg: 30,
      label: "Piano",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId: null,
      layerId: "layer-objects",
      zIndex: 0,
      shape: "rect",
    });

    const svg = renderProjectToSvg(project, { background: false, objects: true, labels: true, grid: false });
    expect(svg).toContain('<symbol id="stage-symbol-grand-piano"');
    expect(svg).toContain('href="#stage-symbol-grand-piano"');
    expect(svg).toContain('width="1560" height="2740"');
    expect(svg).toContain("rotate(30)");
    expect(svg).toContain("Piano");
  });

  it("default labels identify instruments", () => {
    const project = createEmptyProject("ラベル表示");
    project.calibration.mmPerPixel = 1;
    project.objects.push({
      id: "piano-2",
      type: "instrument",
      presetId: "grand-piano-full",
      name: "グランドピアノ(フル)",
      xMm: 1200,
      yMm: 1800,
      widthMm: 1560,
      depthMm: 2740,
      heightMm: 1020,
      rotationDeg: 0,
      label: "",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId: null,
      layerId: "layer-objects",
      zIndex: 0,
      shape: "rect",
    });

    const svg = renderProjectToSvg(project, { background: false, objects: true, labels: true, grid: false });
    expect(svg).toContain('href="#stage-symbol-grand-piano"');
    expect(svg).toContain("グランドピアノ(フル)");
  });
  it("汎用図形は従来の矩形描画へフォールバックする", () => {
    const project = createEmptyProject("汎用図形出力");
    project.calibration.mmPerPixel = 1;
    project.objects.push({
      id: "shape-1",
      type: "shape",
      presetId: null,
      name: "長方形",
      xMm: 500,
      yMm: 600,
      widthMm: 1000,
      depthMm: 600,
      heightMm: 0,
      rotationDeg: 0,
      label: "",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId: null,
      layerId: "layer-objects",
      zIndex: 0,
      shape: "rect",
    });

    const svg = renderProjectToSvg(project, { background: false, objects: true, labels: true, grid: false });
    expect(svg).toContain('<rect x="-500" y="-300" width="1000" height="600" fill=');
  });
});
