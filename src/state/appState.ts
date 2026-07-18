// アプリケーション状態とreducer。
// 編集操作を単一のAction経由に統一し、将来のUndo/Redo(FR-053)を
// コマンド履歴として実装できる構造にしておく(12.1)。

import type {
  PointMm,
  PointPx,
  Project,
  SceneObject,
  ViewState,
} from "../types/project";
import { computeMmPerPixel, normalizeDeg } from "../core/transform";
import { createEmptyProject, generateId } from "../core/project";

export type ToolMode = "select" | "calibrate" | "measure";

/** 未校正時に背景表示のみに使う暫定スケール。実寸配置には使用しない */
export const PROVISIONAL_MM_PER_PX = 10;

export interface AppState {
  project: Project;
  selectedId: string | null;
  /** ライブラリで選択中の配置待ちプリセット */
  pendingPresetId: string | null;
  mode: ToolMode;
  /** 校正モードで打点した点(背景画像px座標) */
  calibPointsPx: PointPx[];
  /** 測定モードで打点した点(実寸mm) */
  measurePointsMm: PointMm[];
  saveState: "saved" | "dirty";
}

export function createInitialState(project?: Project): AppState {
  return {
    project: project ?? createEmptyProject("新規プロジェクト"),
    selectedId: null,
    pendingPresetId: null,
    mode: "select",
    calibPointsPx: [],
    measurePointsMm: [],
    saveState: "saved",
  };
}

/** 校正済みならその値、未校正なら背景表示用の暫定値を返す */
export function effectiveMmPerPixel(project: Project): number {
  return project.calibration.mmPerPixel ?? PROVISIONAL_MM_PER_PX;
}

export type Action =
  | { type: "NEW_PROJECT" }
  | { type: "LOAD_PROJECT"; project: Project }
  | { type: "SET_PROJECT_NAME"; name: string }
  | {
      type: "SET_BACKGROUND";
      imageDataUrl: string;
      naturalWidthPx: number;
      naturalHeightPx: number;
    }
  | { type: "SET_VIEW"; view: ViewState }
  | { type: "SET_MODE"; mode: ToolMode }
  | { type: "SET_PENDING_PRESET"; presetId: string | null }
  | { type: "ADD_OBJECT"; object: SceneObject }
  | { type: "UPDATE_OBJECT"; id: string; patch: Partial<SceneObject> }
  | { type: "MOVE_OBJECT"; id: string; xMm: number; yMm: number }
  | { type: "DELETE_OBJECT"; id: string }
  | { type: "DUPLICATE_OBJECT"; id: string }
  | { type: "SELECT"; id: string | null }
  | { type: "ADD_CALIB_POINT"; point: PointPx }
  | { type: "APPLY_CALIBRATION"; realDistanceMm: number }
  | { type: "CANCEL_CALIBRATION" }
  | { type: "ADD_MEASURE_POINT"; point: PointMm }
  | { type: "CLEAR_MEASURE" }
  | { type: "MARK_SAVED" };

function touch(state: AppState, project: Project): AppState {
  return {
    ...state,
    project: { ...project, updatedAt: new Date().toISOString() },
    saveState: "dirty",
  };
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "NEW_PROJECT":
      return createInitialState();

    case "LOAD_PROJECT":
      return createInitialState(action.project);

    case "SET_PROJECT_NAME":
      return touch(state, { ...state.project, name: action.name });

    case "SET_BACKGROUND":
      return touch(state, {
        ...state.project,
        background: {
          ...state.project.background,
          imageDataUrl: action.imageDataUrl,
          naturalWidthPx: action.naturalWidthPx,
          naturalHeightPx: action.naturalHeightPx,
          crop: null,
          rotationDeg: 0,
        },
      });

    case "SET_VIEW":
      // ズーム・パンは表示のみの変更。実寸データへ影響させない(9.4)
      return { ...state, project: { ...state.project, view: action.view } };

    case "SET_MODE":
      return {
        ...state,
        mode: action.mode,
        calibPointsPx: [],
        measurePointsMm: [],
        pendingPresetId: null,
      };

    case "SET_PENDING_PRESET":
      return { ...state, pendingPresetId: action.presetId, mode: "select" };

    case "ADD_OBJECT":
      return {
        ...touch(state, {
          ...state.project,
          objects: [...state.project.objects, action.object],
        }),
        selectedId: action.object.id,
      };

    case "UPDATE_OBJECT":
      return touch(state, {
        ...state.project,
        objects: state.project.objects.map((o) =>
          o.id === action.id
            ? {
                ...o,
                ...action.patch,
                // 寸法は正数のみ(9.2)。角度は0〜360へ正規化
                widthMm: Math.max(1, action.patch.widthMm ?? o.widthMm),
                depthMm: Math.max(1, action.patch.depthMm ?? o.depthMm),
                heightMm: Math.max(0, action.patch.heightMm ?? o.heightMm),
                rotationDeg: normalizeDeg(action.patch.rotationDeg ?? o.rotationDeg),
              }
            : o,
        ),
      });

    case "MOVE_OBJECT":
      return touch(state, {
        ...state.project,
        objects: state.project.objects.map((o) =>
          o.id === action.id && !o.locked
            ? { ...o, xMm: action.xMm, yMm: action.yMm }
            : o,
        ),
      });

    case "DELETE_OBJECT":
      return {
        ...touch(state, {
          ...state.project,
          objects: state.project.objects.filter((o) => o.id !== action.id),
        }),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case "DUPLICATE_OBJECT": {
      const src = state.project.objects.find((o) => o.id === action.id);
      if (!src) return state;
      const copy: SceneObject = {
        ...src,
        id: generateId("obj"),
        // 複製は少しずらして配置する
        xMm: src.xMm + 500,
        yMm: src.yMm + 500,
        locked: false,
        zIndex: state.project.objects.length,
      };
      return {
        ...touch(state, {
          ...state.project,
          objects: [...state.project.objects, copy],
        }),
        selectedId: copy.id,
      };
    }

    case "SELECT":
      return { ...state, selectedId: action.id };

    case "ADD_CALIB_POINT":
      if (state.calibPointsPx.length >= 2) return state;
      return { ...state, calibPointsPx: [...state.calibPointsPx, action.point] };

    case "APPLY_CALIBRATION": {
      const [a, b] = state.calibPointsPx;
      if (!a || !b) return state;
      // 再校正時も既存オブジェクトのmm座標は変更しない(FR-023)。
      // 背景との相対表示は描画時のmmPerPixel再計算のみで追従する。
      const mmPerPixel = computeMmPerPixel(a, b, action.realDistanceMm);
      return {
        ...touch(state, {
          ...state.project,
          calibration: {
            mmPerPixel,
            pointA: a,
            pointB: b,
            realDistanceMm: action.realDistanceMm,
            calibratedAt: new Date().toISOString(),
          },
        }),
        mode: "select",
        calibPointsPx: [],
      };
    }

    case "CANCEL_CALIBRATION":
      return { ...state, mode: "select", calibPointsPx: [] };

    case "ADD_MEASURE_POINT": {
      const pts =
        state.measurePointsMm.length >= 2
          ? [action.point]
          : [...state.measurePointsMm, action.point];
      return { ...state, measurePointsMm: pts };
    }

    case "CLEAR_MEASURE":
      return { ...state, measurePointsMm: [] };

    case "MARK_SAVED":
      return { ...state, saveState: "saved" };
  }
}
