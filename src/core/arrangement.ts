// Phase 4の一括配置計算。入力・出力はすべて実寸mmで扱い、
// ID生成だけを呼び出し側から注入できる純粋な座標生成関数にする。

import type { PointMm, Project, SceneObject } from "../types/project";
import { normalizeDeg, rotatedBoundsMm } from "./transform";

export interface GridPlacementOptions {
  rows: number;
  columns: number;
  gapXMm: number;
  gapYMm: number;
}

/** Generate standard chairs along the X axis; the first chair center is the anchor. */
export interface ChairLineOptions {
  start: PointMm;
  count: number;
  /** Edge gap in mm; the X-axis pitch is widthMm + gapMm. */
  gapMm: number;
  rotationDeg: number;
  layerId: string;
  /** trueのとき、各椅子の前に譜面台を1台ずつ配置する。 */
  includeMusicStands?: boolean;
}

export interface ChairLinePlacement {
  chairIndex: number;
  xMm: number;
  yMm: number;
  rotationDeg: number;
}

export type ChairLineIdFactory = (placement: ChairLinePlacement) => string;
export type ChairLineMusicStandIdFactory = (placement: ChairLinePlacement) => string;

export const CHAIR_LINE_MUSIC_STAND_GAP_MM = 100;

export const DEFAULT_CHAIR_FACING_ROTATION_DEG = 180;

export const CHAIR_LINE_MIN_COUNT = 1;
export const CHAIR_LINE_MAX_COUNT = 100;
export const CHAIR_LINE_DEFAULT_COUNT = 6;
export const CHAIR_LINE_DEFAULT_GAP_MM = 500;
export const CHAIR_LINE_DEFAULT_ROTATION_DEG = DEFAULT_CHAIR_FACING_ROTATION_DEG;

function validatePointMm(point: PointMm): boolean {
  return Number.isFinite(point.xMm) && Number.isFinite(point.yMm);
}

export function validateChairLineOptions(options: ChairLineOptions): string[] {
  const errors: string[] = [];
  if (!validatePointMm(options.start)) errors.push("\u958b\u59cb\u4f4d\u7f6e\u304c\u4e0d\u6b63\u3067\u3059\u3002");
  if (!options.layerId) errors.push("\u914d\u7f6e\u5148\u30ec\u30a4\u30e4\u30fc\u304c\u6307\u5b9a\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002");
  if (!Number.isInteger(options.count) || options.count < CHAIR_LINE_MIN_COUNT || options.count > CHAIR_LINE_MAX_COUNT) {
    errors.push(`\u6905\u5b50\u306e\u6570\u306f${CHAIR_LINE_MIN_COUNT}\u301c${CHAIR_LINE_MAX_COUNT}\u811a\u3067\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002`);
  }
  if (!Number.isFinite(options.gapMm) || options.gapMm < 0) errors.push("\u6905\u5b50\u9593\u306e\u96a3\u308a\u5408\u3044\u8ddd\u96e2\u306f0mm\u4ee5\u4e0a\u3067\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
  if (!Number.isFinite(options.rotationDeg)) errors.push("\u6905\u5b50\u306e\u5411\u304d\u304c\u4e0d\u6b63\u3067\u3059\u3002");
  return errors;
}

export function createChairLinePlacements(
  chairTemplate: Pick<SceneObject, "widthMm">,
  options: ChairLineOptions,
): ChairLinePlacement[] {
  if (validateChairLineOptions(options).length > 0) return [];
  if (!Number.isFinite(chairTemplate.widthMm) || chairTemplate.widthMm <= 0) return [];
  const pitchMm = chairTemplate.widthMm + options.gapMm;
  const placements = Array.from({ length: options.count }, (_, chairIndex) => ({
    chairIndex,
    xMm: options.start.xMm + chairIndex * pitchMm,
    yMm: options.start.yMm,
    rotationDeg: normalizeDeg(options.rotationDeg),
  }));
  return placements.every((placement) => Number.isFinite(placement.xMm) && Number.isFinite(placement.yMm))
    ? placements
    : [];
}

export interface ChairLineStageBoundsMm {
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
}

/** Return the first chair center that keeps the complete default row centered in the stage. */
export function fitChairLineStartMm(
  center: PointMm,
  chairTemplate: Pick<SceneObject, "widthMm" | "depthMm">,
  options: Pick<ChairLineOptions, "count" | "gapMm">,
  stageBounds: ChairLineStageBoundsMm | null,
): PointMm {
  if (!Number.isFinite(center.xMm) || !Number.isFinite(center.yMm)) return center;
  const count = Number.isFinite(options.count) ? Math.max(1, Math.floor(options.count)) : 1;
  const widthMm = chairTemplate.widthMm;
  const depthMm = chairTemplate.depthMm;
  const gapMm = Number.isFinite(options.gapMm) ? Math.max(0, options.gapMm) : 0;
  if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isFinite(depthMm) || depthMm <= 0) return center;

  const pitchMm = widthMm + gapMm;
  const firstCenterOffsetMm = Math.max(0, count - 1) * pitchMm / 2;
  const startAtCenter = {
    xMm: center.xMm - firstCenterOffsetMm,
    yMm: center.yMm,
  };
  if (!stageBounds) return startAtCenter;

  const stageValues = [stageBounds.minXMm, stageBounds.minYMm, stageBounds.maxXMm, stageBounds.maxYMm];
  if (!stageValues.every((value) => Number.isFinite(value))) return startAtCenter;
  const stageCenter = {
    xMm: (stageBounds.minXMm + stageBounds.maxXMm) / 2,
    yMm: (stageBounds.minYMm + stageBounds.maxYMm) / 2,
  };
  const lineWidthMm = widthMm + Math.max(0, count - 1) * pitchMm;

  function fitAxis(value: number, minMm: number, maxMm: number, sizeMm: number, middleMm: number): number {
    const lower = minMm + sizeMm / 2;
    const upper = maxMm - sizeMm / 2;
    return lower <= upper ? Math.min(upper, Math.max(lower, value)) : middleMm;
  }

  const fittedCenter = {
    xMm: fitAxis(center.xMm, stageBounds.minXMm, stageBounds.maxXMm, lineWidthMm, stageCenter.xMm),
    yMm: fitAxis(center.yMm, stageBounds.minYMm, stageBounds.maxYMm, depthMm, stageCenter.yMm),
  };
  return {
    xMm: fittedCenter.xMm - firstCenterOffsetMm,
    yMm: fittedCenter.yMm,
  };
}

