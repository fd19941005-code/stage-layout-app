// 椅子1脚と譜面台1台の固定セット配置を、mm座標だけで生成する純粋関数。
// セットはProjectへ親オブジェクトを保存せず、既存の2つのSceneObjectを同じgroupIdで保存する。

import type { PointMm, SceneObject } from "../types/project";
import { normalizeDeg } from "./transform";
import { CHAIR_MUSIC_STAND_SET_GAP_MM } from "./presets";

export interface ChairMusicStandSetOptions {
  /** セット全体の中心。クリック位置をこの中心として扱う。 */
  center: PointMm;
  rotationDeg: number;
  layerId: string;
  baseZIndex: number;
  groupId: string;
  /** 省略時は標準100mm。 */
  gapMm?: number;
}

export type ChairMusicStandSetIdFactory = (role: "chair" | "stand") => string;

function validPoint(point: PointMm): boolean {
  return Number.isFinite(point.xMm) && Number.isFinite(point.yMm);
}

function cloneForPlacement(
  source: SceneObject,
  id: string,
  xMm: number,
  yMm: number,
  rotationDeg: number,
  layerId: string,
  zIndex: number,
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
    layerId,
    zIndex,
    locked: false,
    groupId: null,
  };
}

/**
 * セット中心から見て、譜面台を手前(-Y)、椅子を奥(+Y)へ置く。
 * rotationDegでこの関係全体を回転し、個別寸法は変更しない。
 */
export function createChairMusicStandSetObjects(
  chairTemplate: SceneObject,
  standTemplate: SceneObject,
  options: ChairMusicStandSetOptions,
  idFactory: ChairMusicStandSetIdFactory = (role) => "chair-music-stand-" + role,
): SceneObject[] {
  if (!validPoint(options.center) || !options.layerId || !options.groupId) return [];
  if (![chairTemplate, standTemplate].every((object) =>
    Number.isFinite(object.widthMm)
    && Number.isFinite(object.depthMm)
    && object.widthMm > 0
    && object.depthMm > 0
  )) return [];
  if (!Number.isFinite(options.rotationDeg)) return [];

  const gapMm = Number.isFinite(options.gapMm)
    ? Math.max(0, options.gapMm as number)
    : CHAIR_MUSIC_STAND_SET_GAP_MM;
  const centerDistanceMm = (chairTemplate.depthMm + standTemplate.depthMm) / 2 + gapMm;
  const rotationRad = (options.rotationDeg * Math.PI) / 180;
  // ローカル+Y軸を回転させた方向。0度では椅子が下、譜面台が上になる。
  const localY = { xMm: -Math.sin(rotationRad), yMm: Math.cos(rotationRad) };
  const halfDistanceMm = centerDistanceMm / 2;
  const chairCenter = {
    xMm: options.center.xMm + localY.xMm * halfDistanceMm,
    yMm: options.center.yMm + localY.yMm * halfDistanceMm,
  };
  const standCenter = {
    xMm: options.center.xMm - localY.xMm * halfDistanceMm,
    yMm: options.center.yMm - localY.yMm * halfDistanceMm,
  };

  const chair = cloneForPlacement(
    chairTemplate,
    idFactory("chair"),
    chairCenter.xMm,
    chairCenter.yMm,
    options.rotationDeg,
    options.layerId,
    options.baseZIndex,
  );
  const stand = cloneForPlacement(
    standTemplate,
    idFactory("stand"),
    standCenter.xMm,
    standCenter.yMm,
    options.rotationDeg,
    options.layerId,
    options.baseZIndex + 1,
  );
  return [chair, stand].map((object) => ({ ...object, groupId: options.groupId }));
}
