// 左右対称配置と基準点回転の純粋関数。
// ここではmm座標とrotationDegだけを扱い、SVGの反転や描画固有の状態は扱わない。

import type { PointMm, Project, SceneObject } from "../types/project";
import { stageTemplateBoundsMm } from "./stageTemplate";
import { getBackgroundDisplaySizePx, normalizeDeg } from "./transform";

export type OrientationIdFactory = (prefix: string) => string;

/** 浮動小数点誤差で中心線上のオブジェクトを複製しないための許容値(mm)。 */
export const CENTERLINE_EPSILON_MM = 0.000001;

/** 点を垂直な基準線(x=axisXMm)に対して鏡映する。 */
export function mirrorPointAcrossVerticalAxis(point: PointMm, axisXMm: number): PointMm {
  return { xMm: axisXMm * 2 - point.xMm, yMm: point.yMm };
}

/**
 * 既存シンボルを反転描画せず、正面方向だけを鏡映する角度。
 * rotationDeg=0は画面上方を向くため、垂直軸反転は -rotationDeg になる。
 */
export function mirroredRotationDeg(rotationDeg: number): number {
  return normalizeDeg(-rotationDeg);
}

/** オブジェクト中心から基準点へ向くrotationDeg。正面はローカル上方向(-Y)。 */
export function rotationDegTowardPoint(origin: PointMm, target: PointMm): number | null {
  const dx = target.xMm - origin.xMm;
  const dy = target.yMm - origin.yMm;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) <= CENTERLINE_EPSILON_MM) return null;
  return normalizeDeg((Math.atan2(dy, dx) * 180) / Math.PI + 90);
}

/** 背景図面の実寸幅から舞台中心線のX座標を求める。未校正・背景なしではnull。 */
export function stageCenterXMm(
  project: Pick<Project, "background" | "calibration" | "stageTemplate">,
): number | null {
  const templateBounds = stageTemplateBoundsMm(project.stageTemplate);
  if (templateBounds) return templateBounds.maxXMm / 2;
  const mmPerPixel = project.calibration.mmPerPixel;
  if (!project.background.imageDataUrl || !Number.isFinite(mmPerPixel) || (mmPerPixel ?? 0) <= 0) return null;
  const displaySize = getBackgroundDisplaySizePx(project.background);
  if (!Number.isFinite(displaySize.widthPx) || displaySize.widthPx <= 0) return null;
  return (displaySize.widthPx * (mmPerPixel as number)) / 2;
}

function cloneObjectStyle(object: SceneObject): Pick<SceneObject, "style"> {
  return object.style ? { style: { ...object.style } } : {};
}

/**
 * 選択範囲を垂直軸に対して複製する。ロック中・中心線上のオブジェクトは除外し、
 * 選択範囲内のobjectId/groupId/onRiserIdだけを生成物側のIDへ置き換える。
 */
export function createMirroredObjects(
  objects: readonly SceneObject[],
  selectedIds: readonly string[],
  axisXMm: number,
  idFactory: OrientationIdFactory,
  baseZIndex: number,
): SceneObject[] {
  if (!Number.isFinite(axisXMm)) return [];
  const selectedIdSet = new Set(selectedIds);
  const sources = objects.filter((object) =>
    selectedIdSet.has(object.id)
      && !object.locked
      && !object.backgroundFixed
      && Math.abs(object.xMm - axisXMm) > CENTERLINE_EPSILON_MM,
  );
  if (sources.length === 0) return [];

  const idMap = new Map<string, string>(sources.map((source) => [source.id, idFactory("mirror-obj")]));
  const groupIdMap = new Map<string, string>();
  for (const source of sources) {
    if (source.groupId && !groupIdMap.has(source.groupId)) {
      groupIdMap.set(source.groupId, idFactory("mirror-group"));
    }
  }

  return sources.map((source, index) => {
    const mirroredPosition = mirrorPointAcrossVerticalAxis({ xMm: source.xMm, yMm: source.yMm }, axisXMm);
    return {
      ...source,
      ...cloneObjectStyle(source),
      id: idMap.get(source.id) as string,
      xMm: mirroredPosition.xMm,
      yMm: mirroredPosition.yMm,
      endXMm: typeof source.endXMm === "number" ? mirrorPointAcrossVerticalAxis({ xMm: source.endXMm, yMm: 0 }, axisXMm).xMm : source.endXMm,
      endYMm: source.endYMm,
      rotationDeg: mirroredRotationDeg(source.rotationDeg),
      onRiserId: source.onRiserId ? idMap.get(source.onRiserId) ?? source.onRiserId : null,
      groupId: source.groupId ? groupIdMap.get(source.groupId) ?? null : null,
      locked: false,
      zIndex: baseZIndex + index,
    };
  });
}

function updateRotation(
  objects: readonly SceneObject[],
  selectedIds: readonly string[],
  rotationForObject: (object: SceneObject) => number | null,
): SceneObject[] {
  const selectedIdSet = new Set(selectedIds);
  return objects.map((object) => {
    if (!selectedIdSet.has(object.id) || object.locked || object.backgroundFixed) return object;
    const rotationDeg = rotationForObject(object);
    return rotationDeg === null || !Number.isFinite(rotationDeg)
      ? object
      : { ...object, rotationDeg: normalizeDeg(rotationDeg) };
  });
}

/** 選択物の位置・寸法を変えず、各中心から同じ基準点へ向ける。 */
export function rotateObjectsTowardPoint(
  objects: readonly SceneObject[],
  selectedIds: readonly string[],
  target: PointMm,
): SceneObject[] {
  if (!Number.isFinite(target.xMm) || !Number.isFinite(target.yMm)) return [...objects];
  return updateRotation(objects, selectedIds, (object) => rotationDegTowardPoint(object, target));
}

/** 選択物の角度を同じ値へ統一する。 */
export function setObjectsRotation(
  objects: readonly SceneObject[],
  selectedIds: readonly string[],
  rotationDeg: number,
): SceneObject[] {
  if (!Number.isFinite(rotationDeg)) return [...objects];
  return updateRotation(objects, selectedIds, () => rotationDeg);
}

/** 選択物の角度へ同じ差分を加える。 */
export function rotateObjectsByDelta(
  objects: readonly SceneObject[],
  selectedIds: readonly string[],
  deltaDeg: number,
): SceneObject[] {
  if (!Number.isFinite(deltaDeg)) return [...objects];
  return updateRotation(objects, selectedIds, (object) => object.rotationDeg + deltaDeg);
}