/** Place a music stand along each chair's local forward (-Y) axis. */
export function chairLineMusicStandPlacement(
  placement: Pick<ChairLinePlacement, "xMm" | "yMm" | "rotationDeg">,
  chairTemplate: Pick<SceneObject, "depthMm">,
  standTemplate: Pick<SceneObject, "depthMm">,
): { xMm: number; yMm: number; rotationDeg: number } {
  const angleRad = (placement.rotationDeg * Math.PI) / 180;
  const offsetMm = chairTemplate.depthMm / 2
    + standTemplate.depthMm / 2
    + CHAIR_LINE_MUSIC_STAND_GAP_MM;
  return {
    xMm: placement.xMm + Math.sin(angleRad) * offsetMm,
    yMm: placement.yMm - Math.cos(angleRad) * offsetMm,
    rotationDeg: normalizeDeg(placement.rotationDeg),
  };
}
export function createChairLineObjects(
  chairTemplate: SceneObject,
  options: ChairLineOptions,
  idFactory: ChairLineIdFactory = (placement) => "chair-line-" + (placement.chairIndex + 1),
  standTemplate?: SceneObject,
  standIdFactory: ChairLineMusicStandIdFactory = (placement) => "chair-line-stand-" + (placement.chairIndex + 1),
): SceneObject[] {
  const placements = createChairLinePlacements(chairTemplate, options);
  const objects: SceneObject[] = [];
  placements.forEach((placement, index) => {
    objects.push(cloneForPlacement(
      chairTemplate,
      idFactory(placement),
      placement.xMm,
      placement.yMm,
      placement.rotationDeg,
      options.layerId,
      chairTemplate.zIndex + index,
    ));
    if (options.includeMusicStands && standTemplate) {
      const standPlacement = chairLineMusicStandPlacement(placement, chairTemplate, standTemplate);
      objects.push(cloneForPlacement(
        standTemplate,
        standIdFactory(placement),
        standPlacement.xMm,
        standPlacement.yMm,
        standPlacement.rotationDeg,
        options.layerId,
        chairTemplate.zIndex + placements.length + index,
      ));
    }
  });
  return objects;
}
export function chairLineLaunchIssue(
  project: Pick<Project, "calibration" | "layers">,
  activeLayerId: string,
): string | null {
  if (project.calibration.mmPerPixel === null) return "\u6821\u6b63\u5f8c\u306b\u5229\u7528\u3067\u304d\u307e\u3059\u3002";
  const layer = project.layers.find((candidate) => candidate.id === activeLayerId);
  if (!layer) return "\u914d\u7f6e\u5148\u30ec\u30a4\u30e4\u30fc\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002";
  if (layer.locked) return "\u914d\u7f6e\u5148\u30ec\u30a4\u30e4\u30fc\u304c\u30ed\u30c3\u30af\u3055\u308c\u3066\u3044\u307e\u3059\u3002";
  if (!layer.visible) return "\u914d\u7f6e\u5148\u30ec\u30a4\u30e4\u30fc\u304c\u975e\u8868\u793a\u3067\u3059\u3002";
  return null;
}

export interface PultArcOptions {
  center: PointMm;
  radiusMm: number;
  startDeg: number;
  endDeg: number;
  pultCount: number;
  pultSpacingMm: number;
  layerId: string;
}

export type ArrangementIdFactory = (index: number, role: string, pultIndex?: number) => string;
/** 山台のカスタム一括配置。セグメント順を保ったまま、mmだけで連続配置する。 */
export const RISER_PRESET_IDS = ["riser-3x6", "riser-4x6", "riser-6x6"] as const;
export type RiserPresetId = (typeof RISER_PRESET_IDS)[number];
export type RiserDirection = "horizontal" | "vertical";
export type RiserRotationDeg = 0 | 90;
export const RISER_HEIGHTS_MM = [150, 300, 450, 600] as const;

export interface RiserSegment {
  presetId: RiserPresetId;
  count: number;
  /** Omitted rotation follows the row direction. */
  rotationDeg?: RiserRotationDeg;
}

export interface RiserGroupLayoutOptions {
  center: PointMm;
  segments: readonly RiserSegment[];
  heightMm: number;
  direction: RiserDirection;
}

export interface RiserPresetDimensions {
  widthMm: number;
  depthMm: number;
}

export type RiserDimensions = Readonly<Record<RiserPresetId, RiserPresetDimensions>>;

export interface RiserPlacement {
  presetId: RiserPresetId;
  xMm: number;
  yMm: number;
  rotationDeg: RiserRotationDeg;
  index: number;
}

const RISER_DIRECTION_VALUES: readonly RiserDirection[] = ["horizontal", "vertical"];
const RISER_HEIGHT_VALUES: readonly number[] = RISER_HEIGHTS_MM;

export function defaultRiserRotationDeg(direction: RiserDirection): RiserRotationDeg {
  return direction === "horizontal" ? 0 : 90;
}

function rotationForSegment(segment: RiserSegment, direction: RiserDirection): RiserRotationDeg {
  return segment.rotationDeg ?? defaultRiserRotationDeg(direction);
}

