// 要件定義書 第9章「データ要件」に基づくプロジェクトモデル定義。
// 最重要設計原則: 配置物の正本は常にmm単位。px値は保存しない。

export const SCHEMA_VERSION = "1.0.0";

/** 実寸座標系(mm)上の点 */
export interface PointMm {
  xMm: number;
  yMm: number;
}

/** 背景画像のピクセル座標系上の点(校正基準点の保存に使用) */
export interface PointPx {
  xPx: number;
  yPx: number;
}

export type ObjectType =
  | "chair"
  | "musicStand"
  | "podium"
  | "riser"
  | "instrument"
  | "shape"
  | "text";

export type ShapeKind = "rect" | "circle";

/** 背景図面(5.1 Background) */
export interface Background {
  /** 画像のData URL(Base64埋め込み。6.3 単一ファイル化) */
  imageDataUrl: string | null;
  naturalWidthPx: number;
  naturalHeightPx: number;
  /** 90度単位の回転(FR-012)。微回転(FR-015)はPhase 1以降 */
  rotationDeg: 0 | 90 | 180 | 270;
  /** 切り抜き(FR-013)。元画像は破壊しない。nullは切り抜きなし */
  crop: { xPx: number; yPx: number; widthPx: number; heightPx: number } | null;
  opacity: number;
  visible: boolean;
  /** 背景は初期状態でロック(10.3) */
  locked: boolean;
}

/** 縮尺校正(5.1 Calibration) */
export interface Calibration {
  /** 校正結果。未校正時はnull。等方スケール前提(6.1) */
  mmPerPixel: number | null;
  /** 校正基準点(背景画像px座標で保持。再校正時に再利用) */
  pointA: PointPx | null;
  pointB: PointPx | null;
  /** 入力された実距離(mm正規化済み。FR-022) */
  realDistanceMm: number | null;
  calibratedAt: string | null;
}

/** 画面表示状態。実寸データへ影響させない(9.4) */
export interface ViewState {
  /** 表示倍率: 画面px / mm */
  zoom: number;
  panX: number;
  panY: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

/** 配置オブジェクト(9.2 SceneObject最低項目) */
export interface SceneObject {
  id: string;
  type: ObjectType;
  presetId: string | null;
  name: string;
  /** 基準点(中心)の実寸座標 */
  xMm: number;
  yMm: number;
  /** 実寸寸法。正数のみ。回転してもwidth/depthは入れ替えない(6.2) */
  widthMm: number;
  depthMm: number;
  /** 2Dでは非表示だがPhase 0から必須(FR-046)。山台は段高 */
  heightMm: number;
  /** 0〜360へ正規化 */
  rotationDeg: number;
  label: string;
  /** 載っている山台のID(FR-063、Phase 4) */
  onRiserId: string | null;
  /** "seated" | "standing" | null (Phase 5) */
  avatar: string | null;
  locked: boolean;
  visible: boolean;
  groupId: string | null;
  layerId: string;
  zIndex: number;
  shape: ShapeKind;
}

/** 壁トレース(9.3)。Phase 5で使用、Phase 0で型定義のみ */
export interface Wall {
  id: string;
  points: PointMm[];
  /** 押し出し高さ。既定6000mm */
  heightMm: number;
  closed: boolean;
}

export interface ProjectMetadata {
  hallName: string;
  performanceName: string;
  date: string;
  author: string;
  notes: string;
}

export interface ExportSettings {
  paper: "A4" | "A3";
  orientation: "portrait" | "landscape";
  /** 印刷縮尺(FR-082) */
  scale: "1:50" | "1:100" | "fit";
}

/** プロジェクト(9.1) */
export interface Project {
  schemaVersion: string;
  id: string;
  name: string;
  metadata: ProjectMetadata;
  background: Background;
  calibration: Calibration;
  view: ViewState;
  layers: Layer[];
  objects: SceneObject[];
  /** Phase 0から予約。MVPでは空配列 */
  walls: Wall[];
  /** 舞台前端。Phase 5の客席視点に使用 */
  stageFront: { yMm: number } | null;
  exportSettings: ExportSettings;
  updatedAt: string;
}
