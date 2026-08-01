// 弦楽器テンプレ配置(FR-062)の固定テンプレートのテスト。
// 12型の各アンカーを個別に検証したうえで、8〜16型に共通する作りかたを型ごとに検証する。

import { describe, expect, it } from "vitest";
import type { SceneObject } from "../types/project";
import {
  STAGE_DEPTH_DIRECTION,
  STAGE_RIGHT_DIRECTION,
  STRING_LAYOUT_12_ANCHORS,
  STRING_LAYOUT_12_CHAIR_SPACING_MM,
  STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID,
  STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM,
  STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM,
  STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
  STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
  STRING_LAYOUT_12_LIMITS,
  STRING_LAYOUT_12_PLAYER_COUNTS,
  STRING_LAYOUT_12_SECTIONS,
  STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM,
  createStringLayout12Objects,
  facingRotationDeg,
  stageLocalOf,
  STRING_ENSEMBLE_TYPE_IDS,
  STRING_LAYOUT_PLAYER_COUNTS,
  STRING_SEATING_VARIANT_IDS,
  STRING_SEATING_VARIANT_ORDER,
  stringLayout12FirstRowRadiusFromRadiusMm,
  stringLayout12OffsetsFromPointMm,
  stringLayout12Placements,
  stringLayout12RowGapFromRadiusMm,
  stringLayout12RowRadiusMm,
  stringLayoutAnchors,
  stringLayoutAnchorsFor,
  stringLayoutPultCount,
  stringLayoutRowCount,
  validateStringLayout12Options,
  type StringEnsembleTypeId,
  type StringLayout12Options,
  type StringSeatingVariantId,
  type StringLayout12Section,
  type StringPultPlacement,
} from "./stringLayout12";

const CONDUCTOR = { xMm: 10000, yMm: 12000 };

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

function options(overrides: Partial<StringLayout12Options> = {}): StringLayout12Options {
  return {
    seatingVariantId: "standard",
    ensembleTypeId: "12",
    conductor: { ...CONDUCTOR },
    lateralOffsetMm: 0,
    depthOffsetMm: 0,
    spreadScale: 1,
    firstRowRadiusMm: STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
    rowGapMm: STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
    chairCenterSpacingMm: STRING_LAYOUT_12_CHAIR_SPACING_MM,
    contrabassSeatSpacingMm: STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM,
    standForwardOffsetMm: STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM,
    layerId: "layer-objects",
    ...overrides,
  };
}

let idCounter = 0;
function build(opts: StringLayout12Options = options()): SceneObject[] {
  idCounter = 0;
  return createStringLayout12Objects(TEMPLATES, opts, 0, (role, key) => {
    idCounter += 1;
    return `${key}-${role}-${idCounter}`;
  });
}

/** 生成順は1プルトあたり椅子2脚→譜面台1台。プルト単位へ束ね直す。 */
function pultUnits(objects: readonly SceneObject[]): { chairs: SceneObject[]; stand: SceneObject }[] {
  const units: { chairs: SceneObject[]; stand: SceneObject }[] = [];
  for (let index = 0; index + 2 < objects.length; index += 3) {
    units.push({ chairs: [objects[index], objects[index + 1]], stand: objects[index + 2] });
  }
  return units;
}

const EXPECTED_CHAIR_LABELS: Readonly<Record<StringLayout12Section, string>> = {
  violin1: "1st",
  violin2: "2nd",
  viola: "Va",
  cello: "Vc",
  contrabass: "Cb",
};

function section(placements: readonly StringPultPlacement[], part: StringLayout12Section): StringPultPlacement[] {
  return placements.filter((placement) => placement.section === part).sort((a, b) => a.pultNumber - b.pultNumber);
}

function distance(a: Pick<SceneObject, "xMm" | "yMm">, b: Pick<SceneObject, "xMm" | "yMm">): number {
  return Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
}

