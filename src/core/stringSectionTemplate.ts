// 弦楽器テンプレ配置(FR-062)のUI向け層。
//
// 配置計算そのものは持たない。型ごとの固定アンカーと純粋関数は
// `stringLayout12.ts`にあり、プレビューと確定配置はどちらもそれだけを通る。
// ここでは確定前セッション、配置オプションの組み立て、起動条件、警告を扱う。
//
// 編成型は8/10/12/14/16型のすべてを選択できる。人数は`STRING_LAYOUT_PLAYER_COUNTS`
// を正本として参照し、この層では持たない。

import type { PointMm, Project, SceneObject } from "../types/project";
import { isProjectReadyForPlacement, stageTemplateBoundsMm } from "./stageTemplate";
import { sceneObjectBoundsMm } from "./transform";
import {
  STRING_ENSEMBLE_DEFAULT_TYPE_ID,
  STRING_ENSEMBLE_TYPE_IDS,
  STRING_SEATING_DEFAULT_VARIANT_ID,
  STRING_LAYOUT_12_CHAIR_SPACING_MM,
  STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM,
  STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM,
  STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
  STRING_LAYOUT_12_DEFAULT_LATERAL_OFFSET_MM,
  STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
  STRING_LAYOUT_12_DEFAULT_SPREAD_SCALE,
  STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM,
  STRING_LAYOUT_PLAYER_COUNTS,
  type StringEnsembleTypeId,
  type StringLayout12Options,
  type StringSeatingVariantId,
  type StringLayout12Section,
} from "./stringLayout12";

// 配置計算の入口をこのモジュール経由でも参照できるようにする。
export * from "./stringLayout12";

export type StringPartId = StringLayout12Section;

// ---------------------------------------------------------------------------
// 編成型プリセット(表示用)
// ---------------------------------------------------------------------------

export type EnsemblePresetId = StringEnsembleTypeId;

export interface EnsemblePreset {
  id: EnsemblePresetId;
  label: string;
  counts: Readonly<Record<StringLayout12Section, number>>;
  /** 選択できるか。すべての型が固定アンカーを持つので常にtrue。 */
  available: boolean;
}

/**
 * 編成型。人数は`STRING_LAYOUT_PLAYER_COUNTS`(固定テンプレートの正本)を参照し、
 * ここでは重複して持たない。
 */
export const STRING_ENSEMBLE_PRESETS: readonly EnsemblePreset[] = STRING_ENSEMBLE_TYPE_IDS.map((id) => ({
  id,
  label: id === STRING_ENSEMBLE_DEFAULT_TYPE_ID ? `${id}型標準配置` : `${id}型`,
  counts: STRING_LAYOUT_PLAYER_COUNTS[id],
  available: true,
}));

/** 初期選択の編成型。 */
export const STRING_ENSEMBLE_ACTIVE_PRESET_ID: EnsemblePresetId = STRING_ENSEMBLE_DEFAULT_TYPE_ID;

// ---------------------------------------------------------------------------
// 起動条件
// ---------------------------------------------------------------------------

/** 起動条件を満たさない理由。満たしていればnull。 */
export function stringSectionTemplateLaunchIssue(
  project: Pick<Project, "calibration" | "layers" | "stageTemplate">,
  activeLayerId: string,
): string | null {
  if (!isProjectReadyForPlacement(project)) return "校正後に利用できます。";
  const layer = project.layers.find((candidate) => candidate.id === activeLayerId);
  if (!layer) return "配置先レイヤーが見つかりません。";
  if (!layer.visible) return "配置先レイヤーが非表示です。";
  if (layer.locked) return "配置先レイヤーがロックされています。";
  return null;
}

// ---------------------------------------------------------------------------
// 確定前セッション
// ---------------------------------------------------------------------------

