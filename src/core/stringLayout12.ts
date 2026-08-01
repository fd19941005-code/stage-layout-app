// 弦楽器テンプレ配置(FR-062)の固定テンプレート。8〜16型に対応する。
//
// 設計方針:
// - プルト中心を「参考配置画像から読み取った固定アンカー」として型ごとに持つ。
//   実行時に人数から列数や配分を計算しない。人数編集・自動再配置は扱わない。
//   アンカーの導出規則は`STRING_LAYOUT_ANCHORS`のコメントに残す。
// - 入出力はすべて実寸mm。pxや描画ライブラリ固有値は扱わない(要件12.1)。
// - React/DOMへ依存しない純粋関数だけで構成し、UIとCanvasへ座標計算を置かない。
// - 1プルトの生成は既存の共通処理`createPultUnitObjects`を再利用する。
//   既存のプルト弧状配置(`createPultArcObjects`)の座標結果・外部仕様は変更しない。
//
// 座標系:
//   舞台奥はアプリ固定の`STAGE_DEPTH_DIRECTION`(画面上=Y負方向)、図面右は
//   `STAGE_RIGHT_DIRECTION`(X正方向)。`stageFront.yMm`と指揮者位置Yの大小関係から
//   舞台奥方向を推測しない(stageFrontは任意角度の前端線も法線も持たないため)。
//   アンカーは指揮者(指揮台中心)を原点とする相対mmで、centerXMm=図面右へ正、
//   centerYMm=舞台奥へ正。
//
// プルトと向きの分離:
//   アンカーはプルト全体の中心位置だけを決める。椅子2脚はアンカーを基準に
//   指揮者方向へ直交する軸上へ対称配置し、譜面台は2席の中間から少し指揮者側へ置く。
//   回転角は各オブジェクト位置から指揮者位置へ向かう角度で個別に算出するため、
//   列の位置を蛇行させずに向きだけで指揮者方向を表現できる。

import type { PointMm, SceneObject } from "../types/project";
import { normalizeDeg } from "./transform";
import { createPultUnitObjects } from "./arrangement";
import { STRING_LAYOUT_ANCHORS } from "./stringLayoutAnchors";

export { STRING_LAYOUT_ANCHORS };

export type StringLayout12Section = "violin1" | "violin2" | "viola" | "cello" | "contrabass";

/**
 * アンカーが担う配置上の役割。座標計算には使わず、テストとUI表示で
 * 「どの並びのプルトか」を識別するために持つ。
 */
export type StringPultLayoutRole =
  /** 1列につき1プルトずつ、指揮台から放射方向へまっすぐ伸びる並び(1st Vn・Va)。 */
  | "radial-line"
  /** 1列につき2プルトずつの塊(2nd Vn・Vc)。 */
  | "arc-block"
  /** 放射直線の外端から中央寄りへ折り返すプルト(1st Vn 6)。 */
  | "line-corner"
  /** コントラバスの右後方。 */
  | "bass";

export interface StringPultAnchor {
  section: StringLayout12Section;
  /** セクション内のプルト番号(1起点)。 */
  pultNumber: number;
  /**
   * 何列目か。0が指揮台にもっとも近い列。
   * 実半径は`stringLayout12RowRadiusMm`が列間隔オプションから決める。
   */
  rowIndex: number;
  /** 指揮台の真後ろを0度、図面右を正とした方位角。-90度が真左、+90度が真右。 */
  bearingDeg: number;
  layoutRole: StringPultLayoutRole;
}