// Use the rotated footprint for adjacency while keeping persisted width/depth unchanged.
function orientedRiserExtents(
  dimension: RiserPresetDimensions,
  rotationDeg: RiserRotationDeg,
  direction: RiserDirection,
): { alongMm: number; crossMm: number } {
  const widthMm = rotationDeg === 90 ? dimension.depthMm : dimension.widthMm;
  const depthMm = rotationDeg === 90 ? dimension.widthMm : dimension.depthMm;
  return direction === "horizontal"
    ? { alongMm: widthMm, crossMm: depthMm }
    : { alongMm: depthMm, crossMm: widthMm };
}
export function validateRiserGroupOptions(options: RiserGroupLayoutOptions): string[] {
  const issues: string[] = [];
  if (!Number.isFinite(options.center.xMm) || !Number.isFinite(options.center.yMm)) issues.push("配置位置が不正です。");
  if (!RISER_DIRECTION_VALUES.includes(options.direction)) issues.push("配置方向が不正です。");
  if (!RISER_HEIGHT_VALUES.includes(options.heightMm)) issues.push("段高は150/300/450/600mmから選択してください。");
  if (options.segments.length === 0) issues.push("山台セグメントを1つ以上追加してください。");
  let total = 0;
  options.segments.forEach((segment, index) => {
    if (!RISER_PRESET_IDS.includes(segment.presetId)) issues.push("セグメント" + (index + 1) + "の種類が不正です。");
    if (segment.rotationDeg !== undefined && segment.rotationDeg !== 0 && segment.rotationDeg !== 90) issues.push("セグメントの回転は0°または90°で指定してください。");
    if (!Number.isInteger(segment.count) || segment.count < 1 || segment.count > 50) issues.push("セグメント" + (index + 1) + "の枚数は1〜50枚です。");
    total += Number.isFinite(segment.count) ? Math.max(0, Math.floor(segment.count)) : 0;
  });
  if (total > 100) issues.push("山台の合計枚数は100枚以内です。");
  return issues;
}

/** セグメント列を左から右へ展開する。verticalでも寸法は交換せず、回転だけを与える。 */
export function createRiserGroupPlacements(
  options: RiserGroupLayoutOptions,
  dimensions: RiserDimensions,
): RiserPlacement[] {
  if (validateRiserGroupOptions(options).length > 0) return [];
  const expanded = options.segments.flatMap((segment) =>
    Array.from({ length: segment.count }, () => ({
      presetId: segment.presetId,
      dimension: dimensions[segment.presetId],
      rotationDeg: rotationForSegment(segment, options.direction),
    })),
  );
  if (expanded.some((item) => !item.dimension || item.dimension.widthMm <= 0 || item.dimension.depthMm <= 0)) return [];
  const totalAlongMm = expanded.reduce(
    (sum, item) => sum + orientedRiserExtents(item.dimension, item.rotationDeg, options.direction).alongMm,
    0,
  );
  let offsetMm = -totalAlongMm / 2;
  return expanded.map((item, index) => {
    const extents = orientedRiserExtents(item.dimension, item.rotationDeg, options.direction);
    const alongCenterMm = offsetMm + extents.alongMm / 2;
    offsetMm += extents.alongMm;
    return options.direction === "horizontal"
      ? { presetId: item.presetId, xMm: options.center.xMm + alongCenterMm, yMm: options.center.yMm, rotationDeg: item.rotationDeg, index }
      : { presetId: item.presetId, xMm: options.center.xMm, yMm: options.center.yMm + alongCenterMm, rotationDeg: item.rotationDeg, index };
  });
}
export function riserGroupBoundsMm(options: RiserGroupLayoutOptions, dimensions: RiserDimensions) {
  const placements = createRiserGroupPlacements(options, dimensions);
  if (placements.length === 0) return null;
  const extents = placements.map((placement) => orientedRiserExtents(
    dimensions[placement.presetId],
    placement.rotationDeg,
    options.direction,
  ));
  const totalAlongMm = extents.reduce((sum, extent) => sum + extent.alongMm, 0);
  const crossMm = Math.max(...extents.map((extent) => extent.crossMm));
  return options.direction === "horizontal"
    ? { widthMm: totalAlongMm, depthMm: crossMm }
    : { widthMm: crossMm, depthMm: totalAlongMm };
}
export interface RiserStageBoundsMm {
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
}

/** 山台一括配置の中心を舞台図面の範囲内へ収める。大きすぎる場合はその軸の中央へ置く。 */
export function fitRiserGroupCenterMm(
  center: PointMm,
  groupBounds: { widthMm: number; depthMm: number } | null,
  stageBounds: RiserStageBoundsMm,
): PointMm {
  const stageValues = [stageBounds.minXMm, stageBounds.minYMm, stageBounds.maxXMm, stageBounds.maxYMm];
  if (!stageValues.every((value) => Number.isFinite(value))) return center;
  const stageCenter = {
    xMm: (stageBounds.minXMm + stageBounds.maxXMm) / 2,
    yMm: (stageBounds.minYMm + stageBounds.maxYMm) / 2,
  };
  if (!groupBounds || !Number.isFinite(groupBounds.widthMm) || !Number.isFinite(groupBounds.depthMm)) return stageCenter;

  function fitAxis(value: number, minMm: number, maxMm: number, sizeMm: number, middleMm: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(sizeMm) || sizeMm <= 0) return middleMm;
    const lower = minMm + sizeMm / 2;
    const upper = maxMm - sizeMm / 2;
    return lower <= upper ? Math.min(upper, Math.max(lower, value)) : middleMm;
  }

  return {
    xMm: fitAxis(center.xMm, stageBounds.minXMm, stageBounds.maxXMm, groupBounds.widthMm, stageCenter.xMm),
    yMm: fitAxis(center.yMm, stageBounds.minYMm, stageBounds.maxYMm, groupBounds.depthMm, stageCenter.yMm),
  };
}

