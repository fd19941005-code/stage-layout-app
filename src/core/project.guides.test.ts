import { describe, expect, it } from "vitest";
import { createArcGuide } from "./guides";
import { deserializeProject, serializeProject } from "./project";
import { SCHEMA_VERSION } from "../types/project";
import { createEmptyProject } from "./project";

describe("guide project persistence", () => {
  it("round-trips guide geometry and visibility without px fields", () => {
    const project = createEmptyProject("guide-test");
    project.guides = [createArcGuide("arc-1", { xMm: 1200, yMm: 2300 }, 900, 15, 125)];
    project.guides[0]!.locked = true;
    project.guides[0]!.visible = false;
    const restored = deserializeProject(serializeProject(project));
    expect(restored.guides).toEqual(project.guides);
    expect(serializeProject(project)).not.toContain("xPx");
  });

  it("migrates old projects without guides to the current schema", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject("old"))) as Record<string, unknown>;
    delete raw.guides;
    raw.schemaVersion = "1.7.0";
    const restored = deserializeProject(JSON.stringify(raw));
    expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored.guides).toEqual([]);
  });
});