export interface StringLayout12Options {
  /** どの配置バリエーションのアンカーを使うか。 */
  seatingVariantId: StringSeatingVariantId;
  /** どの編成型のアンカーを使うか。 */
  ensembleTypeId: StringEnsembleTypeId;
  /** 指揮者位置(指揮台中心または指定座標)。アンカーの原点。 */
  conductor: PointMm;
  /** 全体の左右位置補正。図面右へ正。 */
  lateralOffsetMm: number;
  /** 全体の前後位置補正。舞台奥へ正。 */
  depthOffsetMm: number;
  /** 全体間隔倍率。アンカーの相対座標にだけ掛かり、プルト内の椅子間隔は変えない。 */
  spreadScale: number;
  /** 指揮台中心から1列目までの半径。 */
  firstRowRadiusMm: number;
  /** 隣り合う列の半径差。全列で共通。 */
  rowGapMm: number;
  /** 通常弦のプルト内椅子中心間隔。 */
  chairCenterSpacingMm: number;
  /** コントラバスのプルト内スツール中心間隔。 */
  contrabassSeatSpacingMm: number;
  /** プルト中心から指揮者側へ譜面台を離す距離。 */
  standForwardOffsetMm: number;
  layerId: string;
}

/** 1プルト分の配置結果。SceneObject生成前の中間表現でテストしやすくする。 */
export interface StringPultPlacement {
  anchor: StringPultAnchor;
  section: StringLayout12Section;
  pultNumber: number;
  /** プルト中心の実寸座標。 */
  center: PointMm;
  /** 指揮者中心の左右座標(図面右へ正)。 */
  lateralMm: number;
  /** 指揮者中心の舞台奥方向座標。最前列は0付近になり、負にもなりうる。 */
  depthMm: number;
  /** このプルトが乗る列の半径。 */
  rowRadiusMm: number;
  /** 指揮者からプルトへ向かう単位ベクトル。 */
  radial: PointMm;
  /** プルト中心から指揮者を向く回転角(0〜360)。 */
  rotationDeg: number;
  /** このプルト内の椅子中心間隔。 */
  seatSpacingMm: number;
}

export interface StringLayout12Templates {
  chair: SceneObject;
  stand: SceneObject;
  contrabassStool: SceneObject;
}

export type StringLayout12IdFactory = (role: "chair" | "stand", key: string) => string;

// ---------------------------------------------------------------------------
// 舞台の向き
// ---------------------------------------------------------------------------

/**
 * 舞台奥方向。画面上(Y負方向)。
 * 椅子・譜面台シンボルの基準方向が回転0で-Y(客席向き)であること、および
 * 図面上で客席が画面下になる本アプリの前提に合わせた固定値。
 * `stageFront.yMm`と指揮者位置Yの大小からは推測しない。
 */
export const STAGE_DEPTH_DIRECTION: PointMm = { xMm: 0, yMm: -1 };
/** 図面右方向。 */
export const STAGE_RIGHT_DIRECTION: PointMm = { xMm: 1, yMm: 0 };

/** 指揮者原点のローカル座標(左右, 舞台奥)をmm座標へ変換する。 */
export function stageLocalPointMm(conductor: PointMm, lateralMm: number, depthMm: number): PointMm {
  return {
    xMm: conductor.xMm + STAGE_RIGHT_DIRECTION.xMm * lateralMm + STAGE_DEPTH_DIRECTION.xMm * depthMm,
    yMm: conductor.yMm + STAGE_RIGHT_DIRECTION.yMm * lateralMm + STAGE_DEPTH_DIRECTION.yMm * depthMm,
  };
}

/** mm座標を指揮者原点のローカル座標(左右, 舞台奥)へ落とす。 */
export function stageLocalOf(conductor: PointMm, point: Pick<PointMm, "xMm" | "yMm">): { lateralMm: number; depthMm: number } {
  const dx = point.xMm - conductor.xMm;
  const dy = point.yMm - conductor.yMm;
  return {
    lateralMm: dx * STAGE_RIGHT_DIRECTION.xMm + dy * STAGE_RIGHT_DIRECTION.yMm,
    depthMm: dx * STAGE_DEPTH_DIRECTION.xMm + dy * STAGE_DEPTH_DIRECTION.yMm,
  };
}