/** 配置確定と同じ生成経路をプレビューでも再利用する。ID生成は呼び出し側から注入する。 */
export function createRiserGroupObjects(
  templates: ReadonlyMap<RiserPresetId, SceneObject>,
  options: RiserGroupLayoutOptions,
  groupId: string,
  idFactory: (index: number, presetId: RiserPresetId) => string,
): SceneObject[] {
  const dimensions = Object.fromEntries(
    RISER_PRESET_IDS.map((presetId) => {
      const template = templates.get(presetId);
      return [presetId, { widthMm: template?.widthMm ?? 0, depthMm: template?.depthMm ?? 0 }];
    }),
  ) as RiserDimensions;
  return createRiserGroupPlacements(options, dimensions).flatMap((placement) => {
    const template = templates.get(placement.presetId);
    if (!template) return [];
    return [{
      ...template,
      id: idFactory(placement.index, placement.presetId),
      xMm: placement.xMm,
      yMm: placement.yMm,
      rotationDeg: placement.rotationDeg,
      heightMm: options.heightMm,
      label: "段高" + options.heightMm + "mm",
      groupId,
      locked: false,
      zIndex: placement.index,
    } satisfies SceneObject];
  });
}
export interface PultUnitSpec {
  /** プルト中心の実寸座標。 */
  center: PointMm;
  /** 弧中心(指揮者側)からプルトへ向かう単位ベクトル。 */
  radial: PointMm;
  /** 椅子・譜面台へ与える回転角。向きの規約は呼び出し側が決める。 */
  rotationDeg: number;
  /** 椅子中心の接線方向オフセット。1要素なら片プルト。 */
  chairOffsetsMm: readonly number[];
  /** プルト中心から弧中心側へ譜面台を離す距離。 */
  standOffsetMm: number;
  layerId: string;
  /** 先頭オブジェクトのzIndex。以降1ずつ増える。 */
  baseZIndex: number;
  /** 省略時はテンプレートのラベルを引き継ぐ。 */
  chairLabels?: readonly string[];
  standLabel?: string;
  /**
   * オブジェクト単位で回転角を決める場合に指定する。プルト内でも椅子の位置ごとに
   * 指揮者方向へ向ける用途で使う。未指定なら`rotationDeg`を全オブジェクトへ使う。
   */
  rotationForPoint?: (point: PointMm) => number;
}

export type PultUnitIdFactory = (role: "chair" | "stand", indexInUnit: number) => string;

/**
 * 1プルトについて、接線方向へ椅子を置き、弧中心側へ譜面台を置く共通処理。
 * 座標はすべてmmで、pxや描画ライブラリへ依存しない。
 */
export function createPultUnitObjects(
  chairTemplate: SceneObject,
  standTemplate: SceneObject,
  spec: PultUnitSpec,
  idFactory: PultUnitIdFactory,
): SceneObject[] {
  const tangent = { xMm: -spec.radial.yMm, yMm: spec.radial.xMm };
  const rotationAt = (xMm: number, yMm: number) => spec.rotationForPoint
    ? spec.rotationForPoint({ xMm, yMm })
    : spec.rotationDeg;
  const objects: SceneObject[] = [];
  let zIndex = spec.baseZIndex;
  spec.chairOffsetsMm.forEach((offsetMm, chairIndex) => {
    const xMm = spec.center.xMm + tangent.xMm * offsetMm;
    const yMm = spec.center.yMm + tangent.yMm * offsetMm;
    objects.push(cloneForPlacement(
      chairTemplate,
      idFactory("chair", chairIndex),
      xMm,
      yMm,
      rotationAt(xMm, yMm),
      spec.layerId,
      zIndex,
      spec.chairLabels?.[chairIndex] ?? chairTemplate.label,
    ));
    zIndex += 1;
  });
  const standXMm = spec.center.xMm - spec.radial.xMm * spec.standOffsetMm;
  const standYMm = spec.center.yMm - spec.radial.yMm * spec.standOffsetMm;
  objects.push(cloneForPlacement(
    standTemplate,
    idFactory("stand", 0),
    standXMm,
    standYMm,
    rotationAt(standXMm, standYMm),
    spec.layerId,
    zIndex,
    spec.standLabel ?? standTemplate.label,
  ));
  return objects;
}

function positiveInteger(value: number, fallback: number, max: number): number {
  return Math.min(max, Math.max(1, Math.floor(Number.isFinite(value) ? value : fallback)));
}

function cloneForPlacement(
  source: SceneObject,
  id: string,
  xMm: number,
  yMm: number,
  rotationDeg: number,
  layerId: string,
  zIndex: number,
  label: string = source.label,
): SceneObject {
  const deltaX = xMm - source.xMm;
  const deltaY = yMm - source.yMm;
  return {
    ...source,
    id,
    xMm,
    yMm,
    endXMm: typeof source.endXMm === "number" ? source.endXMm + deltaX : source.endXMm,
    endYMm: typeof source.endYMm === "number" ? source.endYMm + deltaY : source.endYMm,
    rotationDeg: normalizeDeg(rotationDeg),
    label,
    layerId,
    zIndex,
    locked: false,
    groupId: null,
  };
}

/** 元オブジェクトを左上のセルとして、残りのセル分だけ複製する。間隔は外形間のmm。 */
export function createGridCopies(
  source: SceneObject,
  options: GridPlacementOptions,
  idFactory: ArrangementIdFactory = (index) => `grid-${index + 1}`,
): SceneObject[] {
  const rows = positiveInteger(options.rows, 1, 100);
  const columns = positiveInteger(options.columns, 1, 100);
  const gapX = Math.max(0, Number.isFinite(options.gapXMm) ? options.gapXMm : 0);
  const gapY = Math.max(0, Number.isFinite(options.gapYMm) ? options.gapYMm : 0);
  const copies: SceneObject[] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (row === 0 && column === 0) continue;
      copies.push(cloneForPlacement(
        source,
        idFactory(index, "grid"),
        source.xMm + column * (source.widthMm + gapX),
        source.yMm + row * (source.depthMm + gapY),
        source.rotationDeg,
        source.layerId,
        source.zIndex + index + 1,
      ));
      index += 1;
    }
  }
  return copies;
}

