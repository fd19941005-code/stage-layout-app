// 弦楽器テンプレ配置(FR-062)のUI層テスト。
// 起動条件・確定前セッション・配置オプション組み立て・警告、および
// 「プレビューと確定が同じ純粋関数を通る」ことを検証する。

import { describe, expect, it } from "vitest";
import type { SceneObject } from "../types/project";
import { createEmptyProject } from "./project";
import {
  STRING_ENSEMBLE_ACTIVE_PRESET_ID,
  STRING_ENSEMBLE_PRESETS,
  STRING_LAYOUT_12_CHAIR_SPACING_MM,
  STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID,
  STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM,
  STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM,
  STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
  STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
  STRING_LAYOUT_12_DEFAULT_SPREAD_SCALE,
  STRING_LAYOUT_12_PLAYER_COUNTS,
  STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM,
  STRING_LAYOUT_PLAYER_COUNTS,
  createStringLayout12Objects,
  createStringSectionTemplateSession,
  stringLayout12Placements,
  stringSectionTemplateLaunchIssue,
  stringSectionTemplateOptionsFromSession,
  stringTemplateBackgroundBoundsMm,
  stringTemplateWarnings,
  type StringSectionTemplateSession,
} from "./stringSectionTemplate";

function template(id: string, type: SceneObject["type"], presetId: string, widthMm: number, depthMm: number): SceneObject {
  return {
    id,
    type,
    presetId,
    name: presetId,
    xMm: 0,
    yMm: 0,
    widthMm,
    depthMm,
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
  };
}

const TEMPLATES = {
  chair: template("chair", "chair", "chair", 450, 450),
  stand: template("stand", "musicStand", "music-stand", 480, 450),
  contrabassStool: template("cb", "chair", STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID, 900, 1200),
};

function session(overrides: Partial<StringSectionTemplateSession> = {}): StringSectionTemplateSession {
  return {
    ...createStringSectionTemplateSession({
      selectedPodium: null,
      backgroundWidthMm: 20000,
      backgroundHeightMm: 15000,
      stageFrontYMm: 12900,
      layerId: "layer-objects",
    }),
    ...overrides,
  };
}

describe("編成型プリセット", () => {
  it("8〜16型がすべて選択でき、人数は固定テンプレートの正本を参照する", () => {
    expect(STRING_ENSEMBLE_ACTIVE_PRESET_ID).toBe("12");
    expect(STRING_ENSEMBLE_PRESETS.map((preset) => preset.id)).toEqual(["8", "10", "12", "14", "16"]);
    expect(STRING_ENSEMBLE_PRESETS.every((preset) => preset.available)).toBe(true);
    // 表示用に人数を二重管理しない
    for (const preset of STRING_ENSEMBLE_PRESETS) {
      expect(preset.counts).toBe(STRING_LAYOUT_PLAYER_COUNTS[preset.id]);
    }
    const twelve = STRING_ENSEMBLE_PRESETS.find((preset) => preset.id === "12");
    expect(twelve?.label).toBe("12型標準配置");
    // 表示人数は固定テンプレートの正本と一致する
    expect(twelve?.counts).toEqual(STRING_LAYOUT_12_PLAYER_COUNTS);
    expect(twelve?.counts).toEqual({ violin1: 12, violin2: 10, viola: 8, cello: 6, contrabass: 4 });
  });
});