/**
 * 指揮者方向を向く回転角。
 * 椅子・譜面台シンボルの基準方向は-Y(回転0で図面上向き)なので、
 * 向きベクトル(ux, uy)に対して`atan2(ux, -uy)`が必要な回転角になる。
 */
export function facingRotationDeg(from: PointMm, toConductor: PointMm): number {
  const dx = toConductor.xMm - from.xMm;
  const dy = toConductor.yMm - from.yMm;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return 0;
  return normalizeDeg((Math.atan2(dx, -dy) * 180) / Math.PI);
}

// ---------------------------------------------------------------------------
// 固定テンプレート
// ---------------------------------------------------------------------------

export const STRING_LAYOUT_12_SECTIONS: readonly StringLayout12Section[] =
  ["violin1", "violin2", "viola", "cello", "contrabass"];

/** 対応する編成型。第1ヴァイオリンの人数による通称。 */
export type StringEnsembleTypeId = "8" | "10" | "12" | "14" | "16";

export const STRING_ENSEMBLE_TYPE_IDS: readonly StringEnsembleTypeId[] = ["8", "10", "12", "14", "16"];

export const STRING_ENSEMBLE_DEFAULT_TYPE_ID: StringEnsembleTypeId = "12";

/**
 * 型ごとの人数。すべて偶数で、プルト数は人数の半分になる。
 * 14型はYamaha公式資料の69人編成(14-12-10-8-6)に合わせている。
 * 10型のVcだけは資料の5人が奇数でプルトへ割れないため6人にしている。
 */
export const STRING_LAYOUT_PLAYER_COUNTS:
  Readonly<Record<StringEnsembleTypeId, Readonly<Record<StringLayout12Section, number>>>> = {
  "8":  { violin1: 8,  violin2: 6,  viola: 4,  cello: 4,  contrabass: 2 },
  "10": { violin1: 10, violin2: 8,  viola: 6,  cello: 6,  contrabass: 4 },
  "12": { violin1: 12, violin2: 10, viola: 8,  cello: 6,  contrabass: 4 },
  "14": { violin1: 14, violin2: 12, viola: 10, cello: 8,  contrabass: 6 },
  "16": { violin1: 16, violin2: 14, viola: 12, cello: 10, contrabass: 8 },
};

/** 12型標準配置の人数。既存呼び出し向けの別名。 */
export const STRING_LAYOUT_12_PLAYER_COUNTS = STRING_LAYOUT_PLAYER_COUNTS["12"];

/** UI表示名。識別子として保存・比較へ使わない。 */
export const STRING_LAYOUT_12_LABELS: Readonly<Record<StringLayout12Section, string>> = {
  violin1: "1st Vn",
  violin2: "2nd Vn",
  viola: "Va",
  cello: "Vc",
  contrabass: "Cb",
};

export const STRING_LAYOUT_12_NAMES_JA: Readonly<Record<StringLayout12Section, string>> = {
  violin1: "第1ヴァイオリン",
  violin2: "第2ヴァイオリン",
  viola: "ヴィオラ",
  cello: "チェロ",
  contrabass: "コントラバス",
};

/** 配置バリエーション。左の直線・左の塊・右の塊・右の直線へどのセクションを入れるか。 */
export type StringSeatingVariantId = "standard" | "standard-swap" | "antiphonal" | "antiphonal-swap";

export const STRING_SEATING_VARIANT_IDS: readonly StringSeatingVariantId[] =
  ["standard", "standard-swap", "antiphonal", "antiphonal-swap"];

export const STRING_SEATING_DEFAULT_VARIANT_ID: StringSeatingVariantId = "standard";

/** UI表示名。識別子として保存・比較へ使わない。 */
export const STRING_SEATING_VARIANT_LABELS: Readonly<Record<StringSeatingVariantId, string>> = {
  "standard": "標準配置",
  "standard-swap": "標準配置(Va/Vc逆)",
  "antiphonal": "対抗配置",
  "antiphonal-swap": "対抗配置(Va/Vc逆)",
};

