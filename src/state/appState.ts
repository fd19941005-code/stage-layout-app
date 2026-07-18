// アプリケーション状態とreducer。
// すべての編集をActionへ集約し、履歴・タッチ入力・将来の拡張が同じ状態遷移を通る。

import type {
  BackgroundSourceType,
  CropPx,
  PointMm,
  PointPx,
  Project,
  SceneObject,
  ViewState,
} from "../types/project";
import {
  clampCrop,
  computeMmPerPixel,
  normalizeDeg,
  rotatedBoundsMm,
} from "../core/transform";
import { alignObjects, distributeObjects, selectionBoundsMm, type Alignment, type DistributionAxis } from "../core/layout";
import { createEmptyProject, generateId } from "../core/project";

export type ToolMode = "select" | "selectRect" | "calibrate" | "verifyCalibration" | "measure";

/** 未校正時に背景表示のみに使う暫定スケール。実寸配置には使用しない */
export const PROVISIONAL_MM_PER_PX = 10;
export const MAX_HISTORY_ENTRIES = 50;

export interface ObjectMove {
  id: string;
  xMm: number;
  yMm: number;
}

export interface AppState {
  project: Project;
  /** 後方互換の単一選択参照。複数選択時は先頭を指す */
  selectedId: string | null;
  /** 複数選択の正本。順序は主選択を先頭に保持する */
  selectedIds: string[];
  /** ライブラリで選択中の配置待ちプリセット */
  pendingPresetId: string | null;
  mode: ToolMode;
  /** 校正/校正確認モードで打点した元画像px座標 */
  calibPointsPx: PointPx[];
  /** 測定モードで打点した実寸mm */
  measurePointsMm: PointMm[];
  saveState: "saved" | "dirty";
  /** プロジェクトスナップショット。保存形式へは出さない */
  past: Project[];
  future: Project[];
  /** pointer drag中の最初の状態。pointerupで1操作に確定する */
  transientBaseProject: Project | null;
}

export function createInitialState(project?: Project): AppState {
  return {
    project: project ?? createEmptyProject("新規プロジェクト"),
    selectedId: null,
    selectedIds: [],
    pendingPresetId: null,
    mode: "select",
    calibPointsPx: [],
    measurePointsMm: [],
    saveState: "saved",
    past: [],
    future: [],
    transientBaseProject: null,
  };
}

/** 校正済みならその値、未校正なら背景表示用の暫定値を返す */
export function effectiveMmPerPixel(project: Project): number {
  return project.calibration.mmPerPixel ?? PROVISIONAL_MM_PER_PX;
}

/** AC-013の配置許可条件をUIとテストで共用する */
export function canPlaceObjects(project: Project): boolean {
  return project.calibration.mmPerPixel !== null;
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
      sourceType: BackgroundSourceType;
      sourcePage: number | null;
    }
  | { type: "SET_BACKGROUND_CROP"; crop: CropPx | null }
  | { type: "ROTATE_BACKGROUND"; delta: 90 | -90 }
  | { type: "SET_BACKGROUND_OPACITY"; opacity: number }
  | { type: "SET_BACKGROUND_VISIBLE"; visible: boolean }
  | { type: "SET_BACKGROUND_LOCKED"; locked: boolean }
  | { type: "SET_VIEW"; view: ViewState }
  | { type: "SET_MODE"; mode: ToolMode }
  | { type: "SET_PENDING_PRESET"; presetId: string | null }
  | { type: "ADD_OBJECT"; object: SceneObject }
  | { type: "UPDATE_OBJECT"; id: string; patch: Partial<SceneObject> }
  | { type: "MOVE_OBJECT"; id: string; xMm: number; yMm: number }
  | { type: "MOVE_OBJECTS"; moves: ObjectMove[]; preview?: boolean }
  | { type: "ROTATE_OBJECT"; id: string; rotationDeg: number; preview?: boolean }
  | { type: "DELETE_OBJECT"; id: string }
  | { type: "DELETE_SELECTED" }
  | { type: "DUPLICATE_OBJECT"; id: string }
  | { type: "DUPLICATE_SELECTED" }
  | { type: "ALIGN_SELECTED"; alignment: Alignment }
  | { type: "DISTRIBUTE_SELECTED"; axis: DistributionAxis }
  | { type: "GROUP_SELECTED" }
  | { type: "UNGROUP_SELECTED" }
  | { type: "SET_SELECTED_LOCKED"; locked: boolean }
  | { type: "SELECT"; id: string | null; additive?: boolean }
  | { type: "SELECT_MANY"; ids: string[]; additive?: boolean }
  | {
      type: "SELECT_RECT";
      bounds: { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number };
      additive?: boolean;
    }
  | { type: "ADD_CALIB_POINT"; point: PointPx }
  | { type: "CLEAR_CALIB_POINTS" }
  | { type: "APPLY_CALIBRATION"; realDistanceMm: number }
  | { type: "CANCEL_CALIBRATION" }
  | { type: "ADD_MEASURE_POINT"; point: PointMm }
  | { type: "CLEAR_MEASURE" }
  | { type: "COMMIT_TRANSIENT_EDIT" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "MARK_SAVED" };

