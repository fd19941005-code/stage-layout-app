// アプリケーション状態とreducer。
// すべての編集をActionへ集約し、履歴・タッチ入力・出力設定も同じ状態遷移を通る。

import type {
  BackgroundSourceType,
  CropPx,
  ExportSettings,
  PointMm,
  PointPx,
  Project,
  ProjectMetadata,
  SceneObject,
  SnapSettings,
  ViewState,
} from "../types/project";
import { clampCrop, computeMmPerPixel, normalizeDeg, sceneObjectBoundsMm } from "../core/transform";
import { alignObjects, distributeObjects, selectionBoundsMm, type Alignment, type DistributionAxis } from "../core/layout";
import { createGridCopies, createPultArcObjects, type GridPlacementOptions, type PultArcOptions } from "../core/arrangement";
import { DEFAULT_SNAP_SETTINGS } from "../core/snap";
import { createEmptyProject, DEFAULT_LAYER_ID, generateId } from "../core/project";
import { findPreset } from "../core/presets";

export type ToolMode =
  | "select"
  | "selectRect"
  | "calibrate"
  | "verifyCalibration"
  | "measure"
  | "annotationText"
  | "annotationLine"
  | "annotationArrow"
  | "annotationRect"
  | "annotationCircle"
  | "annotationDimension";
export const PROVISIONAL_MM_PER_PX = 10;
export const MAX_HISTORY_ENTRIES = 50;

export interface ObjectMove { id: string; xMm: number; yMm: number; }

export interface AppState {
  project: Project;
  selectedId: string | null;
  selectedIds: string[];
  pendingPresetId: string | null;
  placementContinuous: boolean;
  activeLayerId: string;
  mode: ToolMode;
  calibPointsPx: PointPx[];
  measurePointsMm: PointMm[];
  saveState: "saved" | "dirty";
  past: Project[];
  future: Project[];
  transientBaseProject: Project | null;
}

function defaultActiveLayer(project: Project): string {
  return project.layers.find((layer) => layer.id === DEFAULT_LAYER_ID)?.id
    ?? project.layers[0]?.id
    ?? DEFAULT_LAYER_ID;
}

export function createInitialState(project?: Project): AppState {
  const nextProject = project ?? createEmptyProject("新規プロジェクト");
  return {
    project: nextProject,
    selectedId: null,
    selectedIds: [],
    pendingPresetId: null,
    placementContinuous: false,
    activeLayerId: defaultActiveLayer(nextProject),
    mode: "select",
    calibPointsPx: [],
    measurePointsMm: [],
    saveState: "saved",
    past: [],
    future: [],
    transientBaseProject: null,
  };
}

export function effectiveMmPerPixel(project: Project): number {
  return project.calibration.mmPerPixel ?? PROVISIONAL_MM_PER_PX;
}

export function canPlaceObjects(project: Project): boolean {
  return project.calibration.mmPerPixel !== null;
}

export type Action =
  | { type: "NEW_PROJECT" }
  | { type: "LOAD_PROJECT"; project: Project }
  | { type: "SET_PROJECT_NAME"; name: string }
  | { type: "SET_METADATA"; metadata: ProjectMetadata }
  | { type: "SET_EXPORT_SETTINGS"; settings: ExportSettings }
  | { type: "SET_BACKGROUND"; imageDataUrl: string; naturalWidthPx: number; naturalHeightPx: number; sourceType: BackgroundSourceType; sourcePage: number | null }
  | { type: "SET_BACKGROUND_CROP"; crop: CropPx | null }
  | { type: "ROTATE_BACKGROUND"; delta: 90 | -90 }
  | { type: "SET_BACKGROUND_OPACITY"; opacity: number }
  | { type: "SET_BACKGROUND_VISIBLE"; visible: boolean }
  | { type: "SET_BACKGROUND_LOCKED"; locked: boolean }
  | { type: "SET_VIEW"; view: ViewState }
  | { type: "SET_ACTIVE_LAYER"; layerId: string }
  | { type: "SET_LAYER_VISIBLE"; layerId: string; visible: boolean }
  | { type: "SET_LAYER_LOCKED"; layerId: string; locked: boolean }
  | { type: "SET_LAYER_NAME"; layerId: string; name: string }
  | { type: "SET_SNAP_SETTINGS"; settings: SnapSettings }
  | { type: "SET_MODE"; mode: ToolMode }
  | { type: "SET_PLACEMENT_CONTINUOUS"; continuous: boolean }
  | { type: "SET_PENDING_PRESET"; presetId: string | null }
  | { type: "ADD_OBJECT"; object: SceneObject; keepPending?: boolean }
  | { type: "UPDATE_OBJECT"; id: string; patch: Partial<SceneObject> }
  | { type: "MOVE_OBJECT"; id: string; xMm: number; yMm: number }
  | { type: "MOVE_OBJECTS"; moves: ObjectMove[]; preview?: boolean }
  | { type: "ROTATE_OBJECT"; id: string; rotationDeg: number; preview?: boolean }
  | { type: "DELETE_OBJECT"; id: string }
  | { type: "DELETE_SELECTED" }
  | { type: "DUPLICATE_OBJECT"; id: string }
  | { type: "DUPLICATE_SELECTED" }
  | { type: "DUPLICATE_GRID"; sourceId: string; options: GridPlacementOptions }
  | { type: "ADD_PULT_ARC"; options: PultArcOptions }
  | { type: "ALIGN_SELECTED"; alignment: Alignment }
  | { type: "DISTRIBUTE_SELECTED"; axis: DistributionAxis }
  | { type: "GROUP_SELECTED" }
  | { type: "UNGROUP_SELECTED" }
  | { type: "SET_SELECTED_LOCKED"; locked: boolean }
  | { type: "SELECT"; id: string | null; additive?: boolean }
  | { type: "SELECT_MANY"; ids: string[]; additive?: boolean }
  | { type: "SELECT_RECT"; bounds: { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number }; additive?: boolean }
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

