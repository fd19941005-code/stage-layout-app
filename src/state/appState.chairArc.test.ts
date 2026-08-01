// 椅子多列円弧配置(FR-064 / AC-102)のreducerテスト。
// 一括生成・一括選択・Undo/Redo・レイヤー制約・校正条件・保存往復を検証する。

import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, createPresetObject, type AppState } from "./appState";
import { createEmptyProject, deserializeProject, serializeProject } from "../core/project";
import { symbolIdForObject } from "../core/symbols";
import {
  chairArcChairRadiusMm,
  createChairArcRowPlacements,
  detectChairArcOverlaps,
  type ChairArcRowsOptions,
} from "../core/arrangement";
import type { Project, SceneObject } from "../types/project";

function podiumObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: "podium-1",
    type: "podium",
    presetId: "podium",
    name: "指揮台",
    xMm: 10000,
    yMm: 8000,
    widthMm: 900,
    depthMm: 900,
    heightMm: 200,
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

function calibratedProject(objects: SceneObject[] = [podiumObject()]): Project {
  const project = createEmptyProject("テスト");
  return {
    ...project,
    calibration: { ...project.calibration, mmPerPixel: 1, realDistanceMm: 1820, calibratedAt: null },
    objects,
  };
}

function calibratedState(objects: SceneObject[] = [podiumObject()]): AppState {
  return createInitialState(calibratedProject(objects));
}

function options(overrides: Partial<ChairArcRowsOptions> = {}): ChairArcRowsOptions {
  return {
    podiumId: "podium-1",
    directionDeg: -90,
    halfSpanDeg: 45,
    firstGapMm: 1820,
    rowGapMm: 910,
    rows: [{ chairCount: 6 }, { chairCount: 8 }],
    layerId: "layer-objects",
    ...overrides,
  };
}