describe("起動条件", () => {
  it("未校正・非表示・ロックでは起動できない", () => {
    const project = createEmptyProject("テスト");
    expect(stringSectionTemplateLaunchIssue(project, "layer-objects")).toBe("校正後に利用できます。");
    const calibrated = { ...project, calibration: { ...project.calibration, mmPerPixel: 1 } };
    expect(stringSectionTemplateLaunchIssue(calibrated, "layer-objects")).toBeNull();
    expect(stringSectionTemplateLaunchIssue(calibrated, "missing")).toBe("配置先レイヤーが見つかりません。");
    const hidden = { ...calibrated, layers: calibrated.layers.map((layer) => layer.id === "layer-objects" ? { ...layer, visible: false } : layer) };
    expect(stringSectionTemplateLaunchIssue(hidden, "layer-objects")).toBe("配置先レイヤーが非表示です。");
    const locked = { ...calibrated, layers: calibrated.layers.map((layer) => layer.id === "layer-objects" ? { ...layer, locked: true } : layer) };
    expect(stringSectionTemplateLaunchIssue(locked, "layer-objects")).toBe("配置先レイヤーがロックされています。");
  });
});

describe("確定前セッションと配置オプション", () => {
  it("舞台奥が画面上なので、指揮者位置Yは舞台前端より小さい値になる", () => {
    const withStageFront = createStringSectionTemplateSession({
      selectedPodium: null,
      backgroundWidthMm: 20000,
      backgroundHeightMm: 15000,
      stageFrontYMm: 12000,
      layerId: "layer-objects",
    });
    expect(withStageFront.conductor).toEqual({ xMm: 10000, yMm: 11100 });

    const withBackground = createStringSectionTemplateSession({
      selectedPodium: null,
      backgroundWidthMm: 20000,
      backgroundHeightMm: 15000,
      stageFrontYMm: null,
      layerId: "layer-objects",
    });
    expect(withBackground.conductor).toEqual({ xMm: 10000, yMm: 12000 });

    const bare = createStringSectionTemplateSession({
      selectedPodium: null,
      backgroundWidthMm: 0,
      backgroundHeightMm: 0,
      stageFrontYMm: null,
      layerId: "layer-objects",
    });
    expect(bare.conductor).toEqual({ xMm: 5000, yMm: 8000 });
  });

  it("初期セッションは補正なしで、人数・セクション順の入力を持たない", () => {
    const created = createStringSectionTemplateSession({
      selectedPodium: { id: "podium-1", xMm: 4000, yMm: 9000 },
      backgroundWidthMm: 20000,
      backgroundHeightMm: 15000,
      stageFrontYMm: null,
      layerId: "layer-objects",
    });
    expect(created.basis).toBe("podium");
    expect(created.podiumId).toBe("podium-1");
    expect(created.conductor).toEqual({ xMm: 4000, yMm: 9000 });
    expect(created.lateralOffsetMm).toBe(0);
    // 前後補正は指揮者の前を空けるため既定で舞台奥へ600mm
    expect(created.depthOffsetMm).toBe(STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM);
    expect(STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM).toBe(600);
    expect(created.spreadScale).toBe(STRING_LAYOUT_12_DEFAULT_SPREAD_SCALE);
    // 列の間隔は既定値から始まり、ダイアログとキャンバスのドラッグで動く
    expect(created.firstRowRadiusMm).toBe(STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM);
    expect(created.rowGapMm).toBe(STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM);
    expect(created.ensembleTypeId).toBe("12");
    expect(created.seatingVariantId).toBe("standard");
    expect(Object.keys(created).sort()).toEqual([
      "basis", "conductor", "depthOffsetMm", "ensembleTypeId", "firstRowRadiusMm",
      "lateralOffsetMm", "layerId", "podiumId", "rowGapMm", "seatingVariantId", "spreadScale",
    ]);
  });

  it("内部固定値を一元的に与え、指揮台があればその中心を原点にする", () => {
    const current = session({ basis: "podium", podiumId: "podium-1" });
    const withPodium = stringSectionTemplateOptionsFromSession(current, { xMm: 4000, yMm: 9000 });
    expect(withPodium.conductor).toEqual({ xMm: 4000, yMm: 9000 });
    expect(withPodium.chairCenterSpacingMm).toBe(STRING_LAYOUT_12_CHAIR_SPACING_MM);
    expect(withPodium.contrabassSeatSpacingMm).toBe(STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM);
    expect(withPodium.standForwardOffsetMm).toBe(STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM);
    // 列の間隔はセッションの値をそのまま渡す
    expect(withPodium.firstRowRadiusMm).toBe(current.firstRowRadiusMm);
    expect(withPodium.rowGapMm).toBe(current.rowGapMm);

    const fallback = stringSectionTemplateOptionsFromSession(current, null);
    expect(fallback.conductor).toEqual(current.conductor);

    const coordinate = stringSectionTemplateOptionsFromSession(
      session({ basis: "coordinate", conductor: { xMm: 1000, yMm: 2000 } }),
      { xMm: 4000, yMm: 9000 },
    );
    expect(coordinate.conductor).toEqual({ xMm: 1000, yMm: 2000 });
  });

  it("プレビューと確定は同じオプション・同じ純粋関数を通る", () => {
    const current = session({ lateralOffsetMm: 300, depthOffsetMm: 200, spreadScale: 1.1 });
    const first = stringSectionTemplateOptionsFromSession(current, null);
    const second = stringSectionTemplateOptionsFromSession(current, null);
    expect(first).toEqual(second);

    const preview = createStringLayout12Objects(TEMPLATES, first, 0, (role, key) => `preview-${key}-${role}`);
    const commit = createStringLayout12Objects(TEMPLATES, second, 0, (role, key) => `commit-${key}-${role}`);
    expect(preview).toHaveLength(60);
    preview.forEach((object, index) => {
      expect(object.xMm).toBeCloseTo(commit[index].xMm, 9);
      expect(object.yMm).toBeCloseTo(commit[index].yMm, 9);
      expect(object.rotationDeg).toBeCloseTo(commit[index].rotationDeg, 9);
      expect(object.widthMm).toBe(commit[index].widthMm);
      expect(object.depthMm).toBe(commit[index].depthMm);
      expect(object.label).toBe(commit[index].label);
    });
    expect(stringLayout12Placements(first)).toEqual(stringLayout12Placements(second));
  });
});

