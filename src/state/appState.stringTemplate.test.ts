// 弦楽器テンプレ配置(FR-062)のreducerテスト。
// 1 Actionでの一括生成・全選択・1回のUndo/Redo・レイヤー制約・
// プレビューと確定座標の一致・保存互換・既存一括配置の回帰を検証する。

import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, createPresetObject, type AppState } from "./appState";
import { createEmptyProject, deserializeProject, serializeProject } from "../core/project";
import { SCHEMA_VERSION, type Project, type SceneObject } from "../types/project";
import {
  STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID,
  STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
  STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
  STRING_LAYOUT_12_SEAT_PRESET_ID,
  STRING_LAYOUT_12_STAND_PRESET_ID,
  createStringLayout12Objects,
  stageLocalOf,
  stringLayout12Placements,
  stringSectionTemplateOptionsFromSession,
  type StringLayout12Options,
} from "../core/stringSectionTemplate";

const CONDUCTOR = { xMm: 10000, yMm: 12000 };
/** 舞台前端は指揮者より客席側(Yが大きい)。舞台奥は画面上=Y負方向。 */
const STAGE_FRONT_Y_MM = 12900;

function podiumObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: "podium-1",
    type: "podium",
    presetId: "podium",
    name: "指揮台",
    xMm: CONDUCTOR.xMm,
    yMm: CONDUCTOR.yMm,
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
    stageFront: { yMm: STAGE_FRONT_Y_MM },
    objects,
  };
}

function calibratedState(objects: SceneObject[] = [podiumObject()]): AppState {
  return createInitialState(calibratedProject(objects));
}

/** ダイアログと同じ経路(セッション→オプション)で組み立てる。 */
function options(overrides: Partial<StringLayout12Options> = {}): StringLayout12Options {
  const base = stringSectionTemplateOptionsFromSession({
    seatingVariantId: "standard",
    ensembleTypeId: "12",
    basis: "podium",
    podiumId: "podium-1",
    conductor: { ...CONDUCTOR },
    lateralOffsetMm: 0,
    depthOffsetMm: 0,
    spreadScale: 1,
    firstRowRadiusMm: STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
    rowGapMm: STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
    layerId: "layer-objects",
  }, { xMm: CONDUCTOR.xMm, yMm: CONDUCTOR.yMm });
  return { ...base, ...overrides };
}

function generated(state: AppState): SceneObject[] {
  return state.project.objects.filter((object) => object.id !== "podium-1");
}

/** プレビューと同じ純粋関数でSceneObjectを組み立てる。 */
function previewObjects(opts: StringLayout12Options): SceneObject[] {
  const templates = {
    chair: createPresetObject(STRING_LAYOUT_12_SEAT_PRESET_ID, opts.layerId, 0) as SceneObject,
    stand: createPresetObject(STRING_LAYOUT_12_STAND_PRESET_ID, opts.layerId, 0) as SceneObject,
    contrabassStool: createPresetObject(STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID, opts.layerId, 0) as SceneObject,
  };
  return createStringLayout12Objects(templates, opts, 0, (role, key) => `preview-${key}-${role}`);
}

function localOf(object: SceneObject, opts: StringLayout12Options) {
  return stageLocalOf(opts.conductor, object);
}