/** 確定前の一時UI状態。Project・履歴・自動保存へは入れない。 */
export interface StringSectionTemplateSession {
  /** 選択中の配置バリエーション。 */
  seatingVariantId: StringSeatingVariantId;
  /** 選択中の編成型。 */
  ensembleTypeId: StringEnsembleTypeId;
  /** 配置基準。 */
  basis: "podium" | "coordinate";
  /** 基準にする指揮台のID。basisが"coordinate"のときは参照しない。 */
  podiumId: string | null;
  /** 座標指定時の指揮者位置。 */
  conductor: PointMm;
  lateralOffsetMm: number;
  depthOffsetMm: number;
  spreadScale: number;
  /** 指揮台中心から1列目までの距離。キャンバスの1列目補助線ドラッグでも変わる。 */
  firstRowRadiusMm: number;
  /** 隣り合う列の間隔。キャンバスの2列目以降の補助線ドラッグでも変わる。 */
  rowGapMm: number;
  layerId: string;
}

/** 舞台前端が設定済みのとき、指揮者位置をどれだけ舞台奥へ入れるか。 */
export const STRING_TEMPLATE_CONDUCTOR_STAGE_FRONT_OFFSET_MM = 900;
/** 背景も舞台前端もない場合の指揮者位置Y初期値。 */
export const STRING_TEMPLATE_DEFAULT_CONDUCTOR_Y_MM = 8000;
/** 背景高さから指揮者位置Yを決めるときの比率(客席寄り)。 */
export const STRING_TEMPLATE_CONDUCTOR_BACKGROUND_RATIO = 0.8;
/** オブジェクト数警告のしきい値。 */
export const STRING_TEMPLATE_OBJECT_COUNT_WARNING = 500;

/**
 * 起動時の初期セッション。
 * 舞台奥が画面上(Y負方向)なので、指揮者位置Yは舞台前端から舞台奥へ入った値、
 * または背景の下寄りにする。ここから上方向へ弦が展開される。
 * stageFrontは指揮者位置Yの初期値算出にだけ使い、舞台奥方向の判定には使わない。
 */
export function createStringSectionTemplateSession(input: {
  selectedPodium: Pick<SceneObject, "id" | "xMm" | "yMm"> | null;
  backgroundWidthMm: number;
  backgroundHeightMm: number;
  stageFrontYMm: number | null;
  layerId: string;
}): StringSectionTemplateSession {
  const conductorXMm = input.backgroundWidthMm > 0 ? Math.round(input.backgroundWidthMm / 2) : 5000;
  const conductorYMm = input.stageFrontYMm !== null && Number.isFinite(input.stageFrontYMm)
    ? Math.round(input.stageFrontYMm - STRING_TEMPLATE_CONDUCTOR_STAGE_FRONT_OFFSET_MM)
    : input.backgroundHeightMm > 0
      ? Math.round(input.backgroundHeightMm * STRING_TEMPLATE_CONDUCTOR_BACKGROUND_RATIO)
      : STRING_TEMPLATE_DEFAULT_CONDUCTOR_Y_MM;
  return {
    seatingVariantId: STRING_SEATING_DEFAULT_VARIANT_ID,
    ensembleTypeId: STRING_ENSEMBLE_DEFAULT_TYPE_ID,
    basis: input.selectedPodium ? "podium" : "coordinate",
    podiumId: input.selectedPodium?.id ?? null,
    conductor: input.selectedPodium
      ? { xMm: Math.round(input.selectedPodium.xMm), yMm: Math.round(input.selectedPodium.yMm) }
      : { xMm: conductorXMm, yMm: conductorYMm },
    lateralOffsetMm: STRING_LAYOUT_12_DEFAULT_LATERAL_OFFSET_MM,
    depthOffsetMm: STRING_LAYOUT_12_DEFAULT_DEPTH_OFFSET_MM,
    spreadScale: STRING_LAYOUT_12_DEFAULT_SPREAD_SCALE,
    firstRowRadiusMm: STRING_LAYOUT_12_DEFAULT_FIRST_ROW_RADIUS_MM,
    rowGapMm: STRING_LAYOUT_12_DEFAULT_ROW_GAP_MM,
    layerId: input.layerId,
  };
}

/**
 * セッションと基準指揮台から配置オプションを組み立てる。
 * 内部固定値はここで一元的に与え、UIへ散らさない。
 * プレビューと確定生成は同じこのオプションを使うため、座標・角度が一致する。
 */