function setSelection(state: AppState, ids: readonly string[]): AppState {
  const available = new Set(state.project.objects.map((object) => object.id));
  const unique = [...new Set(ids)].filter((id) => available.has(id));
  return {
    ...state,
    selectedIds: unique,
    selectedId: unique[0] ?? null,
  };
}

function pushPast(past: readonly Project[], project: Project): Project[] {
  return [...past, project].slice(-MAX_HISTORY_ENTRIES);
}

function commitProject(state: AppState, project: Project): AppState {
  return {
    ...state,
    project: { ...project, updatedAt: new Date().toISOString() },
    past: pushPast(state.past, state.project),
    future: [],
    transientBaseProject: null,
    saveState: "dirty",
  };
}

function previewProject(state: AppState, project: Project): AppState {
  return {
    ...state,
    project: { ...project, updatedAt: new Date().toISOString() },
    transientBaseProject: state.transientBaseProject ?? state.project,
    saveState: "dirty",
  };
}

function commitTransientEdit(state: AppState): AppState {
  if (!state.transientBaseProject) return state;
  return {
    ...state,
    past: pushPast(state.past, state.transientBaseProject),
    future: [],
    transientBaseProject: null,
    saveState: "dirty",
  };
}

function deleteObjects(state: AppState, ids: readonly string[]): AppState {
  const idSet = new Set(ids);
  const next = commitProject(state, {
    ...state.project,
    objects: state.project.objects.filter((object) => !idSet.has(object.id)),
  });
  return setSelection(next, state.selectedIds.filter((id) => !idSet.has(id)));
}

function duplicateObjects(state: AppState, ids: readonly string[]): AppState {
  const selected = state.project.objects.filter((object) => ids.includes(object.id));
  if (selected.length === 0) return state;
  const copies = selected.map((source, index) => ({
    ...source,
    id: generateId("obj"),
    xMm: source.xMm + 500,
    yMm: source.yMm + 500,
    locked: false,
    zIndex: state.project.objects.length + index,
  }));
  const next = commitProject(state, {
    ...state.project,
    objects: [...state.project.objects, ...copies],
  });
  return setSelection(next, copies.map((copy) => copy.id));
}

function undoState(state: AppState): AppState {
  const committed = commitTransientEdit(state);
  const previous = committed.past[committed.past.length - 1];
  if (!previous) return committed;
  const next: AppState = {
    ...committed,
    project: previous,
    past: committed.past.slice(0, -1),
    future: [committed.project, ...committed.future].slice(0, MAX_HISTORY_ENTRIES),
    transientBaseProject: null,
    saveState: "dirty",
  };
  return setSelection(next, next.selectedIds);
}

function redoState(state: AppState): AppState {
  const committed = commitTransientEdit(state);
  const nextProject = committed.future[0];
  if (!nextProject) return committed;
  const next: AppState = {
    ...committed,
    project: nextProject,
    past: [...committed.past, committed.project].slice(-MAX_HISTORY_ENTRIES),
    future: committed.future.slice(1),
    transientBaseProject: null,
    saveState: "dirty",
  };
  return setSelection(next, next.selectedIds);
}