describe("ADD_CHAIR_ARC_ROWS", () => {
  it("AC-102-03/12: 14脚を1 Actionで追加し、生成した全椅子を選択状態にする", () => {
    const before = calibratedState();
    const state = appReducer(before, { type: "ADD_CHAIR_ARC_ROWS", options: options() });

    expect(state.project.objects).toHaveLength(15);
    expect(state.project.objects.filter((object) => object.type === "chair")).toHaveLength(14);
    expect(state.selectedIds).toHaveLength(14);
    expect(state.selectedIds).toEqual(state.project.objects.filter((object) => object.type === "chair").map((object) => object.id));
    expect(state.past).toHaveLength(1);
    expect(state.past[0].objects).toHaveLength(1);
    // 既存オブジェクトを破壊しない
    expect(state.project.objects.find((object) => object.id === "podium-1")).toEqual(before.project.objects[0]);
    expect(new Set(state.project.objects.map((object) => object.zIndex)).size).toBe(15);
  });

  it("譜面台オプションも1 Actionで椅子と一緒に選択・Undo単位になる", () => {
    const state = appReducer(calibratedState(), {
      type: "ADD_CHAIR_ARC_ROWS",
      options: options({ rows: [{ chairCount: 2 }], includeMusicStands: true }),
    });
    expect(state.project.objects.filter((object) => object.type === "chair")).toHaveLength(2);
    expect(state.project.objects.filter((object) => object.type === "musicStand")).toHaveLength(2);
    expect(state.selectedIds).toHaveLength(4);
    expect(state.past).toHaveLength(1);
  });

  it("AC-102-13/14: 1回のUndoで全削除、1回のRedoで全復元し、以後は1脚ずつ編集できる", () => {
    let state = appReducer(calibratedState(), { type: "ADD_CHAIR_ARC_ROWS", options: options() });
    const chairIds = state.project.objects.filter((object) => object.type === "chair").map((object) => object.id);

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects).toHaveLength(1);

    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects).toHaveLength(15);

    state = appReducer(state, { type: "MOVE_OBJECT", id: chairIds[0], xMm: 1, yMm: 2 });
    expect(state.project.objects.find((object) => object.id === chairIds[0])?.xMm).toBe(1);

    state = appReducer(state, { type: "DELETE_OBJECT", id: chairIds[1] });
    expect(state.project.objects).toHaveLength(14);
    expect(state.project.objects.some((object) => object.id === chairIds[1])).toBe(false);
  });

  it("AC-102-10: プレビュー計算はProject・past・future・selectedIdsを変更しない", () => {
    const state = calibratedState();
    const podium = state.project.objects[0];
    const chair = createPresetObject("chair", "layer-objects", 0);
    expect(chair).not.toBeNull();

    const placements = createChairArcRowPlacements(podium, chair as SceneObject, options({ halfSpanDeg: 30 }));
    expect(placements).toHaveLength(14);

    expect(state.project.objects).toHaveLength(1);
    expect(state.project).toBe(state.project);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.selectedIds).toEqual([]);
    expect(state.saveState).toBe("saved");
  });

  it("AC-102-11: 重なり警告が出る設定でも配置を確定できる", () => {
    const narrow = options({ halfSpanDeg: 2.5, rows: [{ chairCount: 20 }] });
    const state = calibratedState();
    const chair = createPresetObject("chair", "layer-objects", 0) as SceneObject;
    const placements = createChairArcRowPlacements(state.project.objects[0], chair, narrow);
    expect(detectChairArcOverlaps(placements, chairArcChairRadiusMm(chair)).length).toBeGreaterThan(0);

    const next = appReducer(state, { type: "ADD_CHAIR_ARC_ROWS", options: narrow });
    expect(next.project.objects.filter((object) => object.type === "chair")).toHaveLength(20);
  });

  it("AC-102-16: 校正前は確定できない", () => {
    const state = createInitialState({ ...createEmptyProject("未校正"), objects: [podiumObject()] });
    expect(appReducer(state, { type: "ADD_CHAIR_ARC_ROWS", options: options() })).toBe(state);
  });

  it("AC-102-15: ロック中・非表示レイヤーでは生成しない", () => {
    const locked = appReducer(calibratedState(), { type: "SET_LAYER_LOCKED", layerId: "layer-objects", locked: true });
    expect(appReducer(locked, { type: "ADD_CHAIR_ARC_ROWS", options: options() }).project.objects).toHaveLength(1);

    const hidden = appReducer(calibratedState(), { type: "SET_LAYER_VISIBLE", layerId: "layer-objects", visible: false });
    expect(appReducer(hidden, { type: "ADD_CHAIR_ARC_ROWS", options: options() }).project.objects).toHaveLength(1);
  });

  it("指揮台以外・存在しないID・不正な入力値を拒否する", () => {
    const chair = podiumObject({ id: "not-podium", type: "chair", presetId: "chair" });
    const state = calibratedState([podiumObject(), chair]);
    expect(appReducer(state, { type: "ADD_CHAIR_ARC_ROWS", options: options({ podiumId: "missing" }) })).toBe(state);
    expect(appReducer(state, { type: "ADD_CHAIR_ARC_ROWS", options: options({ podiumId: "not-podium" }) })).toBe(state);
    expect(appReducer(state, { type: "ADD_CHAIR_ARC_ROWS", options: options({ firstGapMm: 0 }) })).toBe(state);
    expect(appReducer(state, { type: "ADD_CHAIR_ARC_ROWS", options: options({ rows: [] }) })).toBe(state);

    const invisiblePodium = calibratedState([podiumObject({ visible: false })]);
    expect(appReducer(invisiblePodium, { type: "ADD_CHAIR_ARC_ROWS", options: options() })).toBe(invisiblePodium);
  });

  it("AC-102-19: 生成した椅子が単体配置した標準椅子と同じ表示関連フィールドを持つ", () => {
    const single = createPresetObject("chair", "layer-objects", 0) as SceneObject;
    const state = appReducer(calibratedState(), { type: "ADD_CHAIR_ARC_ROWS", options: options() });
    const generated = state.project.objects.filter((object) => object.type === "chair");

    for (const chair of generated) {
      expect(chair.presetId).toBe(single.presetId);
      expect(chair.assetVariantId).toBe(single.assetVariantId);
      expect(chair.shape).toBe(single.shape);
      expect(chair.widthMm).toBe(single.widthMm);
      expect(chair.depthMm).toBe(single.depthMm);
      expect(chair.heightMm).toBe(single.heightMm);
      expect(chair.name).toBe(single.name);
      expect(chair.label).toBe(single.label);
      expect(chair.style).toBe(single.style);
      expect(chair.rotationDeg).toBe(single.rotationDeg);
      expect(symbolIdForObject(chair)).toBe(symbolIdForObject(single));
    }
  });

  it("AC-102-17: 保存・復元後も通常の椅子として維持され、円弧専用データを持たない", () => {
    const state = appReducer(calibratedState(), { type: "ADD_CHAIR_ARC_ROWS", options: options() });
    const restored = deserializeProject(serializeProject(state.project));

    expect(restored.schemaVersion).toBe(state.project.schemaVersion);
    expect(restored.objects.filter((object) => object.type === "chair")).toHaveLength(14);
    const before = state.project.objects.filter((object) => object.type === "chair");
    const after = restored.objects.filter((object) => object.type === "chair");
    after.forEach((chair, index) => {
      expect(chair.presetId).toBe(before[index].presetId);
      expect(chair.assetVariantId).toBe(before[index].assetVariantId);
      expect(chair.shape).toBe(before[index].shape);
      expect(chair.widthMm).toBe(before[index].widthMm);
      expect(chair.xMm).toBeCloseTo(before[index].xMm);
      expect(chair.yMm).toBeCloseTo(before[index].yMm);
    });
    expect(JSON.parse(serializeProject(state.project))).not.toHaveProperty("chairArc");
  });

  it("既存のADD_PULT_ARCと行列配置に回帰がない", () => {
    const pult = appReducer(createInitialState(), {
      type: "ADD_PULT_ARC",
      options: {
        center: { xMm: 6000, yMm: 5000 },
        radiusMm: 6000,
        startDeg: -45,
        endDeg: 45,
        pultCount: 14,
        pultSpacingMm: 900,
        layerId: "layer-objects",
      },
    });
    expect(pult.project.objects).toHaveLength(42);

    const grid = appReducer(
      appReducer(calibratedState(), { type: "ADD_OBJECT", object: podiumObject({ id: "source", type: "chair", presetId: "chair", widthMm: 450, depthMm: 450 }) }),
      { type: "DUPLICATE_GRID", sourceId: "source", options: { rows: 2, columns: 3, gapXMm: 100, gapYMm: 200 } },
    );
    expect(grid.project.objects.filter((object) => object.type === "chair")).toHaveLength(6);
  });
});
