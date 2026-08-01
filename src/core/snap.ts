// 実寸スナップ計算(FR-059)。画面pxやズームには依存しない。 

import type { Guide, PointMm, SceneObject, SnapSettings } from "../types/project";
import { nearestGuideSnap, type GuideAnchor } from "./guides";

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  grid: false,
  objects: false,
  stageCenter: true,
  gridIntervalMm: 910,
  thresholdMm: 60,
};

function nearest(value: number, candidates: readonly number[], threshold: number): number | null {
  let best: number | null = null;
  let bestDistance = threshold;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - value);
    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function stageCenterX(projectWidthMm: number | null | undefined): number | null {
  return typeof projectWidthMm === "number" && Number.isFinite(projectWidthMm) && projectWidthMm > 0
    ? projectWidthMm / 2
    : null;
}

export interface SnapContext {
  guides?: readonly Guide[];
  guideAnchors?: readonly GuideAnchor[];
  settings: SnapSettings;
  otherObjects: readonly SceneObject[];
  stageWidthMm?: number | null;
}

/** 1点を有効なスナップ候補へ寄せる。複数選択移動では代表点にだけ適用する。 */
export function snapPointMm(point: PointMm, context: SnapContext): PointMm {
  const settings = context.settings;
  let xMm = point.xMm;
  let yMm = point.yMm;
  const threshold = Math.max(0, settings.thresholdMm);

  if (settings.grid && settings.gridIntervalMm > 0) {
    const interval = settings.gridIntervalMm;
    const gridX = Math.round(xMm / interval) * interval;
    const gridY = Math.round(yMm / interval) * interval;
    if (Math.abs(gridX - xMm) <= threshold) xMm = gridX;
    if (Math.abs(gridY - yMm) <= threshold) yMm = gridY;
  }

  if (settings.objects) {
    const xCandidates = context.otherObjects.map((object) => object.xMm);
    const yCandidates = context.otherObjects.map((object) => object.yMm);
    xMm = nearest(xMm, xCandidates, threshold) ?? xMm;
    yMm = nearest(yMm, yCandidates, threshold) ?? yMm;
  }

  if (settings.stageCenter) {
    const center = stageCenterX(context.stageWidthMm);
    if (center !== null && Math.abs(center - xMm) <= threshold) xMm = center;
  }
  if (settings.guides && context.guides) {
    const guideSnap = nearestGuideSnap({ xMm, yMm }, context.guides, settings.guideThresholdMm ?? threshold, context.guideAnchors);
    if (guideSnap) {
      ({ xMm, yMm } = guideSnap.point);
    }
  }

  return { xMm, yMm };
}
