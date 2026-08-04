// アプリケーション状態とreducer。
// すべての編集をActionへ集約し、履歴・タッチ入力・出力設定も同じ状態遷移を通る。

import type {
  BackgroundSourceType,
  Guide,
  CropPx,
  ExportSettings,
  PointMm,
  PointPx,
  Project,
  ProjectDisplaySettings,
  ProjectMetadata,
  SceneObject,
  SnapSettings,
  ViewState,
  Wall,
} from "../types/project";
import { clampCrop, computeMmPerPixel, normalizeDeg, sceneObjectBoundsMm } from "../core/transform";
import { alignObjects, arrangeObjectsInLine, boundsIntersectMm, distributeObjects, selectionBoundsMm, selectionUnits, setObjectsBackgroundFixed, validateLineArrangement, type Alignment, type DistributionAxis, type LineArrangementOptions } from "../core/layout";
import {
  createChairArcRowObjects,
  DEFAULT_CHAIR_FACING_ROTATION_DEG,
  createChairLineObjects,
  createGridCopies,
  createPultArcObjects,
  createRiserGroupObjects,
  riserParallelRows,
  validateRiserGroupOptions,
  validateChairLineOptions,
  validateChairArcRowsOptions,
  type ChairArcRowsOptions,
  type ChairLineOptions,
  type GridPlacementOptions,
  type PultArcOptions,
  type RiserGroupLayoutOptions,
  type RiserPresetId,
} from "../core/arrangement";
import { createChairMusicStandSetObjects } from "../core/chairMusicStandSet";
import {
  STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID,
  STRING_LAYOUT_12_SEAT_PRESET_ID,
  STRING_LAYOUT_12_STAND_PRESET_ID,
  createStringLayout12Objects,
  validateStringLayout12Options,
  type StringLayout12Options,
} from "../core/stringLayout12";
import { DEFAULT_SNAP_SETTINGS } from "../core/snap";
import { addGuideToProject, addStageCenterGuideToProject, addStageFrontGuideToProject, deleteGuideFromProject, moveGuideInProject, setGuideLockedInProject, setGuideVisibleInProject, synchronizeProjectGuides, updateGuideInProject } from "../core/guideState";
import { DEFAULT_LIBRARY_PREFERENCES, normalizeLibraryPreferences, recordRecentPresets, toggleFavoritePreset, type LibraryPreferences } from "../core/library";
import { createEmptyProject, DEFAULT_LAYER_ID, generateId } from "../core/project";
import { createStageTemplate, isProjectReadyForPlacement } from "../core/stageTemplate";
import { CONCERT_TOM_SET_LAYOUT, TIMPANI_SET_LAYOUT } from "../core/instrumentCatalog";
import { CHAIR_MUSIC_STAND_SET_PRESET_ID, findPreset, isObjectResizable } from "../core/presets";
import { defaultAssetVariantIdForPreset, visualAssetVariantsForPreset } from "../core/symbolAssets";
import { isCuttableSelection } from "../core/objectClipboard";
import { createMirroredObjects, rotateObjectsByDelta, rotateObjectsTowardPoint, setObjectsRotation } from "../core/orientation";
import {
  cloneUserTemplate,
  createUserTemplate,
  duplicateUserTemplate,
  normalizeUserTemplateName,
  reidentifyUserTemplate,
} from "../core/userTemplate";
import type { UserTemplate } from "../types/userTemplate";

export type ToolMode =
  | "select"
  | "selectRect"
  | "aimPoint"
  | "traceWall"
  | "calibrate"
  | "verifyCalibration"
  | "measure"
  | "annotationText"
  | "annotationLine"
  | "annotationArrow"
  | "annotationRect"
  | "annotationCircle"
  | "annotationDimension";

export const TOOL_MODE_LABELS: Record<ToolMode, string> = {
  select: "選択・移動",
  aimPoint: "\u6307\u5b9a\u70b9\u3078\u5411\u3051\u308b",
  selectRect: "範囲選択",
  traceWall: "壁トレース",
  calibrate: "縮尺合わせ",
  verifyCalibration: "縮尺確認",
  measure: "距離を測る",
  annotationText: "文字注釈",
  annotationLine: "線注釈",
  annotationArrow: "矢印注釈",
  annotationRect: "矩形注釈",
  annotationCircle: "円注釈",
  annotationDimension: "寸法線",
};

export function toolModeLabel(mode: ToolMode): string {
  return TOOL_MODE_LABELS[mode];
}

export const PROVISIONAL_MM_PER_PX = 10;
export const MAX_HISTORY_ENTRIES = 50;

export interface ObjectMove { id: string; xMm: number; yMm: number; }

export interface AppState {
  project: Project;
  selectedId: string | null;
  selectedIds: string[];
  pendingPresetId: string | null;
  pendingUserTemplateId: string | null;
  placementContinuous: boolean;
  /** 配置直後に、最寄りの指揮台へ正面を向けるか(FR-UX-401)。Projectには保存しない表示側の作業設定。 */
  placementFacePodium: boolean;
  activeLayerId: string;
  mode: ToolMode;
  calibPointsPx: PointPx[];
  measurePointsMm: PointMm[];
  saveState: "saved" | "dirty";
  past: Project[];
  future: Project[];
  transientBaseProject: Project | null;
  userTemplates: UserTemplate[];
  libraryPreferences: LibraryPreferences;
  userTemplatesReady: boolean;
  libraryPreferencesReady: boolean;
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
    pendingUserTemplateId: null,
    placementContinuous: false,
    placementFacePodium: false,
    activeLayerId: defaultActiveLayer(nextProject),
    mode: "select",
    calibPointsPx: [],
    measurePointsMm: [],
    saveState: "saved",
    past: [],
    future: [],
    transientBaseProject: null,
    userTemplates: [],
    userTemplatesReady: false,
    libraryPreferences: { ...DEFAULT_LIBRARY_PREFERENCES },
    libraryPreferencesReady: false,
  };
}

export function effectiveMmPerPixel(project: Project): number {
  return project.calibration.mmPerPixel ?? PROVISIONAL_MM_PER_PX;
}

export function canPlaceObjects(project: Project): boolean {
  return isProjectReadyForPlacement(project);
}