/** シンボル基準方向は-Y。回転角から向きベクトルを求める。 */
function facingVector(rotationDeg: number): { x: number; y: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

function facingCosine(object: SceneObject, conductor: { xMm: number; yMm: number }): number {
  const facing = facingVector(object.rotationDeg);
  const dx = conductor.xMm - object.xMm;
  const dy = conductor.yMm - object.yMm;
  return (facing.x * dx + facing.y * dy) / Math.hypot(dx, dy);
}

// ---------------------------------------------------------------------------

describe("必須1〜3: 生成数とプルト単位", () => {
  it("必須1: 12型で20プルトが生成される", () => {
    const placements = stringLayout12Placements(options());
    expect(placements).toHaveLength(20);
    expect(stringLayoutPultCount("standard", "12")).toBe(20);
    expect(STRING_LAYOUT_12_ANCHORS).toHaveLength(20);
    // 人数から計算せず、セクションごとのプルト数が固定テンプレートどおり
    const counts = STRING_LAYOUT_12_SECTIONS.map((part) => section(placements, part).length);
    expect(counts).toEqual([6, 5, 4, 3, 2]);
    expect(STRING_LAYOUT_12_PLAYER_COUNTS).toEqual({ violin1: 12, violin2: 10, viola: 8, cello: 6, contrabass: 4 });
    // プルト番号はセクション内で1..nの連番
    for (const part of STRING_LAYOUT_12_SECTIONS) {
      expect(section(placements, part).map((placement) => placement.pultNumber))
        .toEqual(stringLayoutAnchorsFor("standard", "12", part).map((_, index) => index + 1));
    }
  });

  it("必須2: 通常椅子36脚・Cb用スツール4脚・譜面台20台を生成する", () => {
    const objects = build();
    expect(objects).toHaveLength(60);
    expect(objects.filter((object) => object.presetId === "chair")).toHaveLength(36);
    expect(objects.filter((object) => object.presetId === STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID)).toHaveLength(4);
    expect(objects.filter((object) => object.type === "musicStand")).toHaveLength(20);
    expect(new Set(objects.map((object) => object.id)).size).toBe(60);
    expect(new Set(objects.map((object) => object.zIndex)).size).toBe(60);
    expect(objects.every((object) => object.groupId === null && object.locked === false)).toBe(true);
    // 寸法はテンプレートのまま入れ替えない
    for (const object of objects.filter((item) => item.presetId === "chair")) {
      expect([object.widthMm, object.depthMm]).toEqual([450, 450]);
    }
  });

  it("必須3: 各プルトが椅子2脚(またはCb用スツール2脚)+譜面台1台で構成される", () => {
    const units = pultUnits(build());
    const placements = stringLayout12Placements(options());
    expect(units).toHaveLength(20);
    units.forEach((unit, index) => {
      expect(unit.chairs.every((chair) => chair.type === "chair")).toBe(true);
      expect(unit.stand.type).toBe("musicStand");
      for (const chair of unit.chairs) {
        expect(chair.label).toBe(EXPECTED_CHAIR_LABELS[placements[index].section]);
      }
      expect(unit.stand.label).toBe("");
    });
    // 譜面台は同一プルトの2席の中間から指揮者側へ標準オフセット分ずれる
    for (const unit of units) {
      const midXMm = (unit.chairs[0].xMm + unit.chairs[1].xMm) / 2;
      const midYMm = (unit.chairs[0].yMm + unit.chairs[1].yMm) / 2;
      expect(Math.hypot(midXMm - unit.stand.xMm, midYMm - unit.stand.yMm))
        .toBeCloseTo(STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM, 6);
    }
  });
});

describe("必須4〜5: プルト内とプルト間の間隔", () => {
  const objects = build();
  const units = pultUnits(objects);
  const chairsWithPult = units.flatMap((unit, pultIndex) => unit.chairs.map((chair) => ({ chair, pultIndex })));

  it("必須4: 各プルトの2席が、他プルトの席より互いに近い", () => {
    units.forEach((unit, pultIndex) => {
      const intraMm = distance(unit.chairs[0], unit.chairs[1]);
      const expectedMm = unit.chairs[0].presetId === STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID
        ? STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM
        : STRING_LAYOUT_12_CHAIR_SPACING_MM;
      expect(intraMm).toBeCloseTo(expectedMm, 6);
      const nearestOtherMm = Math.min(...chairsWithPult
        .filter((entry) => entry.pultIndex !== pultIndex)
        .flatMap((entry) => unit.chairs.map((chair) => distance(chair, entry.chair))));
      expect(nearestOtherMm).toBeGreaterThan(intraMm);
    });
  });

  it("必須5: 隣接プルト間に余白があり、3人以上が連続して横並びにならない", () => {
    let minCrossMm = Number.POSITIVE_INFINITY;
    for (let i = 0; i < chairsWithPult.length; i += 1) {
      for (let j = i + 1; j < chairsWithPult.length; j += 1) {
        if (chairsWithPult[i].pultIndex === chairsWithPult[j].pultIndex) continue;
        minCrossMm = Math.min(minCrossMm, distance(chairsWithPult[i].chair, chairsWithPult[j].chair));
      }
    }
    // プルト内600mm(椅子縁で150mm)に対し、異なるプルトの席は800mm以上離す
    expect(minCrossMm).toBeGreaterThanOrEqual(800);
    expect(minCrossMm).toBeGreaterThan(STRING_LAYOUT_12_CHAIR_SPACING_MM * 1.3);
    // 椅子の外形(450mm)どうしが重ならない
    expect(minCrossMm).toBeGreaterThan(450);
  });

  it("セクション間に600mm以上の余白がある", () => {
    const placements = stringLayout12Placements(options());
    const chairsWithSection = units.flatMap((unit, pultIndex) =>
      unit.chairs.map((chair) => ({ chair, part: placements[pultIndex].section })));
    let minMm = Number.POSITIVE_INFINITY;
    for (let i = 0; i < chairsWithSection.length; i += 1) {
      for (let j = i + 1; j < chairsWithSection.length; j += 1) {
        if (chairsWithSection[i].part === chairsWithSection[j].part) continue;
        minMm = Math.min(minMm, distance(chairsWithSection[i].chair, chairsWithSection[j].chair));
      }
    }
    expect(minMm).toBeGreaterThanOrEqual(600);
  });

  it("同じ列に並ぶプルトの間隔が1400mm以上ある", () => {
    const placements = stringLayout12Placements(options());
    const centerGapMm = (a: StringPultPlacement, b: StringPultPlacement) =>
      Math.hypot(a.lateralMm - b.lateralMm, a.depthMm - b.depthMm);
    for (let rowIndex = 0; rowIndex < stringLayoutRowCount("standard", "12"); rowIndex += 1) {
      const row = placements
        .filter((placement) => placement.anchor.rowIndex === rowIndex)
        .sort((a, b) => a.anchor.bearingDeg - b.anchor.bearingDeg);
      for (let index = 1; index < row.length; index += 1) {
        // プルト内600mmに対し、同じ列で隣り合うプルトの中心は倍以上離す
        expect(centerGapMm(row[index], row[index - 1])).toBeGreaterThanOrEqual(1350);
      }
    }
  });
});

describe("列(輪)の構造", () => {
  const placements = stringLayout12Placements(options());
  const radiusMm = (placement: StringPultPlacement) => Math.hypot(placement.lateralMm, placement.depthMm);
  const rowOf = (rowIndex: number) => placements.filter((placement) => placement.anchor.rowIndex === rowIndex);

  it("列は指揮台を中心とする同心の輪で、半径が1列目距離+列間隔×列番号になる", () => {
    const opts = options();
    expect(stringLayoutRowCount("standard", "12")).toBe(5);
    for (const placement of placements) {
      const expectedMm = STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM
        + placement.anchor.rowIndex * STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM;
      expect(placement.rowRadiusMm).toBeCloseTo(expectedMm, 6);
      expect(stringLayout12RowRadiusMm(opts, placement.anchor.rowIndex)).toBeCloseTo(expectedMm, 6);
      // 実座標も同じ半径の上に乗る
      expect(radiusMm(placement)).toBeCloseTo(expectedMm, 6);
    }
  });

  it("各列の中身が参考配置図と同じ構成になる", () => {
    const keysOf = (rowIndex: number) =>
      new Set(rowOf(rowIndex).map((placement) => `${placement.section}-${placement.pultNumber}`));
    // 1列目は各セクションの先頭プルトだけ。これが指揮台を囲む四角になる
    expect(keysOf(0)).toEqual(new Set(["violin1-1", "violin2-1", "cello-1", "viola-1"]));
    expect(keysOf(1)).toEqual(new Set(["violin1-2", "violin2-2", "violin2-3", "cello-2", "cello-3", "viola-2"]));
    expect(keysOf(2)).toEqual(new Set(["violin1-3", "violin2-4", "violin2-5", "viola-3"]));
    // 参考配置図の4本目の輪と同じく、ここは3プルトしか入らない
    expect(keysOf(3)).toEqual(new Set(["violin1-4", "viola-4", "contrabass-1", "contrabass-2"]));
    expect(keysOf(4)).toEqual(new Set(["violin1-5", "violin1-6"]));
    // 客席側へ回る列は作らない。全プルトが舞台奥側の半円に収まる
    for (const placement of placements) {
      expect(placement.anchor.bearingDeg).toBeGreaterThanOrEqual(-90);
      expect(placement.anchor.bearingDeg).toBeLessThanOrEqual(90);
    }
  });

  it("列間隔を変えると全列がまとめて動き、方位角と列内の並び順は変わらない", () => {
    const wide = stringLayout12Placements(options({ rowGapMm: 1800 }));
    expect(wide).toHaveLength(20);
    for (let index = 0; index < placements.length; index += 1) {
      const before = placements[index];
      const after = wide[index];
      expect(after.anchor).toBe(before.anchor);
      // 半径だけが列間隔ぶん伸びる
      expect(after.rowRadiusMm - before.rowRadiusMm)
        .toBeCloseTo(before.anchor.rowIndex * (1800 - STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM), 6);
      // 指揮台から見た方位は不変
      const bearing = (placement: StringPultPlacement) => Math.atan2(placement.lateralMm, placement.depthMm);
      expect(bearing(after)).toBeCloseTo(bearing(before), 9);
    }
    // 1列目距離だけを変えると全列が同じ量だけ外へ出る
    const far = stringLayout12Placements(options({ firstRowRadiusMm: 2000 }));
    for (let index = 0; index < placements.length; index += 1) {
      expect(far[index].rowRadiusMm - placements[index].rowRadiusMm).toBeCloseTo(500, 6);
    }
  });

  it("列間隔を範囲いっぱいまで動かしても席が重ならない", () => {
    const minCrossChairMm = (gapMm: number) => {
      const units = pultUnits(build(options({ rowGapMm: gapMm })));
      const chairs = units.flatMap((unit, pultIndex) => unit.chairs.map((chair) => ({ chair, pultIndex })));
      let minMm = Number.POSITIVE_INFINITY;
      for (let i = 0; i < chairs.length; i += 1) {
        for (let j = i + 1; j < chairs.length; j += 1) {
          if (chairs[i].pultIndex === chairs[j].pultIndex) continue;
          minMm = Math.min(minMm, distance(chairs[i].chair, chairs[j].chair));
        }
      }
      return minMm;
    };
    // 最小まで詰めても椅子の外形(450mm)どうしは重ならない
    for (const gapMm of [STRING_LAYOUT_12_LIMITS.rowGapMm.min, STRING_LAYOUT_12_LIMITS.rowGapMm.max]) {
      expect(minCrossChairMm(gapMm)).toBeGreaterThan(450);
    }
    // 既定値では800mmの余白を確保する
    expect(minCrossChairMm(STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM)).toBeGreaterThanOrEqual(800);
    // 広げるほど余白は増える
    expect(minCrossChairMm(1600)).toBeGreaterThan(minCrossChairMm(1000));
  });
});

describe("列間隔のドラッグ換算", () => {
  it("1列目の補助線半径から1列目距離へ戻す。10mm刻みで範囲内へ丸める", () => {
    expect(stringLayout12FirstRowRadiusFromRadiusMm(1743, 1)).toBe(1740);
    // 全体間隔倍率が掛かった見た目の半径から素の値へ戻す
    expect(stringLayout12FirstRowRadiusFromRadiusMm(1500 * 1.2, 1.2)).toBe(1500);
    expect(stringLayout12FirstRowRadiusFromRadiusMm(10, 1)).toBe(STRING_LAYOUT_12_LIMITS.firstRowRadiusMm.min);
    expect(stringLayout12FirstRowRadiusFromRadiusMm(99999, 1)).toBe(STRING_LAYOUT_12_LIMITS.firstRowRadiusMm.max);
  });

  it("2列目以降はどの列をつまんでも同じ列間隔になる", () => {
    const firstMm = STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM;
    for (let rowIndex = 1; rowIndex < stringLayoutRowCount("standard", "12"); rowIndex += 1) {
      const radiusMm = firstMm + rowIndex * 1500;
      expect(stringLayout12RowGapFromRadiusMm(firstMm, radiusMm, rowIndex, 1)).toBe(1500);
      expect(stringLayout12RowGapFromRadiusMm(firstMm, radiusMm * 1.2, rowIndex, 1.2)).toBe(1500);
    }
    // 1列目は列間隔を変えない
    expect(stringLayout12RowGapFromRadiusMm(firstMm, 9000, 0, 1)).toBe(STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM);
    // 範囲外は丸める
    expect(stringLayout12RowGapFromRadiusMm(firstMm, firstMm + 10, 1, 1)).toBe(STRING_LAYOUT_12_LIMITS.rowGapMm.min);
    expect(stringLayout12RowGapFromRadiusMm(firstMm, firstMm + 99999, 1, 1)).toBe(STRING_LAYOUT_12_LIMITS.rowGapMm.max);
  });
});

describe("1列目: 指揮台を囲む四角", () => {
  const placements = stringLayout12Placements(options());
  const units = pultUnits(build());
  const unitOf = (target: StringPultPlacement) =>
    units[placements.findIndex((placement) => placement === target)];
  /** 指揮者から見た方位角。0度が舞台奥、負が図面左、正が図面右。 */
  const bearingDeg = (placement: StringPultPlacement) =>
    (Math.atan2(placement.lateralMm, placement.depthMm) * 180) / Math.PI;
  const radiusMm = (placement: StringPultPlacement) => Math.hypot(placement.lateralMm, placement.depthMm);

  const violin1First = section(placements, "violin1")[0];
  const violin2First = section(placements, "violin2")[0];
  const celloFirst = section(placements, "cello")[0];
  const violaFirst = section(placements, "viola")[0];
  // 指揮台まわりの環。左 → 後方左 → 後方右 → 右
  const ring = [violin1First, violin2First, celloFirst, violaFirst];

  it("1列目は各セクションの先頭プルト4つだけで、どれも同じ半径に乗る", () => {
    expect(ring.every((placement) => placement.anchor.rowIndex === 0)).toBe(true);
    expect(placements.filter((placement) => placement.anchor.rowIndex === 0)).toHaveLength(4);
    for (const first of ring) {
      // セクション内で最も指揮台に近い
      const others = placements.filter((placement) =>
        placement.section === first.section && placement !== first);
      for (const other of others) {
        expect(radiusMm(first)).toBeLessThan(radiusMm(other));
      }
      expect(radiusMm(first)).toBeCloseTo(STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM, 6);
    }
  });

  it("4プルトが左・後方左・後方右・右に1つずつ付き、指揮台を取り囲む", () => {
    const bearings = ring.map(bearingDeg);
    // 左脇 / 後方左 / 後方右 / 右脇
    expect(bearings[0]).toBeCloseTo(-90, 6);
    expect(bearings[1]).toBeGreaterThanOrEqual(-55);
    expect(bearings[1]).toBeLessThanOrEqual(-15);
    expect(bearings[2]).toBeGreaterThanOrEqual(15);
    expect(bearings[2]).toBeLessThanOrEqual(55);
    expect(bearings[3]).toBeCloseTo(90, 6);
    // 4プルトとも指揮台のすぐ脇。指揮者から2000mm以内
    for (const placement of ring) {
      expect(radiusMm(placement)).toBeLessThanOrEqual(2000);
    }
    // 左右対称(1st Vn 1とVa 1、2nd Vn 1とVc 1)
    expect(violaFirst.lateralMm).toBeCloseTo(-violin1First.lateralMm, 6);
    expect(violaFirst.depthMm).toBeCloseTo(violin1First.depthMm, 6);
    expect(celloFirst.lateralMm).toBeCloseTo(-violin2First.lateralMm, 6);
    expect(celloFirst.depthMm).toBeCloseTo(violin2First.depthMm, 6);
  });

  it("8脚が途切れずに環をつくり、指揮台の占有域を侵さない", () => {
    // 環に沿って隣り合うプルトの席どうしが1600mm以内。大きな空白を作らない
    for (let index = 1; index < ring.length; index += 1) {
      const gapMm = Math.min(...unitOf(ring[index - 1]).chairs
        .flatMap((a) => unitOf(ring[index]).chairs.map((b) => distance(a, b))));
      expect(gapMm).toBeGreaterThanOrEqual(800);
      expect(gapMm).toBeLessThanOrEqual(1600);
    }
    // 指揮台プリセット(900×900mm)の占有域へ椅子も譜面台も入らない
    const conductor = options().conductor;
    const chebyshevMm = (object: SceneObject) =>
      Math.max(Math.abs(object.xMm - conductor.xMm), Math.abs(object.yMm - conductor.yMm));
    for (const placement of ring) {
      const unit = unitOf(placement);
      for (const object of [...unit.chairs, unit.stand]) {
        expect(chebyshevMm(object)).toBeGreaterThan(450);
      }
    }
  });

  it("1st Vn 1とVa 1は指揮台の真横で、2脚が指揮台の前後にまたがる", () => {
    for (const placement of [violin1First, violaFirst]) {
      // 放射直線は方位角±90度なので、プルト中心は指揮台と同じ前後位置
      expect(placement.depthMm).toBeCloseTo(0, 6);
      const chairDepths = unitOf(placement).chairs
        .map((chair) => stageLocalOf(options().conductor, chair).depthMm);
      // 一方が舞台奥、もう一方が客席側。指揮台を挟む
      expect(Math.max(...chairDepths)).toBeGreaterThan(200);
      expect(Math.min(...chairDepths)).toBeLessThan(-200);
    }
  });

  it("2nd Vn 1とVc 1が指揮台の真後ろ左右へ付き、正面奥に大きな空白を作らない", () => {
    for (const placement of [violin2First, celloFirst]) {
      expect(Math.abs(placement.lateralMm)).toBeLessThanOrEqual(1200);
      // 指揮台の奥行き半分(450mm)より奥、かつ2000mm以内
      expect(placement.depthMm).toBeGreaterThan(450);
      expect(placement.depthMm).toBeLessThanOrEqual(2000);
    }
    expect(violin2First.lateralMm).toBeLessThan(0);
    expect(celloFirst.lateralMm).toBeGreaterThan(0);
    // 指揮者の正面奥は視界として空ける。ただし2000mm以上は空けない
    const centerGapMm = celloFirst.lateralMm - violin2First.lateralMm;
    expect(centerGapMm).toBeGreaterThanOrEqual(1200);
    expect(centerGapMm).toBeLessThanOrEqual(2000);
  });

  it("8脚が指揮台の四方を占め、どの向きにも空きがない", () => {
    // 4プルトの方位を並べたとき、隣り合う方位差が110度を超えない
    const bearings = ring.map(bearingDeg).sort((a, b) => a - b);
    for (let index = 1; index < bearings.length; index += 1) {
      expect(bearings[index] - bearings[index - 1]).toBeLessThanOrEqual(110);
    }
    // 左右の腕の外側(±90度より外)には1列目のプルトがない
    expect(Math.max(...bearings)).toBeLessThanOrEqual(90);
    expect(Math.min(...bearings)).toBeGreaterThanOrEqual(-90);
  });
});

describe("必須6〜8: 1st Vn", () => {
  const placements = stringLayout12Placements(options());
  const violin1 = section(placements, "violin1");

  it("必須6: 1st Vnが6プルトである", () => {
    expect(violin1).toHaveLength(6);
    expect(violin1.every((placement) => placement.lateralMm < 0)).toBe(true);
  });

  it("必須7: 第1〜第5プルトが1列に1プルトずつ、指揮台左への水平な一直線になる", () => {
    const line = violin1.slice(0, 5);
    expect(line.every((placement) => placement.anchor.layoutRole === "radial-line")).toBe(true);
    // 参考図はわずかに舞台奥へ振れるが、テンプレートは完全な水平直線
    for (const placement of line) expect(placement.depthMm).toBeCloseTo(0, 6);
    expect(line.map((placement) => placement.anchor.bearingDeg)).toEqual([-90, -90, -90, -90, -90]);
    // 1列につき1プルト。列番号は0から順に1つずつ増える
    expect(line.map((placement) => placement.anchor.rowIndex)).toEqual([0, 1, 2, 3, 4]);
    // 第1プルトは指揮台の真横
    expect(line[0].lateralMm).toBeCloseTo(-STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM, 6);
    // 図面左へ順に並ぶ一直線で、間隔は列間隔そのもの
    for (let index = 1; index < line.length; index += 1) {
      expect(line[index - 1].lateralMm - line[index].lateralMm)
        .toBeCloseTo(STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM, 6);
    }
    // 1+2+3や3+3の段組みではない(同じ列に2プルト以上が入らない)
    expect(new Set(line.map((placement) => placement.anchor.rowIndex)).size).toBe(5);
  });

  it("必須8: 第6プルトだけが直線から外れ、最外の列の中央寄りへ折り返す", () => {
    const fifth = violin1[4];
    const sixth = violin1[5];
    expect(sixth.anchor.layoutRole).toBe("line-corner");
    // 第5プルトと同じ列(=同じ半径)に乗る
    expect(sixth.anchor.rowIndex).toBe(fifth.anchor.rowIndex);
    expect(Math.hypot(sixth.lateralMm, sixth.depthMm))
      .toBeCloseTo(Math.hypot(fifth.lateralMm, fifth.depthMm), 6);
    // 真後ろではなく舞台中央寄り、かつ第4プルトより外側のまま
    expect(sixth.lateralMm).toBeGreaterThan(fifth.lateralMm);
    expect(sixth.lateralMm).toBeLessThan(violin1[3].lateralMm);
    // 直線より明確に舞台奥
    expect(sixth.depthMm - fifth.depthMm).toBeGreaterThanOrEqual(1000);
  });
});

describe("必須9: 2nd Vn", () => {
  const placements = stringLayout12Placements(options());
  const violin2 = section(placements, "violin2");

  it("1列に2プルトずつの塊になり、偶数が外側・奇数が内側に来る", () => {
    expect(violin2).toHaveLength(5);
    expect(violin2.every((placement) => placement.anchor.layoutRole === "arc-block")).toBe(true);
    // 1列目に1プルト、2・3列目に2プルトずつ
    expect(violin2.map((placement) => placement.anchor.rowIndex)).toEqual([0, 1, 1, 2, 2]);
    // 参考図と同じく、偶数番のプルトが外側(1st Vn寄り)、奇数番が内側(中央寄り)
    for (const [outer, inner] of [[violin2[1], violin2[2]], [violin2[3], violin2[4]]]) {
      expect(outer.anchor.bearingDeg).toBeLessThan(inner.anchor.bearingDeg);
      expect(outer.lateralMm).toBeLessThan(inner.lateralMm);
      expect(outer.depthMm).toBeLessThan(inner.depthMm);
    }
    // 5プルトを長い1列にしない
    expect(new Set(violin2.map((placement) => placement.anchor.rowIndex)).size).toBe(3);
  });

  it("1st Vnと重ならない扇形を占め、外側でも1st Vnの直線を越えない", () => {
    const violin1 = section(placements, "violin1");
    expect(violin2.every((placement) => placement.lateralMm < 0)).toBe(true);
    // 方位角は真左(-90度)より内側。1st Vnの直線の内側にとどまる
    for (const placement of violin2) {
      expect(placement.anchor.bearingDeg).toBeGreaterThan(-90);
      expect(placement.anchor.bearingDeg).toBeLessThan(0);
      expect(placement.depthMm).toBeGreaterThan(0);
    }
    // 同じ列の1st Vnより中央寄り
    for (const placement of violin2) {
      const sameRow = violin1.find((other) => other.anchor.rowIndex === placement.anchor.rowIndex
        && other.anchor.layoutRole === "radial-line");
      expect(sameRow).toBeDefined();
      expect(placement.lateralMm).toBeGreaterThan(sameRow!.lateralMm);
    }
  });
});

describe("必須10: Va", () => {
  const placements = stringLayout12Placements(options());
  const viola = section(placements, "viola");

  it("4プルトが1列に1プルトずつ、指揮台右への水平な一直線になる", () => {
    expect(viola).toHaveLength(4);
    expect(viola.every((placement) => placement.anchor.layoutRole === "radial-line")).toBe(true);
    expect(viola.every((placement) => placement.lateralMm > 0)).toBe(true);
    for (const placement of viola) expect(placement.depthMm).toBeCloseTo(0, 6);
    expect(viola.map((placement) => placement.anchor.rowIndex)).toEqual([0, 1, 2, 3]);
    for (let index = 1; index < viola.length; index += 1) {
      expect(viola[index].lateralMm - viola[index - 1].lateralMm)
        .toBeCloseTo(STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM, 6);
    }
  });

  it("1st Vnの直線と左右対称になり、指揮者正面に空間がある", () => {
    const violin1 = section(placements, "violin1");
    for (let index = 0; index < viola.length; index += 1) {
      expect(viola[index].lateralMm).toBeCloseTo(-violin1[index].lateralMm, 6);
      expect(viola[index].depthMm).toBeCloseTo(violin1[index].depthMm, 6);
    }
    expect(viola[0].lateralMm - violin1[0].lateralMm).toBeGreaterThanOrEqual(2400);
    // 指揮者の真正面奥(左右0)にプルトが来ない
    expect(Math.min(...placements.map((placement) => Math.abs(placement.lateralMm)))).toBeGreaterThanOrEqual(700);
  });
});

describe("必須11: Vc", () => {
  const placements = stringLayout12Placements(options());
  const cello = section(placements, "cello");
  const viola = section(placements, "viola");

  it("2nd Vnと同じ作りで、1列目1プルト+2列目2プルトになる", () => {
    expect(cello).toHaveLength(3);
    expect(cello.every((placement) => placement.anchor.layoutRole === "arc-block")).toBe(true);
    expect(cello.map((placement) => placement.anchor.rowIndex)).toEqual([0, 1, 1]);
    // 偶数番が外側(Va寄り)、奇数番が内側(中央寄り)
    expect(cello[1].anchor.bearingDeg).toBeGreaterThan(cello[2].anchor.bearingDeg);
    expect(cello[1].lateralMm).toBeGreaterThan(cello[2].lateralMm);
    expect(cello[1].depthMm).toBeLessThan(cello[2].depthMm);
  });

  it("Vaの直線の内側にとどまり、2nd Vnと同じ列構成になる", () => {
    const violin2 = section(placements, "violin2");
    expect(cello.every((placement) => placement.lateralMm > 0)).toBe(true);
    for (const placement of cello) {
      expect(placement.anchor.bearingDeg).toBeGreaterThan(0);
      expect(placement.anchor.bearingDeg).toBeLessThan(90);
      // 同じ列のVaより中央寄り
      const sameRow = viola.find((other) => other.anchor.rowIndex === placement.anchor.rowIndex);
      expect(sameRow).toBeDefined();
      expect(placement.lateralMm).toBeLessThan(sameRow!.lateralMm);
    }
    // 先頭プルトは2nd Vn 1と左右対称
    expect(cello[0].lateralMm).toBeCloseTo(-violin2[0].lateralMm, 6);
    expect(cello[0].depthMm).toBeCloseTo(violin2[0].depthMm, 6);
  });
});

describe("必須12〜13: Cb", () => {
  const placements = stringLayout12Placements(options());
  const contrabass = section(placements, "contrabass");
  const others = placements.filter((placement) => placement.section !== "contrabass");

  it("必須12: 2プルトが同じ列(弧)の上に並び、通常弦の外側へ置かれる", () => {
    expect(contrabass).toHaveLength(2);
    expect(contrabass.every((placement) => placement.anchor.layoutRole === "bass")).toBe(true);
    // 2プルトなので同じ弧の上。半径が一致する
    expect(contrabass[0].anchor.rowIndex).toBe(contrabass[1].anchor.rowIndex);
    expect(contrabass[0].rowRadiusMm).toBeCloseTo(contrabass[1].rowRadiusMm, 6);
    // 弧に沿って離れる。Cbはスツールが大きいので通常弦より広く取る
    const arcGapMm = contrabass[0].rowRadiusMm
      * Math.abs(contrabass[0].anchor.bearingDeg - contrabass[1].anchor.bearingDeg) * Math.PI / 180;
    expect(arcGapMm).toBeGreaterThanOrEqual(2200);
    // 図面右かつ舞台奥。Vaの直線より舞台奥にある
    expect(contrabass.every((placement) => placement.lateralMm > 0 && placement.depthMm > 0)).toBe(true);
    expect(Math.min(...contrabass.map((placement) => placement.depthMm)))
      .toBeGreaterThan(Math.max(...section(placements, "viola").map((placement) => placement.depthMm)) + 1000);
    // 番号は外側(Va寄り)から中央へ振る
    expect(contrabass[0].anchor.bearingDeg).toBeGreaterThan(contrabass[1].anchor.bearingDeg);
    // 通常弦へ混ざらない
    const nearestStringMm = Math.min(...contrabass.flatMap((bass) => others.map((other) =>
      Math.hypot(bass.lateralMm - other.lateralMm, bass.depthMm - other.depthMm))));
    expect(nearestStringMm).toBeGreaterThanOrEqual(1400);
  });

  it("必須13: Cbが専用スツールを使い、通常椅子を使わない", () => {
    const objects = build();
    const stools = objects.filter((object) => object.presetId === STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID);
    expect(stools).toHaveLength(4);
    expect(stools.every((object) => object.label === "Cb")).toBe(true);
    expect(stools.every((object) => object.presetId === STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID)).toBe(true);
    expect(stools.every((object) => object.widthMm === 900 && object.depthMm === 1200)).toBe(true);
    // 他セクションは通常椅子のまま
    expect(objects.filter((object) => object.type === "chair" && object.label !== "Cb")
      .every((object) => object.presetId === "chair")).toBe(true);
  });

  it("Cbのスツール占有域が重ならない間隔になる", () => {
    const objects = build();
    const stools = objects.filter((object) => object.presetId === STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID);
    for (let i = 0; i < stools.length; i += 1) {
      for (let j = i + 1; j < stools.length; j += 1) {
        expect(distance(stools[i], stools[j])).toBeGreaterThanOrEqual(TEMPLATES.contrabassStool.widthMm);
      }
    }
  });
});

describe("必須14〜16: 舞台奥方向と向き", () => {
  it("舞台奥は画面上(Y負方向)、図面右はX正方向で固定", () => {
    expect(STAGE_DEPTH_DIRECTION).toEqual({ xMm: 0, yMm: -1 });
    expect(STAGE_RIGHT_DIRECTION).toEqual({ xMm: 1, yMm: 0 });
    expect(stageLocalOf(CONDUCTOR, { xMm: CONDUCTOR.xMm, yMm: CONDUCTOR.yMm - 1000 }))
      .toEqual({ lateralMm: 0, depthMm: 1000 });
  });

  it("必須14: 補正の全範囲で20プルト60点を生成し、最前列だけが指揮台の前後にまたがる", () => {
    const combos: Partial<StringLayout12Options>[] = [
      {},
      { spreadScale: STRING_LAYOUT_12_LIMITS.spreadScale.min },
      { spreadScale: STRING_LAYOUT_12_LIMITS.spreadScale.max },
      { depthOffsetMm: STRING_LAYOUT_12_LIMITS.depthOffsetMm.min },
      { depthOffsetMm: STRING_LAYOUT_12_LIMITS.depthOffsetMm.max },
      { spreadScale: 0.8, depthOffsetMm: -500, lateralOffsetMm: -5000 },
      { spreadScale: 0.8, depthOffsetMm: -500, lateralOffsetMm: 5000 },
      { spreadScale: 0.8, depthOffsetMm: -500, lateralOffsetMm: 1500 },
      { spreadScale: 0.8, depthOffsetMm: -500, lateralOffsetMm: -1500 },
      { spreadScale: 1, depthOffsetMm: -150, lateralOffsetMm: 1500 },
      { spreadScale: 1.5, depthOffsetMm: 5000, lateralOffsetMm: 5000 },
    ];
    for (const overrides of combos) {
      const opts = options(overrides);
      const objects = build(opts);
      // プルト中心が指揮者位置と一致する補正値でも生成が消えない
      expect(objects).toHaveLength(60);
      for (const object of objects) {
        expect(Number.isFinite(object.xMm) && Number.isFinite(object.yMm)).toBe(true);
      }
    }
    // 標準設定で指揮者より客席側へ出るのは、最前列の腕(1st Vn 1〜5 / Va 1〜4)の
    // 客席側の席だけ。2列目以降・譜面台・Cbは必ず舞台奥側に残る。
    const opts = options();
    const placements = stringLayout12Placements(opts);
    pultUnits(build(opts)).forEach((unit, index) => {
      for (const object of [...unit.chairs, unit.stand]) {
        const objectDepthMm = stageLocalOf(opts.conductor, object).depthMm;
        if (objectDepthMm >= 0) continue;
        const placement = placements[index];
        expect(object.type).toBe("chair");
        expect(placement.section === "violin1" || placement.section === "viola").toBe(true);
        expect(placement.pultNumber).toBeLessThanOrEqual(placement.section === "violin1" ? 5 : 4);
        expect(object.label).toBe(EXPECTED_CHAIR_LABELS[placement.section]);
        // はみ出しは椅子半分程度まで
        expect(objectDepthMm).toBeGreaterThan(-350);
      }
    });
  });

  it("必須15: 椅子と譜面台が指揮者方向を向く", () => {
    for (const opts of [options(), options({ lateralOffsetMm: 1200, depthOffsetMm: 800, spreadScale: 1.2 })]) {
      const objects = build(opts);
      for (const object of objects) {
        expect(facingCosine(object, opts.conductor)).toBeCloseTo(1, 9);
      }
      // 位置ごとに回転角が異なる(セクション固定値ではない)
      const rotations = new Set(objects.map((object) => Math.round(object.rotationDeg * 1000)));
      expect(rotations.size).toBeGreaterThan(10);
      // 図面左のオブジェクトは右を、図面右のオブジェクトは左を向く
      const left = objects.reduce((min, object) => (object.xMm < min.xMm ? object : min));
      const right = objects.reduce((max, object) => (object.xMm > max.xMm ? object : max));
      expect(facingVector(left.rotationDeg).x).toBeGreaterThan(0);
      expect(facingVector(right.rotationDeg).x).toBeLessThan(0);
    }
  });

  it("必須16: 譜面台が同一プルトの椅子より指揮者側にある", () => {
    for (const opts of [options(), options({ spreadScale: 1.3, depthOffsetMm: 600 })]) {
      for (const unit of pultUnits(build(opts))) {
        const standMm = distance(unit.stand, { xMm: opts.conductor.xMm, yMm: opts.conductor.yMm });
        for (const chair of unit.chairs) {
          expect(standMm).toBeLessThan(distance(chair, { xMm: opts.conductor.xMm, yMm: opts.conductor.yMm }));
        }
      }
    }
  });

  it("facingRotationDegは基準方向-Yに対して正しい角度を返す", () => {
    expect(facingRotationDeg({ xMm: 0, yMm: 100 }, { xMm: 0, yMm: 0 })).toBeCloseTo(0, 9);
    expect(facingRotationDeg({ xMm: 0, yMm: -100 }, { xMm: 0, yMm: 0 })).toBeCloseTo(180, 9);
    expect(facingRotationDeg({ xMm: -100, yMm: 0 }, { xMm: 0, yMm: 0 })).toBeCloseTo(90, 9);
    expect(facingRotationDeg({ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 0 })).toBe(0);
  });
});

describe("全体補正", () => {
  it("左右・前後補正はプルト中心を平行移動し、向きは指揮者基準で作り直す", () => {
    const basePlacements = stringLayout12Placements(options());
    const shiftedOptions = options({ lateralOffsetMm: 1000, depthOffsetMm: 700 });
    const shiftedPlacements = stringLayout12Placements(shiftedOptions);
    expect(shiftedPlacements).toHaveLength(basePlacements.length);
    shiftedPlacements.forEach((placement, index) => {
      expect(placement.lateralMm - basePlacements[index].lateralMm).toBeCloseTo(1000, 6);
      expect(placement.depthMm - basePlacements[index].depthMm).toBeCloseTo(700, 6);
      // 舞台奥は画面上なので、mm座標のYは補正ぶんだけ小さくなる
      expect(placement.center.xMm - basePlacements[index].center.xMm).toBeCloseTo(1000, 6);
      expect(placement.center.yMm - basePlacements[index].center.yMm).toBeCloseTo(-700, 6);
    });
    // 補正後も全オブジェクトが指揮者方向を向き、プルト構成は変わらない
    const shifted = build(shiftedOptions);
    expect(shifted).toHaveLength(60);
    for (const object of shifted) {
      expect(facingCosine(object, shiftedOptions.conductor)).toBeCloseTo(1, 9);
    }
    for (const unit of pultUnits(shifted)) {
      const expectedMm = unit.chairs[0].presetId === STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID
        ? STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM
        : STRING_LAYOUT_12_CHAIR_SPACING_MM;
      expect(distance(unit.chairs[0], unit.chairs[1])).toBeCloseTo(expectedMm, 6);
    }
  });

  it("全体間隔倍率はアンカーへ掛かり、プルト内の椅子間隔を変えない", () => {
    const opts = options({ spreadScale: 1.4 });
    const placements = stringLayout12Placements(opts);
    const basePlacements = stringLayout12Placements(options());
    placements.forEach((placement, index) => {
      expect(placement.lateralMm).toBeCloseTo(basePlacements[index].lateralMm * 1.4, 6);
      expect(placement.depthMm).toBeCloseTo(basePlacements[index].depthMm * 1.4, 6);
    });
    for (const unit of pultUnits(build(opts))) {
      const expectedMm = unit.chairs[0].presetId === STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID
        ? STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM
        : STRING_LAYOUT_12_CHAIR_SPACING_MM;
      expect(distance(unit.chairs[0], unit.chairs[1])).toBeCloseTo(expectedMm, 6);
      const midXMm = (unit.chairs[0].xMm + unit.chairs[1].xMm) / 2;
      const midYMm = (unit.chairs[0].yMm + unit.chairs[1].yMm) / 2;
      expect(Math.hypot(midXMm - unit.stand.xMm, midYMm - unit.stand.yMm))
        .toBeCloseTo(STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM, 6);
    }
  });
});

describe("入力検証とラベル", () => {
  it("範囲外・非有限値を拒否し、生成しない", () => {
    const invalid: Partial<StringLayout12Options>[] = [
      { layerId: "" },
      { conductor: { xMm: Number.NaN, yMm: 0 } },
      { lateralOffsetMm: 5001 },
      { lateralOffsetMm: -5001 },
      { depthOffsetMm: -501 },
      { depthOffsetMm: 5001 },
      { spreadScale: 0.79 },
      { spreadScale: 1.51 },
      { spreadScale: Number.NaN },
      { chairCenterSpacingMm: 0 },
      { standForwardOffsetMm: Number.POSITIVE_INFINITY },
    ];
    for (const overrides of invalid) {
      expect(validateStringLayout12Options(options(overrides)).length).toBeGreaterThan(0);
      expect(stringLayout12Placements(options(overrides))).toEqual([]);
      expect(build(options(overrides))).toEqual([]);
    }
    expect(validateStringLayout12Options(options())).toEqual([]);
  });

  it("椅子の円内にはセクション略称だけを表示し、譜面台へ文字を表示しない", () => {
    const objects = build();
    const chairLabels = objects.filter((object) => object.type === "chair").map((object) => object.label);
    const standLabels = objects.filter((object) => object.type === "musicStand").map((object) => object.label);
    expect(new Set(chairLabels)).toEqual(new Set(["1st", "2nd", "Va", "Vc", "Cb"]));
    expect(chairLabels.every((label) => /^(1st|2nd|Va|Vc|Cb)$/.test(label))).toBe(true);
    expect(standLabels.every((label) => label === "")).toBe(true);
    expect(objects.every((object) => !/[0-9]+\s*(表|裏|譜面台)|表|裏|譜面台/.test(object.label))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 全編成型
// ---------------------------------------------------------------------------

/** 型ごとの想定。人数・プルト数・列数は固定テンプレートの正本と突き合わせる。 */
const TYPE_EXPECTATIONS: Record<StringEnsembleTypeId, {
  counts: [number, number, number, number, number];
  pults: [number, number, number, number, number];
  rows: number;
}> = {
  "8":  { counts: [8, 6, 4, 4, 2],     pults: [4, 3, 2, 2, 1], rows: 3 },
  "10": { counts: [10, 8, 6, 6, 4],    pults: [5, 4, 3, 3, 2], rows: 4 },
  "12": { counts: [12, 10, 8, 6, 4],   pults: [6, 5, 4, 3, 2], rows: 5 },
  "14": { counts: [14, 12, 10, 8, 6],  pults: [7, 6, 5, 4, 3], rows: 5 },
  "16": { counts: [16, 14, 12, 10, 8], pults: [8, 7, 6, 5, 4], rows: 6 },
};

describe("全編成型: 共通の作りかた", () => {
  it("8・10・12・14・16型がそろい、人数はすべて偶数でプルトへ割れる", () => {
    expect(STRING_ENSEMBLE_TYPE_IDS).toEqual(["8", "10", "12", "14", "16"]);
    for (const typeId of STRING_ENSEMBLE_TYPE_IDS) {
      const counts = STRING_LAYOUT_PLAYER_COUNTS[typeId];
      expect(STRING_LAYOUT_12_SECTIONS.map((part) => counts[part]))
        .toEqual(TYPE_EXPECTATIONS[typeId].counts);
      // 人数はすべて偶数。奇数だと2人1組のプルトへ割れない
      for (const part of STRING_LAYOUT_12_SECTIONS) expect(counts[part] % 2).toBe(0);
      // プルト数は人数の半分
      for (const part of STRING_LAYOUT_12_SECTIONS) {
        expect(stringLayoutAnchorsFor("standard", typeId, part)).toHaveLength(counts[part] / 2);
      }
      const total = STRING_LAYOUT_12_SECTIONS.reduce((sum, part) => sum + counts[part], 0);
      expect(stringLayoutPultCount("standard", typeId)).toBe(total / 2);
      // 第1ヴァイオリンの人数が型の呼称と一致する
      expect(counts.violin1).toBe(Number(typeId));
    }
  });

  it.each(STRING_ENSEMBLE_TYPE_IDS)("%s型: プルト数・列数と番号の連番", (typeId) => {
    const expected = TYPE_EXPECTATIONS[typeId];
    const placements = stringLayout12Placements(options({ ensembleTypeId: typeId }));
    expect(placements).toHaveLength(expected.pults.reduce((sum, count) => sum + count, 0));
    expect(STRING_LAYOUT_12_SECTIONS.map((part) => section(placements, part).length)).toEqual(expected.pults);
    expect(stringLayoutRowCount("standard", typeId)).toBe(expected.rows);
    for (const part of STRING_LAYOUT_12_SECTIONS) {
      expect(section(placements, part).map((placement) => placement.pultNumber))
        .toEqual(section(placements, part).map((_, index) => index + 1));
    }
    // 列番号は0から連続して使われ、飛び番にならない
    const rows = new Set(placements.map((placement) => placement.anchor.rowIndex));
    expect([...rows].sort((a, b) => a - b)).toEqual([...Array(expected.rows).keys()]);
  });

  it.each(STRING_ENSEMBLE_TYPE_IDS)("%s型: 1列目が各セクションの先頭4プルトで指揮台を囲む", (typeId) => {
    const placements = stringLayout12Placements(options({ ensembleTypeId: typeId }));
    const first = placements.filter((placement) => placement.anchor.rowIndex === 0);
    expect(first).toHaveLength(4);
    expect(new Set(first.map((placement) => placement.section)))
      .toEqual(new Set(["violin1", "violin2", "cello", "viola"]));
    // 4プルトとも先頭プルトで、同じ半径に乗る
    for (const placement of first) {
      expect(placement.pultNumber).toBe(1);
      expect(placement.rowRadiusMm).toBeCloseTo(STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM, 6);
    }
    // 左・後方左・後方右・右を1つずつ占める
    const bearings = first.map((placement) => placement.anchor.bearingDeg).sort((a, b) => a - b);
    expect(bearings[0]).toBeCloseTo(-90, 6);
    expect(bearings[1]).toBeLessThan(0);
    expect(bearings[2]).toBeGreaterThan(0);
    expect(bearings[3]).toBeCloseTo(90, 6);
  });

  it.each(STRING_ENSEMBLE_TYPE_IDS)("%s型: 1st VnとVaが放射直線、Cbは同じ弧の上に並ぶ", (typeId) => {
    const anchors = stringLayoutAnchors("standard", typeId);
    const line = anchors.filter((anchor) => anchor.layoutRole === "radial-line");
    // 直線はすべて真横(±90度)。1列につき1プルト
    for (const anchor of line) expect(Math.abs(anchor.bearingDeg)).toBe(90);
    for (const part of ["violin1", "viola"] as const) {
      const rows = line.filter((anchor) => anchor.section === part).map((anchor) => anchor.rowIndex);
      expect(new Set(rows).size).toBe(rows.length);
      expect([...rows].sort((a, b) => a - b)).toEqual([...Array(rows.length).keys()]);
    }
    // 1st Vnの折り返しは6プルトまで1つ、7プルト以上で2つ
    const corners = anchors.filter((anchor) => anchor.layoutRole === "line-corner");
    expect(corners.every((anchor) => anchor.section === "violin1")).toBe(true);
    expect(corners.length).toBe(TYPE_EXPECTATIONS[typeId].pults[0] <= 6 ? 1 : 2);
    // Cbは2プルトまで同じ弧。3プルト以上は1つ外側の弧が2列目になる
    const bass = anchors.filter((anchor) => anchor.layoutRole === "bass");
    const bassRows = [...new Set(bass.map((anchor) => anchor.rowIndex))].sort((a, b) => a - b);
    expect(bassRows).toHaveLength(bass.length <= 2 ? 1 : 2);
    if (bassRows.length === 2) expect(bassRows[1] - bassRows[0]).toBe(1);
  });

  it.each(STRING_ENSEMBLE_TYPE_IDS)("%s型: 2nd Vn / Vcは番号が大きいほど中央寄り", (typeId) => {
    const anchors = stringLayoutAnchors("standard", typeId);
    for (const [part, sign] of [["violin2", -1], ["cello", 1]] as const) {
      const block = anchors.filter((anchor) => anchor.section === part && anchor.layoutRole === "arc-block");
      expect(block.length).toBeGreaterThan(0);
      // 先頭プルトだけが1列目
      expect(block.filter((anchor) => anchor.rowIndex === 0).map((anchor) => anchor.pultNumber)).toEqual([1]);
      // 同じ列では偶数プルトが外側(1st Vn / Vaの直線寄り)
      for (const rowIndex of new Set(block.map((anchor) => anchor.rowIndex))) {
        if (rowIndex === 0) continue;
        const row = block.filter((anchor) => anchor.rowIndex === rowIndex)
          .sort((a, b) => a.pultNumber - b.pultNumber);
        for (let index = 1; index < row.length; index += 1) {
          expect(Math.abs(row[index].bearingDeg)).toBeLessThan(Math.abs(row[index - 1].bearingDeg));
        }
      }
      // すべて自分の側に収まり、真横(±90度)は越えない
      for (const anchor of block) {
        expect(Math.sign(anchor.bearingDeg)).toBe(sign);
        expect(Math.abs(anchor.bearingDeg)).toBeLessThan(90);
      }
    }
  });

  it.each(STRING_ENSEMBLE_TYPE_IDS)("%s型: 方位角が半円に収まり、席が重ならない", (typeId) => {
    for (const anchor of stringLayoutAnchors("standard", typeId)) {
      expect(anchor.bearingDeg).toBeGreaterThanOrEqual(-90);
      expect(anchor.bearingDeg).toBeLessThanOrEqual(90);
    }
    const opts = options({ ensembleTypeId: typeId });
    const objects = build(opts);
    const units = pultUnits(objects);
    const chairs = units.flatMap((unit, pultIndex) => unit.chairs.map((chair) => ({ chair, pultIndex })));
    let minCrossMm = Number.POSITIVE_INFINITY;
    for (let i = 0; i < chairs.length; i += 1) {
      for (let j = i + 1; j < chairs.length; j += 1) {
        if (chairs[i].pultIndex === chairs[j].pultIndex) continue;
        minCrossMm = Math.min(minCrossMm, distance(chairs[i].chair, chairs[j].chair));
      }
    }
    // 別プルトの席はプルト内(600mm)より広く、椅子の外形(450mm)が重ならない
    expect(minCrossMm).toBeGreaterThanOrEqual(800);
    // 指揮台プリセット(900×900mm)の占有域へ入らない
    for (const object of objects) {
      const local = stageLocalOf(opts.conductor, object);
      expect(Math.max(Math.abs(local.lateralMm), Math.abs(local.depthMm))).toBeGreaterThan(450);
    }
  });

  it.each(STRING_ENSEMBLE_TYPE_IDS)("%s型: 全オブジェクトが指揮者を向き、列間隔の変更に追従する", (typeId) => {
    const opts = options({ ensembleTypeId: typeId });
    const objects = build(opts);
    expect(objects).toHaveLength(stringLayoutPultCount("standard", typeId) * 3);
    for (const object of objects) expect(facingCosine(object, opts.conductor)).toBeCloseTo(1, 9);
    // 列間隔を広げると半径だけが伸び、方位角は変わらない
    const base = stringLayout12Placements(opts);
    const wide = stringLayout12Placements(options({ ensembleTypeId: typeId, rowGapMm: 1800 }));
    for (let index = 0; index < base.length; index += 1) {
      expect(wide[index].anchor).toBe(base[index].anchor);
      expect(wide[index].rowRadiusMm - base[index].rowRadiusMm)
        .toBeCloseTo(base[index].anchor.rowIndex * (1800 - STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM), 6);
    }
  });
});

// ---------------------------------------------------------------------------
// 配置バリエーション
// ---------------------------------------------------------------------------

/** 4枠(左の直線・左の塊・右の塊・右の直線)へどのセクションが入るか。 */
const VARIANT_SLOTS: Record<StringSeatingVariantId, [string, string, string, string]> = {
  "standard": ["violin1", "violin2", "cello", "viola"],
  "standard-swap": ["violin1", "violin2", "viola", "cello"],
  "antiphonal": ["violin1", "cello", "viola", "violin2"],
  "antiphonal-swap": ["violin1", "viola", "cello", "violin2"],
};

describe("配置バリエーション: 標準/対抗とVa・Vc入れ替え", () => {
  it("4種類がそろい、下手→上手のセクション順が枠の定義と一致する", () => {
    expect(STRING_SEATING_VARIANT_IDS).toEqual(["standard", "standard-swap", "antiphonal", "antiphonal-swap"]);
    for (const variantId of STRING_SEATING_VARIANT_IDS) {
      expect(STRING_SEATING_VARIANT_ORDER[variantId]).toEqual(VARIANT_SLOTS[variantId]);
    }
  });

  it("標準配置は既定であり、12型は既存の固定アンカーと一致する", () => {
    expect(stringLayoutAnchors("standard", "12")).toBe(STRING_LAYOUT_12_ANCHORS);
  });

  it.each(STRING_SEATING_VARIANT_IDS)("%s: 全型でプルト数が編成人数の半分になる", (variantId) => {
    for (const typeId of STRING_ENSEMBLE_TYPE_IDS) {
      const counts = STRING_LAYOUT_PLAYER_COUNTS[typeId];
      for (const part of STRING_LAYOUT_12_SECTIONS) {
        expect(stringLayoutAnchorsFor(variantId, typeId, part)).toHaveLength(counts[part] / 2);
      }
      const total = STRING_LAYOUT_12_SECTIONS.reduce((sum, part) => sum + counts[part], 0);
      expect(stringLayoutPultCount(variantId, typeId)).toBe(total / 2);
    }
  });

  it.each(STRING_SEATING_VARIANT_IDS)("%s: 下手→上手の並び順が定義どおりになる", (variantId) => {
    const order = STRING_SEATING_VARIANT_ORDER[variantId];
    for (const typeId of STRING_ENSEMBLE_TYPE_IDS) {
      const placements = stringLayout12Placements(options({ seatingVariantId: variantId, ensembleTypeId: typeId }));
      // セクションの左右位置は平均方位角で比べる。定義順に単調増加する
      const meanBearing = (part: StringLayout12Section) => {
        const list = section(placements, part);
        return list.reduce((sum, placement) => sum + placement.anchor.bearingDeg, 0) / list.length;
      };
      const bearings = order.map((part) => meanBearing(part as StringLayout12Section));
      for (let index = 1; index < bearings.length; index += 1) {
        expect(bearings[index]).toBeGreaterThan(bearings[index - 1]);
      }
      // 両端は必ず放射直線、中2つは塊
      const roleOf = (part: string) =>
        new Set(stringLayoutAnchorsFor(variantId, typeId, part as StringLayout12Section)
          .map((anchor) => anchor.layoutRole));
      expect([...roleOf(order[0])].every((role) => role === "radial-line" || role === "line-corner")).toBe(true);
      expect([...roleOf(order[3])].every((role) => role === "radial-line" || role === "line-corner")).toBe(true);
      expect([...roleOf(order[1])]).toEqual(["arc-block"]);
      expect([...roleOf(order[2])]).toEqual(["arc-block"]);
    }
  });

  it.each(STRING_SEATING_VARIANT_IDS)("%s: Cbがチェロと同じ側の外側後方に付く", (variantId) => {
    for (const typeId of STRING_ENSEMBLE_TYPE_IDS) {
      const placements = stringLayout12Placements(options({ seatingVariantId: variantId, ensembleTypeId: typeId }));
      const bass = section(placements, "contrabass");
      const cello = section(placements, "cello");
      const celloSign = Math.sign(cello[0].anchor.bearingDeg);
      // すべてチェロと同じ側
      for (const placement of bass) {
        expect(Math.sign(placement.anchor.bearingDeg)).toBe(celloSign);
        expect(placement.depthMm).toBeGreaterThan(0);
      }
      // チェロと同じかそれより外側の列に乗る(標準配置Va/Vc逆ではVcが直線なので同じ列になる)
      expect(Math.min(...bass.map((placement) => placement.anchor.rowIndex)))
        .toBeGreaterThanOrEqual(Math.max(...cello.map((placement) => placement.anchor.rowIndex)));
      // 同じ列にチェロが居る場合は、Cbのほうが外側(方位角が真横寄り)にある
      for (const placement of bass) {
        const sameRow = cello.filter((other) => other.anchor.rowIndex === placement.anchor.rowIndex);
        for (const other of sameRow) {
          expect(Math.abs(placement.anchor.bearingDeg)).toBeLessThan(Math.abs(other.anchor.bearingDeg));
        }
      }
      // 2プルトまで同じ弧、3プルト以上は隣り合う2本の弧
      const rows = [...new Set(bass.map((placement) => placement.anchor.rowIndex))].sort((a, b) => a - b);
      expect(rows).toHaveLength(bass.length <= 2 ? 1 : 2);
      if (rows.length === 2) expect(rows[1] - rows[0]).toBe(1);
    }
  });

  it.each(STRING_SEATING_VARIANT_IDS)("%s: 1列目が4プルトで指揮台を囲み、方位角が半円に収まる", (variantId) => {
    for (const typeId of STRING_ENSEMBLE_TYPE_IDS) {
      const anchors = stringLayoutAnchors(variantId, typeId);
      const first = anchors.filter((anchor) => anchor.rowIndex === 0 && anchor.layoutRole !== "bass");
      expect(first).toHaveLength(4);
      expect(first.every((anchor) => anchor.pultNumber === 1)).toBe(true);
      const bearings = first.map((anchor) => anchor.bearingDeg).sort((a, b) => a - b);
      expect(bearings[0]).toBeCloseTo(-90, 6);
      expect(bearings[3]).toBeCloseTo(90, 6);
      expect(bearings[1]).toBeLessThan(0);
      expect(bearings[2]).toBeGreaterThan(0);
      for (const anchor of anchors) {
        expect(anchor.bearingDeg).toBeGreaterThanOrEqual(-90);
        expect(anchor.bearingDeg).toBeLessThanOrEqual(90);
      }
      // 列番号は0から連続する
      const rows = [...new Set(anchors.map((anchor) => anchor.rowIndex))].sort((a, b) => a - b);
      expect(rows).toEqual([...Array(stringLayoutRowCount(variantId, typeId)).keys()]);
    }
  });

  it.each(STRING_SEATING_VARIANT_IDS)("%s: 全型で席が重ならず、指揮台の占有域も侵さない", (variantId) => {
    for (const typeId of STRING_ENSEMBLE_TYPE_IDS) {
      const opts = options({ seatingVariantId: variantId, ensembleTypeId: typeId });
      const objects = build(opts);
      expect(objects).toHaveLength(stringLayoutPultCount(variantId, typeId) * 3);
      const units = pultUnits(objects);
      const chairs = units.flatMap((unit, pultIndex) => unit.chairs.map((chair) => ({ chair, pultIndex })));
      let minCrossMm = Number.POSITIVE_INFINITY;
      for (let i = 0; i < chairs.length; i += 1) {
        for (let j = i + 1; j < chairs.length; j += 1) {
          if (chairs[i].pultIndex === chairs[j].pultIndex) continue;
          minCrossMm = Math.min(minCrossMm, distance(chairs[i].chair, chairs[j].chair));
        }
      }
      expect(minCrossMm).toBeGreaterThanOrEqual(800);
      for (const object of objects) {
        const local = stageLocalOf(opts.conductor, object);
        expect(Math.max(Math.abs(local.lateralMm), Math.abs(local.depthMm))).toBeGreaterThan(450);
        expect(facingCosine(object, opts.conductor)).toBeCloseTo(1, 9);
      }
    }
  });

  it("対抗配置では2nd Vnも放射直線になり、16型は末尾2つを折り返して幅を詰める", () => {
    for (const variantId of ["antiphonal", "antiphonal-swap"] as const) {
      const anchors = stringLayoutAnchors(variantId, "16");
      const violin2 = anchors.filter((anchor) => anchor.section === "violin2");
      // 塊ではなく直線+折り返し
      expect(violin2.filter((anchor) => anchor.layoutRole === "radial-line")).toHaveLength(5);
      expect(violin2.filter((anchor) => anchor.layoutRole === "line-corner")).toHaveLength(2);
      // 直線は真横。折り返し2つで1st Vnより1列内側に収まる
      const line = violin2.filter((anchor) => anchor.layoutRole === "radial-line");
      expect(line.every((anchor) => anchor.bearingDeg === 90)).toBe(true);
      const violin1Line = anchors
        .filter((anchor) => anchor.section === "violin1" && anchor.layoutRole === "radial-line");
      expect(Math.max(...line.map((anchor) => anchor.rowIndex)))
        .toBeLessThan(Math.max(...violin1Line.map((anchor) => anchor.rowIndex)));
    }
    // 14型以下は列数に収まるので折り返しは1つ以下
    for (const typeId of ["8", "10", "12", "14"] as const) {
      const violin2 = stringLayoutAnchors("antiphonal", typeId)
        .filter((anchor) => anchor.section === "violin2" && anchor.layoutRole === "line-corner");
      expect(violin2.length).toBeLessThanOrEqual(1);
    }
  });

  it("Va/Vc入れ替えは2つの枠だけを交換し、1st Vn・2nd Vnは動かさない", () => {
    for (const [base, swapped] of [["standard", "standard-swap"], ["antiphonal", "antiphonal-swap"]] as const) {
      for (const typeId of STRING_ENSEMBLE_TYPE_IDS) {
        // 直線側のセクションはそのまま
        for (const part of ["violin1", "violin2"] as const) {
          expect(stringLayoutAnchorsFor(swapped, typeId, part))
            .toEqual(stringLayoutAnchorsFor(base, typeId, part));
        }
        // VaとVcが互いの枠へ入れ替わる。枠が同じ形(対抗配置の塊どうし)なら左右が入れ替わる
        const slotOf = (variantId: StringSeatingVariantId, part: StringLayout12Section) => {
          const anchors = stringLayoutAnchorsFor(variantId, typeId, part);
          return {
            roles: [...new Set(anchors.map((anchor) => anchor.layoutRole))].sort().join(","),
            side: Math.sign(anchors[0].bearingDeg),
          };
        };
        for (const part of ["viola", "cello"] as const) {
          const before = slotOf(base, part);
          const after = slotOf(swapped, part);
          expect(before.roles !== after.roles || before.side !== after.side).toBe(true);
        }
        // 入れ替え後のVaは入れ替え前のVcと同じ枠、Vcは同じくVaの枠に入る
        expect(slotOf(swapped, "viola").roles).toBe(slotOf(base, "cello").roles);
        expect(slotOf(swapped, "cello").roles).toBe(slotOf(base, "viola").roles);
      }
    }
  });
});

describe("位置補正のドラッグ換算", () => {
  it("前後位置補正の既定値は指揮者の前を空ける600mm", () => {
    expect(STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM).toBe(600);
    // 補正0のときアンカーどおり最前列が指揮台の真横に来る
    const flush = section(stringLayout12Placements(options({ depthOffsetMm: 0 })), "violin1")[0];
    expect(flush.depthMm).toBeCloseTo(0, 6);
    // 既定値では全体が舞台奥へ600mmずれる
    const shifted = section(stringLayout12Placements(
      options({ depthOffsetMm: STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM })), "violin1")[0];
    expect(shifted.depthMm - flush.depthMm).toBeCloseTo(600, 6);
    expect(shifted.lateralMm).toBeCloseTo(flush.lateralMm, 6);
  });

  it("中心ハンドルの位置から左右・前後補正を求める。10mm刻みで範囲内へ丸める", () => {
    // 舞台奥は画面上(Y負方向)、図面右はX正方向
    expect(stringLayout12OffsetsFromPointMm(CONDUCTOR, { xMm: CONDUCTOR.xMm + 1234, yMm: CONDUCTOR.yMm - 987 }))
      .toEqual({ lateralOffsetMm: 1230, depthOffsetMm: 990 });
    // 指揮者位置そのものなら補正なし
    expect(stringLayout12OffsetsFromPointMm(CONDUCTOR, { ...CONDUCTOR }))
      .toEqual({ lateralOffsetMm: 0, depthOffsetMm: 0 });
    // 客席側へ引くと前後補正は負。下限で止まる
    expect(stringLayout12OffsetsFromPointMm(CONDUCTOR, { xMm: CONDUCTOR.xMm, yMm: CONDUCTOR.yMm + 99999 }).depthOffsetMm)
      .toBe(STRING_LAYOUT_12_LIMITS.depthOffsetMm.min);
    // 上限・左右の範囲でも丸める
    const far = stringLayout12OffsetsFromPointMm(CONDUCTOR, { xMm: CONDUCTOR.xMm + 99999, yMm: CONDUCTOR.yMm - 99999 });
    expect(far).toEqual({
      lateralOffsetMm: STRING_LAYOUT_12_LIMITS.lateralOffsetMm.max,
      depthOffsetMm: STRING_LAYOUT_12_LIMITS.depthOffsetMm.max,
    });
    expect(stringLayout12OffsetsFromPointMm(CONDUCTOR, { xMm: CONDUCTOR.xMm - 99999, yMm: CONDUCTOR.yMm }).lateralOffsetMm)
      .toBe(STRING_LAYOUT_12_LIMITS.lateralOffsetMm.min);
  });

  it("求めた補正で配置すると、中心が掴んだ位置へ一致する", () => {
    const grabbed = { xMm: CONDUCTOR.xMm - 820, yMm: CONDUCTOR.yMm - 1470 };
    const offsets = stringLayout12OffsetsFromPointMm(CONDUCTOR, grabbed);
    const placements = stringLayout12Placements(options(offsets));
    // 補正なしの配置に対して、全プルトが同じ量だけ平行移動する
    const base = stringLayout12Placements(options({ lateralOffsetMm: 0, depthOffsetMm: 0 }));
    for (let index = 0; index < base.length; index += 1) {
      expect(placements[index].lateralMm - base[index].lateralMm).toBeCloseTo(offsets.lateralOffsetMm, 6);
      expect(placements[index].depthMm - base[index].depthMm).toBeCloseTo(offsets.depthOffsetMm, 6);
      // 列半径と向きは補正で変わらない
      expect(placements[index].rowRadiusMm).toBeCloseTo(base[index].rowRadiusMm, 6);
    }
    // 掴んだ位置は10mm刻みへ丸めた範囲内に収まる
    const center = stageLocalOf(CONDUCTOR, grabbed);
    expect(Math.abs(offsets.lateralOffsetMm - center.lateralMm)).toBeLessThanOrEqual(5);
    expect(Math.abs(offsets.depthOffsetMm - center.depthMm)).toBeLessThanOrEqual(5);
  });
});