/**
 * バリエーションごとのセクション順(下手→上手)。表示用で、座標計算には使わない。
 * 座標はすべて`STRING_LAYOUT_ANCHORS`の固定値から決まる。
 */
export const STRING_SEATING_VARIANT_ORDER:
  Readonly<Record<StringSeatingVariantId, readonly StringLayout12Section[]>> = {
  "standard": ["violin1", "violin2", "cello", "viola"],
  "standard-swap": ["violin1", "violin2", "viola", "cello"],
  "antiphonal": ["violin1", "cello", "viola", "violin2"],
  "antiphonal-swap": ["violin1", "viola", "cello", "violin2"],
};

/** 指定したバリエーション・型のアンカー。 */
export function stringLayoutAnchors(
  variantId: StringSeatingVariantId,
  typeId: StringEnsembleTypeId,
): readonly StringPultAnchor[] {
  return STRING_LAYOUT_ANCHORS[variantId][typeId];
}

/** 12型標準配置のアンカー。既存呼び出し向けの別名。 */
export const STRING_LAYOUT_12_ANCHORS = STRING_LAYOUT_ANCHORS["standard"]["12"];

/** 指定したバリエーション・型の列(輪)の本数。0起点の`rowIndex`の最大値+1。 */
export function stringLayoutRowCount(
  variantId: StringSeatingVariantId,
  typeId: StringEnsembleTypeId,
): number {
  return stringLayoutAnchors(variantId, typeId)
    .reduce((max, anchor) => Math.max(max, anchor.rowIndex), 0) + 1;
}

/** プルト内椅子中心間隔(通常弦)。 */
export const STRING_LAYOUT_12_CHAIR_SPACING_MM = 600;
/**
 * プルト内スツール中心間隔(コントラバス)。
 * `contrabass-stool`プリセットの実寸幅900mmに対して重ならない値。
 */
export const STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM = 1100;
/** プルト中心から指揮者側への譜面台オフセット。 */
export const STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM = 450;

/** 参照するプリセット。コントラバスは通常椅子へ置き換えない。 */
export const STRING_LAYOUT_12_SEAT_PRESET_ID = "chair";
export const STRING_LAYOUT_12_STAND_PRESET_ID = "music-stand";
export const STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID = "contrabass-stool";

/**
 * 全体補正の入力制約。
 * 最前列は指揮台の真横(奥行き150mm)にあるため、この範囲内でも指揮者より
 * 客席側へ出るオブジェクトが生じる。それは意図した配置なので制約しない。
 * ここで縛るのは、図面から極端に外れる補正値だけ。
 */
export const STRING_LAYOUT_12_LIMITS = {
  lateralOffsetMm: { min: -5000, max: 5000 },
  depthOffsetMm: { min: -500, max: 5000 },
  spreadScale: { min: 0.8, max: 1.5 },
  firstRowRadiusMm: { min: 900, max: 4000 },
  rowGapMm: { min: 800, max: 3000 },
} as const;

export const STRING_LAYOUT_12_DEFAULT_LATERAL_OFFSET_MM = 0;
/**
 * 前後位置補正の既定値。アンカーは指揮台を原点に取っているので補正0だと最前列が
 * 指揮台の真横に来る。実際の舞台では指揮者の前後に余裕が要るため、既定で
 * 全体を舞台奥へ600mm下げる。
 */
export const STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM = 600;
export const STRING_LAYOUT_12_DEFAULT_SPREAD_SCALE = 1;
/** 指揮台中心から1列目までの既定半径。 */
export const STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM = 1500;
/** 列間隔の既定値。1st Vn / Va の隣接プルト間隔でもある。 */
export const STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM = 1200;
/** キャンバスで列をドラッグするときの刻み。 */
export const STRING_LAYOUT_12_DRAG_STEP_MM = 10;

