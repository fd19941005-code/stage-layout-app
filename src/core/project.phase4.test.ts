import { describe, expect, it } from "vitest";
import { createEmptyProject, deserializeProject, serializeProject } from "./project";
import type { SceneObject } from "../types/project";

function annotation(): SceneObject {
  return {
    id: "annotation-1",
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
    endYMm: 2000,
  };
}

describe("Phase 4プロジェクト互換性", () => {
  it("注釈のmm終点とスナップ設定を保存・復元する", () => {
    const project = createEmptyProject("Phase 4");
    project.objects.push(annotation());
    project.snapSettings = { grid: true, objects: true, stageCenter: true, gridIntervalMm: 910, thresholdMm: 80 };

    const restored = deserializeProject(serializeProject(project));

    expect(restored.schemaVersion).toBe("1.3.0");
    expect(restored.objects[0].annotationKind).toBe("dimension");
    expect(restored.objects[0].endXMm).toBe(2000);
    expect(restored.objects[0].endYMm).toBe(2000);
    expect(restored.snapSettings).toEqual(project.snapSettings);
  });

  it("1.1.0などスナップ設定のないJSONへ既定値を適用し未知フィールドを無視する", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject("旧形式"))) as Record<string, unknown>;
    raw.schemaVersion = "1.1.0";
    delete raw.snapSettings;
    raw.futurePhase = { enabled: true };

    const restored = deserializeProject(JSON.stringify(raw));

    expect(restored.snapSettings).toMatchObject({ grid: false, objects: false, stageCenter: false, gridIntervalMm: 910 });
    expect("futurePhase" in restored).toBe(false);
  });
});

