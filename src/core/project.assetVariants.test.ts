import { describe, expect, it } from "vitest";
import { createEmptyProject, deserializeProject, serializeProject } from "./project";
import type { SceneObject } from "../types/project";

function instrumentObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: "instrument-1",
    type: "instrument",
    presetId: "grand-piano-full",
    name: "グランドピアノ",
    xMm: 1000,
    yMm: 2000,
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
    ...overrides,
  };
}

describe("assetVariantIdの保存・移行", () => {
  it("旧JSONのvariant欠落を既定variantへ補完する", () => {
    const project = createEmptyProject("旧variant");
    project.objects.push(instrumentObject());
    const raw = JSON.parse(serializeProject(project)) as Record<string, unknown>;
    raw.schemaVersion = "1.4.0";
    delete (raw.objects as Record<string, unknown>[])[0].assetVariantId;

    const restored = deserializeProject(JSON.stringify(raw));

    expect(restored.objects[0].assetVariantId).toBe("stage-open-template/grand-piano-d");
  });

  it("既知variantは保持し、未知variantは既定値へ戻す", () => {
    const project = createEmptyProject("variant fallback");
    project.objects.push(instrumentObject({ assetVariantId: "stage-open-template/grand-piano-semi-a" }));
    const raw = JSON.parse(serializeProject(project)) as { objects: Record<string, unknown>[] };

    expect(deserializeProject(JSON.stringify(raw)).objects[0].assetVariantId)
      .toBe("stage-open-template/grand-piano-semi-a");

    raw.objects[0].assetVariantId = "unknown/variant";
    expect(deserializeProject(JSON.stringify(raw)).objects[0].assetVariantId)
      .toBe("stage-open-template/grand-piano-d");
  });
});






describe("display settings persistence and compatibility", () => {
  it("persists settings and defaults missing legacy settings", () => {
    const project = createEmptyProject("display settings");
    expect(project.displaySettings).toEqual({ instrumentLabelsVisible: true, instrumentLabelLanguage: "ja" });
    project.displaySettings = { instrumentLabelsVisible: false, instrumentLabelLanguage: "enShort" };

    const raw = JSON.parse(serializeProject(project)) as Record<string, unknown>;
    expect(raw.displaySettings).toEqual({ instrumentLabelsVisible: false, instrumentLabelLanguage: "enShort" });
    expect(deserializeProject(JSON.stringify(raw)).displaySettings).toEqual({ instrumentLabelsVisible: false, instrumentLabelLanguage: "enShort" });

    delete raw.displaySettings;
    expect(deserializeProject(JSON.stringify(raw)).displaySettings).toEqual({ instrumentLabelsVisible: true, instrumentLabelLanguage: "ja" });
  });
});
