import { describe, expect, it } from "vitest";
import { exportBoundsMm, renderProjectToSvg, selectExportObjects } from "./export";
import { createEmptyProject } from "./project";
import type { SceneObject } from "../types/project";
import { sceneObjectBoundsMm } from "./transform";

function dimension(): SceneObject {
  return {
    id: "dimension-1",
    type: "shape",
    presetId: null,
    name: "寸法線",
    xMm: 1000,
    yMm: 2000,
    widthMm: 1,
    depthMm: 1,
    heightMm: 0,
    rotationDeg: 0,
    label: "1000 mm",
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-annotations",
    zIndex: 0,
    shape: "rect",
    annotationKind: "dimension",
    endXMm: 2000,
    endYMm: 3500,
  };
}

describe("Phase 4注釈出力", () => {
  it("線分注釈の外接矩形とSVG出力をmm正本から作る", () => {
    const project = createEmptyProject("注釈出力");
    project.objects.push(dimension());
    const bounds = sceneObjectBoundsMm(project.objects[0]);

    expect(bounds).toEqual({ minXMm: 1000, minYMm: 2000, maxXMm: 2000, maxYMm: 3500 });
    expect(exportBoundsMm(project, { background: false, objects: false, labels: true, grid: false, annotations: true })).toMatchObject({
      minXMm: 1000,
      minYMm: 2000,
      maxXMm: 2000,
      maxYMm: 3500,
    });
    expect(selectExportObjects(project, { background: false, objects: false, labels: true, grid: false, annotations: true })).toHaveLength(1);
    const svg = renderProjectToSvg(project, { background: false, objects: false, labels: true, grid: false, annotations: true });
    expect(svg).toContain("1000 mm");
    expect(svg).toContain("x1=\"1000\"");
    expect(svg).toContain("annotation-arrow");
  });

  it("注釈レイヤーを出力対象から外せる", () => {
    const project = createEmptyProject("注釈なし");
    project.objects.push(dimension());
    expect(selectExportObjects(project, { background: false, objects: true, labels: true, grid: false, annotations: false })).toHaveLength(0);
  });
});