function layerFor(project: Project, layerId: string) {
  return project.layers.find((layer) => layer.id === layerId);
}

function layerIsVisible(project: Project, layerId: string): boolean {
  return layerFor(project, layerId)?.visible ?? true;
}

function layerIsLocked(project: Project, layerId: string): boolean {
  return layerFor(project, layerId)?.locked ?? false;
}

function objectIsEditable(project: Project, object: SceneObject): boolean {
  return !object.locked && !layerIsLocked(project, object.layerId);
}

function setSelection(state: AppState, ids: readonly string[]): AppState {
  const available = new Set(
    state.project.objects
      .filter((object) => object.visible && layerIsVisible(state.project, object.layerId))
      .map((object) => object.id),
  );
  const unique = [...new Set(ids)].filter((id) => available.has(id));
  return { ...state, selectedIds: unique, selectedId: unique[0] ?? null };
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
  const idSet = new Set(
    state.project.objects
      .filter((object) => ids.includes(object.id) && objectIsEditable(state.project, object))
      .map((object) => object.id),
  );
  if (idSet.size === 0) return state;
  const next = commitProject(state, {
    ...state.project,
    objects: state.project.objects.filter((object) => !idSet.has(object.id)),
  });
  return setSelection(next, state.selectedIds.filter((id) => !idSet.has(id)));
}

function offsetObject(source: SceneObject, id: string, zIndex: number): SceneObject {
  const dx = 500;
  const dy = 500;
  return {
    ...source,
    id,
    xMm: source.xMm + dx,
    yMm: source.yMm + dy,
    endXMm: typeof source.endXMm === "number" ? source.endXMm + dx : source.endXMm,
    endYMm: typeof source.endYMm === "number" ? source.endYMm + dy : source.endYMm,
    locked: false,
    zIndex,
  };
}

function duplicateObjects(state: AppState, ids: readonly string[]): AppState {
  const selected = state.project.objects.filter((object) =>
    ids.includes(object.id) && !layerIsLocked(state.project, object.layerId),
  );
  if (selected.length === 0) return state;
  const copies = selected.map((source, index) => offsetObject(
    source,
    generateId("obj"),
    state.project.objects.length + index,
  ));
  const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...copies] });
  return setSelection(next, copies.map((copy) => copy.id));
}

function editableSelectedIds(state: AppState): string[] {
  return state.selectedIds.filter((id) => {
    const object = state.project.objects.find((candidate) => candidate.id === id);
    return object ? objectIsEditable(state.project, object) : false;
  });
}

function createPresetObject(presetId: string, layerId: string, zIndex: number): SceneObject | null {
  const preset = findPreset(presetId);
  if (!preset) return null;
  return {
    id: generateId("obj"),
    type: preset.type,
    presetId: preset.id,
    name: preset.name,
    xMm: 0,
    yMm: 0,
    widthMm: preset.widthMm,
    depthMm: preset.depthMm,
    heightMm: preset.heightMm,
    rotationDeg: 0,
    label: "",
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId,
    zIndex,
    shape: preset.shape,
  };
}