export type Action =
  | { type: "NEW_PROJECT" }
  | { type: "NEW_PROJECT_WITH_STAGE_TEMPLATE"; name: string; widthMm: number; depthMm: number }
  | { type: "LOAD_PROJECT"; project: Project }
  | { type: "SET_PROJECT_NAME"; name: string }
  | { type: "SET_METADATA"; metadata: ProjectMetadata }
  | { type: "SET_EXPORT_SETTINGS"; settings: ExportSettings }
  | { type: "SET_EXPORT_CONFIGURATION"; metadata: ProjectMetadata; settings: ExportSettings }
  | { type: "SET_DISPLAY_SETTINGS"; settings: ProjectDisplaySettings }
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
  | { type: "LOAD_LIBRARY_PREFERENCES"; preferences: Partial<LibraryPreferences> | null | undefined }
  | { type: "TOGGLE_LIBRARY_FAVORITE"; presetId: string }
  | { type: "RECORD_PRESET_USE"; presetIds: string[] }
  | { type: "SET_MODE"; mode: ToolMode }
  | { type: "SET_PLACEMENT_CONTINUOUS"; continuous: boolean }
  | { type: "SET_PLACEMENT_FACE_PODIUM"; facePodium: boolean }
  | { type: "SET_PENDING_PRESET"; presetId: string | null }
  | { type: "SET_PENDING_USER_TEMPLATE"; templateId: string | null }
  | { type: "LOAD_USER_TEMPLATES"; templates: UserTemplate[] }
  | { type: "SAVE_USER_TEMPLATE"; name: string }
  | { type: "RENAME_USER_TEMPLATE"; id: string; name: string }
  | { type: "DUPLICATE_USER_TEMPLATE"; id: string }
  | { type: "DELETE_USER_TEMPLATE"; id: string }
  | { type: "IMPORT_USER_TEMPLATES"; templates: UserTemplate[] }
  | { type: "ADD_OBJECT"; object: SceneObject; keepPending?: boolean }
  | { type: "ADD_OBJECTS"; objects: SceneObject[] }
  | { type: "ADD_GROUP_PRESET"; presetId: "timpani-set-4" | "concert-tom-set-4"; centerXMm: number; centerYMm: number; layerId: string; keepPending?: boolean; rotationDeg?: number }
  | { type: "ADD_CHAIR_MUSIC_STAND_SET"; centerXMm: number; centerYMm: number; layerId: string; keepPending?: boolean; rotationDeg?: number }
  | { type: "ADD_WALL"; wall: Wall }
  | { type: "UPDATE_WALL"; id: string; patch: Partial<Wall> }
  | { type: "ADD_WALL_POINT"; wallId: string; point: PointMm }
  | { type: "UPDATE_WALL_POINT"; wallId: string; index: number; point: PointMm }
  | { type: "DELETE_WALL_POINT"; wallId: string; index: number }
  | { type: "DELETE_WALL"; id: string }
  | { type: "SET_STAGE_FRONT"; yMm: number | null }
  | { type: "ADD_GUIDE"; guide: Guide }
  | { type: "ADD_STAGE_CENTER_GUIDE" }
  | { type: "ADD_STAGE_FRONT_GUIDE"; distanceMm: number }
  | { type: "UPDATE_GUIDE"; id: string; patch: Partial<Guide> }
  | { type: "MOVE_GUIDE"; id: string; xMm: number; yMm: number; preview?: boolean }
  | { type: "DELETE_GUIDE"; id: string }
  | { type: "SET_GUIDE_LOCKED"; id: string; locked: boolean }
  | { type: "SET_GUIDE_VISIBLE"; id: string; visible: boolean }
  | { type: "UPDATE_OBJECT"; id: string; patch: Partial<SceneObject> }
  | { type: "SET_OBJECT_ASSET_VARIANT"; id: string; assetVariantId: string }
  | { type: "MOVE_OBJECT"; id: string; xMm: number; yMm: number }
  | { type: "MOVE_OBJECTS"; moves: ObjectMove[]; preview?: boolean }
  | { type: "MIRROR_SELECTED"; axisXMm: number }
  | { type: "ROTATE_SELECTED_TO_POINT"; point: PointMm }
  | { type: "ROTATE_SELECTED_TO_PODIUM"; podiumId: string }
  | { type: "SET_SELECTED_ROTATION"; rotationDeg: number }
  | { type: "ROTATE_SELECTED_DELTA"; deltaDeg: number }
  | { type: "NUDGE_SELECTED"; dxMm: number; dyMm: number }
  | { type: "ROTATE_OBJECT"; id: string; rotationDeg: number; preview?: boolean }
  | { type: "DELETE_OBJECT"; id: string }
  | { type: "DELETE_SELECTED" }
  | { type: "CUT_SELECTED" }
  | { type: "DUPLICATE_OBJECT"; id: string }
  | { type: "DUPLICATE_SELECTED" }
  | { type: "DUPLICATE_GRID"; sourceId: string; options: GridPlacementOptions }
  | { type: "ADD_PULT_ARC"; options: PultArcOptions }
  | { type: "ADD_CHAIR_ARC_ROWS"; options: ChairArcRowsOptions }
  | { type: "ADD_CHAIR_LINE"; options: ChairLineOptions }
  | { type: "ADD_STRING_SECTION_TEMPLATE"; options: StringLayout12Options }
  | { type: "ADD_RISER_GROUP"; options: RiserGroupLayoutOptions; layerId: string; fixedToBack: boolean }
  | { type: "ARRANGE_SELECTED_LINE"; ids: string[]; options: LineArrangementOptions; preview?: boolean }
  | { type: "SET_SELECTED_BACKGROUND_FIXED"; fixed: boolean }
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
  | { type: "CANCEL_TRANSIENT_EDIT" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "MARK_SAVED" }
  | { type: "UPDATE_OBJECT_PREVIEW"; id: string; patch: Partial<SceneObject> }
  | { type: "NUDGE_SELECTED_PREVIEW"; dxMm: number; dyMm: number }
  | { type: "SELECT_GROUP"; id: string; additive?: boolean }
  | { type: "SET_SELECTED_STYLE"; style: NonNullable<SceneObject["style"]> }
  | { type: "SET_SELECTED_CHAIR_LABEL"; label: string };

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
  return !object.locked && !object.backgroundFixed && !layerIsLocked(project, object.layerId);
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

function sameProjectMetadata(left: ProjectMetadata, right: ProjectMetadata): boolean {
  return left.hallName === right.hallName
    && left.performanceName === right.performanceName
    && left.date === right.date
    && left.author === right.author
    && left.notes === right.notes;
}

function sameExportSettings(left: ExportSettings, right: ExportSettings): boolean {
  return left.paper === right.paper
    && left.orientation === right.orientation
    && left.scale === right.scale;
}