function snapRowValueMm(valueMm: number, range: { min: number; max: number }): number {
  if (!Number.isFinite(valueMm)) return range.min;
  const snapped = Math.round(valueMm / STRING_LAYOUT_12_DRAG_STEP_MM) * STRING_LAYOUT_12_DRAG_STEP_MM;
  return Math.min(range.max, Math.max(range.min, snapped));
}

/**
 * 位置補正の補助線中心をドラッグしたときの左右・前後補正。
 * ポインター位置を指揮者原点のローカル座標へ落とし、10mm刻みで範囲内へ丸める。
 * 補助線中心と実際の配置中心が常に一致するよう、換算はここへ一元化する。
 */
export function stringLayout12OffsetsFromPointMm(
  conductor: PointMm,
  point: PointMm,
): { lateralOffsetMm: number; depthOffsetMm: number } {
  const local = stageLocalOf(conductor, point);
  return {
    lateralOffsetMm: snapRowValueMm(local.lateralMm, STRING_LAYOUT_12_LIMITS.lateralOffsetMm),
    depthOffsetMm: snapRowValueMm(local.depthMm, STRING_LAYOUT_12_LIMITS.depthOffsetMm),
  };
}

/**
 * 指定した列の半径。列は指揮台を中心とする同心の輪で、間隔は全列共通。
 * 全体間隔倍率はここでは掛けない(`stringLayout12Placements`側で掛ける)。
 */
export function stringLayout12RowRadiusMm(
  options: Pick<StringLayout12Options, "firstRowRadiusMm" | "rowGapMm">,
  rowIndex: number,
): number {
  return options.firstRowRadiusMm + rowIndex * options.rowGapMm;
}

/**
 * 1列目の補助線をドラッグしたときの1列目半径。
 * 全体間隔倍率が掛かった見た目の半径から、保存する素の半径へ戻す。
 */
export function stringLayout12FirstRowRadiusFromRadiusMm(radiusMm: number, spreadScale: number): number {
  const scale = Number.isFinite(spreadScale) && spreadScale > 0 ? spreadScale : 1;
  return snapRowValueMm(radiusMm / scale, STRING_LAYOUT_12_LIMITS.firstRowRadiusMm);
}

/**
 * 2列目以降の補助線をドラッグしたときの列間隔。
 * ドラッグした列までの距離を列数で割るので、どの列をつまんでも同じ意味になる。
 */
export function stringLayout12RowGapFromRadiusMm(
  firstRowRadiusMm: number,
  radiusMm: number,
  rowIndex: number,
  spreadScale: number,
): number {
  if (!Number.isFinite(rowIndex) || rowIndex < 1) return STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM;
  const scale = Number.isFinite(spreadScale) && spreadScale > 0 ? spreadScale : 1;
  return snapRowValueMm((radiusMm / scale - firstRowRadiusMm) / rowIndex, STRING_LAYOUT_12_LIMITS.rowGapMm);
}

/** 指定したバリエーション・型・セクションのアンカー。プルト番号順。 */
export function stringLayoutAnchorsFor(
  variantId: StringSeatingVariantId,
  typeId: StringEnsembleTypeId,
  section: StringLayout12Section,
): StringPultAnchor[] {
  return stringLayoutAnchors(variantId, typeId)
    .filter((anchor) => anchor.section === section)
    .sort((a, b) => a.pultNumber - b.pultNumber);
}

/** 指定したバリエーション・型の総プルト数。 */
export function stringLayoutPultCount(
  variantId: StringSeatingVariantId,
  typeId: StringEnsembleTypeId,
): number {
  return stringLayoutAnchors(variantId, typeId).length;
}

// ---------------------------------------------------------------------------
// 入力検証
// ---------------------------------------------------------------------------

function rangeError(label: string, value: number, range: { min: number; max: number }, unit: string): string | null {
  if (!Number.isFinite(value)) return `${label}は数値で指定してください。`;
  if (value < range.min || value > range.max) return `${label}は${range.min}〜${range.max}${unit}で指定してください。`;
  return null;
}

