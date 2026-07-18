// 複数オブジェクトの整列・等間隔配置(FR-057、FR-058)。
// mm座標だけを操作する純粋関数として分離し、Undo/Redoからも一操作として扱う。

import type { SceneObject } from "../types/project";
import { rotatedBoundsMm } from "./transform";

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

export function selectionBoundsMm(objects: readonly SceneObject[], ids: readonly string[]) {
  const selected = selectedObjects(objects, ids);
  if (selected.length === 0) return null;
  const bounds = selected.map(rotatedBoundsMm);
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
  const bounds = selected.map((object) => ({ object, bounds: rotatedBoundsMm(object) }));
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
    if (object.locked) continue;
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
    if (object.locked || index === 0 || index === sorted.length - 1) return;
    const position = first + step * index;
    updates.set(object.id, axis === "x" ? { xMm: position } : { yMm: position });
  });
  return replaceObjects(objects, updates);
}
