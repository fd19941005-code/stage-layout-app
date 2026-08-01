// 複数オブジェクトの整列・等間隔配置(FR-057、FR-058)。
// mm座標だけを操作する純粋関数として分離し、Undo/Redoからも一操作として扱う。

import type { PointMm, SceneObject } from "../types/project";
import { sceneObjectBoundsMm } from "./transform";

export type Alignment = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
export type DistributionAxis = "x" | "y";

function selectedObjects(objects: readonly SceneObject[], ids: readonly string[]): SceneObject[] {
  const wanted = new Set(ids);
  return objects.filter((object) => wanted.has(object.id));
}

function replaceObjects(
  objects: readonly SceneObject[],
  updates: ReadonlyMap<string, Partial<SceneObject>>,
): SceneObject[] {
  return objects.map((object) => {
    const patch = updates.get(object.id);
    return patch ? { ...object, ...patch } : object;
  });
}

/** Return the shared mm rectangle used by marquee rendering and selection commit. */
export function marqueeBoundsMm(start: PointMm, current: PointMm) {
  return {
    minXMm: Math.min(start.xMm, current.xMm),
    minYMm: Math.min(start.yMm, current.yMm),
    maxXMm: Math.max(start.xMm, current.xMm),
    maxYMm: Math.max(start.yMm, current.yMm),
  };
}

export type BoundsMm = {
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
};

/** 範囲選択の枠と配置物の外接矩形が少しでも重なるかを判定する。辺の接触も含める。 */
export function boundsIntersectMm(a: BoundsMm, b: BoundsMm): boolean {
  return a.minXMm <= b.maxXMm
    && a.maxXMm >= b.minXMm
    && a.minYMm <= b.maxYMm
    && a.maxYMm >= b.minYMm;
}

export function selectionBoundsMm(objects: readonly SceneObject[], ids: readonly string[]) {
  const selected = selectedObjects(objects, ids);
  if (selected.length === 0) return null;
  const bounds = selected.map(sceneObjectBoundsMm);
  return {
    minXMm: Math.min(...bounds.map((bound) => bound.minXMm)),
    minYMm: Math.min(...bounds.map((bound) => bound.minYMm)),
    maxXMm: Math.max(...bounds.map((bound) => bound.maxXMm)),
    maxYMm: Math.max(...bounds.map((bound) => bound.maxYMm)),
  };
}

/** 選択物の外接矩形の辺または中心を揃える */
export function alignObjects(
  objects: readonly SceneObject[],
  ids: readonly string[],
  alignment: Alignment,
): SceneObject[] {
  const selected = selectedObjects(objects, ids);
  if (selected.length < 2) return [...objects];
  const bounds = selected.map((object) => ({ object, bounds: sceneObjectBoundsMm(object) }));
  const target = (() => {
    switch (alignment) {
      case "left":
        return Math.min(...bounds.map(({ bounds: value }) => value.minXMm));
      case "centerX":
        return bounds.reduce((sum, { object }) => sum + object.xMm, 0) / bounds.length;
      case "right":
        return Math.max(...bounds.map(({ bounds: value }) => value.maxXMm));
      case "top":
        return Math.min(...bounds.map(({ bounds: value }) => value.minYMm));
      case "centerY":
        return bounds.reduce((sum, { object }) => sum + object.yMm, 0) / bounds.length;
      case "bottom":
        return Math.max(...bounds.map(({ bounds: value }) => value.maxYMm));
    }
  })();

  const updates = new Map<string, Partial<SceneObject>>();
  for (const { object, bounds: value } of bounds) {
    if (object.locked || object.backgroundFixed) continue;
    if (alignment === "left") updates.set(object.id, { xMm: object.xMm + target - value.minXMm });
    if (alignment === "centerX") updates.set(object.id, { xMm: target });
    if (alignment === "right") updates.set(object.id, { xMm: object.xMm + target - value.maxXMm });
    if (alignment === "top") updates.set(object.id, { yMm: object.yMm + target - value.minYMm });
    if (alignment === "centerY") updates.set(object.id, { yMm: target });
    if (alignment === "bottom") updates.set(object.id, { yMm: object.yMm + target - value.maxYMm });
  }
  return replaceObjects(objects, updates);
}

