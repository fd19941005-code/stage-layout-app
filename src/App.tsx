// アプリ全体の画面構成(10.1)とデータフロー。
// 自動保存(FR-002): IndexedDBへ最終操作から1.5秒後にデバウンスして実行する。

import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import type { PointMm, Project } from "./types/project";
import { appReducer, canPlaceObjects, createInitialState, effectiveMmPerPixel, type AppState, type ToolMode } from "./state/appState";
import { generateId } from "./core/project";
import { favoritePresetIdForDigit, LIBRARY_PREFERENCES_KEY, type LibraryPreferences } from "./core/library";
import {
  getFavoritePresetDigit,
  blocksCanvasShortcut,
  getKeyboardShortcut,
  getKeyboardTargetInfo,
  suppressesKeyRepeat,
  type KeyboardShortcut,
} from "./core/keyboardShortcuts";
import type { EditCommand } from "./core/editCommands";
import {
  createObjectClipboard,
  createPastedObjects,
  hasProtectedObjectInSelection,
  isCuttableSelection,
  type ObjectClipboard,
} from "./core/objectClipboard";
import { appServices } from "./services";
import { Toolbar } from "./components/Toolbar";
import { LibraryPanel } from "./components/LibraryPanel";
import { CanvasStage, type CanvasStageController } from "./components/CanvasStage";
import { ObjectContextMenu } from "./components/ObjectContextMenu";
import { PropertyPanel } from "./components/PropertyPanel";
import { StatusBar, type AutosaveStatus } from "./components/StatusBar";
import { CalibrationDialog } from "./components/CalibrationDialog";
import { CalibrationVerificationDialog } from "./components/CalibrationVerificationDialog";
import { ExportDialog } from "./components/ExportDialog";
import { ArrangementDialog } from "./components/ArrangementDialog";

import { ChairArcRowsDialog } from "./components/ChairArcRowsDialog";
import { ChairLineDialog, createChairLineSession, type ChairLineSession } from "./components/ChairLineDialog";
import { StringSectionTemplateDialog } from "./components/StringSectionTemplateDialog";
import { UserTemplateNameDialog } from "./components/UserTemplateNameDialog";
import { RiserGroupDialog, type RiserGroupSession } from "./components/RiserGroupDialog";
import { LineArrangementDialog, type LineArrangementSession } from "./components/LineArrangementDialog";
import { chairArcLaunchIssue, chairLineLaunchIssue, createChairArcSession, createRiserGroupObjects, fitChairLineStartMm, fitRiserGroupCenterMm, riserGroupBoundsMm, riserParallelRows, RISER_PRESET_IDS, type ChairArcSession, type RiserDimensions, type RiserPresetId } from "./core/arrangement";
import { createChairLineObjects } from "./core/arrangement";
import { createPresetObject } from "./state/appState";
import { nextSelectionId, selectionUnits } from "./core/layout";
import { findPreset } from "./core/presets";
import { countRequiredItems, type RequirementScope } from "./core/requirements";
import { fitViewToObjects, fitViewToProject, getBackgroundDisplaySizePx, zoomAt } from "./core/transform";
import { deserializeUserTemplates, serializeUserTemplates } from "./core/userTemplate";
import { stageTemplateBoundsMm } from "./core/stageTemplate";
import {
  STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID,
  STRING_LAYOUT_12_SEAT_PRESET_ID,
  STRING_LAYOUT_12_STAND_PRESET_ID,
  createStringLayout12Objects,
  createStringSectionTemplateSession,
  stringLayout12Placements,
  stringSectionTemplateLaunchIssue,
  stringSectionTemplateOptionsFromSession,
  stringTemplateBackgroundBoundsMm,
  stringTemplateWarnings,
  type StringSectionTemplateSession,
} from "./core/stringSectionTemplate";

const Viewer3D = lazy(() => import("./components/Viewer3D").then((module) => ({ default: module.Viewer3D })));

interface Viewer3DErrorBoundaryProps {
  onClose: () => void;
  children: ReactNode;
}

interface Viewer3DErrorBoundaryState {
  hasError: boolean;
}

class Viewer3DErrorBoundary extends Component<Viewer3DErrorBoundaryProps, Viewer3DErrorBoundaryState> {
  state: Viewer3DErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): Viewer3DErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("3Dビューの読み込みに失敗しました", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="viewer3d-error-screen" aria-label="3Dビューエラー">
        <div className="viewer3d-error" role="alert">
          <h2>3Dビューを表示できません</h2>
          <p>WebGLまたは3Dモジュールの読み込みに失敗しました。</p>
          <p>2D編集画面へ戻って作業を続けられます。</p>
          <button type="button" onClick={this.props.onClose}>2D編集へ戻る</button>
        </div>
      </section>
    );
  }
}

function Viewer3DLoading({ onClose }: { onClose: () => void }) {
  return (
    <section className="viewer3d-error-screen" aria-label="3Dビュー読み込み中">
      <div className="viewer3d-loading" role="status">
        <p>3Dビューを読み込んでいます…</p>
        <button type="button" onClick={onClose}>2D編集へ戻る</button>
      </div>
    </section>
  );
}

const EDIT_COMMAND_SHORTCUTS: ReadonlySet<KeyboardShortcut> = new Set(["undo", "redo", "copy", "cut", "paste", "pasteInPlace", "duplicate", "selectAll", "group", "ungroup", "delete"]);

function isEditCommandShortcut(shortcut: KeyboardShortcut): shortcut is EditCommand {
  return EDIT_COMMAND_SHORTCUTS.has(shortcut);
}

