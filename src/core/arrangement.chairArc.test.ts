// 椅子多列円弧配置(FR-064 / AC-102)の幾何計算・警告・起動条件テスト。
// すべてmm座標だけで検証し、React/DOM/pxへ依存しない。

import { describe, expect, it } from "vitest";
import {
  CHAIR_ARC_DRAG_STEP_MM,
  chairArcChairRadiusMm,
  chairArcFirstGapFromRadiusMm,
  chairArcMusicStandPlacement,
  chairArcFirstRowRadiusMm,
  chairArcLaunchIssue,
  chairArcRowGapFromRadiusMm,
  chairArcRowAnglesDeg,
  chairArcRowRadiusMm,
  createChairArcRowObjects,
  createChairArcRowPlacements,
  createChairArcSession,
  defaultChairArcDirectionDeg,
  detectChairArcObjectOverlaps,
  detectChairArcOffStagePlacements,
  detectChairArcOverlaps,
  podiumExtentAlongDirection,
  validateChairArcRowsOptions,
  type ChairArcRowsOptions,
} from "./arrangement";
import { createEmptyProject } from "./project";
import { findPreset } from "./presets";
import type { Project, SceneObject } from "../types/project";

function sceneObject(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: "椅子",
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

/** 標準プリセットの実寸をそのまま使う。テスト側で寸法をハードコードしない。 */
function chairTemplate(): SceneObject {
  const preset = findPreset("chair");
  if (!preset) throw new Error("chairプリセットが見つかりません");
  return sceneObject("chair-template", {
    widthMm: preset.widthMm,
    depthMm: preset.depthMm,
    heightMm: preset.heightMm,
    shape: preset.shape,
    assetVariantId: "stage-open-template/chair-a",
  });
}

function musicStandTemplate(): SceneObject {
  const preset = findPreset("music-stand");
  if (!preset) throw new Error("music-standプリセットが見つかりません");
  return sceneObject("stand-template", {
    type: "musicStand",
    presetId: "music-stand",
    name: preset.name,
    widthMm: preset.widthMm,
    depthMm: preset.depthMm,
    heightMm: preset.heightMm,
    shape: preset.shape,
    assetVariantId: "generated/music-stand",
  });
}

function podiumObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return sceneObject("podium-1", {
    type: "podium",
    presetId: "podium",
    name: "指揮台",
    widthMm: 900,
    depthMm: 900,
    heightMm: 200,
    xMm: 10000,
    yMm: 8000,
    ...overrides,
  });
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

describe("椅子多列円弧配置の幾何計算", () => {
  it("AC-102-01: 900×900mmの指揮台と450×450mmの椅子、空き1820mmで1列目半径が2495mmになる", () => {
    const podium = podiumObject();
    const chair = chairTemplate();
    expect(podiumExtentAlongDirection(podium, -90)).toBeCloseTo(450);
    expect(chairArcChairRadiusMm(chair)).toBeCloseTo(225);
    expect(chairArcFirstRowRadiusMm(podium, chair, options())).toBeCloseTo(2495);
  });

  it("AC-102-02: 2列目半径が1列目半径+910mmになる", () => {
    const placements = createChairArcRowPlacements(podiumObject(), chairTemplate(), options());
    const row0 = placements.filter((placement) => placement.rowIndex === 0);
    const row1 = placements.filter((placement) => placement.rowIndex === 1);
    expect(row0[0].radiusMm).toBeCloseTo(2495);
    expect(row1[0].radiusMm).toBeCloseTo(2495 + 910);
    expect(chairArcRowRadiusMm(2495, 2, 910)).toBeCloseTo(4315);
  });

  it("各椅子の前に譜面台を選ぶと、同じ円弧の各脚へ1台ずつ生成する", () => {
    const podium = podiumObject();
    const chair = chairTemplate();
    const stand = musicStandTemplate();
    const optionsWithStands = options({ rows: [{ chairCount: 2 }], includeMusicStands: true });
    const placements = createChairArcRowPlacements(podium, chair, optionsWithStands);
    const objects = createChairArcRowObjects(podium, chair, optionsWithStands, undefined, stand);
    expect(objects).toHaveLength(4);
    expect(objects.filter((object) => object.type === "chair")).toHaveLength(2);
    expect(objects.filter((object) => object.type === "musicStand")).toHaveLength(2);
    const expectedStand = chairArcMusicStandPlacement(placements[0], chair, stand);
    expect(objects.find((object) => object.type === "musicStand")).toMatchObject(expectedStand);
  });

  it("AC-102-03: 1列目6脚・2列目8脚で合計14脚を生成する", () => {
    const placements = createChairArcRowPlacements(podiumObject(), chairTemplate(), options());
    expect(placements).toHaveLength(14);
    expect(placements.filter((placement) => placement.rowIndex === 0)).toHaveLength(6);
    expect(placements.filter((placement) => placement.rowIndex === 1)).toHaveLength(8);
  });

  it("AC-102-04/07: 全列の開始・終了角度が一致し、列内は等角度間隔になる", () => {
    const placements = createChairArcRowPlacements(podiumObject(), chairTemplate(), options({
      rows: [{ chairCount: 6 }, { chairCount: 8 }, { chairCount: 10 }],
    }));
    const rows = [0, 1, 2].map((rowIndex) => placements.filter((placement) => placement.rowIndex === rowIndex));
    for (const row of rows) {
      expect(row[0].angleDeg).toBeCloseTo(-135);
      expect(row[row.length - 1].angleDeg).toBeCloseTo(-45);
      const steps = row.slice(1).map((placement, index) => placement.angleDeg - row[index].angleDeg);
      for (const step of steps) expect(step).toBeCloseTo(steps[0]);
    }
  });

  it("AC-102-05: 偶数脚は中央線を挟んで左右対称に配置される", () => {
    const podium = podiumObject();
    const placements = createChairArcRowPlacements(podium, chairTemplate(), options({ rows: [{ chairCount: 6 }] }));
    expect(placements).toHaveLength(6);
    expect(placements.some((placement) => Math.abs(placement.xMm - podium.xMm) < 1e-6)).toBe(false);
    for (let index = 0; index < 3; index += 1) {
      const left = placements[index];
      const right = placements[placements.length - 1 - index];
      expect(left.xMm - podium.xMm).toBeCloseTo(-(right.xMm - podium.xMm));
      expect(left.yMm).toBeCloseTo(right.yMm);
    }
  });

  it("AC-102-06: 奇数脚は中央線上に1脚、左右へ同数配置される", () => {
    const podium = podiumObject();
    const placements = createChairArcRowPlacements(podium, chairTemplate(), options({ rows: [{ chairCount: 5 }] }));
    expect(placements).toHaveLength(5);
    expect(placements[2].xMm).toBeCloseTo(podium.xMm);
    expect(placements[2].yMm).toBeCloseTo(podium.yMm - 2495);
    expect(placements.filter((placement) => placement.xMm < podium.xMm - 1e-6)).toHaveLength(2);
    expect(placements.filter((placement) => placement.xMm > podium.xMm + 1e-6)).toHaveLength(2);
  });

  it("1脚の列は中心方向上へ1脚だけ置く", () => {
    expect(chairArcRowAnglesDeg(1, -90, 45)).toEqual([-90]);
    expect(chairArcRowAnglesDeg(2, -90, 45)).toEqual([-135, -45]);
    expect(chairArcRowAnglesDeg(0, -90, 45)).toEqual([]);
  });

  it("AC-102-08: 指揮台を回転しても中心方向上の回転後外形端を基準にする", () => {
    expect(podiumExtentAlongDirection(podiumObject({ rotationDeg: 90 }), -90)).toBeCloseTo(450);
    expect(podiumExtentAlongDirection(podiumObject({ rotationDeg: 45 }), -90)).toBeCloseTo(450 * Math.SQRT2);
    // 長方形の指揮台では、方向により支持距離が幅側・奥行側で切り替わる
    const wide = podiumObject({ widthMm: 1200, depthMm: 600, rotationDeg: 90 });
    expect(podiumExtentAlongDirection(wide, 0)).toBeCloseTo(300);
    expect(podiumExtentAlongDirection(wide, -90)).toBeCloseTo(600);
    const rotated = createChairArcRowPlacements(podiumObject({ rotationDeg: 45 }), chairTemplate(), options());
    expect(rotated[0].radiusMm).toBeCloseTo(450 * Math.SQRT2 + 1820 + 225);
  });

  it("方向を変更すると円弧中心まわりに座標が回転する", () => {
    const podium = podiumObject();
    const base = createChairArcRowPlacements(podium, chairTemplate(), options());
    const turned = createChairArcRowPlacements(podium, chairTemplate(), options({ directionDeg: 0 }));
    expect(turned).toHaveLength(base.length);
    base.forEach((placement, index) => {
      // -90度から0度へ+90度回転: (x, y) -> (-y, x)を円弧中心まわりに適用した位置になる
      const dx = placement.xMm - podium.xMm;
      const dy = placement.yMm - podium.yMm;
      expect(turned[index].xMm).toBeCloseTo(podium.xMm - dy);
      expect(turned[index].yMm).toBeCloseTo(podium.yMm + dx);
    });
  });

  it("指揮台の回転方向を中心方向の初期値にし、回転0では画面上方向になる", () => {
    expect(defaultChairArcDirectionDeg({ rotationDeg: 0 })).toBeCloseTo(270);
    expect(defaultChairArcDirectionDeg({ rotationDeg: 90 })).toBeCloseTo(0);
    const session = createChairArcSession(podiumObject(), "layer-objects");
    expect(session.options.rows.map((row) => row.chairCount)).toEqual([6, 8]);
    expect(session.options.firstGapMm).toBe(1820);
    expect(session.options.rowGapMm).toBe(910);
    expect(session.options.includeMusicStands).toBe(true);
    expect(session.pickingDirection).toBe(false);
  });

  it("円弧線のドラッグ半径から1列目空き距離を10mm刻みで求める", () => {
    const podium = podiumObject();
    const chair = chairTemplate();
    // 半径2495mmは既定の1820mmへ戻る(450 + 1820 + 225)
    expect(chairArcFirstGapFromRadiusMm(podium, chair, -90, 2495)).toBe(1820);
    expect(chairArcFirstGapFromRadiusMm(podium, chair, -90, 3405)).toBe(2730);
    expect(chairArcFirstGapFromRadiusMm(podium, chair, -90, 2500)).toBe(1830);
    // 指揮台が回転していても、支持距離を差し引いた空き距離が正本になる
    expect(chairArcFirstGapFromRadiusMm(podiumObject({ rotationDeg: 45 }), chair, -90, 450 * Math.SQRT2 + 1820 + 225)).toBe(1820);
    // 内側へ詰めすぎても0以下にしない
    expect(chairArcFirstGapFromRadiusMm(podium, chair, -90, 100)).toBe(10);
    expect(chairArcFirstGapFromRadiusMm(podium, chair, -90, Number.NaN)).toBe(10);
  });

  it("円弧線のドラッグ半径から列間隔を求め、どの列を掴んでも同じ意味になる", () => {
    expect(chairArcRowGapFromRadiusMm(2495, 2495 + 910, 1)).toBe(910);
    expect(chairArcRowGapFromRadiusMm(2495, 2495 + 1820, 2)).toBe(910);
    expect(chairArcRowGapFromRadiusMm(2495, 2495 + 2730, 3)).toBe(910);
    expect(chairArcRowGapFromRadiusMm(2495, 2495 + 100, 1)).toBe(100);
    // 1列目や不正な列番号では列間隔を算出しない
    expect(chairArcRowGapFromRadiusMm(2495, 4000, 0)).toBe(10);
    expect(chairArcRowGapFromRadiusMm(2495, 2000, 1)).toBe(10);
  });

  it("ドラッグ結果を再計算すると、10mm刻みの丸め幅の中で同じ半径へ戻る", () => {
    const podium = podiumObject();
    const chair = chairTemplate();
    const firstGapMm = chairArcFirstGapFromRadiusMm(podium, chair, -90, 3000);
    const radius = chairArcFirstRowRadiusMm(podium, chair, { directionDeg: -90, firstGapMm });
    expect(Math.abs(radius - 3000)).toBeLessThanOrEqual(CHAIR_ARC_DRAG_STEP_MM / 2);

    const rowGapMm = chairArcRowGapFromRadiusMm(radius, 4500, 1);
    expect(Math.abs(chairArcRowRadiusMm(radius, 1, rowGapMm) - 4500)).toBeLessThanOrEqual(CHAIR_ARC_DRAG_STEP_MM / 2);
  });

  it("非有限値や範囲外の入力を拒否する", () => {
    expect(validateChairArcRowsOptions(options())).toEqual([]);
    expect(validateChairArcRowsOptions(options({ firstGapMm: Number.NaN })).length).toBeGreaterThan(0);
    expect(validateChairArcRowsOptions(options({ rowGapMm: 0 })).length).toBeGreaterThan(0);
    expect(validateChairArcRowsOptions(options({ directionDeg: Number.POSITIVE_INFINITY })).length).toBeGreaterThan(0);
    expect(validateChairArcRowsOptions(options({ halfSpanDeg: 1 })).length).toBeGreaterThan(0);
    expect(validateChairArcRowsOptions(options({ halfSpanDeg: 120 })).length).toBeGreaterThan(0);
    expect(validateChairArcRowsOptions(options({ rows: [] })).length).toBeGreaterThan(0);
    expect(validateChairArcRowsOptions(options({ rows: Array.from({ length: 21 }, () => ({ chairCount: 4 })) })).length).toBeGreaterThan(0);
    expect(validateChairArcRowsOptions(options({ rows: [{ chairCount: 0 }] })).length).toBeGreaterThan(0);
    expect(validateChairArcRowsOptions(options({ rows: [{ chairCount: 101 }] })).length).toBeGreaterThan(0);
    expect(createChairArcRowPlacements(podiumObject(), chairTemplate(), options({ firstGapMm: Number.NaN }))).toEqual([]);
  });
});

describe("椅子多列円弧配置の警告", () => {
  it("AC-102-11: 中心間距離が直径未満なら重なり、直径ちょうどは接触として扱わない", () => {
    const near = [
      { rowIndex: 0, chairIndex: 0, xMm: 0, yMm: 0, rotationDeg: 0, angleDeg: 0, radiusMm: 2495 },
      { rowIndex: 0, chairIndex: 1, xMm: 449, yMm: 0, rotationDeg: 0, angleDeg: 0, radiusMm: 2495 },
    ];
    expect(detectChairArcOverlaps(near, 225)).toHaveLength(1);
    const touching = [near[0], { ...near[1], xMm: 450 }];
    expect(detectChairArcOverlaps(touching, 225)).toHaveLength(0);
  });

  it("狭い円弧では実際の配置結果が重なり警告になる", () => {
    const wide = createChairArcRowPlacements(podiumObject(), chairTemplate(), options({ rows: [{ chairCount: 6 }] }));
    expect(detectChairArcOverlaps(wide, 225)).toHaveLength(0);
    const narrow = createChairArcRowPlacements(podiumObject(), chairTemplate(), options({ halfSpanDeg: 2.5, rows: [{ chairCount: 20 }] }));
    expect(detectChairArcOverlaps(narrow, 225).length).toBeGreaterThan(0);
  });

  it("複数列にまたがる重なりも検出する", () => {
    const placements = createChairArcRowPlacements(podiumObject(), chairTemplate(), options({ rowGapMm: 300 }));
    const overlaps = detectChairArcOverlaps(placements, 225);
    expect(overlaps.some((overlap) => overlap.a.rowIndex !== overlap.b.rowIndex)).toBe(true);
  });

  it("既存オブジェクトとの重なりを判定し、注釈は対象外にする", () => {
    const podium = podiumObject();
    const placements = createChairArcRowPlacements(podium, chairTemplate(), options({ rows: [{ chairCount: 1 }] }));
    const target = sceneObject("existing", { type: "instrument", xMm: placements[0].xMm, yMm: placements[0].yMm, widthMm: 1000, depthMm: 1000 });
    expect(detectChairArcObjectOverlaps(placements, 225, [target])).toHaveLength(1);
    const annotation = { ...target, id: "annotation", annotationKind: "rect" as const };
    expect(detectChairArcObjectOverlaps(placements, 225, [annotation])).toHaveLength(0);
    const far = { ...target, id: "far", xMm: placements[0].xMm + 5000 };
    expect(detectChairArcObjectOverlaps(placements, 225, [far])).toHaveLength(0);
  });

  it("有効舞台範囲が未設定なら舞台外判定を行わない", () => {
    const podium = podiumObject();
    const placements = createChairArcRowPlacements(podium, chairTemplate(), options({ rows: [{ chairCount: 1 }] }));
    expect(detectChairArcOffStagePlacements(placements, 225, null)).toEqual([]);
    expect(detectChairArcOffStagePlacements(placements, 225, { yMm: podium.yMm })).toHaveLength(1);
    expect(detectChairArcOffStagePlacements(placements, 225, { yMm: podium.yMm - 10000 })).toEqual([]);
  });
});

describe("椅子多列円弧配置の起動条件と生成オブジェクト", () => {
  function calibratedProject(): Project {
    const project = createEmptyProject("テスト");
    return {
      ...project,
      calibration: { ...project.calibration, mmPerPixel: 1 },
      objects: [podiumObject()],
    };
  }

  it("AC-102-16: 校正前は起動できない", () => {
    const project = createEmptyProject("テスト");
    expect(chairArcLaunchIssue({ ...project, objects: [podiumObject()] }, ["podium-1"], "layer-objects")).toBe("校正後に利用できます。");
  });

  it("指揮台1台以外の選択を拒否する", () => {
    const project = calibratedProject();
    expect(chairArcLaunchIssue(project, [], "layer-objects")).toBe("指揮台を1台選択してください。");
    expect(chairArcLaunchIssue({ ...project, objects: [podiumObject(), sceneObject("chair-1")] }, ["podium-1", "chair-1"], "layer-objects")).toBe("指揮台を1台選択してください。");
    expect(chairArcLaunchIssue({ ...project, objects: [sceneObject("chair-1")] }, ["chair-1"], "layer-objects")).toBe("指揮台を1台選択してください。");
  });

  it("AC-102-15: ロック・非表示レイヤーを拒否し、条件を満たせばnullを返す", () => {
    const project = calibratedProject();
    expect(chairArcLaunchIssue(project, ["podium-1"], "layer-objects")).toBeNull();
    const locked = { ...project, layers: project.layers.map((layer) => layer.id === "layer-objects" ? { ...layer, locked: true } : layer) };
    expect(chairArcLaunchIssue(locked, ["podium-1"], "layer-objects")).toBe("配置先レイヤーがロックされています。");
    // 配置先レイヤーだけが非表示のケースは、指揮台を別レイヤーへ置いて切り分ける
    const hidden = {
      ...project,
      objects: [podiumObject({ layerId: "layer-annotations" })],
      layers: project.layers.map((layer) => layer.id === "layer-objects" ? { ...layer, visible: false } : layer),
    };
    expect(chairArcLaunchIssue(hidden, ["podium-1"], "layer-objects")).toBe("配置先レイヤーが非表示です。");
    expect(chairArcLaunchIssue(project, ["podium-1"], "layer-missing")).toBe("配置先レイヤーが見つかりません。");
    const invisiblePodium = { ...project, objects: [podiumObject({ visible: false })] };
    expect(chairArcLaunchIssue(invisiblePodium, ["podium-1"], "layer-objects")).toBe("選択中の指揮台が非表示です。");
  });

  it("生成オブジェクトはテンプレートの表示関連フィールドを継承し、回転を円弧角から算出しない", () => {
    const template = chairTemplate();
    const objects = createChairArcRowObjects(podiumObject(), template, options());
    expect(objects).toHaveLength(14);
    expect(objects.map((object) => object.id)).toEqual([
      "chair-arc-r1-c1", "chair-arc-r1-c2", "chair-arc-r1-c3", "chair-arc-r1-c4", "chair-arc-r1-c5", "chair-arc-r1-c6",
      "chair-arc-r2-c1", "chair-arc-r2-c2", "chair-arc-r2-c3", "chair-arc-r2-c4", "chair-arc-r2-c5", "chair-arc-r2-c6", "chair-arc-r2-c7", "chair-arc-r2-c8",
    ]);
    for (const object of objects) {
      expect(object.type).toBe(template.type);
      expect(object.presetId).toBe(template.presetId);
      expect(object.assetVariantId).toBe(template.assetVariantId);
      expect(object.shape).toBe(template.shape);
      expect(object.widthMm).toBe(template.widthMm);
      expect(object.depthMm).toBe(template.depthMm);
      expect(object.heightMm).toBe(template.heightMm);
      expect(object.label).toBe(template.label);
      expect(object.name).toBe(template.name);
      expect(object.rotationDeg).toBe(0);
      expect(object.layerId).toBe("layer-objects");
      expect(object.locked).toBe(false);
      expect(object.groupId).toBeNull();
      expect(object.visible).toBe(true);
    }
    expect(new Set(objects.map((object) => object.zIndex)).size).toBe(objects.length);
  });
});