/** 確定不能エラー。空配列なら配置できる。警告とは区別する。 */
export function validateStringLayout12Options(options: StringLayout12Options): string[] {
  const errors: string[] = [];
  if (!options.layerId) errors.push("配置先レイヤーが指定されていません。");
  if (!STRING_ENSEMBLE_TYPE_IDS.includes(options.ensembleTypeId)) errors.push("編成型が不正です。");
  if (!STRING_SEATING_VARIANT_IDS.includes(options.seatingVariantId)) errors.push("配置バリエーションが不正です。");
  if (!Number.isFinite(options.conductor?.xMm) || !Number.isFinite(options.conductor?.yMm)) {
    errors.push("指揮者位置を数値で指定してください。");
  }
  const messages = [
    rangeError("左右位置補正", options.lateralOffsetMm, STRING_LAYOUT_12_LIMITS.lateralOffsetMm, "mm"),
    rangeError("前後位置補正", options.depthOffsetMm, STRING_LAYOUT_12_LIMITS.depthOffsetMm, "mm"),
    rangeError("全体間隔倍率", options.spreadScale, STRING_LAYOUT_12_LIMITS.spreadScale, "倍"),
    rangeError("1列目までの距離", options.firstRowRadiusMm, STRING_LAYOUT_12_LIMITS.firstRowRadiusMm, "mm"),
    rangeError("列間隔", options.rowGapMm, STRING_LAYOUT_12_LIMITS.rowGapMm, "mm"),
  ];
  for (const message of messages) {
    if (message) errors.push(message);
  }
  const internals = [options.chairCenterSpacingMm, options.contrabassSeatSpacingMm, options.standForwardOffsetMm];
  if (internals.some((value) => !Number.isFinite(value) || value <= 0)) {
    errors.push("内部配置定数が不正です。");
  }
  return errors;
}

// ---------------------------------------------------------------------------
// 配置計算
// ---------------------------------------------------------------------------

/** このプルトの椅子中心間隔。コントラバスだけスツール実寸に合わせて広げる。 */
export function seatSpacingForSection(section: StringLayout12Section, options: StringLayout12Options): number {
  return section === "contrabass" ? options.contrabassSeatSpacingMm : options.chairCenterSpacingMm;
}

/**
 * 20個の固定アンカーからプルト中心・向きを求める。
 * プレビューと確定配置はどちらもこの関数だけを通る。
 *
 * アンカーは「何列目か」と「方位角」だけを持ち、実際の半径は列間隔オプションから
 * 決まる。列間隔を変えると各列がまとめて指揮台から遠ざかる／近づくが、
 * 方位角は変わらないので列内の並び順と左右関係は保たれる。
 *
 * 全体間隔倍率は列半径へ掛け、位置補正はそのあとで加える。
 * プルト内の椅子間隔・譜面台オフセットには一切掛からない。
 */