const TOOL_MODE_BY_SHORTCUT: Partial<Record<KeyboardShortcut, ToolMode>> = {
  modeSelect: "select",
  modeSelectRect: "selectRect",
  modeMeasure: "measure",
  modeTraceWall: "traceWall",
  modeCalibrate: "calibrate",
  modeAimPoint: "aimPoint",
  modeAnnotationText: "annotationText",
  modeAnnotationLine: "annotationLine",
  modeAnnotationArrow: "annotationArrow",
  modeAnnotationRect: "annotationRect",

  modeAnnotationCircle: "annotationCircle",
  modeAnnotationDimension: "annotationDimension",
};

function toolModeForShortcut(shortcut: KeyboardShortcut): ToolMode | null {
  return TOOL_MODE_BY_SHORTCUT[shortcut] ?? null;
}

function hasEditableSelection(state: AppState): boolean {
  return state.selectedIds.some((id) => {
    const object = state.project.objects.find((candidate) => candidate.id === id);
    const layer = object ? state.project.layers.find((candidate) => candidate.id === object.layerId) : undefined;
    return Boolean(object && !object.locked && !object.backgroundFixed && !layer?.locked);
  });
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => createInitialState());
  const [storageReady, setStorageReady] = useState(false);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [gridSourceId, setGridSourceId] = useState<string | null>(null);
  const [viewer3dOpen, setViewer3dOpen] = useState(false);
  const [wallDraft, setWallDraft] = useState<PointMm[]>([]);

  // 椅子多列円弧配置の確定前セッション。Project・履歴・自動保存には入れない(FR-064-22)。
  const [chairArc, setChairArc] = useState<ChairArcSession | null>(null);
  // ???????????????Project???????????????
  const [chairLine, setChairLine] = useState<ChairLineSession | null>(null);
  // 弦楽器テンプレ配置の確定前セッション。同じくProject・履歴・自動保存へは入れない(15.2)。
  const [stringTemplate, setStringTemplate] = useState<StringSectionTemplateSession | null>(null);
  const [riserGroup, setRiserGroup] = useState<RiserGroupSession | null>(null);
  const [lineArrangement, setLineArrangement] = useState<LineArrangementSession | null>(null);
  // Requirement scope is display-only local state; it is not persisted in Project or JSON.
  const [requirementScope, setRequirementScope] = useState<RequirementScope>("visible");
  const [cursorMm, setCursorMm] = useState<PointMm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth > 960);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth > 960);
  const autosaveRequestRef = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);
  const storageLoadStarted = useRef(false);
  const templateLoadStarted = useRef(false);
  const libraryLoadStarted = useRef(false);
  const nudgeActiveRef = useRef(false);
  const clipboardRef = useRef<ObjectClipboard | null>(null);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const canvasStageRef = useRef<CanvasStageController | null>(null);
  const registerCanvasController = useCallback((controller: CanvasStageController | null) => {
    canvasStageRef.current = controller;
  }, []);
  const focusCanvas = useCallback(() => {
    canvasStageRef.current?.focus();
  }, []);
  const getCanvasViewport = useCallback(() => {
    return canvasStageRef.current?.getViewport() ?? {
      width: Math.max(320, window.innerWidth - 520),
      height: Math.max(240, window.innerHeight - 180),
    };
  }, []);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  function showNotice(message: string) {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }
  function armPresetFromShortcut(presetId: string | null): boolean {
    if (!presetId || !findPreset(presetId)) return false;
    if (!canPlaceObjects(state.project)) {
      showNotice("縮尺未設定のため配置できません。先に「縮尺合わせ」で2点と実距離を指定してください。");
      return false;
    }
    const layer = state.project.layers.find((candidate) => candidate.id === state.activeLayerId);
    if (!layer || layer.locked || !layer.visible) {
      showNotice("配置先レイヤーが非表示またはロックされています。");
      return false;
    }
    dispatch({ type: "SET_PENDING_PRESET", presetId });
    return true;
  }
  function runAutosave(project: Project) {
    const requestId = ++autosaveRequestRef.current;
    setAutosaveStatus("saving");
    void appServices.autosave.saveProject(project)
      .then(() => {
        if (requestId === autosaveRequestRef.current) {
          setAutosaveStatus("saved");
        }
      })
      .catch(() => {
        if (requestId !== autosaveRequestRef.current) return;
        setAutosaveStatus("error");
        showNotice("自動保存に失敗しました。内容はファイル未保存です。再試行または「ファイル保存」を実行してください。");
      });
  }

  async function exportUserTemplates() {
    if (state.userTemplates.length === 0) {
      showNotice("書き出すユーザーテンプレートがありません");
      return;
    }
    try {
      await appServices.file.saveFile({
        filename: "舞台配置ユーザーテンプレート.json",
        mimeType: "application/json",
        data: serializeUserTemplates(state.userTemplates),
      });
      showNotice(String(state.userTemplates.length) + "件のユーザーテンプレートを書き出しました");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "ユーザーテンプレートを書き出せません");
    }
  }

  async function importUserTemplates() {
    try {
      const file = await appServices.file.openFile({ accept: ["application/json", ".json"] });
      if (!file) return;
      const templates = deserializeUserTemplates(new TextDecoder().decode(file.bytes));
      if (!templates) {
        showNotice("ユーザーテンプレートJSONの形式が不正です");
        return;
      }
      dispatch({ type: "IMPORT_USER_TEMPLATES", templates });
      showNotice(String(templates.length) + "件のユーザーテンプレートを読み込みました");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "ユーザーテンプレートを読み込めません");
    }
  }

  function toggleViewer3D() {
    if (viewer3dOpen) {
      setViewer3dOpen(false);
      return;
    }
    if (state.project.calibration.mmPerPixel === null) {
      showNotice("3Dビューには縮尺設定済みの図面が必要です。");
      return;
    }
    setViewer3dOpen(true);
  }

  function openChairArcRows() {
    const issue = chairArcLaunchIssue(state.project, state.selectedIds, state.activeLayerId);
    if (issue) {
      showNotice(issue);
      return;
    }
    const podium = state.project.objects.find((object) => object.id === state.selectedIds[0]);
    if (!podium) return;
    setChairArc(createChairArcSession(podium, state.activeLayerId));
  }

  function openChairLine() {
    const issue = chairLineLaunchIssue(state.project, state.activeLayerId);
    if (issue) {
      showNotice(issue);
      return;
    }
    const mmPerPixel = effectiveMmPerPixel(state.project);
    rememberDialogTrigger();
    setChairArc(null);
    setStringTemplate(null);
    setRiserGroup(null);
    setLineArrangement(null);

    const displaySize = getBackgroundDisplaySizePx(state.project.background);
    const templateBounds = stageTemplateBoundsMm(state.project.stageTemplate);
    const stageBounds = templateBounds ?? (state.project.background.imageDataUrl
      ? {
          minXMm: 0,
          minYMm: 0,
          maxXMm: displaySize.widthPx * mmPerPixel,
          maxYMm: displaySize.heightPx * mmPerPixel,
        }
      : null);
    const requestedCenter = stageBounds
      ? { xMm: (stageBounds.minXMm + stageBounds.maxXMm) / 2, yMm: (stageBounds.minYMm + stageBounds.maxYMm) / 2 }
      : { xMm: 0, yMm: 0 };
    const session = createChairLineSession(requestedCenter, state.activeLayerId);
    const chairTemplate = createPresetObject("chair", state.activeLayerId, 0);
    const start = chairTemplate
      ? fitChairLineStartMm(requestedCenter, chairTemplate, session.options, stageBounds)
      : requestedCenter;
    setChairLine({ ...session, options: { ...session.options, start } });
  }
  function rememberDialogTrigger() {
    const active = document.activeElement;
    dialogReturnFocusRef.current = active instanceof HTMLElement ? active : null;
  }

  function restoreDialogTrigger() {
    const trigger = dialogReturnFocusRef.current;
    dialogReturnFocusRef.current = null;
    if (trigger?.isConnected) window.requestAnimationFrame(() => trigger.focus());
  }

  function closeRiserGroup() {
    setRiserGroup(null);
    restoreDialogTrigger();
  }

  function closeLineArrangement() {
    dispatch({ type: "CANCEL_TRANSIENT_EDIT" });
    setLineArrangement(null);
    restoreDialogTrigger();
  }
  function closeChairLine() {
    setChairLine(null);
    restoreDialogTrigger();
  }


  function openRiserGroup() {
    if (!canPlaceObjects(state.project)) {
      showNotice("縮尺未設定のため山台を配置できません。先に縮尺合わせをしてください。");
      return;
    }
    const layer = state.project.layers.find((candidate) => candidate.id === state.activeLayerId);
    if (!layer || layer.locked || !layer.visible) {
      showNotice("配置先レイヤーが非表示またはロックされています。");
      return;
    }
    rememberDialogTrigger();
    setChairArc(null);
    setStringTemplate(null);
    setLineArrangement(null);
    const mmPerPixel = effectiveMmPerPixel(state.project);
    const displaySize = getBackgroundDisplaySizePx(state.project.background);
    const templateBounds = stageTemplateBoundsMm(state.project.stageTemplate);
    const stageBounds = templateBounds ?? (state.project.background.imageDataUrl
      ? {
          minXMm: 0,
          minYMm: 0,
          maxXMm: displaySize.widthPx * mmPerPixel,
          maxYMm: displaySize.heightPx * mmPerPixel,
        }
      : null);
    const requestedCenter = cursorMm ?? (stageBounds
      ? { xMm: (stageBounds.minXMm + stageBounds.maxXMm) / 2, yMm: (stageBounds.minYMm + stageBounds.maxYMm) / 2 }
      : { xMm: 0, yMm: 0 });
    const defaultOptions = {
      center: requestedCenter,
      segments: [{ presetId: "riser-6x6" as const, count: 1 }],
      heightMm: 300 as const,
      direction: "horizontal" as const,
      parallelCount: 1,
      parallelGapMm: 0,
    };
    const dimensions = Object.fromEntries(RISER_PRESET_IDS.map((presetId) => {
      const preset = createPresetObject(presetId, state.activeLayerId, 0);
      return [presetId, { widthMm: preset?.widthMm ?? 0, depthMm: preset?.depthMm ?? 0 }];
    })) as RiserDimensions;
    const center = stageBounds
      ? fitRiserGroupCenterMm(requestedCenter, riserGroupBoundsMm(defaultOptions, dimensions), stageBounds)
      : requestedCenter;
    setRiserGroup({
      options: { ...defaultOptions, center },
      layerId: state.activeLayerId,
      fixedToBack: false,
      pickingAnchor: false,
    });
  }

  function openLineArrangement() {
    const units = selectionUnits(state.project.objects, state.selectedIds);
    if (units.length < 2) {
      showNotice("一直線配置には2つ以上のオブジェクトを選択してください。");
      return;
    }
    const targetIds = units.flatMap((unit) => unit.objectIds);
    if (targetIds.some((id) => {
      const object = state.project.objects.find((candidate) => candidate.id === id);
      const layer = object && state.project.layers.find((candidate) => candidate.id === object.layerId);
      return Boolean(object?.locked || object?.backgroundFixed || layer?.locked);
    })) {
      showNotice("ロック中または背景化したオブジェクトを含むため一直線配置できません。");
      return;
    }
    rememberDialogTrigger();
    setRiserGroup(null);
    setLineArrangement({ ids: targetIds, axis: "x", gapMm: 600, initialGapMm: 600 });
  }

  function handleLineArrangementChange(next: LineArrangementSession) {
    setLineArrangement(next);
    if (Number.isFinite(next.gapMm) && next.gapMm >= 0) {
      dispatch({ type: "ARRANGE_SELECTED_LINE", ids: next.ids, options: { axis: next.axis, gapMm: next.gapMm }, preview: true });
    }
  }
  function openStringSectionTemplate() {
    const issue = stringSectionTemplateLaunchIssue(state.project, state.activeLayerId);
    if (issue) {
      showNotice(issue);
      return;
    }
    const selected = state.selectedIds.length === 1
      ? state.project.objects.find((object) => object.id === state.selectedIds[0]) ?? null
      : null;
    const selectedPodium = selected?.presetId === "podium" ? selected : null;
    // 背景画像がない場合はgetEffectiveCropが1pxへ丸めるため、実寸幅として扱わない。
    const displaySize = getBackgroundDisplaySizePx(state.project.background);
    const mmPerPixel = state.project.calibration.mmPerPixel ?? 0;
    const templateBounds = stageTemplateBoundsMm(state.project.stageTemplate);
    const hasBackground = Boolean(state.project.background.imageDataUrl);
    setChairArc(null);
    setStringTemplate(createStringSectionTemplateSession({
      selectedPodium,
      backgroundWidthMm: templateBounds?.maxXMm ?? (hasBackground ? displaySize.widthPx * mmPerPixel : 0),
      backgroundHeightMm: templateBounds?.maxYMm ?? (hasBackground ? displaySize.heightPx * mmPerPixel : 0),
      stageFrontYMm: state.project.stageFront?.yMm ?? null,
      layerId: state.activeLayerId,
    }));
  }

  function finishWallTrace(heightMm: number) {
    if (wallDraft.length < 2) return;
    dispatch({ type: "ADD_WALL", wall: { id: generateId("wall"), points: wallDraft, heightMm, closed: false } });
    setWallDraft([]);
  }

  function executeEditCommand(command: EditCommand): boolean {
    if (contextMenu !== null) setContextMenu(null);
    switch (command) {
      case "copy": {
        const clipboard = createObjectClipboard(state.project, state.selectedIds);
        if (!clipboard) return false;
        clipboardRef.current = clipboard;
        showNotice(`${clipboard.objects.length}個のオブジェクトをコピーしました`);
        return true;
      }
      case "cut": {
        if (state.selectedIds.length === 0) return false;
        if (hasProtectedObjectInSelection(state.project, state.selectedIds)) {
          showNotice("ロック中または背景化したオブジェクトを含むため切り取りできません");
          return true;
        }
        if (!isCuttableSelection(state.project, state.selectedIds)) return false;
        const clipboard = createObjectClipboard(state.project, state.selectedIds);
        if (!clipboard) return false;
        clipboardRef.current = clipboard;
        dispatch({ type: "CUT_SELECTED" });
        showNotice(`${clipboard.objects.length}個のオブジェクトを切り取りました`);
        return true;
      }
      case "paste":
      case "pasteInPlace": {
        const clipboard = clipboardRef.current;
        if (!clipboard) {
          showNotice("貼り付けるオブジェクトがありません");
          return false;
        }
        const pasted = createPastedObjects(
          clipboard,
          state.project,
          state.activeLayerId,
          { cursorMm, preservePosition: command === "pasteInPlace" },
          generateId,
        );
        if (pasted.length === 0) {
          showNotice("貼り付け先の編集可能なレイヤーがありません");
          return false;
        }
        dispatch({ type: "ADD_OBJECTS", objects: pasted });
        showNotice(`${pasted.length}個のオブジェクトを貼り付けました`);
        return true;
      }
      case "group":
        if (state.selectedIds.length < 2) return false;
        dispatch({ type: "GROUP_SELECTED" });
        return true;
      case "ungroup":
        if (!state.selectedIds.some((id) => state.project.objects.find((object) => object.id === id)?.groupId)) return false;
        dispatch({ type: "UNGROUP_SELECTED" });
        return true;
      case "duplicate":
        if (state.selectedIds.length === 0) return false;
        dispatch({ type: "DUPLICATE_SELECTED" });
        return true;
      case "selectAll":
        dispatch({
          type: "SELECT_MANY",
          ids: state.project.objects.filter((object) => object.visible && !object.backgroundFixed).map((object) => object.id),
        });
        return true;
      case "undo":
        dispatch({ type: "UNDO" });
        return true;
      case "redo":
        dispatch({ type: "REDO" });
        return true;
      case "delete":
        if (state.selectedIds.length === 0) return false;
        dispatch({ type: "DELETE_SELECTED" });
        return true;
    }
  }

  useEffect(() => {
    if (storageLoadStarted.current) return;
    storageLoadStarted.current = true;
    appServices.autosave.loadProject()
      .then((project) => {
        if (project) dispatch({ type: "LOAD_PROJECT", project });
      })
      .catch(() => showNotice("自動保存データを読み込めませんでした。新規プロジェクトを表示します。"))
      .finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (templateLoadStarted.current) return;
    templateLoadStarted.current = true;
    appServices.templates.loadTemplates()
      .then((templates) => dispatch({ type: "LOAD_USER_TEMPLATES", templates }))
      .catch(() => {
        dispatch({ type: "LOAD_USER_TEMPLATES", templates: [] });
        showNotice("ユーザーテンプレートを読み込めませんでした。");
      });
  }, []);

  useEffect(() => {
    if (state.mode !== "traceWall" && wallDraft.length > 0) {
      setWallDraft([]);
    }
  }, [state.mode, wallDraft.length]);
  useEffect(() => {
    if (libraryLoadStarted.current) return;
    libraryLoadStarted.current = true;
    appServices.settings.read<LibraryPreferences>(LIBRARY_PREFERENCES_KEY)
      .then((preferences) => dispatch({ type: "LOAD_LIBRARY_PREFERENCES", preferences }))
      .catch(() => dispatch({ type: "LOAD_LIBRARY_PREFERENCES", preferences: null }));
  }, []);

  useEffect(() => {
    // Undoなどで基準指揮台が消えた場合はプレビューを破棄する。
    if (chairArc && !state.project.objects.some((object) => object.id === chairArc.options.podiumId)) {
      setChairArc(null);
    }
  }, [chairArc, state.project.objects]);

  useEffect(() => {
    if (!state.userTemplatesReady) return;
    appServices.templates.saveTemplates(state.userTemplates)
      .catch(() => showNotice("ユーザーテンプレートの保存に失敗しました"));
  }, [state.userTemplates, state.userTemplatesReady]);
  useEffect(() => {
    if (!state.libraryPreferencesReady) return;
    appServices.settings.write<LibraryPreferences>(LIBRARY_PREFERENCES_KEY, state.libraryPreferences)
      .catch(() => showNotice("ライブラリ設定の保存に失敗しました"));
  }, [state.libraryPreferences, state.libraryPreferencesReady]);

  useEffect(() => {
    if (!storageReady || state.saveState !== "dirty") return;
    setAutosaveStatus("pending");
    const timer = window.setTimeout(() => {
      runAutosave(state.project);
    }, 1500);
    return () => {
      window.clearTimeout(timer);
      // 編集が進んだ時点で、古い非同期結果を最新状態へ反映させない。
      autosaveRequestRef.current += 1;
    };
  }, [state.project, state.saveState, storageReady]);

  useEffect(() => {
    if (state.saveState !== "dirty" && autosaveStatus !== "idle") {
      setAutosaveStatus("idle");
    }
  }, [state.saveState, autosaveStatus]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = getKeyboardShortcut(event);
      if (!shortcut) return;
      if (event.defaultPrevented) return;
      const targetInfo = getKeyboardTargetInfo(event.target);

      const calibrationDialogOpen = state.mode === "calibrate" && state.calibPointsPx.length === 2;
      const verificationDialogOpen = state.mode === "verifyCalibration" && state.calibPointsPx.length === 2;
      const blockingSurfaceOpen = viewer3dOpen
        || exportOpen
        || gridSourceId !== null
        || chairLine !== null
        || riserGroup !== null
        || lineArrangement !== null
        || calibrationDialogOpen
        || verificationDialogOpen
        || templateSaveOpen;
      if (blockingSurfaceOpen) {
        if (shortcut === "escape") {
          event.preventDefault();
          if (viewer3dOpen) setViewer3dOpen(false);
          else if (exportOpen) setExportOpen(false);
          else if (gridSourceId !== null) setGridSourceId(null);
          else if (chairLine !== null) closeChairLine();
          else if (riserGroup !== null) closeRiserGroup();
          else if (lineArrangement !== null) closeLineArrangement();
          else if (templateSaveOpen) setTemplateSaveOpen(false);
          else dispatch({ type: "CANCEL_CALIBRATION" });
        }
        return;
      }

      if (riserGroup !== null) {
        if (shortcut === "escape") {
          event.preventDefault();
          setRiserGroup(null);
          return;
        }
        if (!isEditCommandShortcut(shortcut)) return;
      }

      if (lineArrangement !== null) {
        if (shortcut === "escape") {
          event.preventDefault();
          dispatch({ type: "CANCEL_TRANSIENT_EDIT" });
          setLineArrangement(null);
          return;
        }
        if (!isEditCommandShortcut(shortcut)) return;
      }
      if (stringTemplate !== null) {
        // プレビュー中はEscで破棄する。誤って既存オブジェクトを編集しないよう編集操作は無効にする。
        if (shortcut === "escape") {
          event.preventDefault();
          setStringTemplate(null);
          return;
        }
        if (!isEditCommandShortcut(shortcut)) return;
      }

      if (chairArc !== null) {
        // プレビュー中はEscで破棄する。誤って選択中の指揮台を編集しないよう編集操作は無効にする。
        if (shortcut === "escape") {
          event.preventDefault();
          setChairArc(null);
          return;
        }
        if (!isEditCommandShortcut(shortcut)) return;
      }

      if (contextMenu !== null && !isEditCommandShortcut(shortcut)) return;

      if (blocksCanvasShortcut(targetInfo, shortcut)) return;
      if (event.repeat && suppressesKeyRepeat(shortcut)) return;

      if (shortcut === "escape") {
        if (state.mode !== "select" || Boolean(state.pendingPresetId) || Boolean(state.pendingUserTemplateId)) {
          event.preventDefault();
          setWallDraft([]);
          if (state.transientBaseProject) dispatch({ type: "CANCEL_TRANSIENT_EDIT" });
          dispatch({ type: "SET_MODE", mode: "select" });
        } else if (state.selectedIds.length > 0) {
          event.preventDefault();
          dispatch({ type: "SELECT", id: null });
        }
        return;
      }

      if (isEditCommandShortcut(shortcut)) {
        if (executeEditCommand(shortcut)) event.preventDefault();
        return;
      }

      const toolMode = toolModeForShortcut(shortcut);
      if (toolMode) {
        event.preventDefault();
        const nextMode = state.mode === toolMode ? "select" : toolMode;
        if (nextMode !== "traceWall") setWallDraft([]);
        dispatch({ type: "SET_MODE", mode: nextMode });
        return;
      }

      if (shortcut === "rotateCw" || shortcut === "rotateCcw" || shortcut === "rotateCwFine" || shortcut === "rotateCcwFine") {
        if (!hasEditableSelection(state)) return;
        event.preventDefault();
        const deltaDeg = shortcut === "rotateCw" ? 15 : shortcut === "rotateCcw" ? -15 : shortcut === "rotateCwFine" ? 5 : -5;
        dispatch({ type: "ROTATE_SELECTED_DELTA", deltaDeg });
        return;
      }

      if (shortcut === "zoomFit") {
        event.preventDefault();
        const viewport = getCanvasViewport();
        dispatch({ type: "SET_VIEW", view: fitViewToProject(state.project, viewport.width, viewport.height) });
        return;
      }
      if (shortcut === "zoomSelection") {
        const viewport = getCanvasViewport();
        const view = fitViewToObjects(state.project.objects, state.selectedIds, viewport.width, viewport.height);
        if (!view) return;
        event.preventDefault();
        dispatch({ type: "SET_VIEW", view });
        return;
      }
      if (shortcut === "zoomIn" || shortcut === "zoomOut") {
        event.preventDefault();
        const viewport = getCanvasViewport();
        const factor = shortcut === "zoomIn" ? 1.25 : 1 / 1.25;
        const nextZoom = Math.min(2, Math.max(0.005, state.project.view.zoom * factor));
        dispatch({ type: "SET_VIEW", view: zoomAt(state.project.view, { x: viewport.width / 2, y: viewport.height / 2 }, nextZoom) });
        return;
      }

      if (shortcut === "repeatLastPreset") {
        event.preventDefault();
        armPresetFromShortcut(state.libraryPreferences.recentPresetIds[0] ?? null);
        return;
      }
      if (shortcut === "favoritePreset") {
        const digit = getFavoritePresetDigit(event);
        if (digit === null) return;
        event.preventDefault();
        armPresetFromShortcut(favoritePresetIdForDigit(state.libraryPreferences, digit));
        return;
      }

      if (shortcut === "nextSelection" || shortcut === "previousSelection") {
        if (!targetInfo.isCanvas) return;
        const nextId = nextSelectionId(
          state.project.objects,
          state.project.layers,
          state.selectedId,
          shortcut === "nextSelection" ? "next" : "previous",
        );
        if (!nextId) return;
        event.preventDefault();
        dispatch({ type: "SELECT", id: nextId });
        return;
      }

      switch (shortcut) {
        case "arrowLeft":
        case "arrowRight":
        case "arrowUp":
        case "arrowDown": {
          if (state.mode !== "select" || state.pendingPresetId || state.selectedIds.length === 0 || event.altKey) return;
          const stepMm = event.shiftKey ? 100 : 10;
          const direction = shortcut === "arrowLeft"
            ? { dxMm: -stepMm, dyMm: 0 }
            : shortcut === "arrowRight"
              ? { dxMm: stepMm, dyMm: 0 }
              : shortcut === "arrowUp"
                ? { dxMm: 0, dyMm: -stepMm }
                : { dxMm: 0, dyMm: stepMm };
          event.preventDefault();
          nudgeActiveRef.current = true;
          dispatch({ type: "NUDGE_SELECTED_PREVIEW", ...direction });
          return;
        }
      }

    }

    function handleKeyUp(event: KeyboardEvent) {
      const shortcut = getKeyboardShortcut(event);
      if (blocksCanvasShortcut(getKeyboardTargetInfo(event.target), shortcut ?? undefined)) return;
      if (contextMenu !== null) return;
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
        && nudgeActiveRef.current
      ) {
        nudgeActiveRef.current = false;
        dispatch({ type: "COMMIT_TRANSIENT_EDIT" });
        return;
      }
      if (event.key === "Shift" && state.pendingPresetId && !state.placementContinuous) {
        // Shift連続配置はキーを離した時点で待機を解除し、次のクリックを誤配置にしない。
        dispatch({ type: "SET_PENDING_PRESET", presetId: null });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [state, cursorMm, viewer3dOpen, exportOpen, gridSourceId, chairLine, riserGroup, lineArrangement, chairArc, stringTemplate, contextMenu, templateSaveOpen]);

  const requirementCounts = useMemo(() => countRequiredItems(
    { objects: state.project.objects, layers: state.project.layers },
    { scope: requirementScope },
  ), [state.project.objects, state.project.layers, requirementScope]);

  const calibrationReady = state.mode === "calibrate" && state.calibPointsPx.length === 2;
  const verificationReady = state.mode === "verifyCalibration" && state.calibPointsPx.length === 2;

  /**
   * 弦楽器テンプレ配置のライブプレビュー(15)。coreの純粋関数で毎回作り直すだけで、
   * project.objects・Undo履歴・保存状態・自動保存へは一切書き込まない。
   * IDは決定的に振るため、入力が変わらなければReactのkeyも変わらない。
   */
  const riserPreview = useMemo(() => {
    if (!riserGroup) return null;
    const templates = new Map<RiserPresetId, NonNullable<ReturnType<typeof createPresetObject>>>();
    [...new Set(riserParallelRows(riserGroup.options).flatMap((row) => row.segments).map((segment) => segment.presetId))].forEach((presetId) => {
      const template = createPresetObject(presetId, riserGroup.layerId, 0);
      if (template) templates.set(presetId, template);
    });
    return createRiserGroupObjects(templates, riserGroup.options, "riser-preview", (index) => "riser-preview-" + index);
  }, [riserGroup]);
  const chairLinePreview = useMemo(() => {
    if (!chairLine) return null;
    const chairTemplate = createPresetObject("chair", chairLine.options.layerId, 0);
    const standTemplate = chairLine.options.includeMusicStands
      ? createPresetObject("music-stand", chairLine.options.layerId, 0)
      : null;
    if (!chairTemplate) return [];
    return createChairLineObjects(chairTemplate, chairLine.options, undefined, standTemplate ?? undefined);
  }, [chairLine]);
  const stringTemplatePreview = useMemo(() => {
    if (!stringTemplate) return null;
    const podium = stringTemplate.podiumId
      ? state.project.objects.find((object) => object.id === stringTemplate.podiumId) ?? null
      : null;
    const options = stringSectionTemplateOptionsFromSession(stringTemplate, podium);
    const placements = stringLayout12Placements(options);
    const chair = createPresetObject(STRING_LAYOUT_12_SEAT_PRESET_ID, options.layerId, 0);
    const stand = createPresetObject(STRING_LAYOUT_12_STAND_PRESET_ID, options.layerId, 0);
    const contrabassStool = createPresetObject(STRING_LAYOUT_12_CONTRABASS_SEAT_PRESET_ID, options.layerId, 0);
    if (!chair || !stand || !contrabassStool) {
      return { options, placements, objects: [], warnings: [], presetMissing: true };
    }
    const objects = createStringLayout12Objects(
      { chair, stand, contrabassStool },
      options,
      0,
      (_role, key) => `string-template-preview-${key}`,
    );
    const warnings = stringTemplateWarnings(
      objects,
      stringTemplateBackgroundBoundsMm(state.project, getBackgroundDisplaySizePx(state.project.background)),
      state.project.objects.length,
    );
    return { options, placements, objects, warnings, presetMissing: false };
  }, [stringTemplate, state.project]);

  return (
    <div className="app-layout">
      {!viewer3dOpen && <Toolbar state={state} dispatch={dispatch} onNotice={showNotice} onEditCommand={executeEditCommand} clipboardAvailable={clipboardRef.current !== null} onFocusCanvas={focusCanvas} getCanvasViewport={getCanvasViewport} onExport={() => setExportOpen(true)} onToggle3d={toggleViewer3D} is3dOpen={viewer3dOpen} wallDraft={wallDraft} onFinishWall={finishWallTrace} onClearWallDraft={() => setWallDraft([])} onToggleLibrary={() => setLibraryOpen((open) => !open)} onToggleInspector={() => setInspectorOpen((open) => !open)} libraryOpen={libraryOpen} inspectorOpen={inspectorOpen} />}
      {!storageReady && <div className="banner info">ローカル保存データを確認中…</div>}
      {state.mode === "traceWall" && <div className="banner info">壁トレースモード: 背景上を順にクリックして壁の頂点を追加します。2点以上で「壁を確定」、高さはmmで指定してください({wallDraft.length}点)</div>}
      {state.project.calibration.mmPerPixel === null && state.project.stageTemplate === null && (
        <div className="banner warning">未校正です。背景読込 → 縮尺合わせで既知の2点をクリック → その2点間の実寸を選択、の順で始めてください(1間=1820mm、半間=910mm)。</div>
      )}
      {state.mode === "calibrate" && state.calibPointsPx.length < 2 && (
        <div className="banner info">縮尺合わせ: 図面上の既知距離の{state.calibPointsPx.length === 0 ? "始点" : "終点"}をクリックしてください({state.calibPointsPx.length}/2)</div>
      )}
      {state.mode === "verifyCalibration" && state.calibPointsPx.length < 2 && (
        <div className="banner info">縮尺確認: 保存済みの基準距離と同じ2点をクリックしてください({state.calibPointsPx.length}/2)</div>
      )}
      {state.mode === "selectRect" && <div className="banner info">範囲選択モード: キャンバス上をドラッグ。枠に少しでも重なった配置物を選択します</div>}
      {state.mode === "measure" && <div className="banner info">距離を測る: 2点をクリックすると距離を表示します</div>}
      {state.mode === "aimPoint" && (
        <div className="banner info">{"\u6307\u5b9a\u70b9\u30e2\u30fc\u30c9: \u30ad\u30e3\u30f3\u30d0\u30b9\u4e0a\u306e\u57fa\u6e96\u70b9\u3092\u30af\u30ea\u30c3\u30af\u3059\u308b\u3068\u3001\u9078\u629e\u7269\u3092\u305d\u306e\u70b9\u3078\u5411\u3051\u307e\u3059\u3002Escape\u3067\u30ad\u30e3\u30f3\u30bb\u30eb\u3067\u304d\u307e\u3059\u3002"}</div>
      )}
      {state.mode.startsWith("annotation") && <div className="banner info">注釈モード: キャンバスをクリックまたはドラッグして注釈を作成します。作成後にラベルや寸法を編集できます。</div>}
      {notice && <div className="banner notice">{notice}</div>}

      {viewer3dOpen ? (
        <Viewer3DErrorBoundary onClose={() => setViewer3dOpen(false)}>
          <Suspense fallback={<Viewer3DLoading onClose={() => setViewer3dOpen(false)} />}>
            <Viewer3D state={state} onClose={() => setViewer3dOpen(false)} onNotice={showNotice} />
          </Suspense>
        </Viewer3DErrorBoundary>
      ) : (
        <>
          <main className={`main-area${libraryOpen ? " library-is-open" : ""}${inspectorOpen ? " inspector-is-open" : ""}`}>
            <LibraryPanel state={state} dispatch={dispatch} onClose={() => setLibraryOpen(false)} onNotice={showNotice} onExportUserTemplates={exportUserTemplates} onImportUserTemplates={importUserTemplates} />
            <CanvasStage state={state} dispatch={dispatch} onCursorMm={setCursorMm} onRegisterCanvasController={registerCanvasController} onNotice={showNotice} wallDraft={wallDraft} onWallDraftChange={setWallDraft} onContextMenu={(position) => setContextMenu(position)} chairArc={chairArc} onChairArcChange={setChairArc} chairLine={chairLine} onChairLineChange={setChairLine} stringTemplate={stringTemplate} onStringTemplateChange={setStringTemplate} riserGroup={riserGroup} onRiserGroupChange={setRiserGroup} lineArrangement={lineArrangement} onLineArrangementChange={handleLineArrangementChange} previewObjects={stringTemplatePreview?.objects} riserPreviewObjects={riserPreview ?? undefined} chairLinePreviewObjects={chairLinePreview ?? undefined} />
            <PropertyPanel state={state} dispatch={dispatch} onOpenSaveUserTemplate={() => setTemplateSaveOpen(true)} onOpenGrid={setGridSourceId} onOpenChairArcRows={openChairArcRows} onOpenChairLine={openChairLine} onOpenStringSectionTemplate={openStringSectionTemplate} onOpenRiserGroup={openRiserGroup} onOpenLineArrangement={openLineArrangement} requirementCounts={requirementCounts} requirementScope={requirementScope} onRequirementScopeChange={setRequirementScope} onFocusCanvas={focusCanvas} onClose={() => setInspectorOpen(false)} />
          </main>
          <StatusBar state={state} cursorMm={cursorMm} autosaveStatus={autosaveStatus} onRetryAutosave={() => runAutosave(state.project)} />
        </>
      )}
      {templateSaveOpen && (
        <UserTemplateNameDialog
          title="テンプレートとして保存"
          onClose={() => setTemplateSaveOpen(false)}
          onSubmit={(name) => {
            dispatch({ type: "SAVE_USER_TEMPLATE", name });
            setTemplateSaveOpen(false);
            showNotice("ユーザーテンプレートを保存しました");
          }}
        />
      )}
      {calibrationReady && <CalibrationDialog dispatch={dispatch} />}
      {verificationReady && <CalibrationVerificationDialog state={state} dispatch={dispatch} />}
      {exportOpen && <ExportDialog state={state} dispatch={dispatch} onClose={() => setExportOpen(false)} onNotice={showNotice} />}
      {gridSourceId && <ArrangementDialog state={state} dispatch={dispatch} sourceId={gridSourceId} onClose={() => setGridSourceId(null)} />}

      {chairArc && !viewer3dOpen && (
        <ChairArcRowsDialog
          state={state}
          dispatch={dispatch}
          session={chairArc}
          onSessionChange={setChairArc}
          onClose={() => setChairArc(null)}
          onNotice={showNotice}
        />
      )}
      {chairLine && !viewer3dOpen && <ChairLineDialog state={state} dispatch={dispatch} session={chairLine} onSessionChange={setChairLine} onClose={closeChairLine} onNotice={showNotice} />}
      {riserGroup && !viewer3dOpen && <RiserGroupDialog state={state} dispatch={dispatch} session={riserGroup} onSessionChange={setRiserGroup} onClose={closeRiserGroup} onNotice={showNotice} />}
      {lineArrangement && !viewer3dOpen && <LineArrangementDialog state={state} dispatch={dispatch} session={lineArrangement} onSessionChange={handleLineArrangementChange} onClose={closeLineArrangement} onNotice={showNotice} />}
      {stringTemplate && stringTemplatePreview && !viewer3dOpen && (
        <StringSectionTemplateDialog
          state={state}
          dispatch={dispatch}
          session={stringTemplate}
          options={stringTemplatePreview.options}
          placements={stringTemplatePreview.placements}
          previewObjects={stringTemplatePreview.objects}
          warnings={stringTemplatePreview.warnings}
          presetMissing={stringTemplatePreview.presetMissing}
          onSessionChange={setStringTemplate}
          onClose={() => setStringTemplate(null)}
          onNotice={showNotice}
        />
      )}
      {contextMenu && !viewer3dOpen && !exportOpen && gridSourceId === null && chairLine === null && riserGroup === null && lineArrangement === null && !calibrationReady && !verificationReady && (
        <ObjectContextMenu
          state={state}
          clipboardAvailable={clipboardRef.current !== null}
          position={contextMenu}
          onCommand={executeEditCommand}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