/** 椅子2脚+譜面台1台を1プルトとして弧状に生成する。 */
export function createPultArcObjects(
  chairTemplate: SceneObject,
  standTemplate: SceneObject,
  options: PultArcOptions,
  idFactory: ArrangementIdFactory = (index, role, pultIndex = 0) => `pult-${pultIndex + 1}-${role}-${index + 1}`,
): SceneObject[] {
  const count = positiveInteger(options.pultCount, 1, 100);
  const radius = Math.max(1, Number.isFinite(options.radiusMm) ? options.radiusMm : 1);
  const spacing = Math.max(1, Number.isFinite(options.pultSpacingMm) ? options.pultSpacingMm : 900);
  const start = Number.isFinite(options.startDeg) ? options.startDeg : 0;
  const end = Number.isFinite(options.endDeg) ? options.endDeg : start;
  const result: SceneObject[] = [];
  let zIndex = Math.max(chairTemplate.zIndex, standTemplate.zIndex);
  let index = 0;

  for (let pultIndex = 0; pultIndex < count; pultIndex += 1) {
    const ratio = count === 1 ? 0.5 : pultIndex / (count - 1);
    const angleDeg = start + (end - start) * ratio;
    const angleRad = (angleDeg * Math.PI) / 180;
    const radial = { xMm: Math.cos(angleRad), yMm: Math.sin(angleRad) };
    const base = {
      xMm: options.center.xMm + radial.xMm * radius,
      yMm: options.center.yMm + radial.yMm * radius,
    };
    const chairOffset = spacing / 2;
    const objects = createPultUnitObjects(chairTemplate, standTemplate, {
      center: base,
      radial,
      rotationDeg: angleDeg + 90,
      chairOffsetsMm: [-chairOffset, chairOffset],
      standOffsetMm: Math.max(350, standTemplate.depthMm / 2 + 100),
      layerId: options.layerId,
      baseZIndex: zIndex,
      chairLabels: [`プルト${pultIndex + 1}-1`, `プルト${pultIndex + 1}-2`],
      standLabel: `譜面台${pultIndex + 1}`,
      // 既存のID採番は椅子2脚→譜面台の通し番号を前提にしているため、そのまま維持する。
    }, (role, indexInUnit) => idFactory(index + (role === "chair" ? indexInUnit : 2), role, pultIndex));
    result.push(...objects);
    index += objects.length;
    zIndex += objects.length;
  }

  return result;
}

// ---------------------------------------------------------------------------
// 椅子多列円弧配置(FR-064)。指揮台を円弧中心として、列ごとの脚数を同心円弧上へ配置する。
// 計算はすべてmmとベクトル演算だけで行い、React/DOM/pxへ依存しない。
// 椅子の見た目は標準プリセットchairの既存実装をそのまま継承し、ここでは一切上書きしない。
// ---------------------------------------------------------------------------

export interface ChairArcRowSpec {
  chairCount: number;
}

export interface ChairArcRowsOptions {
  podiumId: string;
  /** 中心方向の角度。mm座標系で0度が+X、90度が+Y。 */
  directionDeg: number;
  /** 中心方向から左右端までの角度。円弧角の半分。 */
  halfSpanDeg: number;
  /** 指揮台外形端から1列目椅子の手前端までの距離。 */
  firstGapMm: number;
  /** 前列と次列の椅子中心円弧の半径差。 */
  rowGapMm: number;
  rows: ChairArcRowSpec[];
  layerId: string;
  /** trueのとき、各椅子と指揮台の間に譜面台を1台ずつ配置する。 */
  includeMusicStands?: boolean;
}

export interface ChairArcPlacement {
  rowIndex: number;
  chairIndex: number;
  xMm: number;
  yMm: number;
  /** テンプレート値を継承する。円弧角度からは算出しない(FR-064-20)。 */
  rotationDeg: number;
  angleDeg: number;
  radiusMm: number;
}

export interface ChairArcPlacementRef {
  rowIndex: number;
  chairIndex: number;
}

export interface ChairArcOverlap {
  a: ChairArcPlacementRef;
  b: ChairArcPlacementRef;
  distanceMm: number;
}

export interface ChairArcObjectOverlap {
  placement: ChairArcPlacementRef;
  objectId: string;
}

export type ChairArcIdFactory = (placement: ChairArcPlacement) => string;

/** 確定前の一時UI状態。Project・履歴・自動保存には入れない(FR-064-22)。 */
export interface ChairArcSession {
  options: ChairArcRowsOptions;
  /** キャンバスの1クリックで中心方向を指定する待機中かどうか。 */
  pickingDirection: boolean;
}

