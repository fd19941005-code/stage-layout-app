import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./project";
import { renderProjectToSvg } from "./export";
import { getSymbolDefinition } from "./symbols";

describe("実寸比を持つ楽器シンボル", () => {
  it("フル／セミピアノは固定原本を表示する", () => {
    const full = getSymbolDefinition("stage-symbol-grand-piano");
    const semi = getSymbolDefinition("stage-symbol-grand-piano-semi");

    expect(full?.assetId).toBe("stage-open-template/grand-piano-d");
    expect(full?.viewBox).toBe("0 0 16.406787 28.272829");
    expect(full?.rawSvg).toContain("matrix(0 1 -1 0");
    expect(semi?.assetId).toBe("stage-open-template/grand-piano-bb");
    expect(semi?.viewBox).toBe("0 0 15.551068 21.371962");
    expect(semi?.rawSvg).toContain("matrix(0 1 -1 0");
    expect(getSymbolDefinition("stage-symbol-grand-piano-generated")).toBeUndefined();
    expect(getSymbolDefinition("stage-symbol-grand-piano-semi-generated")).toBeUndefined();
  });
  it("バスドラムは559×914mmの本体だけを描く", () => {
    const definition = getSymbolDefinition("stage-symbol-concert-bass-drum");
    expect(definition?.assetId).toBe("generated/concert-bass-drum-36x22");
    expect(definition?.viewBox).toBe("0 0 559 914");
    expect(definition?.nodes.some((node) => node.kind === "ellipse" && node.paint === "body")).toBe(true);
    expect(definition?.nodes.some((node) => node.kind === "line" && node.y1 === 914)).toBe(false);
  });

  it("回転した楽器のラベルをSVG出力では水平に戻す", () => {
    const project = createEmptyProject("ラベル回転");
    project.calibration.mmPerPixel = 1;
    project.objects.push({
      id: "timpani-rotated",
      type: "instrument",
      presetId: "timpani-26",
      assetVariantId: "generated/timpani-circle",
      name: "ティンパニ26インチ",
      xMm: 1000,
      yMm: 1200,
      widthMm: 800,
      depthMm: 800,
      heightMm: 700,
      rotationDeg: 30,
      label: "",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId: null,
      layerId: "layer-objects",
      zIndex: 0,
      shape: "circle",
    });

    const svg = renderProjectToSvg(project, { background: false, objects: true, labels: true, grid: false });
    expect(svg).toContain('href="#stage-symbol-timpani"');
    expect(svg).toContain("rotate(30)");
    expect(svg).toContain("rotate(-30)");
  });
});
