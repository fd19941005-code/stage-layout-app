// アプリ全体の画面構成(10.1)とデータフロー。
// 自動保存(FR-002): IndexedDBへ最終操作から1.5秒後にデバウンスして実行する。

import { Component, lazy, Suspense, useEffect, useReducer, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import type { PointMm } from "./types/project";
import { appReducer, createInitialState } from "./state/appState";
import { generateId } from "./core/project";
import { appServices } from "./services";
import { Toolbar } from "./components/Toolbar";
import { LibraryPanel } from "./components/LibraryPanel";
import { CanvasStage } from "./components/CanvasStage";
import { PropertyPanel } from "./components/PropertyPanel";
import { StatusBar } from "./components/StatusBar";
import { CalibrationDialog } from "./components/CalibrationDialog";
import { CalibrationVerificationDialog } from "./components/CalibrationVerificationDialog";
import { ExportDialog } from "./components/ExportDialog";
import { ArrangementDialog } from "./components/ArrangementDialog";
import { PultArcDialog } from "./components/PultArcDialog";

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

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => createInitialState());
  const [storageReady, setStorageReady] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [gridSourceId, setGridSourceId] = useState<string | null>(null);
  const [viewer3dOpen, setViewer3dOpen] = useState(false);
  const [wallDraft, setWallDraft] = useState<PointMm[]>([]);
  const [pultArcOpen, setPultArcOpen] = useState(false);
  const [cursorMm, setCursorMm] = useState<PointMm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth > 960);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth > 960);
  const noticeTimer = useRef<number | undefined>(undefined);
  const storageLoadStarted = useRef(false);
  const nudgeActiveRef = useRef(false);

  function showNotice(message: string) {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }

  function toggleViewer3D() {
    if (viewer3dOpen) {
      setViewer3dOpen(false);
      return;
    }
    if (state.project.calibration.mmPerPixel === null) {
      showNotice("3Dビューには校正済みのプロジェクトが必要です。");
      return;
    }
    setViewer3dOpen(true);
  }

  function finishWallTrace(heightMm: number) {
    if (wallDraft.length < 2) return;
    dispatch({ type: "ADD_WALL", wall: { id: generateId("wall"), points: wallDraft, heightMm, closed: false } });
    setWallDraft([]);
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
    if (state.mode !== "traceWall" && wallDraft.length > 0) {
      setWallDraft([]);
    }
  }, [state.mode, wallDraft.length]);

  useEffect(() => {
    if (!storageReady || state.saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      appServices.autosave.saveProject(state.project).catch(() => showNotice("自動保存に失敗しました(容量超過の可能性があります)"));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [state.project, state.saveState, storageReady]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target?.tagName ?? "")) return;
      if (event.key === "Escape" && (state.mode !== "select" || Boolean(state.pendingPresetId))) {
        event.preventDefault();
        setWallDraft([]);
        dispatch({ type: "SET_MODE", mode: "select" });
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "REDO" : "UNDO" });
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "REDO" });
      } else if (modifier && event.key.toLowerCase() === "d" && state.selectedIds.length > 0) {
        event.preventDefault();
        dispatch({ type: "DUPLICATE_SELECTED" });
      } else if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        dispatch({
          type: "SELECT_MANY",
          ids: state.project.objects.filter((object) => object.visible).map((object) => object.id),
        });
      } else if (
        state.mode === "select"
        && !state.pendingPresetId
        && !modifier
        && !event.altKey
        && state.selectedIds.length > 0
        && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        const stepMm = event.shiftKey ? 100 : 10;
        const direction = {
          ArrowLeft: { dxMm: -stepMm, dyMm: 0 },
          ArrowRight: { dxMm: stepMm, dyMm: 0 },
          ArrowUp: { dxMm: 0, dyMm: -stepMm },
          ArrowDown: { dxMm: 0, dyMm: stepMm },
        }[event.key];
        if (!direction) return;
        event.preventDefault();
        nudgeActiveRef.current = true;
        dispatch({ type: "NUDGE_SELECTED_PREVIEW", ...direction });
      } else if ((event.key === "Delete" || event.key === "Backspace") && state.selectedIds.length > 0) {
        event.preventDefault();
        dispatch({ type: "DELETE_SELECTED" });
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && nudgeActiveRef.current) {
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
  }, [state.mode, state.selectedIds.length, state.pendingPresetId, state.placementContinuous, state.project.objects]);

  const calibrationReady = state.mode === "calibrate" && state.calibPointsPx.length === 2;
  const verificationReady = state.mode === "verifyCalibration" && state.calibPointsPx.length === 2;

  return (
    <div className="app-layout">
      {!viewer3dOpen && <Toolbar state={state} dispatch={dispatch} onNotice={showNotice} onExport={() => setExportOpen(true)} onToggle3d={toggleViewer3D} is3dOpen={viewer3dOpen} wallDraft={wallDraft} onFinishWall={finishWallTrace} onClearWallDraft={() => setWallDraft([])} onToggleLibrary={() => setLibraryOpen((open) => !open)} onToggleInspector={() => setInspectorOpen((open) => !open)} libraryOpen={libraryOpen} inspectorOpen={inspectorOpen} />}
      {!storageReady && <div className="banner info">ローカル保存データを確認中…</div>}
      {state.mode === "traceWall" && <div className="banner info">壁トレースモード: 背景上を順にクリックして壁の頂点を追加します。2点以上で「壁を確定」、高さはmmで指定してください({wallDraft.length}点)</div>}
      {state.project.calibration.mmPerPixel === null && (
        <div className="banner warning">未校正です。背景読込 → 校正で既知の2点をクリック → その2点間の実寸を選択、の順で始めてください(1間=1820mm、半間=910mm)。</div>
      )}
      {state.mode === "calibrate" && state.calibPointsPx.length < 2 && (
        <div className="banner info">校正モード: 図面上の既知距離の{state.calibPointsPx.length === 0 ? "始点" : "終点"}をクリックしてください({state.calibPointsPx.length}/2)</div>
      )}
      {state.mode === "verifyCalibration" && state.calibPointsPx.length < 2 && (
        <div className="banner info">校正確認: 保存済みの基準距離と同じ2点をクリックしてください({state.calibPointsPx.length}/2)</div>
      )}
      {state.mode === "selectRect" && <div className="banner info">範囲選択モード: キャンバス上をドラッグして複数のオブジェクトを選択してください</div>}
      {state.mode === "measure" && <div className="banner info">測定モード: 2点をクリックすると距離を表示します</div>}
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
            <LibraryPanel state={state} dispatch={dispatch} onClose={() => setLibraryOpen(false)} />
            <CanvasStage state={state} dispatch={dispatch} onCursorMm={setCursorMm} onNotice={showNotice} wallDraft={wallDraft} onWallDraftChange={setWallDraft} />
            <PropertyPanel state={state} dispatch={dispatch} onOpenGrid={setGridSourceId} onOpenPultArc={() => setPultArcOpen(true)} onClose={() => setInspectorOpen(false)} />
          </main>
          <StatusBar state={state} cursorMm={cursorMm} />
        </>
      )}
      {calibrationReady && <CalibrationDialog dispatch={dispatch} />}
      {verificationReady && <CalibrationVerificationDialog state={state} dispatch={dispatch} />}
      {exportOpen && <ExportDialog state={state} dispatch={dispatch} onClose={() => setExportOpen(false)} onNotice={showNotice} />}
      {gridSourceId && <ArrangementDialog state={state} dispatch={dispatch} sourceId={gridSourceId} onClose={() => setGridSourceId(null)} />}
      {pultArcOpen && <PultArcDialog state={state} dispatch={dispatch} onClose={() => setPultArcOpen(false)} />}
    </div>
  );
}