export const CHAIR_ARC_MIN_ROWS = 1;
export const CHAIR_ARC_MAX_ROWS = 20;
export const CHAIR_ARC_MIN_CHAIRS_PER_ROW = 1;
export const CHAIR_ARC_MAX_CHAIRS_PER_ROW = 100;
export const CHAIR_ARC_MIN_ARC_DEG = 5;
export const CHAIR_ARC_MAX_ARC_DEG = 180;
/** 1間。1列目空き距離の既定値かつプリセット値。 */
export const CHAIR_ARC_DEFAULT_FIRST_GAP_MM = 1820;
/** 半間。列間隔の既定値かつプリセット値。 */
export const CHAIR_ARC_DEFAULT_ROW_GAP_MM = 910;
export const CHAIR_ARC_DEFAULT_HALF_SPAN_DEG = 45;
/** 距離ドラッグの丸め単位。数値入力の値は丸めず、ドラッグ結果だけをこの刻みへ揃える。 */
export const CHAIR_ARC_DRAG_STEP_MM = 10;
/** ドラッグで詰められる下限。0以下は入力エラーになるため手前で止める。 */
export const CHAIR_ARC_MIN_GAP_MM = 10;
export const CHAIR_ARC_DEFAULT_ROW_CHAIR_COUNTS: readonly number[] = [6, 8];
/** 重なり判定で接触を重なり扱いにしないための許容差。 */
const CHAIR_ARC_TOUCH_EPSILON_MM = 1e-6;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 角度差を-180〜180度へ畳む。左右対称の半角算出に使う。 */
export function signedDeltaDeg(fromDeg: number, toDeg: number): number {
  const delta = normalizeDeg(toDeg - fromDeg);
  return delta > 180 ? delta - 360 : delta;
}

/**
 * 中心方向uに対する指揮台中心から回転後外形端までの距離(7.2)。
 * 回転後の幅方向eW・奥行き方向eDへの射影の絶対値で求めるため、
 * 指揮台が何度回転していても、pxやDOM座標を参照せずに正しい値になる。
 */
export function podiumExtentAlongDirection(
  podium: Pick<SceneObject, "widthMm" | "depthMm" | "rotationDeg">,
  directionDeg: number,
): number {
  const rot = toRadians(podium.rotationDeg);
  const dir = toRadians(directionDeg);
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  const widthAxis = { x: Math.cos(rot), y: Math.sin(rot) };
  const depthAxis = { x: -Math.sin(rot), y: Math.cos(rot) };
  return Math.abs(ux * widthAxis.x + uy * widthAxis.y) * podium.widthMm / 2
    + Math.abs(ux * depthAxis.x + uy * depthAxis.y) * podium.depthMm / 2;
}

/**
 * 配置距離・重なり判定に使う椅子半径(7.3)。
 * 値をハードコードせず、現在のchairプリセット実寸から求める。
 */
export function chairArcChairRadiusMm(chairTemplate: Pick<SceneObject, "widthMm" | "depthMm">): number {
  return Math.max(chairTemplate.widthMm, chairTemplate.depthMm) / 2;
}

export const CHAIR_ARC_MUSIC_STAND_GAP_MM = 100;
export type ChairArcMusicStandIdFactory = (placement: ChairArcPlacement) => string;

/** 椅子から指揮台側へ、椅子の前面と譜面台の間隔を保って譜面台を置く。 */
export function chairArcMusicStandPlacement(
  placement: Pick<ChairArcPlacement, "xMm" | "yMm" | "angleDeg">,
  chairTemplate: Pick<SceneObject, "widthMm" | "depthMm">,
  standTemplate: Pick<SceneObject, "widthMm" | "depthMm">,
): { xMm: number; yMm: number; rotationDeg: number } {
  const angleRad = toRadians(placement.angleDeg);
  const radial = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
  const offsetMm = chairArcChairRadiusMm(chairTemplate)
    + Math.max(standTemplate.widthMm, standTemplate.depthMm) / 2
    + CHAIR_ARC_MUSIC_STAND_GAP_MM;
  return {
    xMm: placement.xMm - radial.x * offsetMm,
    yMm: placement.yMm - radial.y * offsetMm,
    rotationDeg: normalizeDeg(placement.angleDeg + 90),
  };
}

/** R1 = podiumExtent + firstGap + chairRadius(7.4) */
export function chairArcFirstRowRadiusMm(
  podium: Pick<SceneObject, "widthMm" | "depthMm" | "rotationDeg">,
  chairTemplate: Pick<SceneObject, "widthMm" | "depthMm">,
  options: Pick<ChairArcRowsOptions, "directionDeg" | "firstGapMm">,
): number {
  return podiumExtentAlongDirection(podium, options.directionDeg)
    + options.firstGapMm
    + chairArcChairRadiusMm(chairTemplate);
}

/** Rrow = R1 + rowIndex × rowGap(7.5) */
export function chairArcRowRadiusMm(firstRowRadiusMm: number, rowIndex: number, rowGapMm: number): number {
  return firstRowRadiusMm + rowIndex * rowGapMm;
}

/**
 * 列内の椅子角度(7.7)。全列で同じ開始・終了角度を使うため、
 * 各列の両端は円弧中心から見て同じ放射方向上へ揃う。
 */
export function chairArcRowAnglesDeg(chairCount: number, directionDeg: number, halfSpanDeg: number): number[] {
  const count = Math.floor(chairCount);
  if (!Number.isFinite(count) || count < 1) return [];
  if (count === 1) return [directionDeg];
  const startAngle = directionDeg - halfSpanDeg;
  const endAngle = directionDeg + halfSpanDeg;
  return Array.from({ length: count }, (_, index) => startAngle + (endAngle - startAngle) * index / (count - 1));
}

function snapDragGapMm(value: number): number {
  if (!Number.isFinite(value)) return CHAIR_ARC_MIN_GAP_MM;
  return Math.max(CHAIR_ARC_MIN_GAP_MM, Math.round(value / CHAIR_ARC_DRAG_STEP_MM) * CHAIR_ARC_DRAG_STEP_MM);
}

/**
 * 1列目の円弧補助線をドラッグしたときの空き距離。
 * ポインターの半径から指揮台の方向支持距離と椅子半径を差し引くため、
 * 指揮台が回転していてもドラッグ位置と1820mmの意味がずれない。
 */
export function chairArcFirstGapFromRadiusMm(
  podium: Pick<SceneObject, "widthMm" | "depthMm" | "rotationDeg">,
  chairTemplate: Pick<SceneObject, "widthMm" | "depthMm">,
  directionDeg: number,
  radiusMm: number,
): number {
  const base = podiumExtentAlongDirection(podium, directionDeg) + chairArcChairRadiusMm(chairTemplate);
  return snapDragGapMm(radiusMm - base);
}