describe("警告", () => {
  const options = stringSectionTemplateOptionsFromSession(session(), null);
  const objects = createStringLayout12Objects(TEMPLATES, options, 0, (role, key) => `w-${key}-${role}`);

  it("背景範囲内・少数オブジェクトでは警告が出ない", () => {
    expect(stringTemplateWarnings(objects, { minXMm: -100000, minYMm: -100000, maxXMm: 100000, maxYMm: 100000 }, 0))
      .toEqual([]);
    expect(stringTemplateWarnings(objects, null, 0)).toEqual([]);
  });

  it("背景範囲外・オブジェクト数超過を警告する", () => {
    expect(stringTemplateWarnings(objects, { minXMm: 0, minYMm: 0, maxXMm: 1000, maxYMm: 1000 }, 0)
      .some((warning) => warning.kind === "outOfBackground")).toBe(true);
    expect(stringTemplateWarnings(objects, null, 441)
      .some((warning) => warning.kind === "objectCount")).toBe(true);
    expect(stringTemplateWarnings(objects, null, 440)).toEqual([]);
  });

  it("背景範囲は校正済みの背景がある場合だけ求まる", () => {
    const project = createEmptyProject("テスト");
    expect(stringTemplateBackgroundBoundsMm(project, { widthPx: 100, heightPx: 100 })).toBeNull();
    const calibrated = {
      ...project,
      calibration: { ...project.calibration, mmPerPixel: 10 },
      background: { ...project.background, imageDataUrl: "data:image/png;base64,xx" },
    };
    expect(stringTemplateBackgroundBoundsMm(calibrated, { widthPx: 100, heightPx: 50 }))
      .toEqual({ minXMm: 0, minYMm: 0, maxXMm: 1000, maxYMm: 500 });
    expect(stringTemplateBackgroundBoundsMm(calibrated, { widthPx: 0, heightPx: 0 })).toBeNull();
  });
});
