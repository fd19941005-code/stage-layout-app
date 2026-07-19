// Phase 5の3Dシーン計算。2Dのmm正本から閲覧用の立体プリミティブと
// カメラ初期値を導出する。Three.js固有の値はUI側で作り、ここは純粋関数に保つ。

import type { CropPx, PointMm, Project, SceneObject } from "../types/project";
import { getBackgroundDisplaySizePx, getEffectiveCrop, rotatedBoundsMm } from "./transform";

export type Scene3DPrimitiveKind = "object" | "wall" | "avatar";
export type Scene3DShape = "box" | "cylinder";
export type AvatarKind = "seated" | "standing";

export interface Scene3DPrimitive {
  id: string;
  kind: Scene3DPrimitiveKind;
  shape: Scene3DShape;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** 床面からの立ち上がり。山台上のオブジェクトは山台の天面。 */
  baseHeightMm: number;
  /** 2D SVGと同じ正方向。Three.js側でY軸回転へ写像する。 */
  rotationDeg: number;
  objectType?: SceneObject["type"];
  avatarKind?: AvatarKind;
}

export interface Scene3DBoundsMm {
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
}

export interface Scene3DModel {
  bounds: Scene3DBoundsMm;
  primitives: Scene3DPrimitive[];
  objectCount: number;
  wallCount: number;
  avatarCount: number;
  backgroundPlane: Scene3DBackgroundPlane | null;
}

export interface Scene3DBackgroundPlane {
  widthMm: number;
  depthMm: number;
  xMm: number;
  yMm: number;
  opacity: number;
  crop: CropPx;
  rotationDeg: Project["background"]["rotationDeg"];
}

export interface FirstPersonPose {
  xMm: number;
  yMm: number;
  eyeHeightMm: number;
  yawDeg: number;
  pitchDeg: number;
}

export function rotateFirstPersonPose(pose: FirstPersonPose, deltaX: number, deltaY: number): FirstPersonPose {
  return {
    ...pose,
    yawDeg: pose.yawDeg + deltaX * 0.25,
    pitchDeg: Math.max(-75, Math.min(75, pose.pitchDeg - deltaY * 0.2)),
  };
}

/** 一人称中はOrbitControlsがカメラ姿勢を上書きしないよう更新を止める。 */
export function shouldUpdateOrbitControls(cameraMode: "orbit" | "firstPerson"): boolean {
  return cameraMode !== "firstPerson";
}

const DEFAULT_WALL_THICKNESS_MM = 100;
const DEFAULT_FLOOR_HALF_SIZE_MM = 6000;
const FLOOR_MARGIN_MM = 1000;

function isVisible(project: Project, object: SceneObject): boolean {
  return object.visible && (project.layers.find((layer) => layer.id === object.layerId)?.visible ?? true);
}

function nonAnnotationObjects(project: Project): SceneObject[] {
  return project.objects.filter((object) => isVisible(project, object) && !object.annotationKind);
}

/** 山台の入れ子も含めた床面からのオブジェクト基準高さ(mm)。循環参照は無視する。 */
export function objectBaseElevationMm(project: Project, objectId: string, visited = new Set<string>()): number {
  const object = project.objects.find((candidate) => candidate.id === objectId);
  if (!object || !object.onRiserId || visited.has(objectId)) return 0;
  const nextVisited = new Set(visited);
  nextVisited.add(objectId);
  const riser = project.objects.find((candidate) => candidate.id === object.onRiserId && candidate.type === "riser");
  if (!riser) return 0;
  return objectBaseElevationMm(project, riser.id, nextVisited) + Math.max(0, riser.heightMm);
}

export function avatarKindForObject(object: SceneObject): AvatarKind | null {
  if (object.avatar === "standing") return "standing";
  if (object.avatar === "seated" || object.type === "chair") return "seated";
  return null;
}

export function avatarHeightMm(kind: AvatarKind): number {
  return kind === "standing" ? 1700 : 1200;
}

function includePoint(bounds: Scene3DBoundsMm, point: PointMm, paddingMm = 0): Scene3DBoundsMm {
  return {
    minXMm: Math.min(bounds.minXMm, point.xMm - paddingMm),
    minYMm: Math.min(bounds.minYMm, point.yMm - paddingMm),
    maxXMm: Math.max(bounds.maxXMm, point.xMm + paddingMm),
    maxYMm: Math.max(bounds.maxYMm, point.yMm + paddingMm),
  };
}

function includeObjectBounds(bounds: Scene3DBoundsMm, object: SceneObject): Scene3DBoundsMm {
  const objectBounds = rotatedBoundsMm(object);
  return {
    minXMm: Math.min(bounds.minXMm, objectBounds.minXMm),
    minYMm: Math.min(bounds.minYMm, objectBounds.minYMm),
    maxXMm: Math.max(bounds.maxXMm, objectBounds.maxXMm),
    maxYMm: Math.max(bounds.maxYMm, objectBounds.maxYMm),
  };
}

function initialBounds(): Scene3DBoundsMm {
  return {
    minXMm: -DEFAULT_FLOOR_HALF_SIZE_MM,
    minYMm: -DEFAULT_FLOOR_HALF_SIZE_MM,
    maxXMm: DEFAULT_FLOOR_HALF_SIZE_MM,
    maxYMm: DEFAULT_FLOOR_HALF_SIZE_MM,
  };
}

function finishBounds(bounds: Scene3DBoundsMm): Scene3DBoundsMm {
  return {
    minXMm: bounds.minXMm - FLOOR_MARGIN_MM,
    minYMm: bounds.minYMm - FLOOR_MARGIN_MM,
    maxXMm: bounds.maxXMm + FLOOR_MARGIN_MM,
    maxYMm: bounds.maxYMm + FLOOR_MARGIN_MM,
  };
}

