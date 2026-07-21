// 座標変換の純粋関数群(9.4 座標変換の原則、12.1 実装上の制約)。
// UIコンポーネントへ散在させず、ここに集約する。自動テスト必須領域(11.4)。

import type { Background, CropPx, PointMm, PointPx, Project, SceneObject, ViewState } from "../types/project";

/** 画面上の点(px)。保存対象にしてはならない */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** 2点間のピクセル距離 */
export function pxDistance(a: PointPx, b: PointPx): number {
  return Math.hypot(b.xPx - a.xPx, b.yPx - a.yPx);
}

/** 2点間の実寸距離(mm) */
export function mmDistance(a: PointMm, b: PointMm): number {
  return Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
}

/**
 * 2点校正(FR-020): 画像上の2点と実距離からmm/pxを算出する。
 * 入力実距離は正数のみ(6.1)。2点が同一の場合もエラー。
 */
export function computeMmPerPixel(
  pointA: PointPx,
  pointB: PointPx,
  realDistanceMm: number,
): number {
  if (!Number.isFinite(realDistanceMm) || realDistanceMm <= 0) {
    throw new Error("実距離は正の数値で入力してください");
  }
  const dPx = pxDistance(pointA, pointB);
  if (dPx <= 0) {
    throw new Error("校正の2点が同一位置です。異なる2点を指定してください");
  }
  return realDistanceMm / dPx;
}

/** 単位入力の正規化(FR-022): mm/cm/m → mm */
export function toMm(value: number, unit: "mm" | "cm" | "m"): number {
  switch (unit) {
    case "mm":
      return value;
    case "cm":
      return value * 10;
    case "m":
      return value * 1000;
  }
}

/**
 * 背景の切り抜き範囲を画像内に収める。元画像の破壊を避けるため、
 * UI入力とJSON復元の両方からこの関数を通す。
 */
export function clampCrop(crop: CropPx, sourceWidthPx: number, sourceHeightPx: number): CropPx {
  const width = Math.max(1, Math.floor(Number.isFinite(sourceWidthPx) ? sourceWidthPx : 1));
  const height = Math.max(1, Math.floor(Number.isFinite(sourceHeightPx) ? sourceHeightPx : 1));
  const x = Math.min(Math.max(0, Math.round(Number.isFinite(crop.xPx) ? crop.xPx : 0)), width - 1);
  const y = Math.min(Math.max(0, Math.round(Number.isFinite(crop.yPx) ? crop.yPx : 0)), height - 1);
  const cropWidth = Math.min(
    Math.max(1, Math.round(Number.isFinite(crop.widthPx) ? crop.widthPx : width)),
    width - x,
  );
  const cropHeight = Math.min(
    Math.max(1, Math.round(Number.isFinite(crop.heightPx) ? crop.heightPx : height)),
    height - y,
  );
  return { xPx: x, yPx: y, widthPx: cropWidth, heightPx: cropHeight };
}

/** nullのcropを全画像範囲へ展開する */
export function getEffectiveCrop(background: Pick<Background, "naturalWidthPx" | "naturalHeightPx" | "crop">): CropPx {
  const width = Math.max(1, Math.floor(background.naturalWidthPx || 1));
  const height = Math.max(1, Math.floor(background.naturalHeightPx || 1));
  return background.crop
    ? clampCrop(background.crop, width, height)
    : { xPx: 0, yPx: 0, widthPx: width, heightPx: height };
}

/** 回転後に画面へ表示する画像のpx寸法 */
export function getBackgroundDisplaySizePx(
  background: Pick<Background, "naturalWidthPx" | "naturalHeightPx" | "crop" | "rotationDeg">,
): { widthPx: number; heightPx: number } {
  const crop = getEffectiveCrop(background);
  return background.rotationDeg === 90 || background.rotationDeg === 270
    ? { widthPx: crop.heightPx, heightPx: crop.widthPx }
    : { widthPx: crop.widthPx, heightPx: crop.heightPx };
}