export function stringLayout12Placements(options: StringLayout12Options): StringPultPlacement[] {
  if (validateStringLayout12Options(options).length > 0) return [];
  const placements: StringPultPlacement[] = [];
  for (const anchor of stringLayoutAnchors(options.seatingVariantId, options.ensembleTypeId)) {
    const rowRadiusMm = stringLayout12RowRadiusMm(options, anchor.rowIndex);
    const scaledRadiusMm = rowRadiusMm * options.spreadScale;
    const bearingRad = (anchor.bearingDeg * Math.PI) / 180;
    const lateralMm = scaledRadiusMm * Math.sin(bearingRad) + options.lateralOffsetMm;
    const depthMm = scaledRadiusMm * Math.cos(bearingRad) + options.depthOffsetMm;
    const center = stageLocalPointMm(options.conductor, lateralMm, depthMm);
    const dx = center.xMm - options.conductor.xMm;
    const dy = center.yMm - options.conductor.yMm;
    const distanceMm = Math.hypot(dx, dy);
    if (!Number.isFinite(distanceMm)) return [];
    // 最前列は指揮台の真横に並ぶため、位置補正しだいでプルト中心が指揮者位置と
    // 一致しうる。そのとき向きは決められないので、客席側を基準方向として扱い、
    // 20プルト全体が消えないようにする。
    const radial = distanceMm > 0
      ? { xMm: dx / distanceMm, yMm: dy / distanceMm }
      : { xMm: -STAGE_DEPTH_DIRECTION.xMm, yMm: -STAGE_DEPTH_DIRECTION.yMm };
    placements.push({
      anchor,
      section: anchor.section,
      pultNumber: anchor.pultNumber,
      center,
      lateralMm,
      depthMm,
      rowRadiusMm,
      radial,
      rotationDeg: facingRotationDeg(center, options.conductor),
      seatSpacingMm: seatSpacingForSection(anchor.section, options),
    });
  }
  // 最前列は指揮台を囲むため、プルト中心・椅子が指揮者位置より客席側へ出る場合がある。
  // 「必ず舞台奥側」という条件は持たない。
  const valid = placements.every((placement) =>
    Number.isFinite(placement.center.xMm)
    && Number.isFinite(placement.center.yMm)
    && Number.isFinite(placement.rotationDeg));
  return valid ? placements : [];
}

/** 椅子の円内へ収めるセクション略称。プルト番号・表裏は表示しない。 */
const STRING_CHAIR_LABELS: Readonly<Record<StringLayout12Section, string>> = {
  violin1: "1st",
  violin2: "2nd",
  viola: "Va",
  cello: "Vc",
  contrabass: "Cb",
};

/**
 * 1プルト分のSceneObject(椅子2脚+譜面台1台)を生成する純粋関数。
 * アンカーを基準に左右対称へ椅子を置き、譜面台は2席の中間かつ少し指揮者側へ置く。
 * 回転角はオブジェクト位置ごとに指揮者方向から算出する。
 */
export function createStringPultUnitObjects(
  placement: StringPultPlacement,
  chairTemplate: SceneObject,
  standTemplate: SceneObject,
  options: StringLayout12Options,
  baseZIndex: number,
  idFactory: StringLayout12IdFactory,
): SceneObject[] {
  const half = placement.seatSpacingMm / 2;
  const key = `${placement.section}-${placement.pultNumber}`;
  const chairLabel = STRING_CHAIR_LABELS[placement.section];
  return createPultUnitObjects(chairTemplate, standTemplate, {
    center: placement.center,
    radial: placement.radial,
    rotationDeg: placement.rotationDeg,
    rotationForPoint: (point) => facingRotationDeg(point, options.conductor),
    chairOffsetsMm: [-half, half],
    standOffsetMm: options.standForwardOffsetMm,
    layerId: options.layerId,
    baseZIndex,
    chairLabels: [chairLabel, chairLabel],
    // プルト番号を含む譜面台ラベルは図面を混雑させるため、弦配置では表示しない。
    standLabel: "",
  }, (role, indexInUnit) => idFactory(role, `${key}-${role}${indexInUnit + 1}`));
}

/**
 * 指定した編成型のSceneObjectを一括生成する。
 * 1プルトあたり椅子2脚+譜面台1台なので、生成数はプルト数の3倍になる。
 */
export function createStringLayout12Objects(
  templates: StringLayout12Templates,
  options: StringLayout12Options,
  baseZIndex: number,
  idFactory: StringLayout12IdFactory,
): SceneObject[] {
  const placements = stringLayout12Placements(options);
  if (placements.length === 0) return [];
  const objects: SceneObject[] = [];
  let zIndex = Number.isFinite(baseZIndex) ? baseZIndex : 0;
  for (const placement of placements) {
    const chairTemplate = placement.section === "contrabass" ? templates.contrabassStool : templates.chair;
    const unit = createStringPultUnitObjects(placement, chairTemplate, templates.stand, options, zIndex, idFactory);
    objects.push(...unit);
    zIndex += unit.length;
  }
  return objects;
}