function normalizedBackgroundRotation(value: number): 0 | 90 | 180 | 270 {
  const normalized = ((value % 360) + 360) % 360;
  return normalized as 0 | 90 | 180 | 270;
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "NEW_PROJECT":
      return createInitialState();
    case "LOAD_PROJECT":
      return createInitialState(action.project);
    case "SET_PROJECT_NAME":
      return commitProject(state, { ...state.project, name: action.name });
    case "SET_BACKGROUND":
      return commitProject(state, {
        ...state.project,
        background: {
          ...state.project.background,
          imageDataUrl: action.imageDataUrl,
          naturalWidthPx: action.naturalWidthPx,
          naturalHeightPx: action.naturalHeightPx,
          sourceType: action.sourceType,
          sourcePage: action.sourcePage,
          crop: null,
          rotationDeg: 0,
        },
        calibration: {
          mmPerPixel: null,
          pointA: null,
          pointB: null,
          realDistanceMm: null,
          calibratedAt: null,
        },
      });
    case "SET_BACKGROUND_CROP":
      return commitProject(state, {
        ...state.project,
        background: {
          ...state.project.background,
          crop: action.crop
            ? clampCrop(action.crop, state.project.background.naturalWidthPx, state.project.background.naturalHeightPx)
            : null,
        },
      });
    case "ROTATE_BACKGROUND":
      return commitProject(state, {
        ...state.project,
        background: {
          ...state.project.background,
          rotationDeg: normalizedBackgroundRotation(state.project.background.rotationDeg + action.delta),
        },
      });
    case "SET_BACKGROUND_OPACITY":
      return commitProject(state, {
        ...state.project,
        background: { ...state.project.background, opacity: Math.min(1, Math.max(0, action.opacity)) },
      });
    case "SET_BACKGROUND_VISIBLE":
      return commitProject(state, { ...state.project, background: { ...state.project.background, visible: action.visible } });
    case "SET_BACKGROUND_LOCKED":
      return commitProject(state, { ...state.project, background: { ...state.project.background, locked: action.locked } });
    case "SET_VIEW":
      return { ...state, project: { ...state.project, view: action.view } };
    case "SET_MODE":
      return { ...state, mode: action.mode, calibPointsPx: [], measurePointsMm: [], pendingPresetId: null };
    case "SET_PENDING_PRESET":
      return { ...state, pendingPresetId: action.presetId, mode: "select" };
    case "ADD_OBJECT":
      return setSelection(commitProject(state, { ...state.project, objects: [...state.project.objects, action.object] }), [action.object.id]);
    case "UPDATE_OBJECT":
      return commitProject(state, {
        ...state.project,
        objects: state.project.objects.map((object) =>
          object.id === action.id
            ? {
                ...object,
                ...action.patch,
                widthMm: Math.max(1, action.patch.widthMm ?? object.widthMm),
                depthMm: Math.max(1, action.patch.depthMm ?? object.depthMm),
                heightMm: Math.max(0, action.patch.heightMm ?? object.heightMm),
                rotationDeg: normalizeDeg(action.patch.rotationDeg ?? object.rotationDeg),
              }
            : object,
        ),
      });
    case "MOVE_OBJECT":
      return commitProject(state, {
        ...state.project,
        objects: state.project.objects.map((object) =>
          object.id === action.id && !object.locked ? { ...object, xMm: action.xMm, yMm: action.yMm } : object,
        ),
      });
    case "MOVE_OBJECTS": {
      const moves = new Map(action.moves.map((move) => [move.id, move]));
      const project = {
        ...state.project,
        objects: state.project.objects.map((object) => {
          const move = moves.get(object.id);
          return move && !object.locked ? { ...object, xMm: move.xMm, yMm: move.yMm } : object;
        }),
      };
      return action.preview ? previewProject(state, project) : commitProject(state, project);
    }
    case "ROTATE_OBJECT": {
      const project = {
        ...state.project,
        objects: state.project.objects.map((object) =>
          object.id === action.id && !object.locked ? { ...object, rotationDeg: normalizeDeg(action.rotationDeg) } : object,
        ),
      };
      return action.preview ? previewProject(state, project) : commitProject(state, project);
    }
    case "DELETE_OBJECT":
      return deleteObjects(state, [action.id]);
    case "DELETE_SELECTED":
      return deleteObjects(state, state.selectedIds);
    case "DUPLICATE_OBJECT":
      return duplicateObjects(state, [action.id]);
    case "DUPLICATE_SELECTED":
      return duplicateObjects(state, state.selectedIds);
    case "ALIGN_SELECTED":
      return commitProject(state, { ...state.project, objects: alignObjects(state.project.objects, state.selectedIds, action.alignment) });
    case "DISTRIBUTE_SELECTED":
      return commitProject(state, { ...state.project, objects: distributeObjects(state.project.objects, state.selectedIds, action.axis) });
    case "GROUP_SELECTED": {
      if (state.selectedIds.length < 2) return state;
      const groupId = generateId("group");
      return commitProject(state, { ...state.project, objects: state.project.objects.map((object) => state.selectedIds.includes(object.id) ? { ...object, groupId } : object) });
    }
    case "UNGROUP_SELECTED":
      return commitProject(state, { ...state.project, objects: state.project.objects.map((object) => state.selectedIds.includes(object.id) ? { ...object, groupId: null } : object) });
    case "SET_SELECTED_LOCKED": {
      const groupIds = new Set(state.project.objects.filter((object) => state.selectedIds.includes(object.id) && object.groupId).map((object) => object.groupId as string));
      return commitProject(state, { ...state.project, objects: state.project.objects.map((object) => state.selectedIds.includes(object.id) || (object.groupId !== null && groupIds.has(object.groupId)) ? { ...object, locked: action.locked } : object) });
    }
    case "SELECT": {
      if (!action.id) return setSelection(state, []);
      if (!action.additive) return setSelection(state, [action.id]);
      const next = state.selectedIds.includes(action.id) ? state.selectedIds.filter((id) => id !== action.id) : [...state.selectedIds, action.id];
      return setSelection(state, next);
    }
    case "SELECT_MANY":
      return setSelection(state, action.additive ? [...state.selectedIds, ...action.ids] : action.ids);
    case "SELECT_RECT": {
      const ids = state.project.objects.filter((object) => {
        if (!object.visible) return false;
        const bounds = rotatedBoundsMm(object);
        return bounds.minXMm >= action.bounds.minXMm && bounds.maxXMm <= action.bounds.maxXMm && bounds.minYMm >= action.bounds.minYMm && bounds.maxYMm <= action.bounds.maxYMm;
      }).map((object) => object.id);
      return setSelection(state, action.additive ? [...state.selectedIds, ...ids] : ids);
    }
    case "ADD_CALIB_POINT":
      if (state.calibPointsPx.length >= 2) return state;
      return { ...state, calibPointsPx: [...state.calibPointsPx, action.point] };
    case "CLEAR_CALIB_POINTS":
      return { ...state, calibPointsPx: [] };
    case "APPLY_CALIBRATION": {
      const [a, b] = state.calibPointsPx;
      if (!a || !b) return state;
      const mmPerPixel = computeMmPerPixel(a, b, action.realDistanceMm);
      return { ...commitProject(state, { ...state.project, calibration: { mmPerPixel, pointA: a, pointB: b, realDistanceMm: action.realDistanceMm, calibratedAt: new Date().toISOString() } }), mode: "select", calibPointsPx: [] };
    }
    case "CANCEL_CALIBRATION":
      return { ...state, mode: "select", calibPointsPx: [] };
    case "ADD_MEASURE_POINT":
      return { ...state, measurePointsMm: state.measurePointsMm.length >= 2 ? [action.point] : [...state.measurePointsMm, action.point] };
    case "CLEAR_MEASURE":
      return { ...state, measurePointsMm: [] };
    case "COMMIT_TRANSIENT_EDIT":
      return commitTransientEdit(state);
    case "UNDO":
      return undoState(state);
    case "REDO":
      return redoState(state);
    case "MARK_SAVED":
      return { ...state, saveState: "saved" };
  }
}

export { selectionBoundsMm };
