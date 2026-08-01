import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./project";
import {
  createPlacedObjectsFromUserTemplate,
  createUserTemplate,
  deserializeUserTemplates,
  serializeUserTemplates,
} from "./userTemplate";
import type { Project, SceneObject } from "../types/project";

function object(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: id,
    xMm: 0,
    yMm: 0,
    widthMm: 450,
    depthMm: 450,
    heightMm: 450,
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

function projectWith(objects: SceneObject[]): Project {
  const project = createEmptyProject("テンプレートテスト");
  project.objects = objects;
  return project;
}

function idFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-new-${++index}`;
}

function sampleProject(): Project {
  return projectWith([
    object("riser-source", {
      type: "riser",
      presetId: "riser-3x6",
      name: "山台",
      xMm: 3000,
      yMm: 4000,
      widthMm: 1800,
      depthMm: 900,
      heightMm: 300,
      groupId: "riser-group-source",
      zIndex: 0,
    }),
    object("chair-source", {
      xMm: 3000,
      yMm: 4000,
      rotationDeg: 30,
      label: "奏者A",
      onRiserId: "riser-source",
      groupId: "seat-group-source",
      zIndex: 1,
      style: { labelVisible: true, fillOpacity: 0.65 },
    }),
    object("stand-source", {
      type: "musicStand",
      presetId: "music-stand",
      name: "譜面台",
      xMm: 3800,
      yMm: 4200,
      widthMm: 480,
      depthMm: 450,
      groupId: "seat-group-source",
      zIndex: 2,
    }),
    object("annotation-source", {
      type: "shape",
      presetId: null,
      name: "線注釈",
      xMm: 2500,
      yMm: 4500,
      widthMm: 1,
      depthMm: 1,
      annotationKind: "line",
      endXMm: 4300,
      endYMm: 4500,
      zIndex: 3,
    }),
  ]);
}

describe("ユーザーテンプレートの座標・ID変換", () => {
  it("選択範囲中心を原点にし、相対座標・表示設定・スタイルを保存する", () => {
    const template = createUserTemplate(sampleProject(), ["chair-source", "stand-source", "annotation-source"], "山台セット", idFactory(), "2026-07-29T00:00:00.000Z");

    expect(template).not.toBeNull();
    expect(template?.objects.map((item) => item.id)).toEqual([
      "riser-source",
      "chair-source",
      "stand-source",
      "annotation-source",
    ]);
    const chair = template?.objects.find((item) => item.id === "chair-source");
    const stand = template?.objects.find((item) => item.id === "stand-source");
    expect(stand!.xMm - chair!.xMm).toBe(800);
    expect(stand!.yMm - chair!.yMm).toBe(200);
    expect(chair).toMatchObject({ label: "奏者A", rotationDeg: 30, style: { labelVisible: true, fillOpacity: 0.65 } });
    expect(template?.objects.find((item) => item.id === "chair-source")?.onRiserId).toBe("riser-source");
    expect(template?.objects.find((item) => item.id === "annotation-source")?.endXMm).toBe(1100);
  });

  it("配置位置を変えても物同士の間隔を維持する", () => {
    const template = createUserTemplate(sampleProject(), ["chair-source", "stand-source"], "座席セット", idFactory(), "2026-07-29T00:00:00.000Z");
    expect(template).not.toBeNull();
    const first = createPlacedObjectsFromUserTemplate(template!, { objects: [] }, "layer-objects", { xMm: 1000, yMm: 2000 }, idFactory());
    const second = createPlacedObjectsFromUserTemplate(template!, { objects: [] }, "layer-objects", { xMm: 9000, yMm: 12000 }, idFactory());
    const firstChair = first.find((item) => item.name === "chair-source")!;
    const firstStand = first.find((item) => item.name === "譜面台")!;
    const secondChair = second.find((item) => item.name === "chair-source")!;
    const secondStand = second.find((item) => item.name === "譜面台")!;
    expect(firstStand.xMm - firstChair.xMm).toBe(secondStand.xMm - secondChair.xMm);
    expect(firstStand.yMm - firstChair.yMm).toBe(secondStand.yMm - secondChair.yMm);
  });

  it("配置時に全IDを新規生成し、グループと山台関連を新しいIDへ置換する", () => {
    const template = createUserTemplate(sampleProject(), ["chair-source", "stand-source", "riser-source", "annotation-source"], "山台セット", idFactory(), "2026-07-29T00:00:00.000Z");
    const placed = createPlacedObjectsFromUserTemplate(template!, { objects: [] }, "layer-objects", { xMm: 7000, yMm: 8000 }, idFactory());
    const sourceIds = new Set(template!.objects.map((item) => item.id));
    expect(placed).toHaveLength(4);
    expect(new Set(placed.map((item) => item.id)).size).toBe(placed.length);
    expect(placed.every((item) => !sourceIds.has(item.id))).toBe(true);
    expect(placed.every((item) => item.locked === false)).toBe(true);
    const riser = placed.find((item) => item.type === "riser")!;
    const chair = placed.find((item) => item.name === "chair-source")!;
    const stands = placed.filter((item) => item.name === "chair-source" || item.name === "譜面台");
    expect(chair.onRiserId).toBe(riser.id);
    expect(new Set(stands.map((item) => item.groupId)).size).toBe(1);
    expect(stands[0]!.groupId).not.toBe("seat-group-source");
    expect(placed.find((item) => item.name === "chair-source")!.widthMm).toBe(450);
    expect(placed.find((item) => item.name === "chair-source")!.depthMm).toBe(450);
  });
});

describe("ユーザーテンプレートJSON", () => {
  it("背景・壁・舞台設定を含めずに往復できる", () => {
    const template = createUserTemplate(sampleProject(), ["chair-source", "stand-source"], "座席セット", idFactory(), "2026-07-29T00:00:00.000Z")!;
    const json = serializeUserTemplates([template]);
    expect(json).not.toContain("background");
    expect(json).not.toContain("walls");
    expect(json).not.toContain("stageFront");
    expect(deserializeUserTemplates(json)?.[0]).toEqual(template);
  });

  it("不正なJSON、重複ID、外部の山台参照を安全に拒否する", () => {
    const template = createUserTemplate(sampleProject(), ["chair-source", "stand-source"], "座席セット", idFactory(), "2026-07-29T00:00:00.000Z")!;
    expect(deserializeUserTemplates("{broken")).toBeNull();

    const duplicate = JSON.parse(serializeUserTemplates([template])) as { templates: Array<{ objects: Array<{ id: string }> }> };
    duplicate.templates[0]!.objects[1]!.id = duplicate.templates[0]!.objects[0]!.id;
    expect(deserializeUserTemplates(JSON.stringify(duplicate))).toBeNull();

    const externalRiser = JSON.parse(serializeUserTemplates([template])) as { templates: Array<{ objects: Array<{ onRiserId: string | null }> }> };
    externalRiser.templates[0]!.objects[0]!.onRiserId = "missing-riser";
    expect(deserializeUserTemplates(JSON.stringify(externalRiser))).toBeNull();
  });
});