function commitExportConfiguration(
  state: AppState,
  metadata: ProjectMetadata,
  settings: ExportSettings,
): AppState {
  if (sameProjectMetadata(state.project.metadata, metadata) && sameExportSettings(state.project.exportSettings, settings)) {
    return state;
  }
  return commitProject(state, {
    ...state.project,
    metadata: { ...metadata },
    exportSettings: { ...settings },
  });
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

function cancelTransientEdit(state: AppState): AppState {
  if (!state.transientBaseProject) return state;
  const restored = {
    ...state,
    project: state.transientBaseProject,
    transientBaseProject: null,
    saveState: "dirty" as const,
  };
  return setSelection(restored, state.selectedIds);
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

function addObjects(state: AppState, objects: readonly SceneObject[]): AppState {
  if (objects.length === 0) return state;
  const existingIds = new Set(state.project.objects.map((object) => object.id));
  const addedIds = new Set<string>();
  for (const object of objects) {
    if (existingIds.has(object.id) || addedIds.has(object.id)) return state;
    addedIds.add(object.id);
  }
  if (objects.some((object) => layerIsLocked(state.project, object.layerId) || !layerIsVisible(state.project, object.layerId))) return state;
  const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...objects] });
  const selected = setSelection({ ...next, pendingPresetId: null, pendingUserTemplateId: null }, [...addedIds]);
  return { ...selected, libraryPreferences: recordRecentPresets(selected.libraryPreferences, objects.flatMap((object) => object.presetId ? [object.presetId] : [])) };
}

function offsetObject(
  source: SceneObject,
  id: string,
  zIndex: number,
  idMap: ReadonlyMap<string, string>,
  groupIdMap: ReadonlyMap<string, string>,
  existingObjectIds: ReadonlySet<string>,
): SceneObject {
  const dx = 500;
  const dy = 500;
  const onRiserId = source.onRiserId
    ? idMap.get(source.onRiserId) ?? (existingObjectIds.has(source.onRiserId) ? source.onRiserId : null)
    : null;
  return {
    ...source,
    id,
    xMm: source.xMm + dx,
    yMm: source.yMm + dy,
    endXMm: typeof source.endXMm === "number" ? source.endXMm + dx : source.endXMm,
    endYMm: typeof source.endYMm === "number" ? source.endYMm + dy : source.endYMm,
    onRiserId,
    groupId: source.groupId ? groupIdMap.get(source.groupId) ?? null : null,
    locked: false,
    zIndex,
  };
}

