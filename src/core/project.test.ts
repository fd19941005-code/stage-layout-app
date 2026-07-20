// 自動テスト必須領域(11.4): プロジェクトJSONの保存・復元・スキーマ耐性

import { describe, expect, it } from "vitest";
import {
  createEmptyProject,
  deserializeProject,
  serializeProject,
} from "./project";
import { SCHEMA_VERSION, type SceneObject } from "../types/project";

function sampleObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: "obj-1",
    type: "chair",
    presetId: "chair",
    name: "椅子",
    xMm: 1234,
    yMm: 5678,
    widthMm: 450,
    depthMm: 450,
    heightMm: 450,
    rotationDeg: 30,
    label: "Vn1-1",
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

describe("プロジェクト保存・復元 (FR-003、AC-009)", () => {
  it("保存→復元で位置・寸法・角度・heightMmが一致する", () => {
    const project = createEmptyProject("テスト公演");
    project.objects.push(sampleObject());
    project.calibration = {
      mmPerPixel: 9.1,
      pointA: { xPx: 10, yPx: 10 },
      pointB: { xPx: 110, yPx: 10 },
      realDistanceMm: 910,
      calibratedAt: "2026-07-18T00:00:00.000Z",
    };

    const restored = deserializeProject(serializeProject(project));

    expect(restored.name).toBe("テスト公演");
    expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored.calibration.mmPerPixel).toBeCloseTo(9.1);
    expect(restored.objects).toHaveLength(1);
    const o = restored.objects[0];
    expect(o.xMm).toBe(1234);
    expect(o.yMm).toBe(5678);
    expect(o.widthMm).toBe(450);
    expect(o.depthMm).toBe(450);
    expect(o.heightMm).toBe(450);
    expect(o.rotationDeg).toBe(30);
    expect(o.label).toBe("Vn1-1");
  });

  it("style round-trip persists", () => {
    const project = createEmptyProject("Style");
    project.objects.push(sampleObject({
      style: {
        color: "#12151a",
        fillColor: "#995c67",
        fillOpacity: 0.58,
        labelColor: "#ffffff",
        labelVisible: true,
        labelFontSizeMm: 200,
        strokeWidthMm: 16,
      },
    }));

    const restored = deserializeProject(serializeProject(project));

    expect(restored.objects[0].style).toEqual({
      color: "#12151a",
      fillColor: "#995c67",
      fillOpacity: 0.58,
      labelColor: "#ffffff",
      labelVisible: true,
      labelFontSizeMm: 200,
      strokeWidthMm: 16,
    });
  });

  it("背景のPDFページ、回転、切り抜きを保存・復元できる(AC-004)", () => {
    const project = createEmptyProject("背景編集");
    project.background = {
      ...project.background,
      imageDataUrl: "data:image/png;base64,background",
      naturalWidthPx: 1200,
      naturalHeightPx: 800,
      sourceType: "pdf",
      sourcePage: 2,
      rotationDeg: 90,
      crop: { xPx: 100, yPx: 50, widthPx: 900, heightPx: 600 },
    };
    const restored = deserializeProject(serializeProject(project));
    expect(restored.background.sourceType).toBe("pdf");
    expect(restored.background.sourcePage).toBe(2);
    expect(restored.background.rotationDeg).toBe(90);
    expect(restored.background.crop).toEqual({ xPx: 100, yPx: 50, widthPx: 900, heightPx: 600 });
  });

  it("1.0.0のJSONは追加フィールドの既定値で復元できる", () => {
    const project = createEmptyProject("旧形式");
    const raw = JSON.parse(serializeProject(project)) as Record<string, unknown>;
    raw.schemaVersion = "1.0.0";
    const background = raw.background as Record<string, unknown>;
    delete background.sourceType;
    delete background.sourcePage;
    const restored = deserializeProject(JSON.stringify(raw));
    expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored.background.sourceType).toBe("image");
    expect(restored.background.sourcePage).toBeNull();
  });

  it("wallsフィールドを保存・復元できる(6.3 Phase 0から予約)", () => {
    const project = createEmptyProject("壁テスト");
    project.walls.push({
      id: "wall-1",
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 10000, yMm: 0 },
      ],
      heightMm: 6000,
      closed: false,
    });
    const restored = deserializeProject(serializeProject(project));
    expect(restored.walls).toHaveLength(1);
    expect(restored.walls[0].heightMm).toBe(6000);
    expect(restored.walls[0].points[1].xMm).toBe(10000);
  });

  it("未知のフィールドは無視し、既知フィールドを復元する(6.3)", () => {
    const project = createEmptyProject("互換テスト");
    project.objects.push(sampleObject());
    const raw = JSON.parse(serializeProject(project)) as Record<string, unknown>;
    raw.futureFeature = { anything: true };
    (raw.objects as Record<string, unknown>[])[0].unknownProp = 123;

    const restored = deserializeProject(JSON.stringify(raw));
    expect(restored.objects[0].xMm).toBe(1234);
    expect("futureFeature" in restored).toBe(false);
  });

  it("JSONとして不正な入力はエラーメッセージ付きで拒否する(NFR-013)", () => {
    expect(() => deserializeProject("{ broken")).toThrow(/解析できません/);
  });

  it("schemaVersionのない入力を拒否する", () => {
    expect(() => deserializeProject(JSON.stringify({ name: "x" }))).toThrow(/schemaVersion/);
  });

  it("不正な寸法値は安全な値へ補正する", () => {
    const project = createEmptyProject("補正テスト");
    project.objects.push(sampleObject());
    const raw = JSON.parse(serializeProject(project)) as {
      objects: Record<string, unknown>[];
    };
    raw.objects[0].widthMm = -100;
    raw.objects[0].heightMm = "invalid";

    const restored = deserializeProject(JSON.stringify(raw));
    expect(restored.objects[0].widthMm).toBeGreaterThan(0);
    expect(typeof restored.objects[0].heightMm).toBe("number");
  });
});