/**
 * 2列目以降の円弧補助線をドラッグしたときの列間隔。
 * 掴んだ列までの半径差を列数で割るので、どの列を引いても同じ意味になる。
 */
export function chairArcRowGapFromRadiusMm(
  firstRowRadiusMm: number,
  radiusMm: number,
  rowIndex: number,
): number {
  if (!Number.isFinite(rowIndex) || rowIndex < 1) return snapDragGapMm(Number.NaN);
  return snapDragGapMm((radiusMm - firstRowRadiusMm) / rowIndex);
}

/** 指揮台の回転方向を中心方向の初期値にする。取得不能時の画面上方向(-90度)と同じ基準。 */
export function defaultChairArcDirectionDeg(podium: Pick<SceneObject, "rotationDeg">): number {
  return normalizeDeg((Number.isFinite(podium.rotationDeg) ? podium.rotationDeg : 0) - 90);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** 入力エラー(10.1)。空配列なら確定できる。警告とは区別する。 */
export function validateChairArcRowsOptions(options: ChairArcRowsOptions): string[] {
  const errors: string[] = [];
  if (!options.podiumId) errors.push("基準となる指揮台が指定されていません。");
  if (!options.layerId) errors.push("配置先レイヤーが指定されていません。");
  if (!Number.isFinite(options.directionDeg)) errors.push("中心方向を確定できません。キャンバス上で方向を指定してください。");
  const arcDeg = options.halfSpanDeg * 2;
  if (!Number.isFinite(arcDeg) || arcDeg < CHAIR_ARC_MIN_ARC_DEG || arcDeg > CHAIR_ARC_MAX_ARC_DEG) {
    errors.push(`円弧角は${CHAIR_ARC_MIN_ARC_DEG}度以上${CHAIR_ARC_MAX_ARC_DEG}度以下で指定してください。`);
  }
  if (!isPositiveFinite(options.firstGapMm)) errors.push("1列目空き距離は0より大きい数値で指定してください。");
  if (!isPositiveFinite(options.rowGapMm)) errors.push("列間隔は0より大きい数値で指定してください。");
  if (options.rows.length < CHAIR_ARC_MIN_ROWS || options.rows.length > CHAIR_ARC_MAX_ROWS) {
    errors.push(`列数は${CHAIR_ARC_MIN_ROWS}〜${CHAIR_ARC_MAX_ROWS}で指定してください。`);
  }
  const hasInvalidCount = options.rows.some((row) => {
    const count = Math.floor(row.chairCount);
    return !Number.isFinite(count) || count < CHAIR_ARC_MIN_CHAIRS_PER_ROW || count > CHAIR_ARC_MAX_CHAIRS_PER_ROW;
  });
  if (hasInvalidCount) {
    errors.push(`各列の椅子数は${CHAIR_ARC_MIN_CHAIRS_PER_ROW}〜${CHAIR_ARC_MAX_CHAIRS_PER_ROW}で指定してください。`);
  }
  return errors;
}

/** 全列・全脚のmm座標。入力が不正、または結果に非有限値が混ざる場合は空配列を返す。 */
export function createChairArcRowPlacements(
  podium: Pick<SceneObject, "xMm" | "yMm" | "widthMm" | "depthMm" | "rotationDeg">,
  chairTemplate: Pick<SceneObject, "widthMm" | "depthMm" | "rotationDeg">,
  options: ChairArcRowsOptions,
): ChairArcPlacement[] {
  if (validateChairArcRowsOptions(options).length > 0) return [];
  const podiumValues = [podium.xMm, podium.yMm, podium.widthMm, podium.depthMm, podium.rotationDeg];
  if (!podiumValues.every((value) => Number.isFinite(value))) return [];
  const chairRadiusMm = chairArcChairRadiusMm(chairTemplate);
  if (!isPositiveFinite(chairRadiusMm)) return [];

  const firstRowRadiusMm = chairArcFirstRowRadiusMm(podium, chairTemplate, options);
  if (!isPositiveFinite(firstRowRadiusMm)) return [];
  const rotationDeg = normalizeDeg(Number.isFinite(chairTemplate.rotationDeg) ? chairTemplate.rotationDeg : 0);

  const placements: ChairArcPlacement[] = [];
  options.rows.forEach((row, rowIndex) => {
    const radiusMm = chairArcRowRadiusMm(firstRowRadiusMm, rowIndex, options.rowGapMm);
    chairArcRowAnglesDeg(row.chairCount, options.directionDeg, options.halfSpanDeg).forEach((angleDeg, chairIndex) => {
      const angleRad = toRadians(angleDeg);
      placements.push({
        rowIndex,
        chairIndex,
        xMm: podium.xMm + Math.cos(angleRad) * radiusMm,
        yMm: podium.yMm + Math.sin(angleRad) * radiusMm,
        rotationDeg,
        angleDeg,
        radiusMm,
      });
    });
  });

  const finite = placements.every((placement) => Number.isFinite(placement.xMm) && Number.isFinite(placement.yMm));
  return finite ? placements : [];
}

/**
 * 標準椅子を生成し、必要なら各椅子の前に譜面台も生成する。
 * いずれも配置座標・寸法・角度はmmのSceneObjectへ確定時に書き込む(FR-064-19/20)。
 */
export function createChairArcRowObjects(
  podium: Pick<SceneObject, "xMm" | "yMm" | "widthMm" | "depthMm" | "rotationDeg">,
  chairTemplate: SceneObject,
  options: ChairArcRowsOptions,
  idFactory: ChairArcIdFactory = (placement) => `chair-arc-r${placement.rowIndex + 1}-c${placement.chairIndex + 1}`,
  standTemplate?: SceneObject,
  standIdFactory: ChairArcMusicStandIdFactory = (placement) => `chair-arc-stand-r${placement.rowIndex + 1}-c${placement.chairIndex + 1}`,
): SceneObject[] {
  const placements = createChairArcRowPlacements(podium, chairTemplate, options);
  const objects: SceneObject[] = [];
  placements.forEach((placement, index) => {
    objects.push(cloneForPlacement(
      chairTemplate,
      idFactory(placement),
      placement.xMm,
      placement.yMm,
      placement.rotationDeg,
      options.layerId,
      chairTemplate.zIndex + index,
    ));
    if (options.includeMusicStands && standTemplate) {
      const standPlacement = chairArcMusicStandPlacement(placement, chairTemplate, standTemplate);
      objects.push(cloneForPlacement(
        standTemplate,
        standIdFactory(placement),
        standPlacement.xMm,
        standPlacement.yMm,
        standPlacement.rotationDeg,
        options.layerId,
        chairTemplate.zIndex + placements.length + index,
      ));
    }
  });
  return objects;
}

/**
 * 生成椅子同士の重なり(9.1)。中心間距離が半径合計未満のときだけ重なりとし、
 * 接触(距離=半径合計)は重なりに含めない。
 */
export function detectChairArcOverlaps(
  placements: readonly ChairArcPlacement[],
  chairRadiusMm: number,
): ChairArcOverlap[] {
  const limitMm = chairRadiusMm * 2;
  const overlaps: ChairArcOverlap[] = [];
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];
      const distanceMm = Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
      if (distanceMm + CHAIR_ARC_TOUCH_EPSILON_MM < limitMm) {
        overlaps.push({
          a: { rowIndex: a.rowIndex, chairIndex: a.chairIndex },
          b: { rowIndex: b.rowIndex, chairIndex: b.chairIndex },
          distanceMm,
        });
      }
    }
  }
  return overlaps;
}