function duplicateObjects(state: AppState, ids: readonly string[]): AppState {
  const selected = state.project.objects.filter((object) =>
    ids.includes(object.id) && !object.backgroundFixed && !layerIsLocked(state.project, object.layerId),
  );
  if (selected.length === 0) return state;

  const idMap = new Map<string, string>(selected.map((source) => [source.id, generateId("obj")]));
  const groupIdMap = new Map<string, string>();
  for (const source of selected) {
    if (source.groupId && !groupIdMap.has(source.groupId)) {
      groupIdMap.set(source.groupId, generateId("group"));
    }
  }
  const existingObjectIds = new Set(state.project.objects.map((object) => object.id));
  const copies = selected.map((source, index) => offsetObject(
    source,
    idMap.get(source.id) as string,
    state.project.objects.length + index,
    idMap,
    groupIdMap,
    existingObjectIds,
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

/** プリセット1個分のSceneObject。単体配置・プルト弧状配置・椅子多列円弧配置の共通生成経路。 */
export function createPresetObject(presetId: string, layerId: string, zIndex: number): SceneObject | null {
  const preset = findPreset(presetId);
  if (!preset || preset.isGroupPreset) return null;
  const assetVariantId = defaultAssetVariantIdForPreset(preset.id);
  return {
    id: generateId("obj"),
    type: preset.type,
    presetId: preset.id,
    ...(assetVariantId ? { assetVariantId } : {}),
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
type InstrumentGroupPresetId = "timpani-set-4" | "concert-tom-set-4";
type GroupLayoutPart = { presetId: string; centerXMm: number; centerYMm: number };

function groupLayoutForPreset(presetId: InstrumentGroupPresetId): readonly GroupLayoutPart[] {
  return presetId === "timpani-set-4" ? TIMPANI_SET_LAYOUT : CONCERT_TOM_SET_LAYOUT;
}

function createGroupPresetObjects(
  presetId: InstrumentGroupPresetId,
  centerXMm: number,
  centerYMm: number,
  layerId: string,
  zIndex: number,
  rotationDeg = 0,
): SceneObject[] {
  const groupPreset = findPreset(presetId);
  if (!groupPreset) return [];
  const parts = groupLayoutForPreset(presetId);
  const bounds = parts.reduce(
    (result, part) => {
      const preset = findPreset(part.presetId);
      const diameter = preset?.widthMm ?? 0;
      return {
        minX: Math.min(result.minX, part.centerXMm - diameter / 2),
        minY: Math.min(result.minY, part.centerYMm - diameter / 2),
        maxX: Math.max(result.maxX, part.centerXMm + diameter / 2),
        maxY: Math.max(result.maxY, part.centerYMm + diameter / 2),
      };
    },
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
  const groupCenterXMm = (bounds.minX + bounds.maxX) / 2;
  const groupCenterYMm = (bounds.minY + bounds.maxY) / 2;
  const groupId = generateId("group");
  // セット全体を1つの剛体として回す。各パーツのオフセットをセット中心まわりに回し、
  // 個々のrotationDegにも同じ角度を入れることで、内部の相対配置が崩れない。
  const rotationRad = (normalizeDeg(rotationDeg) * Math.PI) / 180;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  return parts.flatMap((part, index) => {
    const preset = findPreset(part.presetId);
    if (!preset) return [];
    const assetVariantId = defaultAssetVariantIdForPreset(preset.id);
    const offsetXMm = part.centerXMm - groupCenterXMm;
    const offsetYMm = part.centerYMm - groupCenterYMm;
    return [{
      id: generateId("obj"),
      type: preset.type,
      presetId: preset.id,
      ...(assetVariantId ? { assetVariantId } : {}),
      name: preset.name,
      xMm: Math.round(centerXMm + offsetXMm * cos - offsetYMm * sin),
      yMm: Math.round(centerYMm + offsetXMm * sin + offsetYMm * cos),
      widthMm: preset.widthMm,
      depthMm: preset.depthMm,
      heightMm: preset.heightMm,
      rotationDeg: normalizeDeg(rotationDeg),
      label: "",
      onRiserId: null,
      avatar: null,
      locked: false,
      visible: true,
      groupId,
      layerId,
      zIndex: zIndex + index,
      shape: preset.shape,
    } satisfies SceneObject];
  });
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
    guides: Boolean(settings.guides),
    guideThresholdMm: Math.max(0, typeof settings.guideThresholdMm === "number" && Number.isFinite(settings.guideThresholdMm) ? settings.guideThresholdMm : settings.thresholdMm),
  };
}

function sameObjectStyle(left: SceneObject["style"], right: SceneObject["style"]): boolean {
  const leftRecord = left as Record<string, unknown> | undefined;
  const rightRecord = right as Record<string, unknown> | undefined;
  const keys = new Set([...Object.keys(leftRecord ?? {}), ...Object.keys(rightRecord ?? {})]);
  return [...keys].every((key) => leftRecord?.[key] === rightRecord?.[key]);
}

function sameSceneObject(left: SceneObject, right: SceneObject): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => {
    if (key === "style") return sameObjectStyle(left.style, right.style);
    return left[key as keyof SceneObject] === right[key as keyof SceneObject];
  });
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
    widthMm: isObjectResizable(current) ? Math.max(1, Number.isFinite(patch.widthMm) ? patch.widthMm as number : current.widthMm) : current.widthMm,
    depthMm: isObjectResizable(current) ? Math.max(1, Number.isFinite(patch.depthMm) ? patch.depthMm as number : current.depthMm) : current.depthMm,
    heightMm: Math.max(0, Number.isFinite(patch.heightMm) ? patch.heightMm as number : current.heightMm),
    rotationDeg: normalizeDeg(Number.isFinite(patch.rotationDeg) ? patch.rotationDeg as number : current.rotationDeg),
  };
  if (sameSceneObject(current, nextObject)) return state;
  return commitProject(state, {
    ...state.project,
    objects: state.project.objects.map((object) => object.id === id ? nextObject : object),
  });
}

function setSelectedChairLabel(state: AppState, label: string): AppState {
  const normalizedLabel = label.trim() ? label : "";
  const ids = new Set(editableSelectedIds(state));
  const targetIds = new Set(state.project.objects
    .filter((object) => ids.has(object.id) && object.type === "chair")
    .map((object) => object.id));
  if (targetIds.size === 0) return state;
  const targets = state.project.objects.filter((object) => targetIds.has(object.id));
  if (targets.every((object) => object.label === normalizedLabel)) return state;
  return commitProject(state, {
    ...state.project,
    objects: state.project.objects.map((object) => targetIds.has(object.id)
      ? { ...object, label: normalizedLabel }
      : object),
  });
}

function setObjectAssetVariant(state: AppState, id: string, assetVariantId: string): AppState {
  const current = state.project.objects.find((object) => object.id === id);
  if (!current || !objectIsEditable(state.project, current)) return state;
  // 切替可否はtypeではなくpresetごとのvariant台帳で判定する。譜面台のような備品も対象になる。
  if (visualAssetVariantsForPreset(current.presetId).some((variant) => variant.assetId === assetVariantId)) {
    return commitProject(state, {
      ...state.project,
      objects: state.project.objects.map((object) => object.id === id ? { ...object, assetVariantId } : object),
    });
  }
  return state;
}

function updateObjectPreview(state: AppState, id: string, patch: Partial<SceneObject>): AppState {
  const committed = updateObject(state, id, patch);
  if (committed === state) return state;
  return previewProject(state, committed.project);
}

function groupedSelectionIds(project: AppState["project"], id: string): string[] {
  const selected = project.objects.find((object) => object.id === id);
  if (!selected?.groupId) return [id];
  return project.objects.filter((object) => object.groupId === selected.groupId).map((object) => object.id);
}
function normalizeWallPoint(point: PointMm): PointMm {
  return {
    xMm: Number.isFinite(point.xMm) ? point.xMm : 0,
    yMm: Number.isFinite(point.yMm) ? point.yMm : 0,
  };
}

function normalizeWall(wall: Wall): Wall {
  return {
    ...wall,
    points: wall.points.map(normalizeWallPoint),
    heightMm: Math.max(1, Number.isFinite(wall.heightMm) ? wall.heightMm : 6000),
    closed: Boolean(wall.closed),
  };
}

function updateWall(state: AppState, id: string, patch: Partial<Wall>): AppState {
  const current = state.project.walls.find((wall) => wall.id === id);
  if (!current) return state;
  const nextWall = normalizeWall({ ...current, ...patch });
  if (nextWall.points.length < 2) return state;
  return commitProject(state, {
    ...state.project,
    walls: state.project.walls.map((wall) => wall.id === id ? nextWall : wall),
  });
}

function updateWallPoint(state: AppState, wallId: string, index: number, point: PointMm): AppState {
  const wall = state.project.walls.find((candidate) => candidate.id === wallId);
  if (!wall || index < 0 || index >= wall.points.length) return state;
  const points = wall.points.map((candidate, pointIndex) => pointIndex === index ? normalizeWallPoint(point) : candidate);
  return updateWall(state, wallId, { points });
}

function deleteWallPoint(state: AppState, wallId: string, index: number): AppState {
  const wall = state.project.walls.find((candidate) => candidate.id === wallId);
  if (!wall || wall.points.length <= 2 || index < 0 || index >= wall.points.length) return state;
  return updateWall(state, wallId, { points: wall.points.filter((_, pointIndex) => pointIndex !== index) });
}

function deleteWall(state: AppState, id: string): AppState {
  if (!state.project.walls.some((wall) => wall.id === id)) return state;
  return commitProject(state, { ...state.project, walls: state.project.walls.filter((wall) => wall.id !== id) });
}

function addWall(state: AppState, wall: Wall): AppState {
  const nextWall = normalizeWall(wall);
  if (nextWall.points.length < 2 || state.project.walls.some((candidate) => candidate.id === nextWall.id)) return state;
  return { ...commitProject(state, { ...state.project, walls: [...state.project.walls, nextWall] }), mode: "select" };
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

function rotateObjectSet(state: AppState, id: string, rotationDeg: number, preview: boolean): AppState {
  // Preview targets are always evaluated from the first transient state so repeated pointer updates do not move the rotation center.
  const sourceProject = preview && state.transientBaseProject ? state.transientBaseProject : state.project;
  const primary = sourceProject.objects.find((candidate) => candidate.id === id);
  if (!primary) return state;
  const ids = groupedSelectionIds(sourceProject, id);
  const idSet = new Set(ids);
  const objects = sourceProject.objects.filter((candidate) => idSet.has(candidate.id));
  if (objects.length === 0 || objects.some((candidate) => !objectIsEditable(sourceProject, candidate))) return state;
  const bounds = selectionBoundsMm(sourceProject.objects, ids);
  if (!bounds) return state;

  const centerXMm = (bounds.minXMm + bounds.maxXMm) / 2;
  const centerYMm = (bounds.minYMm + bounds.maxYMm) / 2;
  const deltaDeg = normalizeDeg(rotationDeg - primary.rotationDeg);
  const deltaRad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(deltaRad);
  const sin = Math.sin(deltaRad);
  const rotatePoint = (xMm: number, yMm: number) => ({
    xMm: centerXMm + (xMm - centerXMm) * cos - (yMm - centerYMm) * sin,
    yMm: centerYMm + (xMm - centerXMm) * sin + (yMm - centerYMm) * cos,
  });

  const project = {
    ...sourceProject,
    objects: sourceProject.objects.map((candidate) => {
      if (!idSet.has(candidate.id)) return candidate;
      const rotated = rotatePoint(candidate.xMm, candidate.yMm);
      const nextEnd = typeof candidate.endXMm === "number" && typeof candidate.endYMm === "number"
        ? rotatePoint(candidate.endXMm, candidate.endYMm)
        : null;
      return {
        ...candidate,
        xMm: rotated.xMm,
        yMm: rotated.yMm,
        ...(nextEnd ? { endXMm: nextEnd.xMm, endYMm: nextEnd.yMm } : {}),
        rotationDeg: normalizeDeg(candidate.rotationDeg + deltaDeg),
      };
    }),
  };
  return preview ? previewProject(state, project) : commitProject(state, project);
}
function commitSelectionRotation(
  state: AppState,
  transform: (objects: readonly SceneObject[], ids: readonly string[]) => SceneObject[],
): AppState {
  const ids = editableSelectedIds(state);
  if (ids.length === 0) return state;
  const objects = transform(state.project.objects, ids);
  if (objects.every((object, index) => object === state.project.objects[index])) return state;
  return commitProject(state, { ...state.project, objects });
}

function mirrorSelectedObjects(state: AppState, axisXMm: number): AppState {
  const ids = editableSelectedIds(state);
  if (ids.length === 0 || !Number.isFinite(axisXMm)) return state;
  const baseZIndex = state.project.objects.reduce(
    (maximum, object) => Math.max(maximum, Number.isFinite(object.zIndex) ? object.zIndex : -1),
    -1,
  ) + 1;
  const copies = createMirroredObjects(state.project.objects, ids, axisXMm, generateId, baseZIndex);
  if (copies.length === 0) return state;
  const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...copies] });
  return setSelection({ ...next, pendingPresetId: null, pendingUserTemplateId: null }, copies.map((copy) => copy.id));
}

