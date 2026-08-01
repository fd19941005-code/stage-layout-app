import { describe, expect, it } from "vitest";
import { createEmptyProject, deserializeProject, serializeProject } from "./project";
import { countRequiredItems } from "./requirements";
import type { SceneObject } from "../types/project";

function object(
  id: string,
  presetId: string | null,
  overrides: Partial<SceneObject> = {},
): SceneObject {
  return {
    id,
    type: presetId === "music-stand" ? "musicStand" : presetId?.startsWith("riser-") ? "riser" : "chair",
    presetId,
    name: presetId === "music-stand" ? "譜面台" : presetId?.startsWith("riser-") ? "山台" : "椅子",
    xMm: 0,
    yMm: 0,
    widthMm: presetId === "riser-6x6" ? 1820 : 450,
    depthMm: presetId === "riser-6x6" ? 1820 : 450,
    heightMm: presetId?.startsWith("riser-") ? 300 : 450,
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
    ...overrides,
  };
}

function projectWith(objects: SceneObject[]) {
  return { ...createEmptyProject("集計テスト"), objects };
}

function rowFor(project: ReturnType<typeof projectWith>, label: string, scope: "visible" | "all" = "visible") {
  return countRequiredItems(project, { scope }).find((row) => row.label === label);
}

describe("countRequiredItems", () => {
  it("counts 60 chairs as 椅子 × 60", () => {
    const project = projectWith(Array.from({ length: 60 }, (_, index) => object(`chair-${index}`, "chair")));
    expect(rowFor(project, "椅子")).toMatchObject({ presetId: "chair", count: 60, category: "座席・譜面" });
  });

  it("counts 50 music stands as 譜面台 × 50", () => {
    const project = projectWith(Array.from({ length: 50 }, (_, index) => object(`stand-${index}`, "music-stand")));
    expect(rowFor(project, "譜面台")).toMatchObject({ presetId: "music-stand", count: 50 });
  });

  it("uses the requested Japanese display name for 6x6 risers", () => {
    const project = projectWith(Array.from({ length: 8 }, (_, index) => object(`riser-${index}`, "riser-6x6")));
    expect(rowFor(project, "山台(6×6)")).toMatchObject({ presetId: "riser-6x6", count: 8 });
  });

  it("keeps 3x6, 4x6, and 6x6 risers in separate rows", () => {
    const project = projectWith([
      object("riser-3", "riser-3x6"),
      object("riser-4", "riser-4x6"),
      object("riser-6", "riser-6x6"),
    ]);
    expect(countRequiredItems(project, { scope: "visible" }).map((row) => [row.label, row.count])).toEqual([
      ["山台(3×6)", 1],
      ["山台(4×6)", 1],
      ["山台(6×6)", 1],
    ]);
  });

  it("counts grouped riser children individually rather than counting a group", () => {
    const project = projectWith([
      object("group-a", "riser-6x6", { groupId: "riser-group" }),
      object("group-b", "riser-6x6", { groupId: "riser-group" }),
      object("group-c", "riser-6x6", { groupId: "riser-group" }),
    ]);
    expect(rowFor(project, "山台(6×6)")?.count).toBe(3);
  });

  it("excludes annotation objects", () => {
    const project = projectWith([object("chair", "chair"), object("note", "chair", { annotationKind: "text" })]);
    expect(rowFor(project, "椅子")?.count).toBe(1);
  });

  it("excludes invisible objects in the visible-only scope", () => {
    const project = projectWith([object("shown", "chair"), object("hidden", "chair", { visible: false })]);
    expect(rowFor(project, "椅子")?.count).toBe(1);
  });

  it("excludes objects on invisible layers in the visible-only scope", () => {
    const project = projectWith([object("hidden-layer", "chair", { layerId: "layer-hidden" })]);
    project.layers = [...project.layers, { id: "layer-hidden", name: "非表示", visible: false, locked: false }];
    expect(rowFor(project, "椅子")).toBeUndefined();
  });

  it("includes invisible objects and layers in the all scope", () => {
    const project = projectWith([object("hidden", "chair", { visible: false, layerId: "layer-hidden" })]);
    project.layers = [...project.layers, { id: "layer-hidden", name: "非表示", visible: false, locked: false }];
    expect(rowFor(project, "椅子", "all")?.count).toBe(1);
  });

  it("uses type, name, and dimensions as the fallback key when presetId is null", () => {
    const project = projectWith([
      object("custom-a", null, { name: "特注椅子", label: "A" }),
      object("custom-b", null, { name: "特注椅子", label: "B" }),
      object("custom-c", null, { name: "特注椅子", widthMm: 500 }),
    ]);
    const rows = countRequiredItems(project, { scope: "visible" });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.label === "特注椅子")).toMatchObject({ presetId: null, count: 2 });
  });

  it("does not mutate the input project", () => {
    const project = projectWith([object("chair", "chair")]);
    const before = JSON.stringify(project);
    countRequiredItems(project, { scope: "visible" });
    expect(JSON.stringify(project)).toBe(before);
  });

  it("includes locked objects because lock state does not affect procurement", () => {
    const project = projectWith([object("locked", "chair", { locked: true })]);
    expect(rowFor(project, "\u6905\u5b50")?.count).toBe(1);
  });

  it("does not treat an object without a visible owning layer as visible-only", () => {
    const project = projectWith([object("orphan", "chair", { layerId: "missing-layer" })]);
    expect(rowFor(project, "\u6905\u5b50")).toBeUndefined();
    expect(rowFor(project, "\u6905\u5b50", "all")?.count).toBe(1);
  });

  it("returns an empty array for an empty project", () => {
    expect(countRequiredItems(projectWith([]), { scope: "visible" })).toEqual([]);
  });

  it("keeps the same counts after JSON serialization and restoration", () => {
    const project = projectWith([
      ...Array.from({ length: 2 }, (_, index) => object(`chair-${index}`, "chair")),
      object("riser", "riser-6x6"),
    ]);
    const before = countRequiredItems(project, { scope: "all" });
    const restored = deserializeProject(serializeProject(project));
    expect(countRequiredItems(restored, { scope: "all" })).toEqual(before);
  });

  it("only counts saved objects, so a caller's preview objects cannot be mixed in", () => {
    const saved = projectWith([object("saved", "chair")]);
    const preview = object("preview", "chair");
    expect(countRequiredItems(saved, { scope: "visible" })).toMatchObject([{ label: "椅子", count: 1 }]);
    expect(saved.objects).not.toContain(preview);
  });
});