/** 元画像px → 切り抜き・回転後の表示画像px */
export function sourcePxToDisplayedPx(
  point: PointPx,
  background: Pick<Background, "naturalWidthPx" | "naturalHeightPx" | "crop" | "rotationDeg">,
): PointPx {
  const crop = getEffectiveCrop(background);
  const localX = point.xPx - crop.xPx;
  const localY = point.yPx - crop.yPx;
  switch (background.rotationDeg) {
    case 90:
      return { xPx: crop.heightPx - localY, yPx: localX };
    case 180:
      return { xPx: crop.widthPx - localX, yPx: crop.heightPx - localY };
    case 270:
      return { xPx: localY, yPx: crop.widthPx - localX };
    default:
      return { xPx: localX, yPx: localY };
  }
}

/** 切り抜き・回転後の表示画像px → 元画像px */
export function displayedPxToSourcePx(
  point: PointPx,
  background: Pick<Background, "naturalWidthPx" | "naturalHeightPx" | "crop" | "rotationDeg">,
): PointPx {
  const crop = getEffectiveCrop(background);
  let localX: number;
  let localY: number;
  switch (background.rotationDeg) {
    case 90:
      localX = point.yPx;
      localY = crop.heightPx - point.xPx;
      break;
    case 180:
      localX = crop.widthPx - point.xPx;
      localY = crop.heightPx - point.yPx;
      break;
    case 270:
      localX = crop.widthPx - point.yPx;
      localY = point.xPx;
      break;
    default:
      localX = point.xPx;
      localY = point.yPx;
      break;
  }
  return { xPx: localX + crop.xPx, yPx: localY + crop.yPx };
}

/** 背景表示px → 実寸mm座標 */
export function imagePxToMm(p: PointPx, mmPerPixel: number): PointMm {
  return { xMm: p.xPx * mmPerPixel, yMm: p.yPx * mmPerPixel };
}

/** 実寸mm座標 → 背景表示px */
export function mmToImagePx(p: PointMm, mmPerPixel: number): PointPx {
  return { xPx: p.xMm / mmPerPixel, yPx: p.yMm / mmPerPixel };
}

/** 実寸mm座標 → 画面px座標(描画時のみ使用) */
export function mmToScreen(p: PointMm, view: ViewState): ScreenPoint {
  return {
    x: p.xMm * view.zoom + view.panX,
    y: p.yMm * view.zoom + view.panY,
  };
}

/** 画面px座標 → 実寸mm座標(ポインター入力は直ちにmmへ逆変換して保存する) */
export function screenToMm(p: ScreenPoint, view: ViewState): PointMm {
  return {
    xMm: (p.x - view.panX) / view.zoom,
    yMm: (p.y - view.panY) / view.zoom,
  };
}

/** 校正基準線の再測定値(mm)。FR-024の表示とテストで共用する */
export function measuredCalibrationDistanceMm(pointA: PointPx, pointB: PointPx, mmPerPixel: number): number {
  return pxDistance(pointA, pointB) * mmPerPixel;
}

/** 角度を0〜360度へ正規化(9.2) */
export function normalizeDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/**
 * 回転を含むオブジェクトの外接矩形(mm)を求める(11.4)。
 * 中心(xMm, yMm)・寸法(widthMm, depthMm)・角度(rotationDeg)から算出。
 */