/**
 * 既存オブジェクトとの重なり(9.2)。生成椅子の円外形と、既存オブジェクトの
 * 回転後外接矩形との交差で判定する。注釈は判定対象にしない。
 */
export function detectChairArcObjectOverlaps(
  placements: readonly ChairArcPlacement[],
  chairRadiusMm: number,
  objects: readonly SceneObject[],
): ChairArcObjectOverlap[] {
  const targets = objects.filter((object) => !object.annotationKind);
  const overlaps: ChairArcObjectOverlap[] = [];
  for (const placement of placements) {
    for (const object of targets) {
      const bounds = rotatedBoundsMm(object);
      const nearestX = Math.min(Math.max(placement.xMm, bounds.minXMm), bounds.maxXMm);
      const nearestY = Math.min(Math.max(placement.yMm, bounds.minYMm), bounds.maxYMm);
      const distanceMm = Math.hypot(placement.xMm - nearestX, placement.yMm - nearestY);
      if (distanceMm + CHAIR_ARC_TOUCH_EPSILON_MM < chairRadiusMm) {
        overlaps.push({ placement: { rowIndex: placement.rowIndex, chairIndex: placement.chairIndex }, objectId: object.id });
      }
    }
  }
  return overlaps;
}

/**
 * 舞台外警告(9.3)。明示的な有効舞台範囲としてstageFront(舞台前端)が設定されている
 * 場合だけ判定する。背景画像の外周は舞台境界とみなさない。客席側はyMmが小さい方。
 */
export function detectChairArcOffStagePlacements(
  placements: readonly ChairArcPlacement[],
  chairRadiusMm: number,
  stageFront: Project["stageFront"],
): ChairArcPlacementRef[] {
  if (!stageFront || !Number.isFinite(stageFront.yMm)) return [];
  return placements
    .filter((placement) => placement.yMm - chairRadiusMm < stageFront.yMm)
    .map((placement) => ({ rowIndex: placement.rowIndex, chairIndex: placement.chairIndex }));
}

/**
 * 起動条件(6.1)を満たさない理由。満たしていればnull。
 * ボタンの活性判定と通知文を1か所へ集約し、UIへ条件を散らさない。
 */
export function chairArcLaunchIssue(
  project: Pick<Project, "calibration" | "objects" | "layers">,
  selectedIds: readonly string[],
  activeLayerId: string,
): string | null {
  if (project.calibration.mmPerPixel === null) return "校正後に利用できます。";
  if (selectedIds.length !== 1) return "指揮台を1台選択してください。";
  const podium = project.objects.find((object) => object.id === selectedIds[0]);
  if (!podium || podium.type !== "podium") return "指揮台を1台選択してください。";
  const podiumLayer = project.layers.find((layer) => layer.id === podium.layerId);
  if (!podium.visible || podiumLayer?.visible === false) return "選択中の指揮台が非表示です。";
  const targetLayer = project.layers.find((layer) => layer.id === activeLayerId);
  if (!targetLayer) return "配置先レイヤーが見つかりません。";
  if (targetLayer.locked) return "配置先レイヤーがロックされています。";
  if (!targetLayer.visible) return "配置先レイヤーが非表示です。";
  return null;
}

/** 起動時の初期セッション。既定は1列目6脚・2列目8脚、1間、半間。 */
export function createChairArcSession(podium: SceneObject, layerId: string): ChairArcSession {
  return {
    options: {
      podiumId: podium.id,
      directionDeg: defaultChairArcDirectionDeg(podium),
      halfSpanDeg: CHAIR_ARC_DEFAULT_HALF_SPAN_DEG,
      firstGapMm: CHAIR_ARC_DEFAULT_FIRST_GAP_MM,
      rowGapMm: CHAIR_ARC_DEFAULT_ROW_GAP_MM,
      rows: CHAIR_ARC_DEFAULT_ROW_CHAIR_COUNTS.map((chairCount) => ({ chairCount })),
      layerId,
    },
    pickingDirection: false,
  };
}