function resetProjectState(state: AppState, project?: Project): AppState {
  const next = createInitialState(project);
  return {
    ...next,
    userTemplates: state.userTemplates.map(cloneUserTemplate),
    userTemplatesReady: state.userTemplatesReady,
    libraryPreferences: state.libraryPreferences,
    libraryPreferencesReady: state.libraryPreferencesReady,
  };
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "NEW_PROJECT": return resetProjectState(state);
    case "NEW_PROJECT_WITH_STAGE_TEMPLATE": {
      const stageTemplate = createStageTemplate(action.widthMm, action.depthMm);
      if (!stageTemplate) return state;
      const name = action.name.trim() || "新規プロジェクト";
      return resetProjectState(state, { ...createEmptyProject(name), stageTemplate });
    }
    case "LOAD_PROJECT": return resetProjectState(state, synchronizeProjectGuides(action.project, effectiveMmPerPixel(action.project)));
    case "SET_PROJECT_NAME": return commitProject(state, { ...state.project, name: action.name });
    case "SET_METADATA": return commitProject(state, { ...state.project, metadata: { ...action.metadata } });
    case "SET_EXPORT_SETTINGS": return commitProject(state, { ...state.project, exportSettings: { ...action.settings } });
    case "SET_EXPORT_CONFIGURATION": return commitExportConfiguration(state, action.metadata, action.settings);
    case "SET_DISPLAY_SETTINGS": return commitProject(state, {
      ...state.project,
      displaySettings: {
        instrumentLabelsVisible: Boolean(action.settings.instrumentLabelsVisible),
        instrumentLabelLanguage: action.settings.instrumentLabelLanguage === "enShort" ? "enShort" : "ja",
      },
    });
    case "SET_BACKGROUND": {
      const nextProject = {
        ...state.project,
        background: {
          ...state.project.background,
          imageDataUrl: action.imageDataUrl,
          naturalWidthPx: action.naturalWidthPx,
          naturalHeightPx: action.naturalHeightPx,
          sourceType: action.sourceType,
          sourcePage: action.sourcePage,
          crop: null,
          rotationDeg: 0 as const,
        },
        calibration: { mmPerPixel: null, pointA: null, pointB: null, realDistanceMm: null, calibratedAt: null },
        stageTemplate: null,
      };
      return commitProject(state, synchronizeProjectGuides(nextProject, effectiveMmPerPixel(nextProject)));
    }
    case "SET_BACKGROUND_CROP": {
      const nextProject = {
        ...state.project,
        background: {
          ...state.project.background,
          crop: action.crop ? clampCrop(action.crop, state.project.background.naturalWidthPx, state.project.background.naturalHeightPx) : null,
        },
      };
      return commitProject(state, synchronizeProjectGuides(nextProject, effectiveMmPerPixel(nextProject)));
    }
    case "ROTATE_BACKGROUND": {
      const nextProject = {
        ...state.project,
        background: {
          ...state.project.background,
          rotationDeg: normalizedBackgroundRotation(state.project.background.rotationDeg + action.delta),
        },
      };
      return commitProject(state, synchronizeProjectGuides(nextProject, effectiveMmPerPixel(nextProject)));
    }
    case "SET_BACKGROUND_OPACITY": return commitProject(state, { ...state.project, background: { ...state.project.background, opacity: Math.min(1, Math.max(0, action.opacity)) } });
    case "SET_BACKGROUND_VISIBLE": return commitProject(state, { ...state.project, background: { ...state.project.background, visible: action.visible } });
    case "SET_BACKGROUND_LOCKED": return commitProject(state, { ...state.project, background: { ...state.project.background, locked: action.locked } });
    case "SET_VIEW": return { ...state, project: { ...state.project, view: action.view } };
    case "SET_ACTIVE_LAYER": return layerFor(state.project, action.layerId) ? { ...state, activeLayerId: action.layerId, pendingPresetId: null, pendingUserTemplateId: null } : state;
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
    case "LOAD_LIBRARY_PREFERENCES": return { ...state, libraryPreferences: normalizeLibraryPreferences(action.preferences), libraryPreferencesReady: true };
    case "TOGGLE_LIBRARY_FAVORITE": return { ...state, libraryPreferences: toggleFavoritePreset(state.libraryPreferences, action.presetId) };
    case "RECORD_PRESET_USE": return { ...state, libraryPreferences: recordRecentPresets(state.libraryPreferences, action.presetIds) };
    case "SET_MODE": return { ...state, mode: action.mode, calibPointsPx: [], measurePointsMm: [], pendingPresetId: null, pendingUserTemplateId: null };
    case "SET_PLACEMENT_CONTINUOUS": return { ...state, placementContinuous: action.continuous };
    case "SET_PLACEMENT_FACE_PODIUM": return { ...state, placementFacePodium: action.facePodium };
    case "SET_PENDING_PRESET": return { ...state, pendingPresetId: action.presetId, pendingUserTemplateId: null, mode: "select" };
    case "SET_PENDING_USER_TEMPLATE": {
      const exists = action.templateId !== null && state.userTemplates.some((template) => template.id === action.templateId);
      return { ...state, pendingPresetId: null, pendingUserTemplateId: exists ? action.templateId : null, mode: "select" };
    }
    case "LOAD_USER_TEMPLATES":
      return { ...state, userTemplates: action.templates.map(cloneUserTemplate), userTemplatesReady: true, pendingUserTemplateId: null };
    case "SAVE_USER_TEMPLATE": {
      if (state.selectedIds.length < 2) return state;
      const template = createUserTemplate(state.project, state.selectedIds, action.name, generateId);
      return template ? { ...state, userTemplates: [...state.userTemplates, template], userTemplatesReady: true } : state;
    }
    case "RENAME_USER_TEMPLATE": {
      const name = normalizeUserTemplateName(action.name);
      if (!name) return state;
      const current = state.userTemplates.find((template) => template.id === action.id);
      if (!current) return state;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        userTemplates: state.userTemplates.map((template) => template.id === action.id
          ? { ...cloneUserTemplate(template), name, updatedAt }
          : template),
      };
    }
    case "DUPLICATE_USER_TEMPLATE": {
      const current = state.userTemplates.find((template) => template.id === action.id);
      if (!current) return state;
      return { ...state, userTemplates: [...state.userTemplates, duplicateUserTemplate(current, generateId)] };
    }
    case "DELETE_USER_TEMPLATE":
      return {
        ...state,
        userTemplates: state.userTemplates.filter((template) => template.id !== action.id),
        pendingUserTemplateId: state.pendingUserTemplateId === action.id ? null : state.pendingUserTemplateId,
      };
    case "IMPORT_USER_TEMPLATES": {
      const imported = action.templates.map((template) => reidentifyUserTemplate(template, generateId));
      return { ...state, userTemplates: [...state.userTemplates, ...imported], userTemplatesReady: true };
    }
    case "ADD_OBJECT": {
      if (layerIsLocked(state.project, action.object.layerId) || !layerIsVisible(state.project, action.object.layerId)) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, action.object] });
      const selected = setSelection({ ...next, pendingPresetId: action.keepPending ? next.pendingPresetId : null, pendingUserTemplateId: null }, [action.object.id]);
      return { ...selected, libraryPreferences: recordRecentPresets(selected.libraryPreferences, action.object.presetId ? [action.object.presetId] : []) };
    }
    case "ADD_OBJECTS": return addObjects(state, action.objects);
    case "ADD_CHAIR_MUSIC_STAND_SET": {
      if (!canPlaceObjects(state.project)) return state;
      const layerId = action.layerId || state.activeLayerId;
      if (layerIsLocked(state.project, layerId) || !layerIsVisible(state.project, layerId)) return state;
      const chair = createPresetObject("chair", layerId, state.project.objects.length);
      const stand = createPresetObject("music-stand", layerId, state.project.objects.length + 1);
      if (!chair || !stand) return state;
      const groupId = generateId("chair-music-stand-set");
      const objects = createChairMusicStandSetObjects(
        chair,
        stand,
        {
          center: { xMm: action.centerXMm, yMm: action.centerYMm },
          rotationDeg: normalizeDeg(action.rotationDeg ?? DEFAULT_CHAIR_FACING_ROTATION_DEG),
          layerId,
          baseZIndex: state.project.objects.length,
          groupId,
        },
        (role) => generateId(`chair-stand-${role}`),
      );
      if (objects.length !== 2) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...objects] });
      const selected = setSelection(
        { ...next, pendingPresetId: action.keepPending ? next.pendingPresetId : null, pendingUserTemplateId: null },
        objects.map((object) => object.id),
      );
      return {
        ...selected,
        libraryPreferences: recordRecentPresets(selected.libraryPreferences, [CHAIR_MUSIC_STAND_SET_PRESET_ID]),
      };
    }
    case "ADD_GROUP_PRESET": {
      if (layerIsLocked(state.project, action.layerId) || !layerIsVisible(state.project, action.layerId)) return state;
      const objects = createGroupPresetObjects(action.presetId, action.centerXMm, action.centerYMm, action.layerId, state.project.objects.length, action.rotationDeg ?? 0);
      if (objects.length === 0) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...objects] });
      const selected = setSelection({ ...next, pendingPresetId: action.keepPending ? next.pendingPresetId : null }, objects.map((object) => object.id));
      return { ...selected, libraryPreferences: recordRecentPresets(selected.libraryPreferences, [action.presetId]) };
    }
    case "ADD_WALL": return addWall(state, action.wall);
    case "UPDATE_WALL": return updateWall(state, action.id, action.patch);
    case "ADD_WALL_POINT": {
      const wall = state.project.walls.find((candidate) => candidate.id === action.wallId);
      return wall ? updateWall(state, action.wallId, { points: [...wall.points, normalizeWallPoint(action.point)] }) : state;
    }
    case "UPDATE_WALL_POINT": return updateWallPoint(state, action.wallId, action.index, action.point);
    case "DELETE_WALL_POINT": return deleteWallPoint(state, action.wallId, action.index);
    case "DELETE_WALL": return deleteWall(state, action.id);
    case "SET_STAGE_FRONT": {
      const stageFront = action.yMm === null || !Number.isFinite(action.yMm) ? null : { yMm: action.yMm };
      const nextProject = { ...state.project, stageFront };
      return commitProject(state, synchronizeProjectGuides(nextProject, effectiveMmPerPixel(nextProject), stageFront?.yMm));
    }
    case "UPDATE_OBJECT_PREVIEW": return updateObjectPreview(state, action.id, action.patch);
    case "ADD_GUIDE": {
      const nextProject = addGuideToProject(state.project, action.guide);
      if (!nextProject) return state;
      return commitProject(state, nextProject);
    }
    case "ADD_STAGE_CENTER_GUIDE": {
      const nextProject = addStageCenterGuideToProject(state.project, generateId("guide"), effectiveMmPerPixel(state.project));
      return nextProject ? commitProject(state, nextProject) : state;
    }
    case "ADD_STAGE_FRONT_GUIDE": {
      const nextProject = addStageFrontGuideToProject(state.project, generateId("guide"), action.distanceMm);
      return nextProject ? commitProject(state, nextProject) : state;
    }
    case "UPDATE_GUIDE": {
      const nextProject = updateGuideInProject(state.project, action.id, action.patch);
      return nextProject ? commitProject(state, nextProject) : state;
    }
    case "MOVE_GUIDE": {
      const sourceProject = action.preview && state.transientBaseProject ? state.transientBaseProject : state.project;
      const nextProject = moveGuideInProject(sourceProject, action.id, { xMm: action.xMm, yMm: action.yMm });
      if (!nextProject) return state;
      return action.preview ? previewProject(state, nextProject) : commitProject(state, nextProject);
    }
    case "DELETE_GUIDE": {
      const nextProject = deleteGuideFromProject(state.project, action.id);
      return nextProject ? commitProject(state, nextProject) : state;
    }
    case "SET_GUIDE_LOCKED": {
      const nextProject = setGuideLockedInProject(state.project, action.id, action.locked);
      return nextProject ? commitProject(state, nextProject) : state;
    }
    case "SET_GUIDE_VISIBLE": {
      const nextProject = setGuideVisibleInProject(state.project, action.id, action.visible);
      return nextProject ? commitProject(state, nextProject) : state;
    }
    case "NUDGE_SELECTED_PREVIEW": {
      if (!Number.isFinite(action.dxMm) || !Number.isFinite(action.dyMm) || (action.dxMm === 0 && action.dyMm === 0)) return state;
      const ids = new Set(editableSelectedIds(state));
      if (ids.size === 0) return state;
      const moves = state.project.objects.filter((object) => ids.has(object.id)).map((object) => ({ id: object.id, xMm: object.xMm + action.dxMm, yMm: object.yMm + action.dyMm }));
      return appReducer(state, { type: "MOVE_OBJECTS", moves, preview: true });
    }
    case "SET_SELECTED_CHAIR_LABEL": return setSelectedChairLabel(state, action.label);
    case "SET_SELECTED_STYLE": {
      const ids = new Set(editableSelectedIds(state));
      if (ids.size === 0) return state;
      return commitProject(state, {
        ...state.project,
        objects: state.project.objects.map((object) => ids.has(object.id) ? { ...object, style: { ...(object.style ?? {}), ...action.style } } : object),
      });
    }
    case "SELECT_GROUP": {
      const groupIds = groupedSelectionIds(state.project, action.id);
      if (!action.additive) return setSelection(state, groupIds);
      const groupSet = new Set(groupIds);
      const remove = groupIds.every((groupId) => state.selectedIds.includes(groupId));
      return setSelection(state, remove ? state.selectedIds.filter((selectedId) => !groupSet.has(selectedId)) : [...state.selectedIds.filter((selectedId) => !groupSet.has(selectedId)), ...groupIds]);
    }
    case "UPDATE_OBJECT": return updateObject(state, action.id, action.patch);
    case "SET_OBJECT_ASSET_VARIANT": return setObjectAssetVariant(state, action.id, action.assetVariantId);
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
    case "NUDGE_SELECTED": {
      if (!Number.isFinite(action.dxMm) || !Number.isFinite(action.dyMm) || (action.dxMm === 0 && action.dyMm === 0)) return state;
      const ids = new Set(editableSelectedIds(state));
      if (ids.size === 0) return state;
      const moves = state.project.objects
        .filter((object) => ids.has(object.id))
        .map((object) => ({ id: object.id, xMm: object.xMm + action.dxMm, yMm: object.yMm + action.dyMm }));
      return appReducer(state, { type: "MOVE_OBJECTS", moves });
    }
    case "MIRROR_SELECTED": return mirrorSelectedObjects(state, action.axisXMm);
    case "ROTATE_SELECTED_TO_POINT": return commitSelectionRotation(
      state,
      (objects, ids) => rotateObjectsTowardPoint(objects, ids, action.point),
    );
    case "ROTATE_SELECTED_TO_PODIUM": {
      const podium = state.project.objects.find((object) => object.id === action.podiumId && object.type === "podium");
      return podium
        ? commitSelectionRotation(state, (objects, ids) => rotateObjectsTowardPoint(objects, ids, { xMm: podium.xMm, yMm: podium.yMm }))
        : state;
    }
    case "SET_SELECTED_ROTATION": return commitSelectionRotation(
      state,
      (objects, ids) => setObjectsRotation(objects, ids, action.rotationDeg),
    );
    case "ROTATE_SELECTED_DELTA": return commitSelectionRotation(
      state,
      (objects, ids) => rotateObjectsByDelta(objects, ids, action.deltaDeg),
    );
    case "ROTATE_OBJECT": return rotateObjectSet(state, action.id, action.rotationDeg, Boolean(action.preview));
    case "DELETE_OBJECT": return deleteObjects(state, [action.id]);
    case "DELETE_SELECTED": return deleteObjects(state, state.selectedIds);
    case "CUT_SELECTED": return isCuttableSelection(state.project, state.selectedIds)
      ? deleteObjects(state, state.selectedIds)
      : state;
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
    case "ADD_CHAIR_ARC_ROWS": {
      // 校正・指揮台・レイヤーの各条件は起動時だけでなく確定時にも再検証する(11.2)。
      if (!canPlaceObjects(state.project)) return state;
      const layerId = action.options.layerId || state.activeLayerId;
      if (layerIsLocked(state.project, layerId) || !layerIsVisible(state.project, layerId)) return state;
      const podium = state.project.objects.find((object) => object.id === action.options.podiumId);
      if (!podium || podium.type !== "podium" || !podium.visible) return state;
      if (!layerIsVisible(state.project, podium.layerId)) return state;
      const options = { ...action.options, layerId };
      if (validateChairArcRowsOptions(options).length > 0) return state;
      const baseZIndex = state.project.objects.reduce((max, object) => Math.max(max, object.zIndex), -1) + 1;
      const chair = createPresetObject("chair", layerId, baseZIndex);
      const stand = action.options.includeMusicStands ? createPresetObject("music-stand", layerId, baseZIndex + 1) : null;
      if (!chair || (action.options.includeMusicStands && !stand)) return state;
      const objects = createChairArcRowObjects(
        podium,
        chair,
        options,
        (placement) => generateId(`chair-arc-r${placement.rowIndex + 1}-c${placement.chairIndex + 1}`),
        stand ?? undefined,
        (placement) => generateId(`chair-arc-stand-r${placement.rowIndex + 1}-c${placement.chairIndex + 1}`),
      );
      if (objects.length === 0) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...objects] });
      return setSelection({ ...next, pendingPresetId: null }, objects.map((object) => object.id));
    }
    case "ADD_CHAIR_LINE": {
      if (!canPlaceObjects(state.project)) return state;
      const layerId = action.options.layerId || state.activeLayerId;
      if (layerIsLocked(state.project, layerId) || !layerIsVisible(state.project, layerId)) return state;
      const options = { ...action.options, layerId };
      if (validateChairLineOptions(options).length > 0) return state;
      const baseZIndex = state.project.objects.reduce((max, object) => Math.max(max, object.zIndex), -1) + 1;
      const chair = createPresetObject("chair", layerId, baseZIndex);
      const stand = options.includeMusicStands
        ? createPresetObject("music-stand", layerId, baseZIndex + options.count)
        : null;
      if (!chair || (options.includeMusicStands && !stand)) return state;
      const objects = createChairLineObjects(
        chair,
        options,
        (placement) => generateId("chair-line-" + (placement.chairIndex + 1)),
        stand ?? undefined,
        (placement) => generateId("chair-line-stand-" + (placement.chairIndex + 1)),
      );
      if (objects.length === 0) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...objects] });
      return setSelection({ ...next, pendingPresetId: null }, objects.map((object) => object.id));
    }
    case "ADD_RISER_GROUP": {
      if (!canPlaceObjects(state.project)) return state;
      const layerId = action.layerId || state.activeLayerId;
      if (layerIsLocked(state.project, layerId) || !layerIsVisible(state.project, layerId)) return state;
      if (validateRiserGroupOptions(action.options).length > 0) return state;
      const templateIds = [...new Set(riserParallelRows(action.options).flatMap((row) => row.segments).map((segment) => segment.presetId))] as RiserPresetId[];
      const templates = new Map<RiserPresetId, SceneObject>();
      templateIds.forEach((presetId) => {
        const template = createPresetObject(presetId, layerId, 0);
        if (template) templates.set(presetId, template);
      });
      if (templates.size !== templateIds.length) return state;
      const groupId = generateId("riser-group");
      const baseZIndex = state.project.objects.reduce((max, object) => Math.max(max, object.zIndex), -1) + 1;
      const created = createRiserGroupObjects(templates, action.options, groupId, (index) => generateId("riser-" + (index + 1)))
        .map((object, index) => ({ ...object, layerId, zIndex: baseZIndex + index }));
      if (created.length === 0) return state;
      let objects = [...state.project.objects, ...created];
      if (action.fixedToBack) objects = setObjectsBackgroundFixed(objects, created.map((object) => object.id), true);
      const next = commitProject(state, { ...state.project, objects });
      return setSelection({ ...next, pendingPresetId: null }, created.map((object) => object.id));
    }
    case "ARRANGE_SELECTED_LINE": {
      const ids = action.ids.length > 0 ? action.ids : state.selectedIds;
      if (validateLineArrangement(state.project.objects, ids, action.options).length > 0) return state;
      const units = selectionUnits(state.project.objects, ids);
      const targetIds = new Set(units.flatMap((unit) => unit.objectIds));
      if ([...targetIds].some((id) => {
        const object = state.project.objects.find((candidate) => candidate.id === id);
        return object ? !objectIsEditable(state.project, object) : true;
      })) return state;
      if (!action.preview && state.transientBaseProject) return commitTransientEdit(state);
      const sourceProject = state.transientBaseProject ?? state.project;
      const arranged = arrangeObjectsInLine(sourceProject.objects, ids, action.options);
      return action.preview
        ? previewProject(state, { ...sourceProject, objects: arranged })
        : commitProject(state, { ...sourceProject, objects: arranged });
    }
    case "SET_SELECTED_BACKGROUND_FIXED": {
      const selected = state.project.objects.filter((object) => state.selectedIds.includes(object.id));
      if (selected.length === 0 || selected.some((object) => object.type !== "riser")) return state;
      const units = selectionUnits(state.project.objects, state.selectedIds);
      const targetIds = units.flatMap((unit) => unit.objectIds);
      if (targetIds.some((id) => {
        const object = state.project.objects.find((candidate) => candidate.id === id);
        return object ? layerIsLocked(state.project, object.layerId) : true;
      })) return state;
      return commitProject(state, {
        ...state.project,
        objects: setObjectsBackgroundFixed(state.project.objects, targetIds, action.fixed),
      });
    }
    case "ADD_STRING_SECTION_TEMPLATE": {
      // 校正・レイヤー・入力値は起動時だけでなく確定時にも再検証する(16.3)。
      if (!canPlaceObjects(state.project)) return state;
      const layerId = action.options.layerId || state.activeLayerId;
      if (layerIsLocked(state.project, layerId) || !layerIsVisible(state.project, layerId)) return state;
      const options = { ...action.options, layerId };
      if (validateStringLayout12Options(options).length > 0) return state;
      const baseZIndex = state.project.objects.reduce((max, object) => Math.max(max, object.zIndex), -1) + 1;
      const chair = createPresetObject(STRING_LAYOUT_12_SEAT_PRESET_ID, layerId, baseZIndex);
      const stand = createPresetObject(STRING_LAYOUT_12_STAND_PRESET_ID, layerId, baseZIndex);
      const contrabassStool = createPresetObject(STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID, layerId, baseZIndex);
      if (!chair || !stand || !contrabassStool) return state;
      const objects = createStringLayout12Objects(
        { chair, stand, contrabassStool },
        options,
        baseZIndex,
        (role, key) => generateId(`string-${key}-${role}`),
      );
      if (objects.length === 0) return state;
      const next = commitProject(state, { ...state.project, objects: [...state.project.objects, ...objects] });
      return setSelection({ ...next, pendingPresetId: null }, objects.map((object) => object.id));
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
    case "SELECT_MANY": {
      const ids = action.ids.filter((id) => !state.project.objects.find((object) => object.id === id)?.backgroundFixed);
      return setSelection(state, action.additive ? [...state.selectedIds, ...ids] : ids);
    }
    case "SELECT_RECT": {
      const ids = state.project.objects.filter((object) => {
        if (object.backgroundFixed || !object.visible || !layerIsVisible(state.project, object.layerId)) return false;
        const bounds = sceneObjectBoundsMm(object);
        return boundsIntersectMm(bounds, action.bounds);
      }).map((object) => object.id);
      return setSelection(state, action.additive ? [...state.selectedIds, ...ids] : ids);
    }
    case "ADD_CALIB_POINT": if (state.calibPointsPx.length >= 2) return state; return { ...state, calibPointsPx: [...state.calibPointsPx, action.point] };
    case "CLEAR_CALIB_POINTS": return { ...state, calibPointsPx: [] };
    case "APPLY_CALIBRATION": {
      const [a, b] = state.calibPointsPx;
      if (!a || !b) return state;
      const mmPerPixel = computeMmPerPixel(a, b, action.realDistanceMm);
      const nextProject = { ...state.project, calibration: { mmPerPixel, pointA: a, pointB: b, realDistanceMm: action.realDistanceMm, calibratedAt: new Date().toISOString() } };
      return { ...commitProject(state, synchronizeProjectGuides(nextProject, mmPerPixel)), mode: "select", calibPointsPx: [] };
    }
    case "CANCEL_CALIBRATION": return { ...state, mode: "select", calibPointsPx: [] };
    case "ADD_MEASURE_POINT": return { ...state, measurePointsMm: state.measurePointsMm.length >= 2 ? [action.point] : [...state.measurePointsMm, action.point] };
    case "CLEAR_MEASURE": return { ...state, measurePointsMm: [] };
    case "COMMIT_TRANSIENT_EDIT": return commitTransientEdit(state);
    case "CANCEL_TRANSIENT_EDIT": return cancelTransientEdit(state);
    case "UNDO": return undoState(state);
    case "REDO": return redoState(state);
    case "MARK_SAVED": return { ...state, saveState: "saved" };
  }
}

export { selectionBoundsMm };
