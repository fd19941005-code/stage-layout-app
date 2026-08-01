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
    expect(svg).toContain('<symbol id="stage-symbol-grand-piano-semi"');
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
    expect(svg).toContain('class="symbol-label"');
    expect(svg).toContain(">ピアノ<");
    expect(svg).toContain('y="0"');
  });
  it("4トムはインチラベルを出さずセット名を一度だけ出力する", () => {
    const project = createEmptyProject("4トムラベル");
    project.calibration.mmPerPixel = 1;
    const groupId = "tom-group-1";
    const toms = [
      ["concert-tom-16", 430],
      ["concert-tom-14", 380],
      ["concert-tom-12", 330],
      ["concert-tom-10", 280],
    ] as const;
    toms.forEach(([presetId, diameter], index) => {
      project.objects.push({
        id: "tom-" + index,
        type: "instrument",
        presetId,
        name: "トムトム",
        xMm: 500 + index * 420,
        yMm: 600,
        widthMm: diameter,
        depthMm: diameter,
        heightMm: 900,
        rotationDeg: 0,
        label: "",
        onRiserId: null,
        avatar: null,
        locked: false,
        visible: true,
        groupId,
        layerId: "layer-objects",
        zIndex: index,
        shape: "circle",
      });
    });

    const svg = renderProjectToSvg(project, { background: false, objects: true, labels: true, grid: false });
    expect(svg.match(/トムトム/g) ?? []).toHaveLength(1);
    for (const label of ["16", "14", "12", "10"]) {
      expect(svg).not.toContain(">" + label + "</tspan>");
    }
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

  it("applies project-wide language and visibility without changing object geometry", () => {
    const project = createEmptyProject("display settings export");
    project.calibration.mmPerPixel = 1;
    const piano = {
      id: "piano-settings",
      type: "instrument" as const,
      presetId: "grand-piano-full",
      name: "\u30b0\u30e9\u30f3\u30c9\u30d4\u30a2\u30ce(\u30d5\u30eb)",
      xMm: 1200,
      yMm: 1800,
      widthMm: 1560,
      depthMm: 2740,
      heightMm: 1020,
      rotationDeg: 30,
      label: "",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId: null,
      layerId: "layer-objects",
      zIndex: 0,
      shape: "rect" as const,
    };
    project.objects.push(piano);
    const layers = { background: false, objects: true, labels: true, grid: false } as const;

    const japanese = renderProjectToSvg(project, layers);
    expect(japanese).toContain(">\u30d4\u30a2\u30ce<");
    project.displaySettings.instrumentLabelLanguage = "enShort";
    const english = renderProjectToSvg(project, layers);
    expect(english).toContain(">GP Full<");
    expect(english).not.toContain(">\u30d4\u30a2\u30ce<");
    project.objects[0] = {
      ...piano,
      id: "timpani-language",
      presetId: "timpani-26",
      name: "Timpani 26",
      widthMm: 800,
      depthMm: 800,
    };
    expect(renderProjectToSvg(project, layers)).toContain(">Timp 26<");
    project.objects[0] = piano;

    project.displaySettings.instrumentLabelsVisible = false;
    const hidden = renderProjectToSvg(project, layers);
    expect(hidden).not.toContain(">GP Full<");
    project.objects[0] = { ...piano, label: "MP setup" };
    expect(renderProjectToSvg(project, layers)).toContain(">MP setup<");

    project.objects[0] = {
      ...piano,
      id: "timpani-settings",
      presetId: "timpani-26",
      name: "Timpani 26",
      widthMm: 800,
      depthMm: 800,
      label: "",
    };
    expect(renderProjectToSvg(project, layers)).toContain(">26</tspan>");
  });

});


describe("椅子円内略称のSVG出力", () => {
  it("カスタム略称を椅子記号の中央へ出力する", () => {
    const project = createEmptyProject("椅子略称");
    project.calibration.mmPerPixel = 1;
    project.objects.push({
      id: "chair-label-1",
      type: "chair",
      presetId: "chair",
      name: "椅子",
      xMm: 500,
      yMm: 600,
      widthMm: 450,
      depthMm: 450,
      heightMm: 450,
      rotationDeg: 0,
      label: "①",
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
    expect(svg).toContain('class="symbol-label"');
    expect(svg).toContain(">①</tspan>");
    expect(svg).toContain('y="0"');
  });
});
