// プロジェクトの生成・保存・復元(FR-001〜003、6.3 保存・互換性の詳細要件)。
// 自動テスト必須領域(11.4): 保存・復元・スキーマ移行。

import {
  SCHEMA_VERSION,
  type Project,
  type SceneObject,
  type Wall,
} from "../types/project";

let idCounter = 0;

/** プロジェクト内で一意のIDを生成する */
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export const DEFAULT_LAYER_ID = "layer-objects";

export function createEmptyProject(name: string): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: generateId("project"),
    name,
    metadata: { hallName: "", performanceName: "", date: "", author: "", notes: "" },
    background: {
      imageDataUrl: null,
      naturalWidthPx: 0,
      naturalHeightPx: 0,
      rotationDeg: 0,
      crop: null,
      opacity: 1,
      visible: true,
      locked: true,
    },
    calibration: {
      mmPerPixel: null,
      pointA: null,
      pointB: null,
      realDistanceMm: null,
      calibratedAt: null,
    },
    view: { zoom: 0.04, panX: 40, panY: 40 },
    layers: [
      { id: "layer-background", name: "背景", visible: true, locked: true },
      { id: DEFAULT_LAYER_ID, name: "オブジェクト", visible: true, locked: false },
      { id: "layer-annotations", name: "注釈", visible: true, locked: false },
    ],
    objects: [],
    walls: [],
    stageFront: null,
    exportSettings: { paper: "A3", orientation: "landscape", scale: "1:100" },
    updatedAt: new Date().toISOString(),
  };
}

/** プロジェクトを単一JSON文字列へ書き出す(FR-003) */
export function serializeProject(project: Project): string {
  return JSON.stringify(
    { ...project, updatedAt: new Date().toISOString() },
    null,
    2,
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/**
 * JSONからプロジェクトを復元する。
 * 未知のフィールドは無視し、既知フィールドを復元する(6.3)。
 * 不正な形式の場合は原因を示すErrorを投げる(NFR-013)。
 */
export function deserializeProject(json: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("プロジェクトファイルのJSONを解析できません");
  }
  if (!isRecord(raw)) {
    throw new Error("プロジェクトファイルの形式が不正です");
  }
  if (typeof raw.schemaVersion !== "string") {
    throw new Error("schemaVersionがありません。プロジェクトファイルではない可能性があります");
  }
  // 将来: schemaVersionに応じたマイグレーションをここで行う(12.1)

  const base = createEmptyProject(str(raw.name, "無題のプロジェクト"));

  const objects: SceneObject[] = Array.isArray(raw.objects)
    ? raw.objects.filter(isRecord).map((o, i): SceneObject => ({
        id: str(o.id, generateId("obj")),
        type: (str(o.type, "shape") as SceneObject["type"]),
        presetId: typeof o.presetId === "string" ? o.presetId : null,
        name: str(o.name, "オブジェクト"),
        xMm: num(o.xMm, 0),
        yMm: num(o.yMm, 0),
        widthMm: Math.max(1, num(o.widthMm, 1)),
        depthMm: Math.max(1, num(o.depthMm, 1)),
        heightMm: Math.max(0, num(o.heightMm, 0)),
        rotationDeg: num(o.rotationDeg, 0),
        label: str(o.label, ""),
        onRiserId: typeof o.onRiserId === "string" ? o.onRiserId : null,
        avatar: typeof o.avatar === "string" ? o.avatar : null,
        locked: bool(o.locked, false),
        visible: bool(o.visible, true),
        groupId: typeof o.groupId === "string" ? o.groupId : null,
        layerId: str(o.layerId, DEFAULT_LAYER_ID),
        zIndex: num(o.zIndex, i),
        shape: o.shape === "circle" ? "circle" : "rect",
      }))
    : [];

  const walls: Wall[] = Array.isArray(raw.walls)
    ? raw.walls.filter(isRecord).map((w): Wall => ({
        id: str(w.id, generateId("wall")),
        points: Array.isArray(w.points)
          ? w.points.filter(isRecord).map((p) => ({
              xMm: num(p.xMm, 0),
              yMm: num(p.yMm, 0),
            }))
          : [],
        heightMm: num(w.heightMm, 6000),
        closed: bool(w.closed, false),
      }))
    : [];

  const bg = isRecord(raw.background) ? raw.background : {};
  const calib = isRecord(raw.calibration) ? raw.calibration : {};
  const view = isRecord(raw.view) ? raw.view : {};
  const meta = isRecord(raw.metadata) ? raw.metadata : {};
  const exp = isRecord(raw.exportSettings) ? raw.exportSettings : {};
  const stageFront = isRecord(raw.stageFront)
    ? { yMm: num(raw.stageFront.yMm, 0) }
    : null;

  return {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    id: str(raw.id, base.id),
    name: str(raw.name, base.name),
    metadata: {
      hallName: str(meta.hallName, ""),
      performanceName: str(meta.performanceName, ""),
      date: str(meta.date, ""),
      author: str(meta.author, ""),
      notes: str(meta.notes, ""),
    },
    background: {
      imageDataUrl: typeof bg.imageDataUrl === "string" ? bg.imageDataUrl : null,
      naturalWidthPx: num(bg.naturalWidthPx, 0),
      naturalHeightPx: num(bg.naturalHeightPx, 0),
      rotationDeg: ([0, 90, 180, 270] as const).includes(
        bg.rotationDeg as 0 | 90 | 180 | 270,
      )
        ? (bg.rotationDeg as 0 | 90 | 180 | 270)
        : 0,
      crop: isRecord(bg.crop)
        ? {
            xPx: num(bg.crop.xPx, 0),
            yPx: num(bg.crop.yPx, 0),
            widthPx: num(bg.crop.widthPx, 0),
            heightPx: num(bg.crop.heightPx, 0),
          }
        : null,
      opacity: num(bg.opacity, 1),
      visible: bool(bg.visible, true),
      locked: bool(bg.locked, true),
    },
    calibration: {
      mmPerPixel:
        typeof calib.mmPerPixel === "number" && calib.mmPerPixel > 0
          ? calib.mmPerPixel
          : null,
      pointA: isRecord(calib.pointA)
        ? { xPx: num(calib.pointA.xPx, 0), yPx: num(calib.pointA.yPx, 0) }
        : null,
      pointB: isRecord(calib.pointB)
        ? { xPx: num(calib.pointB.xPx, 0), yPx: num(calib.pointB.yPx, 0) }
        : null,
      realDistanceMm:
        typeof calib.realDistanceMm === "number" && calib.realDistanceMm > 0
          ? calib.realDistanceMm
          : null,
      calibratedAt: typeof calib.calibratedAt === "string" ? calib.calibratedAt : null,
    },
    view: {
      zoom: num(view.zoom, base.view.zoom),
      panX: num(view.panX, base.view.panX),
      panY: num(view.panY, base.view.panY),
    },
    objects,
    walls,
    stageFront,
    exportSettings: {
      paper: exp.paper === "A4" ? "A4" : "A3",
      orientation: exp.orientation === "portrait" ? "portrait" : "landscape",
      scale: exp.scale === "1:50" || exp.scale === "fit" ? exp.scale : "1:100",
    },
    updatedAt: str(raw.updatedAt, base.updatedAt),
  };
}
