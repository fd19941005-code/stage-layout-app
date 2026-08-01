import { describe, expect, it } from "vitest";
import { createHorizontalGuide } from "./guides";
import { createEmptyProject } from "./project";
import { renderProjectToSvg, selectExportObjects } from "./export";

describe("editing guide export boundary", () => {
  it("does not include guides in SVG or the PNG/PDF object selection", () => {
    const project = createEmptyProject("export-guide-test");
    project.guides = [createHorizontalGuide("editing-guide-1", 1200)];
    const svg = renderProjectToSvg(project, { background: false, objects: true, labels: true, grid: false });
    expect(svg).not.toContain("editing-guide-1");
    expect(svg).not.toContain("editing-guide");
    expect(selectExportObjects(project, { objects: true, annotations: true, background: false, labels: true, grid: false })).toEqual([]);
  });
});
