// オブジェクト移動中だけ表示するスマート整列ガイド。
// 判定と補正はmm座標だけで行い、表示用のpxやズームを持ち込まない。

import type { PointMm, SceneObject } from "../types/project";
import { sceneObjectBoundsMm } from "./transform";

export type AlignmentGuideAxis = "vertical" | "horizontal";
export type AlignmentAnchor = "start" | "center" | "end";

export interface AlignmentGuideLine {
  /** verticalはX、horizontalはYの同一位置を示す。 */
  axis: AlignmentGuideAxis;
  positionMm: number;
  /** ガイド線を描く直交軸の範囲。 */
  fromMm: number;
  toMm: number;
  movingAnchor: AlignmentAnchor;
  targetAnchor: AlignmentAnchor;
  movingObjectId: string;
  targetObjectId: string;
  label: string;
}

export interface AlignmentGuidesResult {
  /** 提案した移動量へ加える整列補正量。 */
  delta: PointMm;
  guides: AlignmentGuideLine[];
}

interface Bounds {
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
}

interface Candidate {
  axis: AlignmentGuideAxis;
  moving: SceneObject;
  target: SceneObject;
  movingBounds: Bounds;
  targetBounds: Bounds;
  movingAnchor: AlignmentAnchor;
  targetAnchor: AlignmentAnchor;
  targetValueMm: number;
  errorMm: number;
  distanceMm: number;
}

const ANCHOR_LABELS: Record<AlignmentGuideAxis, Record<AlignmentAnchor, string>> = {
  vertical: { start: "左端", center: "中央", end: "右端" },
  horizontal: { start: "上端", center: "中央", end: "下端" },
};

function anchorValue(bounds: Bounds, axis: AlignmentGuideAxis, anchor: AlignmentAnchor): number {
  if (axis === "vertical") {
    if (anchor === "start") return bounds.minXMm;
    if (anchor === "end") return bounds.maxXMm;
    return (bounds.minXMm + bounds.maxXMm) / 2;
  }
  if (anchor === "start") return bounds.minYMm;
  if (anchor === "end") return bounds.maxYMm;
  return (bounds.minYMm + bounds.maxYMm) / 2;
}

function shiftedBounds(bounds: Bounds, delta: PointMm): Bounds {
  return {
    minXMm: bounds.minXMm + delta.xMm,
    minYMm: bounds.minYMm + delta.yMm,
    maxXMm: bounds.maxXMm + delta.xMm,
    maxYMm: bounds.maxYMm + delta.yMm,
  };
}

function chooseCandidate(candidates: readonly Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (!best || candidate.distanceMm < best.distanceMm) best = candidate;
  }
  return best;
}

/**
 * 移動中のオブジェクトの辺・中心を、停止中オブジェクトの辺・中心へ揃える。
 * 複数選択では全対象へ同じdeltaを適用するため、選択物同士の相対位置は変わらない。
 */
export function findAlignmentGuides(
  objects: readonly SceneObject[],
  movingIds: readonly string[],
  proposedDelta: PointMm,
  thresholdMm: number,
  extensionMm = 500,
): AlignmentGuidesResult {
  const movingIdSet = new Set(movingIds);
  const movingObjects = objects.filter((object) => movingIdSet.has(object.id));
  const targetObjects = objects.filter((object) => !movingIdSet.has(object.id));
  const threshold = Number.isFinite(thresholdMm) ? Math.max(0, thresholdMm) : 0;
  const extension = Number.isFinite(extensionMm) ? Math.max(0, extensionMm) : 0;
  if (movingObjects.length === 0 || targetObjects.length === 0) {
    return { delta: { ...proposedDelta }, guides: [] };
  }

  const candidates: Record<AlignmentGuideAxis, Candidate[]> = {
    vertical: [],
    horizontal: [],
  };
  const anchors: AlignmentAnchor[] = ["start", "center", "end"];

  for (const moving of movingObjects) {
    const movingBounds = sceneObjectBoundsMm(moving);
    for (const target of targetObjects) {
      const targetBounds = sceneObjectBoundsMm(target);
      for (const axis of ["vertical", "horizontal"] as const) {
        for (const movingAnchor of anchors) {
          const movingValueMm = anchorValue(movingBounds, axis, movingAnchor);
          for (const targetAnchor of anchors) {
            const targetValueMm = anchorValue(targetBounds, axis, targetAnchor);
            const proposedValueMm = movingValueMm + (axis === "vertical" ? proposedDelta.xMm : proposedDelta.yMm);
            const errorMm = targetValueMm - proposedValueMm;
            const distanceMm = Math.abs(errorMm);
            if (distanceMm <= threshold) {
              candidates[axis].push({
                axis,
                moving,
                target,
                movingBounds,
                targetBounds,
                movingAnchor,
                targetAnchor,
                targetValueMm,
                errorMm,
                distanceMm,
              });
            }
          }
        }
      }
    }
  }

  const vertical = chooseCandidate(candidates.vertical);
  const horizontal = chooseCandidate(candidates.horizontal);
  const delta = {
    xMm: proposedDelta.xMm + (vertical?.errorMm ?? 0),
    yMm: proposedDelta.yMm + (horizontal?.errorMm ?? 0),
  };

  const guides = [vertical, horizontal].filter((candidate): candidate is Candidate => candidate !== null).map((candidate) => {
    const movingBounds = shiftedBounds(candidate.movingBounds, delta);
    const isVertical = candidate.axis === "vertical";
    const fromMm = isVertical
      ? Math.min(movingBounds.minYMm, candidate.targetBounds.minYMm) - extension
      : Math.min(movingBounds.minXMm, candidate.targetBounds.minXMm) - extension;
    const toMm = isVertical
      ? Math.max(movingBounds.maxYMm, candidate.targetBounds.maxYMm) + extension
      : Math.max(movingBounds.maxXMm, candidate.targetBounds.maxXMm) + extension;
    return {
      axis: candidate.axis,
      positionMm: candidate.targetValueMm,
      fromMm,
      toMm,
      movingAnchor: candidate.movingAnchor,
      targetAnchor: candidate.targetAnchor,
      movingObjectId: candidate.moving.id,
      targetObjectId: candidate.target.id,
      label: `${ANCHOR_LABELS[candidate.axis][candidate.movingAnchor]} = ${ANCHOR_LABELS[candidate.axis][candidate.targetAnchor]}`,
    } satisfies AlignmentGuideLine;
  });

  return { delta, guides };
}
