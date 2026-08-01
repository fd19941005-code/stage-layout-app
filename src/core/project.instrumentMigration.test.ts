import { describe, expect, it } from "vitest";
import { createEmptyProject, deserializeProject, serializeProject } from "./project";
import { SCHEMA_VERSION, type SceneObject } from "../types/project";

function sceneObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: "legacy-object",
    type: "instrument",
    presetId: "grand-piano-full",
    name: "旧楽器",
    xMm: 3000,
    yMm: 4000,
    widthMm: 1560,
    depthMm: 2740,
    heightMm: 900,
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

function legacyJson(objects: SceneObject[], schemaVersion = "1.4.0"): string {
  const project = createEmptyProject("legacy");
  project.objects = objects;
  const raw = JSON.parse(serializeProject(project)) as { schemaVersion: string; objects: Record<string, unknown>[] };
  raw.schemaVersion = schemaVersion;
  return JSON.stringify(raw);
}

describe("保存スキーマ1.5から1.6への楽器ID・寸法移行", () => {
  it("未編集の旧ピアノ・バスドラム既定寸法だけを新標準へ補正する", () => {
    const restored = deserializeProject(legacyJson([
      sceneObject({ id: "piano", presetId: "grand-piano-full", widthMm: 1560, depthMm: 2740 }),
      sceneObject({ id: "bass", presetId: "bass-drum", widthMm: 900, depthMm: 600 }),
      sceneObject({ id: "custom", presetId: "grand-piano-full", widthMm: 1601, depthMm: 2740 }),
    ]));

    expect(restored.objects[0]).toMatchObject({ widthMm: 1600, depthMm: 2750 });
    expect(restored.objects[1]).toMatchObject({ widthMm: 558.8, depthMm: 914.4 });
    expect(restored.objects[2]).toMatchObject({ widthMm: 1601, depthMm: 2740 });
  });

  it("1.5.0の未編集旧IDだけを新ID・新標準寸法へ移行する", () => {
    const restored = deserializeProject(legacyJson([
      sceneObject({ id: "marimba", presetId: "marimba", widthMm: 2600, depthMm: 900 }),
      sceneObject({ id: "vibraphone", presetId: "vibraphone", widthMm: 1500, depthMm: 800 }),
      sceneObject({ id: "chimes", presetId: "chimes", widthMm: 1000, depthMm: 600 }),
      sceneObject({ id: "harp", presetId: "harp", widthMm: 1000, depthMm: 600 }),
    ], "1.5.0"));

    expect(restored.objects.map((object) => object.presetId)).toEqual([
      "marimba-5oct",
      "vibraphone-standard",
      "tubular-bells-concert",
      "grand-harp-47",
    ]);
    expect(restored.objects.map((object) => [object.widthMm, object.depthMm])).toEqual([
      [2610, 1030],
      [1430, 820],
      [800, 710],
      [1050, 700],
    ]);
  });

  it("旧IDのユーザー変更寸法と配置属性を保持する", () => {
    const restored = deserializeProject(legacyJson([
      sceneObject({
        id: "custom-marimba",
        presetId: "marimba",
        name: "ユーザーのマリンバ",
        xMm: 123,
        yMm: 456,
        widthMm: 2700,
        depthMm: 999,
        rotationDeg: 37,
        label: "変更済み",
        locked: true,
        groupId: "existing-group",
        zIndex: 9,
      }),
    ], "1.5.0"));

    expect(restored.objects[0]).toMatchObject({
      id: "custom-marimba",
      presetId: "marimba-5oct",
      name: "ユーザーのマリンバ",
      xMm: 123,
      yMm: 456,
      widthMm: 2700,
      depthMm: 999,
      rotationDeg: 37,
      label: "変更済み",
      locked: true,
      groupId: "existing-group",
      zIndex: 9,
    });
  });

  it("旧ヴィブラフォン・チャイム・ハープの変更寸法も保持する", () => {
    const restored = deserializeProject(legacyJson([
      sceneObject({ id: "custom-vibraphone", presetId: "vibraphone", widthMm: 1501, depthMm: 800 }),
      sceneObject({ id: "custom-chimes", presetId: "chimes", widthMm: 1000, depthMm: 601 }),
      sceneObject({ id: "custom-harp", presetId: "harp", widthMm: 1001, depthMm: 600 }),
    ], "1.5.0"));

    expect(restored.objects.map((object) => object.presetId)).toEqual([
      "vibraphone-standard",
      "tubular-bells-concert",
      "grand-harp-47",
    ]);
    expect(restored.objects.map((object) => [object.widthMm, object.depthMm])).toEqual([
      [1501, 800],
      [1000, 601],
      [1001, 600],
    ]);
  });

  it("旧xylophoneと旧drum-setは用途を推測せずレガシーIDで表示を維持する", () => {
    const restored = deserializeProject(legacyJson([
      sceneObject({ id: "old-xylophone", presetId: "xylophone", widthMm: 1400, depthMm: 700, assetVariantId: "stage-open-template/xylophone-a" }),
      sceneObject({ id: "old-drum", presetId: "drum-set", widthMm: 1800, depthMm: 1300, assetVariantId: "stage-open-template/drum-set-a" }),
    ], "1.5.0"));

    expect(restored.objects[0]).toMatchObject({
      presetId: "legacy-xylophone-glockenspiel",
      widthMm: 1400,
      depthMm: 700,
      assetVariantId: "stage-open-template/xylophone-a",
    });
    expect(restored.objects[1]).toMatchObject({
      presetId: "legacy-drum-set",
      widthMm: 1800,
      depthMm: 1300,
      assetVariantId: "stage-open-template/drum-set-a",
    });
    expect(restored.objects.some((object) => object.presetId === "xylophone-concert" || object.presetId === "glockenspiel-concert")).toBe(false);
    expect(restored.objects.some((object) => object.presetId === "drum-set-compact" || object.presetId === "drum-set-standard" || object.presetId === "drum-set-large")).toBe(false);
  });

  it("1.7.0を保存・復元し未知フィールドを無視する", () => {
    const project = createEmptyProject("1.6 project");
    project.objects = [sceneObject({
      id: "current-piano",
      presetId: "grand-piano-full",
      widthMm: 1600,
      depthMm: 2750,
      assetVariantId: "stage-open-template/grand-piano-d",
    })];
    const raw = JSON.parse(serializeProject(project)) as Record<string, unknown>;
    const rawObjects = raw.objects as Record<string, unknown>[];
    raw.unknownRootField = { ignored: true };
    rawObjects[0].unknownObjectField = "ignored";

    expect(raw.schemaVersion).toBe(SCHEMA_VERSION);
    const restored = deserializeProject(JSON.stringify(raw));
    expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored.objects[0]).toMatchObject({
      presetId: "grand-piano-full",
      widthMm: 1600,
      depthMm: 2750,
      assetVariantId: "stage-open-template/grand-piano-d",
    });
  });

  it("旧ティンパニ4台セットを回転を保った単体4台グループへ展開する", () => {
    const restored = deserializeProject(legacyJson([
      sceneObject({
        id: "old-timpani-set",
        presetId: "timpani-set-4",
        name: "旧ティンパニセット",
        xMm: 5000,
        yMm: 6000,
        widthMm: 2600,
        depthMm: 1507,
        rotationDeg: 90,
      }),
    ]));

    expect(restored.objects).toHaveLength(4);
    expect(restored.objects.map((object) => object.presetId)).toEqual([
      "timpani-23",
      "timpani-26",
      "timpani-29",
      "timpani-32",
    ]);
    expect(new Set(restored.objects.map((object) => object.groupId)).size).toBe(1);
    expect(restored.objects.every((object) => object.rotationDeg === 90)).toBe(true);
    expect(restored.objects.every((object) => object.assetVariantId === "generated/timpani-circle")).toBe(true);
    expect(restored.objects.some((object) => object.xMm !== 5000 || object.yMm !== 6000)).toBe(true);
  });

  it("旧1870x580mmトムセットを新しい4要素グループへ移行する", () => {
    const restored = deserializeProject(legacyJson([
      sceneObject({
        id: "old-tom-set",
        presetId: "concert-tom-set-4",
        name: "旧トムセット",
        widthMm: 1870,
        depthMm: 580,
        rotationDeg: 90,
      }),
    ]));

    expect(restored.objects).toHaveLength(4);
    expect(restored.objects.map((object) => object.presetId)).toEqual([
      "concert-tom-16",
      "concert-tom-14",
      "concert-tom-12",
      "concert-tom-10",
    ]);
    expect(new Set(restored.objects.map((object) => object.groupId)).size).toBe(1);
    expect(restored.objects.every((object) => object.rotationDeg === 90)).toBe(true);
  });

  it("旧セットのユーザー変更寸法は推測で上書きしない", () => {
    const restored = deserializeProject(legacyJson([
      sceneObject({ presetId: "timpani-set-4", widthMm: 2601, depthMm: 1507 }),
    ]));

    expect(restored.objects).toHaveLength(1);
    expect(restored.objects[0]).toMatchObject({ presetId: "timpani-set-4", widthMm: 2601, depthMm: 1507 });
  });

  it("migrates only the legacy crash cymbal pair default dimensions", () => {
    const project = createEmptyProject("crash cymbal migration");
    project.objects = [
      sceneObject({
        id: "legacy-crash",
        presetId: "crash-cymbal-pair",
        xMm: 123,
        yMm: 456,
        widthMm: 550,
        depthMm: 300,
        rotationDeg: 27,
      }),
      sceneObject({
        id: "custom-crash",
        presetId: "crash-cymbal-pair",
        widthMm: 551,
        depthMm: 300,
      }),
    ];

    const restored = deserializeProject(serializeProject(project));

    expect(restored.objects[0]).toMatchObject({
      id: "legacy-crash",
      xMm: 123,
      yMm: 456,
      widthMm: 550,
      depthMm: 550,
      rotationDeg: 27,
    });
    expect(restored.objects[1]).toMatchObject({ id: "custom-crash", widthMm: 551, depthMm: 300 });
  });
});