function backgroundPlaneForProject(project: Project): Scene3DBackgroundPlane | null {
  const backgroundLayerVisible = project.layers.find((layer) => layer.id === "layer-background")?.visible ?? true;
  if (!project.background.imageDataUrl || !project.background.visible || !backgroundLayerVisible) return null;
  const mmPerPixel = project.calibration.mmPerPixel ?? 10;
  const crop = getEffectiveCrop(project.background);
  const displaySize = getBackgroundDisplaySizePx(project.background);
  const widthMm = Math.max(1, displaySize.widthPx * mmPerPixel);
  const depthMm = Math.max(1, displaySize.heightPx * mmPerPixel);
  return {
    widthMm,
    depthMm,
    xMm: widthMm / 2,
    yMm: depthMm / 2,
    opacity: Math.min(1, Math.max(0, project.background.opacity)),
    crop,
    rotationDeg: project.background.rotationDeg,
  };
}

/**
 * 2D配置から3D表示用のプリミティブを作る。位置・寸法・高さはすべて
 * 入力Projectのmm値をそのまま引き継ぎ、表示側だけがmへ変換する。
 */
export function buildScene3D(project: Project, options: { showAvatars?: boolean } = {}): Scene3DModel {
  const showAvatars = options.showAvatars ?? true;
  const primitives: Scene3DPrimitive[] = [];
  let bounds = initialBounds();
  const backgroundPlane = backgroundPlaneForProject(project);
  let objectCount = 0;
  let wallCount = 0;
  let avatarCount = 0;

  for (const object of nonAnnotationObjects(project)) {
    const baseHeightMm = objectBaseElevationMm(project, object.id);
    primitives.push({
      id: object.id,
      kind: "object",
      shape: object.shape === "circle" ? "cylinder" : "box",
      xMm: object.xMm,
      yMm: object.yMm,
      widthMm: Math.max(1, object.widthMm),
      depthMm: Math.max(1, object.depthMm),
      heightMm: Math.max(0, object.heightMm),
      baseHeightMm,
      rotationDeg: object.rotationDeg,
      objectType: object.type,
    });
    objectCount += 1;
    bounds = includeObjectBounds(bounds, object);

    const avatarKind = avatarKindForObject(object);
    if (showAvatars && avatarKind) {
      primitives.push({
        id: `${object.id}-avatar`,
        kind: "avatar",
        shape: "cylinder",
        xMm: object.xMm,
        yMm: object.yMm,
        widthMm: 360,
        depthMm: 360,
        heightMm: avatarHeightMm(avatarKind),
        baseHeightMm,
        rotationDeg: object.rotationDeg,
        objectType: object.type,
        avatarKind,
      });
      avatarCount += 1;
    }
  }

  for (const wall of project.walls) {
    if (wall.points.length < 2) continue;
    wallCount += 1;
    const points = wall.closed && wall.points.length > 2 ? [...wall.points, wall.points[0]] : wall.points;
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const dx = end.xMm - start.xMm;
      const dy = end.yMm - start.yMm;
      const lengthMm = Math.hypot(dx, dy);
      if (lengthMm <= 0) continue;
      primitives.push({
        id: `${wall.id}-segment-${index}`,
        kind: "wall",
        shape: "box",
        xMm: (start.xMm + end.xMm) / 2,
        yMm: (start.yMm + end.yMm) / 2,
        widthMm: lengthMm,
        depthMm: DEFAULT_WALL_THICKNESS_MM,
        heightMm: Math.max(1, wall.heightMm),
        baseHeightMm: 0,
        rotationDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
      bounds = includePoint(bounds, start, DEFAULT_WALL_THICKNESS_MM / 2);
      bounds = includePoint(bounds, end, DEFAULT_WALL_THICKNESS_MM / 2);
    }
  }

  if (project.stageFront) {
    // 舞台前端の外側を客席方向へ8m延長し、客席視点から舞台を見渡せる床を確保する。
    bounds = includePoint(bounds, { xMm: 0, yMm: project.stageFront.yMm - 8000 });
    bounds = includePoint(bounds, { xMm: 0, yMm: project.stageFront.yMm + 1000 });
  }

  if (backgroundPlane) {
    bounds = includePoint(bounds, { xMm: 0, yMm: 0 });
    bounds = includePoint(bounds, { xMm: backgroundPlane.widthMm, yMm: backgroundPlane.depthMm });
  }

  return {
    bounds: finishBounds(bounds),
    primitives,
    objectCount,
    wallCount,
    avatarCount,
    backgroundPlane,
  };
}

export function defaultFirstPersonPose(model: Scene3DModel): FirstPersonPose {
  const centerX = (model.bounds.minXMm + model.bounds.maxXMm) / 2;
  const y = model.bounds.maxYMm - 1500;
  return { xMm: centerX, yMm: y, eyeHeightMm: 1200, yawDeg: 0, pitchDeg: 0 };
}

/** 選択した席の前方150mm・座奏目線1200mmから見る。 */
export function firstPersonPoseForObject(
  project: Project,
  objectId: string,
  eyeHeightMm = 1200,
): FirstPersonPose | null {
  const object = project.objects.find((candidate) => candidate.id === objectId);
  if (!object || object.type !== "chair") return null;
  const baseHeightMm = objectBaseElevationMm(project, object.id);
  const rotationRad = (object.rotationDeg * Math.PI) / 180;
  return {
    xMm: object.xMm + Math.sin(rotationRad) * 150,
    yMm: object.yMm - Math.cos(rotationRad) * 150,
    eyeHeightMm: baseHeightMm + eyeHeightMm,
    yawDeg: object.rotationDeg,
    pitchDeg: 0,
  };
}