/** 選択物の中心を最初と最後の中心の間へ等間隔に置く */
export function distributeObjects(
  objects: readonly SceneObject[],
  ids: readonly string[],
  axis: DistributionAxis,
): SceneObject[] {
  const selected = selectedObjects(objects, ids);
  if (selected.length < 3) return [...objects];
  const sorted = [...selected].sort((a, b) =>
    axis === "x" ? a.xMm - b.xMm : a.yMm - b.yMm,
  );
  const first = axis === "x" ? sorted[0].xMm : sorted[0].yMm;
  const last = axis === "x" ? sorted[sorted.length - 1].xMm : sorted[sorted.length - 1].yMm;
  const step = (last - first) / (sorted.length - 1);
  const updates = new Map<string, Partial<SceneObject>>();
  sorted.forEach((object, index) => {
    if (object.locked || object.backgroundFixed || index === 0 || index === sorted.length - 1) return;
    const position = first + step * index;
    updates.set(object.id, axis === "x" ? { xMm: position } : { yMm: position });
  });
  return replaceObjects(objects, updates);
}



export interface LineArrangementOptions {
  axis: DistributionAxis;
  gapMm: number;
}

export interface SelectionUnit {
  objectIds: string[];
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
}

/** グループは内部配置を保ったまま、一直線配置の1単位として扱う。 */
export function selectionUnits(objects: readonly SceneObject[], ids: readonly string[]): SelectionUnit[] {
  const wanted = new Set(ids);
  const groupIds = new Set(objects.filter((object) => wanted.has(object.id) && object.groupId).map((object) => object.groupId as string));
  const units: SelectionUnit[] = [];
  const seenGroups = new Set<string>();
  for (const object of objects) {
    const belongsToGroup = object.groupId !== null && groupIds.has(object.groupId);
    if (belongsToGroup) {
      if (seenGroups.has(object.groupId as string)) continue;
      seenGroups.add(object.groupId as string);
      const members = objects.filter((candidate) => candidate.groupId === object.groupId);
      const bounds = members.map(sceneObjectBoundsMm);
      units.push({
        objectIds: members.map((member) => member.id),
        minXMm: Math.min(...bounds.map((bound) => bound.minXMm)),
        minYMm: Math.min(...bounds.map((bound) => bound.minYMm)),
        maxXMm: Math.max(...bounds.map((bound) => bound.maxXMm)),
        maxYMm: Math.max(...bounds.map((bound) => bound.maxYMm)),
      });
      continue;
    }
    if (!object.groupId && wanted.has(object.id)) {
      const bounds = sceneObjectBoundsMm(object);
      units.push({ objectIds: [object.id], ...bounds });
    }
  }
  return units;
}

export function moveSelectionIds(objects: readonly SceneObject[], selectedIds: readonly string[], activeObjectId: string): string[] {
  const baseIds = selectedIds.includes(activeObjectId) ? selectedIds : [activeObjectId];
  // 背景化物・ロック物が混ざっていても、移動可能な物だけを動かす。
  // これにより、固定済みの山台が選択集合に残った場合でも、椅子などの操作を妨げない。
  return [...new Set(selectionUnits(objects, baseIds).flatMap((unit) => unit.objectIds))]
    .filter((id) => {
      const object = objects.find((candidate) => candidate.id === id);
      return Boolean(object && !object.locked && !object.backgroundFixed);
    });
}

function unitCrossAnchor(unit: SelectionUnit, objects: readonly SceneObject[], axis: DistributionAxis): number {
  if (unit.objectIds.length === 1) {
    const object = objects.find((candidate) => candidate.id === unit.objectIds[0]);
    if (object) return axis === "x" ? object.yMm : object.xMm;
  }
  return axis === "x" ? (unit.minYMm + unit.maxYMm) / 2 : (unit.minXMm + unit.maxXMm) / 2;
}
function translateObject(object: SceneObject, dxMm: number, dyMm: number): Partial<SceneObject> {
  return {
    xMm: object.xMm + dxMm,
    yMm: object.yMm + dyMm,
    endXMm: typeof object.endXMm === "number" ? object.endXMm + dxMm : object.endXMm,
    endYMm: typeof object.endYMm === "number" ? object.endYMm + dyMm : object.endYMm,
  };
}