export function stringSectionTemplateOptionsFromSession(
  session: StringSectionTemplateSession,
  podium: Pick<SceneObject, "xMm" | "yMm"> | null,
): StringLayout12Options {
  const usePodium = session.basis === "podium" && podium !== null;
  return {
    seatingVariantId: session.seatingVariantId,
    ensembleTypeId: session.ensembleTypeId,
    conductor: usePodium && podium ? { xMm: podium.xMm, yMm: podium.yMm } : { ...session.conductor },
    lateralOffsetMm: session.lateralOffsetMm,
    depthOffsetMm: session.depthOffsetMm,
    spreadScale: session.spreadScale,
    firstRowRadiusMm: session.firstRowRadiusMm,
    rowGapMm: session.rowGapMm,
    chairCenterSpacingMm: STRING_LAYOUT_12_CHAIR_SPACING_MM,
    contrabassSeatSpacingMm: STRING_LAYOUT_12_CONTRABASS_SEAT_SPACING_MM,
    standForwardOffsetMm: STRING_LAYOUT_12_STAND_FORWARD_OFFSET_MM,
    layerId: session.layerId,
  };
}

// ---------------------------------------------------------------------------
// 警告
// ---------------------------------------------------------------------------

export type StringTemplateWarningKind = "outOfBackground" | "objectCount";

export interface StringTemplateWarning {
  kind: StringTemplateWarningKind;
  message: string;
}

export interface StringTemplateBackgroundBounds {
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
}

/** 校正済み背景の実寸範囲。未校正・背景なしはnull。 */
export function stringTemplateBackgroundBoundsMm(
  project: Pick<Project, "background" | "calibration" | "stageTemplate">,
  displaySizePx: { widthPx: number; heightPx: number },
): StringTemplateBackgroundBounds | null {
  const templateBounds = stageTemplateBoundsMm(project.stageTemplate);
  if (templateBounds) return templateBounds;
  const mmPerPixel = project.calibration.mmPerPixel;
  if (mmPerPixel === null || !project.background.imageDataUrl) return null;
  if (displaySizePx.widthPx <= 0 || displaySizePx.heightPx <= 0) return null;
  return {
    minXMm: 0,
    minYMm: 0,
    maxXMm: displaySizePx.widthPx * mmPerPixel,
    maxYMm: displaySizePx.heightPx * mmPerPixel,
  };
}

/**
 * 配置範囲・オブジェクト数の警告。警告状態でも配置は可能。
 * 固定テンプレートなので間隔不足の警告は持たない。
 */
export function stringTemplateWarnings(
  objects: readonly SceneObject[],
  backgroundBounds: StringTemplateBackgroundBounds | null,
  existingObjectCount: number,
): StringTemplateWarning[] {
  const warnings: StringTemplateWarning[] = [];
  if (objects.length > 0 && backgroundBounds) {
    const bounds = objects.reduce(
      (result, object) => {
        const objectBounds = sceneObjectBoundsMm(object);
        return {
          minXMm: Math.min(result.minXMm, objectBounds.minXMm),
          minYMm: Math.min(result.minYMm, objectBounds.minYMm),
          maxXMm: Math.max(result.maxXMm, objectBounds.maxXMm),
          maxYMm: Math.max(result.maxYMm, objectBounds.maxYMm),
        };
      },
      { minXMm: Infinity, minYMm: Infinity, maxXMm: -Infinity, maxYMm: -Infinity },
    );
    const outside = bounds.minXMm < backgroundBounds.minXMm
      || bounds.minYMm < backgroundBounds.minYMm
      || bounds.maxXMm > backgroundBounds.maxXMm
      || bounds.maxYMm > backgroundBounds.maxYMm;
    if (outside) {
      warnings.push({ kind: "outOfBackground", message: "配置の一部が背景図面の範囲外にはみ出します。配置後に調整してください。" });
    }
  }
  if (existingObjectCount + objects.length > STRING_TEMPLATE_OBJECT_COUNT_WARNING) {
    warnings.push({ kind: "objectCount", message: "配置後のオブジェクト数が500を超えます。端末によっては操作が重くなる可能性があります。" });
  }
  return warnings;
}