describe("ADD_STRING_SECTION_TEMPLATE", () => {
  it("12型標準配置を1 Actionで60オブジェクト生成し、全生成物を選択状態にする", () => {
    const before = calibratedState();
    const state = appReducer(before, { type: "ADD_STRING_SECTION_TEMPLATE", options: options() });

    const objects = generated(state);
    expect(objects).toHaveLength(60);
    expect(objects.filter((object) => object.presetId === STRING_LAYOUT_12_SEAT_PRESET_ID)).toHaveLength(36);
    expect(objects.filter((object) => object.presetId === STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID)).toHaveLength(4);
    expect(objects.filter((object) => object.type === "musicStand")).toHaveLength(20);
    expect(state.selectedIds).toEqual(objects.map((object) => object.id));
    // 1回のcommitProjectなので履歴は1件だけ増える
    expect(state.past).toHaveLength(1);
    expect(state.past[0].objects).toHaveLength(1);
    expect(state.saveState).toBe("dirty");
  });

  it("必須17: プレビュー座標と確定後の座標・角度が一致する", () => {
    for (const opts of [options(), options({ lateralOffsetMm: -800, depthOffsetMm: 400, spreadScale: 1.2 })]) {
      const preview = previewObjects(opts);
      const state = appReducer(calibratedState(), { type: "ADD_STRING_SECTION_TEMPLATE", options: opts });
      const committed = generated(state);

      expect(committed).toHaveLength(preview.length);
      committed.forEach((object, index) => {
        expect(object.xMm).toBeCloseTo(preview[index].xMm, 9);
        expect(object.yMm).toBeCloseTo(preview[index].yMm, 9);
        expect(object.rotationDeg).toBeCloseTo(preview[index].rotationDeg, 9);
        expect(object.widthMm).toBe(preview[index].widthMm);
        expect(object.depthMm).toBe(preview[index].depthMm);
        expect(object.presetId).toBe(preview[index].presetId);
        expect(object.label).toBe(preview[index].label);
      });
    }
  });

  it("必須18: プレビュー計算はproject.objects・Undo履歴・保存状態・選択を変更しない", () => {
    const state = calibratedState();
    const first = previewObjects(options());
    const second = previewObjects(options({ spreadScale: 1.4, lateralOffsetMm: 500 }));
    expect(first).toHaveLength(60);
    expect(second).toHaveLength(60);
    expect(second[0].xMm).not.toBeCloseTo(first[0].xMm, 3);

    expect(state.project.objects).toHaveLength(1);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.selectedIds).toEqual([]);
    expect(state.saveState).toBe("saved");
  });

  it("必須19/20: 1回のUndoで全削除、1回のRedoで同じ位置・向き・寸法へ復元する", () => {
    let state = appReducer(calibratedState(), { type: "ADD_STRING_SECTION_TEMPLATE", options: options() });
    const snapshot = generated(state).map((object) => ({
      id: object.id,
      xMm: object.xMm,
      yMm: object.yMm,
      rotationDeg: object.rotationDeg,
      widthMm: object.widthMm,
      depthMm: object.depthMm,
    }));
    expect(snapshot).toHaveLength(60);

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects).toHaveLength(1);
    expect(state.project.objects[0].id).toBe("podium-1");

    state = appReducer(state, { type: "REDO" });
    expect(generated(state).map((object) => ({
      id: object.id,
      xMm: object.xMm,
      yMm: object.yMm,
      rotationDeg: object.rotationDeg,
      widthMm: object.widthMm,
      depthMm: object.depthMm,
    }))).toEqual(snapshot);

    // 確定後は個別に移動・削除・回転できる
    state = appReducer(state, { type: "MOVE_OBJECT", id: snapshot[0].id, xMm: 1, yMm: 2 });
    expect(state.project.objects.find((object) => object.id === snapshot[0].id)?.xMm).toBe(1);
    state = appReducer(state, { type: "DELETE_OBJECT", id: snapshot[1].id });
    expect(generated(state)).toHaveLength(59);
    state = appReducer(state, { type: "ROTATE_OBJECT", id: snapshot[2].id, rotationDeg: 45 });
    expect(state.project.objects.find((object) => object.id === snapshot[2].id)?.rotationDeg).toBe(45);
  });

  it("確定後のオブジェクトでもセクションの左右・前後関係が保たれる", () => {
    const opts = options();
    const state = appReducer(calibratedState(), { type: "ADD_STRING_SECTION_TEMPLATE", options: opts });
    const objects = generated(state);

    // 奏者位置だけで比較する。譜面台は指揮者側へ450mmずれるため基準にしない。
    const stats = (label: string) => {
      const target = objects
        .filter((object) => object.type === "chair" && object.label === label)
        .map((object) => localOf(object, opts));
      expect(target.length).toBeGreaterThan(0);
      return {
        count: target.length,
        meanLateralMm: target.reduce((sum, p) => sum + p.lateralMm, 0) / target.length,
        meanDepthMm: target.reduce((sum, p) => sum + p.depthMm, 0) / target.length,
        minDepthMm: Math.min(...target.map((p) => p.depthMm)),
      };
    };
    const v1 = stats("1st");
    const v2 = stats("2nd");
    const vc = stats("Vc");
    const va = stats("Va");
    const cb = stats("Cb");
    expect([v1.count, v2.count, va.count, vc.count, cb.count]).toEqual([12, 10, 8, 6, 4]);

    // 図面左から右へ 1st Vn → 2nd Vn → Vc → Va → Cb
    expect(v1.meanLateralMm).toBeLessThan(v2.meanLateralMm);
    expect(v2.meanLateralMm).toBeLessThan(0);
    expect(vc.meanLateralMm).toBeGreaterThan(0);
    expect(vc.meanLateralMm).toBeLessThan(va.meanLateralMm);
    expect(va.meanLateralMm).toBeLessThan(cb.meanLateralMm);
    // 1st Vn / Vaが前方、2nd Vn / Vc / Cbが後方
    expect(v1.meanDepthMm).toBeLessThan(v2.meanDepthMm);
    expect(va.meanDepthMm).toBeLessThan(vc.meanDepthMm);
    expect(cb.meanDepthMm).toBeGreaterThan(Math.max(v1.meanDepthMm, va.meanDepthMm));
    // 展開は舞台奥側(画面上)。最前列は指揮台を囲むため椅子半分だけ客席側へ出る
    expect(Math.min(v1.minDepthMm, va.minDepthMm)).toBeGreaterThan(-350);
    expect(Math.min(v2.minDepthMm, vc.minDepthMm, cb.minDepthMm)).toBeGreaterThan(0);
  });

  it("舞台前端の値にかかわらず画面上側(舞台奥)へ生成する", () => {
    for (const stageFrontYMm of [STAGE_FRONT_Y_MM, 3000, null]) {
      const project = { ...calibratedProject(), stageFront: stageFrontYMm === null ? null : { yMm: stageFrontYMm } };
      const opts = options();
      const state = appReducer(createInitialState(project), { type: "ADD_STRING_SECTION_TEMPLATE", options: opts });
      const objects = generated(state);
      expect(objects).toHaveLength(60);
      // 舞台前端の値は生成方向へ影響しない。指揮台を囲む最前列の椅子を除き舞台奥側
      for (const object of objects) {
        expect(localOf(object, opts).depthMm).toBeGreaterThan(-350);
      }
      expect(Math.max(...objects.map((object) => localOf(object, opts).depthMm))).toBeGreaterThan(3000);
      // 客席側へ出るのは最前列の腕の客席側の椅子だけ
      for (const object of objects) {
        if (localOf(object, opts).depthMm >= 0) continue;
        expect(object.type).toBe("chair");
        expect(object.label).toMatch(/^(1st|Va)$/);
      }
    }
  });

  it("ロック中・非表示レイヤーでは生成しない", () => {
    const locked = appReducer(calibratedState(), { type: "SET_LAYER_LOCKED", layerId: "layer-objects", locked: true });
    expect(appReducer(locked, { type: "ADD_STRING_SECTION_TEMPLATE", options: options() }).project.objects).toHaveLength(1);

    const hidden = appReducer(calibratedState(), { type: "SET_LAYER_VISIBLE", layerId: "layer-objects", visible: false });
    expect(appReducer(hidden, { type: "ADD_STRING_SECTION_TEMPLATE", options: options() }).project.objects).toHaveLength(1);
  });

  it("未校正・無効な補正値では確定できない", () => {
    const uncalibrated = createInitialState({ ...createEmptyProject("未校正"), objects: [podiumObject()] });
    expect(appReducer(uncalibrated, { type: "ADD_STRING_SECTION_TEMPLATE", options: options() })).toBe(uncalibrated);

    const state = calibratedState();
    expect(appReducer(state, { type: "ADD_STRING_SECTION_TEMPLATE", options: options({ spreadScale: 3 }) })).toBe(state);
    expect(appReducer(state, { type: "ADD_STRING_SECTION_TEMPLATE", options: options({ depthOffsetMm: -5000 }) })).toBe(state);
    expect(appReducer(state, { type: "ADD_STRING_SECTION_TEMPLATE", options: options({ lateralOffsetMm: Number.NaN }) })).toBe(state);
    expect(appReducer(state, { type: "ADD_STRING_SECTION_TEMPLATE", options: options({ conductor: { xMm: Number.NaN, yMm: 0 } }) })).toBe(state);
  });

  it("既存オブジェクトを変更せず、IDとzIndexが重複しない", () => {
    const before = calibratedState();
    const state = appReducer(before, { type: "ADD_STRING_SECTION_TEMPLATE", options: options() });
    expect(state.project.objects.find((object) => object.id === "podium-1")).toEqual(before.project.objects[0]);
    expect(new Set(state.project.objects.map((object) => object.id)).size).toBe(61);
    expect(new Set(state.project.objects.map((object) => object.zIndex)).size).toBe(61);
  });

  it("layerIdが空ならアクティブレイヤーへ配置する", () => {
    const state = appReducer(calibratedState(), {
      type: "ADD_STRING_SECTION_TEMPLATE",
      options: options({ layerId: "" }),
    });
    const objects = generated(state);
    expect(objects).toHaveLength(60);
    expect(objects.every((object) => object.layerId === "layer-objects")).toBe(true);
  });

  it("必須22: schemaVersionを変えず、保存・復元で通常オブジェクトとして往復する", () => {
    const state = appReducer(calibratedState(), { type: "ADD_STRING_SECTION_TEMPLATE", options: options() });
    expect(state.project.schemaVersion).toBe(SCHEMA_VERSION);

    const restored = deserializeProject(serializeProject(state.project));
    expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored.objects).toHaveLength(61);
    const before = generated(state);
    const after = restored.objects.filter((object) => object.id !== "podium-1");
    after.forEach((object, index) => {
      expect(object.presetId).toBe(before[index].presetId);
      expect(object.label).toBe(before[index].label);
      expect(object.widthMm).toBe(before[index].widthMm);
      expect(object.depthMm).toBe(before[index].depthMm);
      expect(object.xMm).toBeCloseTo(before[index].xMm, 6);
      expect(object.yMm).toBeCloseTo(before[index].yMm, 6);
      expect(object.rotationDeg).toBeCloseTo(before[index].rotationDeg, 6);
    });
    expect(JSON.parse(serializeProject(state.project))).not.toHaveProperty("stringSectionTemplate");
  });

  it("必須21: 既存のADD_PULT_ARC・ADD_CHAIR_ARC_ROWSに回帰がない", () => {
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
    expect(pult.project.objects[0].label).toBe("プルト1-1");
    expect(pult.project.objects[2].label).toBe("譜面台1");
    expect(pult.project.objects[0].rotationDeg).toBeCloseTo(45);
    expect(new Set(pult.project.objects.map((object) => object.id)).size).toBe(42);

    const chairArc = appReducer(calibratedState(), {
      type: "ADD_CHAIR_ARC_ROWS",
      options: {
        podiumId: "podium-1",
        directionDeg: -90,
        halfSpanDeg: 45,
        firstGapMm: 1820,
        rowGapMm: 910,
        rows: [{ chairCount: 6 }, { chairCount: 8 }],
        layerId: "layer-objects",
      },
    });
    expect(chairArc.project.objects.filter((object) => object.type === "chair")).toHaveLength(14);
  });

  it("生成物を自動グループ化しない", () => {
    const state = appReducer(calibratedState(), { type: "ADD_STRING_SECTION_TEMPLATE", options: options() });
    expect(state.project.objects.every((object) => object.groupId === null)).toBe(true);
    // プルト数はテンプレートどおり20
    expect(stringLayout12Placements(options())).toHaveLength(20);
  });
});