export function validateLineArrangement(objects: readonly SceneObject[], ids: readonly string[], options: LineArrangementOptions): string[] {
  const issues: string[] = [];
  if (!Number.isFinite(options.gapMm) || options.gapMm < 0) issues.push("間隔は0mm以上の数値で指定してください。");
  if (selectionUnits(objects, ids).length < 2) issues.push("2つ以上のオブジェクトを選択してください。");
  return issues;
}

/** 外形同士の間隔を正確に保った一直線配置。寸法・回転・グループ内部の相対位置は変更しない。 */
export function arrangeObjectsInLine(
  objects: readonly SceneObject[],
  ids: readonly string[],
  options: LineArrangementOptions,
): SceneObject[] {
  if (validateLineArrangement(objects, ids, options).length > 0) return [...objects];
  const units = selectionUnits(objects, ids).sort((a, b) => options.axis === "x" ? a.minXMm - b.minXMm : a.minYMm - b.minYMm);
  const first = units[0];
  if (!first) return [...objects];
  const crossTarget = unitCrossAnchor(first, objects, options.axis);
  let leadingEdge = options.axis === "x" ? first.minXMm : first.minYMm;
  const updates = new Map<string, Partial<SceneObject>>();
  for (const unit of units) {
    const unitCross = unitCrossAnchor(unit, objects, options.axis);
    const unitLeading = options.axis === "x" ? unit.minXMm : unit.minYMm;
    const unitTrailing = options.axis === "x" ? unit.maxXMm : unit.maxYMm;
    const axisDelta = leadingEdge - unitLeading;
    const crossDelta = crossTarget - unitCross;
    for (const objectId of unit.objectIds) {
      const object = objects.find((candidate) => candidate.id === objectId);
      if (object) updates.set(objectId, translateObject(object, options.axis === "x" ? axisDelta : crossDelta, options.axis === "x" ? crossDelta : axisDelta));
    }
    leadingEdge += unitTrailing - unitLeading + options.gapMm;
  }
  return replaceObjects(objects, updates);
}

export function lineArrangementGuide(objects: readonly SceneObject[], ids: readonly string[], axis: DistributionAxis) {
  const units = selectionUnits(objects, ids).sort((a, b) => axis === "x" ? a.minXMm - b.minXMm : a.minYMm - b.minYMm);
  const first = units[0];
  const last = units[units.length - 1];
  if (!first || !last || units.length < 2) return null;
  const cross = unitCrossAnchor(first, objects, axis);
  return axis === "x"
    ? { startXMm: first.minXMm, endXMm: last.maxXMm, lineYMm: cross, handleXMm: last.maxXMm, handleYMm: cross }
    : { startYMm: first.minYMm, endYMm: last.maxYMm, lineXMm: cross, handleXMm: cross, handleYMm: last.maxYMm };
}

export function lineArrangementGapFromPointer(objects: readonly SceneObject[], ids: readonly string[], axis: DistributionAxis, pointerMm: { xMm: number; yMm: number }): number | null {
  const units = selectionUnits(objects, ids).sort((a, b) => axis === "x" ? a.minXMm - b.minXMm : a.minYMm - b.minYMm);
  if (units.length < 2) return null;
  const first = units[0];
  const axisPointer = axis === "x" ? pointerMm.xMm : pointerMm.yMm;
  const firstLeading = axis === "x" ? first.minXMm : first.minYMm;
  const totalSpan = units.reduce((sum, unit) => sum + ((axis === "x" ? unit.maxXMm - unit.minXMm : unit.maxYMm - unit.minYMm)), 0);
  return Math.max(0, (axisPointer - firstLeading - totalSpan) / (units.length - 1));
}

/** 背景化時は対象を配列先頭へ移し、Canvasと出力の描画順を同じzIndexで保つ。 */
export function setObjectsBackgroundFixed(objects: readonly SceneObject[], ids: readonly string[], fixed: boolean): SceneObject[] {
  const idSet = new Set(ids);
  const ordered = fixed
    ? [...objects.filter((object) => idSet.has(object.id)), ...objects.filter((object) => !idSet.has(object.id))]
    : [...objects];
  return ordered.map((object, index) => ({ ...object, backgroundFixed: idSet.has(object.id) ? fixed : object.backgroundFixed, zIndex: index }));
}