export function rotatedBoundsMm(obj: {
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  rotationDeg: number;
}): { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number } {
  const rad = (obj.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const halfW = (obj.widthMm * cos + obj.depthMm * sin) / 2;
  const halfH = (obj.widthMm * sin + obj.depthMm * cos) / 2;
  return {
    minXMm: obj.xMm - halfW,
    minYMm: obj.yMm - halfH,
    maxXMm: obj.xMm + halfW,
    maxYMm: obj.yMm + halfH,
  };
}

/**
 * カーソル位置を中心にズーム倍率を変更したときの新しいViewStateを返す。
 * ズームは表示のみで、実寸データへ影響しない(AC-003)。
 */
export function zoomAt(
  view: ViewState,
  screenCenter: ScreenPoint,
  nextZoom: number,
): ViewState {
  const anchor = screenToMm(screenCenter, view);
  return {
    zoom: nextZoom,
    panX: screenCenter.x - anchor.xMm * nextZoom,
    panY: screenCenter.y - anchor.yMm * nextZoom,
  };
}
/** 線分系注釈を含むオブジェクトの実寸外接矩形。選択・出力の共通基盤。 */
export function sceneObjectBoundsMm(obj: SceneObject): { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number } {
  const isSegment = obj.annotationKind === "line" || obj.annotationKind === "arrow" || obj.annotationKind === "dimension";
  if (isSegment && Number.isFinite(obj.endXMm) && Number.isFinite(obj.endYMm)) {
    return {
      minXMm: Math.min(obj.xMm, obj.endXMm as number),
      minYMm: Math.min(obj.yMm, obj.endYMm as number),
      maxXMm: Math.max(obj.xMm, obj.endXMm as number),
      maxYMm: Math.max(obj.yMm, obj.endYMm as number),
    };
  }
  return rotatedBoundsMm(obj);
}


/**
 * 表示中の図面全体が見えるViewStateを計算する。背景・表示中オブジェクト・壁を
 * 同じmm座標系でまとめるため、画面のフィット操作でも実寸データは変更しない。
 */
export function fitViewToProject(
  project: Pick<Project, "background" | "calibration" | "layers" | "objects" | "walls">,
  viewportWidth: number,
  viewportHeight: number,
  paddingPx = 48,
): ViewState {
  const mmPerPixel = project.calibration.mmPerPixel ?? 10;
  const visibleLayerIds = new Set(project.layers.filter((layer) => layer.visible).map((layer) => layer.id));
  const bounds = { minXMm: Number.POSITIVE_INFINITY, minYMm: Number.POSITIVE_INFINITY, maxXMm: Number.NEGATIVE_INFINITY, maxYMm: Number.NEGATIVE_INFINITY };
  let hasContent = false;

  function include(minXMm: number, minYMm: number, maxXMm: number, maxYMm: number) {
    bounds.minXMm = Math.min(bounds.minXMm, minXMm);
    bounds.minYMm = Math.min(bounds.minYMm, minYMm);
    bounds.maxXMm = Math.max(bounds.maxXMm, maxXMm);
    bounds.maxYMm = Math.max(bounds.maxYMm, maxYMm);
    hasContent = true;
  }

  if (project.background.imageDataUrl && project.background.visible && visibleLayerIds.has("layer-background")) {
    const display = getBackgroundDisplaySizePx(project.background);
    include(0, 0, display.widthPx * mmPerPixel, display.heightPx * mmPerPixel);
  }

  for (const object of project.objects) {
    if (!object.visible || !visibleLayerIds.has(object.layerId)) continue;
    const objectBounds = sceneObjectBoundsMm(object);
    include(objectBounds.minXMm, objectBounds.minYMm, objectBounds.maxXMm, objectBounds.maxYMm);
  }

  for (const wall of project.walls) {
    if (wall.points.length === 0) continue;
    for (const point of wall.points) include(point.xMm, point.yMm, point.xMm, point.yMm);
  }

  if (!hasContent) {
    return { zoom: 0.04, panX: Math.max(0, viewportWidth / 2), panY: Math.max(0, viewportHeight / 2) };
  }

  const widthMm = Math.max(1, bounds.maxXMm - bounds.minXMm);
  const heightMm = Math.max(1, bounds.maxYMm - bounds.minYMm);
  const availableWidthPx = Math.max(160, viewportWidth - paddingPx * 2);
  const availableHeightPx = Math.max(160, viewportHeight - paddingPx * 2);
  const zoom = Math.min(2, Math.max(0.005, Math.min(availableWidthPx / widthMm, availableHeightPx / heightMm)));
  const centerXMm = (bounds.minXMm + bounds.maxXMm) / 2;
  const centerYMm = (bounds.minYMm + bounds.maxYMm) / 2;
  return {
    zoom,
    panX: viewportWidth / 2 - centerXMm * zoom,
    panY: viewportHeight / 2 - centerYMm * zoom,
  };
}