function normalizedBackgroundRotation(value: number): 0 | 90 | 180 | 270 {
  return (((value % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

function normalizeSnapSettings(settings: SnapSettings): SnapSettings {
  return {
    grid: Boolean(settings.grid),
    objects: Boolean(settings.objects),
    stageCenter: Boolean(settings.stageCenter),
    gridIntervalMm: Math.max(1, Number.isFinite(settings.gridIntervalMm) ? settings.gridIntervalMm : DEFAULT_SNAP_SETTINGS.gridIntervalMm),
    thresholdMm: Math.max(0, Number.isFinite(settings.thresholdMm) ? settings.thresholdMm : DEFAULT_SNAP_SETTINGS.thresholdMm),
  };
}

function updateObject(state: AppState, id: string, patch: Partial<SceneObject>): AppState {
  const current = state.project.objects.find((object) => object.id === id);
  if (!current) return state;
  const changingFields = Object.keys(patch).some((key) => key !== "locked");
  const targetLayerId = typeof patch.layerId === "string" ? patch.layerId : current.layerId;
  if (layerIsLocked(state.project, targetLayerId)) return state;
  if (changingFields && !objectIsEditable(state.project, current)) return state;
  const nextObject: SceneObject = {
    ...current,
    ...patch,
    xMm: Number.isFinite(patch.xMm) ? patch.xMm as number : current.xMm,
    yMm: Number.isFinite(patch.yMm) ? patch.yMm as number : current.yMm,
    widthMm: Math.max(1, Number.isFinite(patch.widthMm) ? patch.widthMm as number : current.widthMm),
    depthMm: Math.max(1, Number.isFinite(patch.depthMm) ? patch.depthMm as number : current.depthMm),
    heightMm: Math.max(0, Number.isFinite(patch.heightMm) ? patch.heightMm as number : current.heightMm),
    rotationDeg: normalizeDeg(Number.isFinite(patch.rotationDeg) ? patch.rotationDeg as number : current.rotationDeg),
  };
  return commitProject(state, {
    ...state.project,
    objects: state.project.objects.map((object) => object.id === id ? nextObject : object),
  });
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
    activeLayerId: layerFor(previous, committed.activeLayerId) ? committed.activeLayerId : defaultActiveLayer(previous),
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
    activeLayerId: layerFor(nextProject, committed.activeLayerId) ? committed.activeLayerId : defaultActiveLayer(nextProject),
  };
  return setSelection(next, next.selectedIds);
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "NEW_PROJECT": return createInitialState();
    case "LOAD_PROJECT": return createInitialState(action.project);
    case "SET_PROJECT_NAME": return commitProject(state, { ...state.project, name: action.name });
    case "SET_METADATA": return commitProject(state, { ...state.project, metadata: { ...action.metadata } });
    case "SET_EXPORT_SETTINGS": return commitProject(state, { ...state.project, exportSettings: { ...action.settings } });
    case "SET_BACKGROUND": return commitProject(state, {
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
      calibration: { mmPerPixel: null, pointA: null, pointB: null, realDistanceMm: null, calibratedAt: null },
    });
    case "SET_BACKGROUND_CROP": return commitProject(state, { ...state.project, background: { ...state.project.background, crop: action.crop ? clampCrop(action.crop, state.project.background.naturalWidthPx, state.project.background.naturalHeightPx) : null } });
    case "ROTATE_BACKGROUND": return commitProject(state, { ...state.project, background: { ...state.project.background, rotationDeg: normalizedBackgroundRotation(state.project.background.rotationDeg + action.delta) } });
    case "SET_BACKGROUND_OPACITY": return commitProject(state, { ...state.project, background: { ...state.project.background, opacity: Math.min(1, Math.max(0, action.opacity)) } });
    case "SET_BACKGROUND_VISIBLE": return commitProject(state, { ...state.project, background: { ...state.project.background, visible: action.visible } });
    case "SET_BACKGROUND_LOCKED": return commitProject(state, { ...state.project, background: { ...state.project.background, locked: action.locked } });
    case "SET_VIEW": return { ...state, project: { ...state.project, view: action.view } };
    case "SET_ACTIVE_LAYER": return layerFor(state.project, action.layerId) ? { ...state, activeLayerId: action.layerId, pendingPresetId: null } : state;
    case "SET_LAYER_VISIBLE": {
      if (!layerFor(state.project, action.layerId)) return state;
      const next = commitProject(state, { ...state.project, layers: state.project.layers.map((layer) => layer.id === action.layerId ? { ...layer, visible: action.visible } : layer) });
      return action.visible ? next : setSelection(next, next.selectedIds);
    }
    case "SET_LAYER_LOCKED": {
      if (!layerFor(state.project, action.layerId)) return state;
      return commitProject(state, { ...state.project, layers: state.project.layers.map((layer) => layer.id === action.layerId ? { ...layer, locked: action.locked } : layer) });
    }
    case "SET_LAYER_NAME": {
      if (!layerFor(state.project, action.layerId)) return state;
      return commitProject(state, { ...state.project, layers: state.project.layers.map((layer) => layer.id === action.layerId ? { ...layer, name: action.name } : layer) });
    }
    case "SET_SNAP_SETTINGS": return commitProject(state, { ...state.project, snapSettings: normalizeSnapSettings(action.settings) });
    case "SET_MODE": return { ...state, mode: action.mode, calibPointsPx: [], measurePointsMm: [], pendingPresetId: null };
    case "SET_PLACEMENT_CONTINUOUS": return { ...state, placementContinuous: action.continuous };
    case "SET_PENDING_PRESET": return { ...state, pendingPresetId: action.presetId, mode: "select" };
    case "ADD_OBJECT": {
      if (layerIsLocked(state.project, action.object.layerId) || !layerIsVisible(state.project, action.object.layerId)) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, action.object] });
      return setSelection({ ...next, pendingPresetId: action.keepPending ? next.pendingPresetId : null }, [action.object.id]);
    }
    case "UPDATE_OBJECT": return updateObject(state, action.id, action.patch);
    case "MOVE_OBJECT": {
      const object = state.project.objects.find((candidate) => candidate.id === action.id);
      if (!object || !objectIsEditable(state.project, object)) return state;
      const deltaX = action.xMm - object.xMm;
      const deltaY = action.yMm - object.yMm;
      return commitProject(state, {
        ...state.project,
        objects: state.project.objects.map((candidate) => candidate.id === action.id
          ? {
              ...candidate,
              xMm: action.xMm,
              yMm: action.yMm,
              endXMm: typeof candidate.endXMm === "number" ? candidate.endXMm + deltaX : candidate.endXMm,
              endYMm: typeof candidate.endYMm === "number" ? candidate.endYMm + deltaY : candidate.endYMm,
            }
          : candidate),
      });
    }
    case "MOVE_OBJECTS": {
      const moves = new Map(action.moves.map((move) => [move.id, move]));
      const project = {
        ...state.project,
        objects: state.project.objects.map((object) => {
          const move = moves.get(object.id);
          if (!move || !objectIsEditable(state.project, object)) return object;
          const deltaX = move.xMm - object.xMm;
          const deltaY = move.yMm - object.yMm;
          return {
            ...object,
            xMm: move.xMm,
            yMm: move.yMm,
            endXMm: typeof object.endXMm === "number" ? object.endXMm + deltaX : object.endXMm,
            endYMm: typeof object.endYMm === "number" ? object.endYMm + deltaY : object.endYMm,
          };
        }),
      };
      return action.preview ? previewProject(state, project) : commitProject(state, project);
    }
    case "ROTATE_OBJECT": {
      const object = state.project.objects.find((candidate) => candidate.id === action.id);
      if (!object || !objectIsEditable(state.project, object)) return state;
      const project = { ...state.project, objects: state.project.objects.map((candidate) => candidate.id === action.id ? { ...candidate, rotationDeg: normalizeDeg(action.rotationDeg) } : candidate) };
      return action.preview ? previewProject(state, project) : commitProject(state, project);
    }
    case "DELETE_OBJECT": return deleteObjects(state, [action.id]);
    case "DELETE_SELECTED": return deleteObjects(state, state.selectedIds);
    case "DUPLICATE_OBJECT": return duplicateObjects(state, [action.id]);
    case "DUPLICATE_SELECTED": return duplicateObjects(state, state.selectedIds);
    case "DUPLICATE_GRID": {
      const source = state.project.objects.find((object) => object.id === action.sourceId);
      if (!source || !objectIsEditable(state.project, source)) return state;
      const copies = createGridCopies(source, action.options, (index) => generateId(`grid${index + 1}`));
      if (copies.length === 0) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...copies] });
      return setSelection(next, copies.map((copy) => copy.id));
    }
    case "ADD_PULT_ARC": {
      const layerId = action.options.layerId || state.activeLayerId;
      if (layerIsLocked(state.project, layerId) || !layerIsVisible(state.project, layerId)) return state;
      const chair = createPresetObject("chair", layerId, state.project.objects.length);
      const stand = createPresetObject("music-stand", layerId, state.project.objects.length + 1);
      if (!chair || !stand) return state;
      const copies = createPultArcObjects(chair, stand, { ...action.options, layerId }, (index, role, pultIndex = 0) => generateId(`pult${pultIndex + 1}-${role}-${index + 1}`));
      if (copies.length === 0) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...copies] });
      return setSelection(next, copies.map((copy) => copy.id));
    }
    case "ALIGN_SELECTED": {
      const ids = editableSelectedIds(state);
      return commitProject(state, { ...state.project, objects: alignObjects(state.project.objects, ids, action.alignment) });
    }
    case "DISTRIBUTE_SELECTED": {
      const ids = editableSelectedIds(state);
      return commitProject(state, { ...state.project, objects: distributeObjects(state.project.objects, ids, action.axis) });
    }
    case "GROUP_SELECTED": {
      const ids = editableSelectedIds(state);
      if (ids.length < 2) return state;
      const groupId = generateId("group");
      return commitProject(state, { ...state.project, objects: state.project.objects.map((object) => ids.includes(object.id) ? { ...object, groupId } : object) });
    }
    case "UNGROUP_SELECTED": {
      const ids = editableSelectedIds(state);
      return commitProject(state, { ...state.project, objects: state.project.objects.map((object) => ids.includes(object.id) ? { ...object, groupId: null } : object) });
    }
    case "SET_SELECTED_LOCKED": {
      const ids = state.selectedIds.filter((id) => {
        const object = state.project.objects.find((candidate) => candidate.id === id);
        return object ? !layerIsLocked(state.project, object.layerId) : false;
      });
      const groupIds = new Set(state.project.objects.filter((object) => ids.includes(object.id) && object.groupId).map((object) => object.groupId as string));
      return commitProject(state, { ...state.project, objects: state.project.objects.map((object) => ids.includes(object.id) || (object.groupId !== null && groupIds.has(object.groupId) && !layerIsLocked(state.project, object.layerId)) ? { ...object, locked: action.locked } : object) });
    }
    case "SELECT": {
      if (!action.id) return setSelection(state, []);
      if (!state.project.objects.some((object) => object.id === action.id && object.visible && layerIsVisible(state.project, object.layerId))) return state;
      if (!action.additive) return setSelection(state, [action.id]);
      return setSelection(state, state.selectedIds.includes(action.id) ? state.selectedIds.filter((id) => id !== action.id) : [...state.selectedIds, action.id]);
    }
    case "SELECT_MANY": return setSelection(state, action.additive ? [...state.selectedIds, ...action.ids] : action.ids);
    case "SELECT_RECT": {
      const ids = state.project.objects.filter((object) => {
        if (!object.visible || !layerIsVisible(state.project, object.layerId)) return false;
        const bounds = sceneObjectBoundsMm(object);
        return bounds.minXMm >= action.bounds.minXMm && bounds.maxXMm <= action.bounds.maxXMm && bounds.minYMm >= action.bounds.minYMm && bounds.maxYMm <= action.bounds.maxYMm;
      }).map((object) => object.id);
      return setSelection(state, action.additive ? [...state.selectedIds, ...ids] : ids);
    }
    case "ADD_CALIB_POINT": if (state.calibPointsPx.length >= 2) return state; return { ...state, calibPointsPx: [...state.calibPointsPx, action.point] };
    case "CLEAR_CALIB_POINTS": return { ...state, calibPointsPx: [] };
    case "APPLY_CALIBRATION": {
      const [a, b] = state.calibPointsPx;
      if (!a || !b) return state;
      const mmPerPixel = computeMmPerPixel(a, b, action.realDistanceMm);
      return { ...commitProject(state, { ...state.project, calibration: { mmPerPixel, pointA: a, pointB: b, realDistanceMm: action.realDistanceMm, calibratedAt: new Date().toISOString() } }), mode: "select", calibPointsPx: [] };
    }
    case "CANCEL_CALIBRATION": return { ...state, mode: "select", calibPointsPx: [] };
    case "ADD_MEASURE_POINT": return { ...state, measurePointsMm: state.measurePointsMm.length >= 2 ? [action.point] : [...state.measurePointsMm, action.point] };
    case "CLEAR_MEASURE": return { ...state, measurePointsMm: [] };
    case "COMMIT_TRANSIENT_EDIT": return commitTransientEdit(state);
    case "UNDO": return undoState(state);
    case "REDO": return redoState(state);
    case "MARK_SAVED": return { ...state, saveState: "saved" };
  }
}

export { selectionBoundsMm };










