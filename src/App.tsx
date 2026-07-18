// アプリ全体の画面構成(10.1)とデータフロー。
// 自動保存(FR-002): IndexedDBへ最終操作から1.5秒後にデバウンスして実行する。

import { useEffect, useReducer, useRef, useState } from "react";
import type { PointMm } from "./types/project";
import { appReducer, createInitialState } from "./state/appState";
import { loadAutosavedProject, saveAutosavedProject } from "./core/storage";
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

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => createInitialState());
  const [storageReady, setStorageReady] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [gridSourceId, setGridSourceId] = useState<string | null>(null);
  const [pultArcOpen, setPultArcOpen] = useState(false);
  const [cursorMm, setCursorMm] = useState<PointMm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const storageLoadStarted = useRef(false);

  function showNotice(message: string) {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }

  useEffect(() => {
    if (storageLoadStarted.current) return;
    storageLoadStarted.current = true;
    loadAutosavedProject()
      .then((project) => {
        if (project) dispatch({ type: "LOAD_PROJECT", project });
      })
      .catch(() => showNotice("自動保存データを読み込めませんでした。新規プロジェクトを表示します。"))
      .finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (!storageReady || state.saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      saveAutosavedProject(state.project).catch(() => showNotice("自動保存に失敗しました(容量超過の可能性があります)"));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [state.project, state.saveState, storageReady]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target?.tagName ?? "")) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "REDO" : "UNDO" });
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "REDO" });
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
        dispatch({ type: "NUDGE_SELECTED", ...direction });
      } else if ((event.key === "Delete" || event.key === "Backspace") && state.selectedIds.length > 0) {
        event.preventDefault();
        dispatch({ type: "DELETE_SELECTED" });
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
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
  }, [state.mode, state.selectedIds.length, state.pendingPresetId, state.placementContinuous]);

  const calibrationReady = state.mode === "calibrate" && state.calibPointsPx.length === 2;
  const verificationReady = state.mode === "verifyCalibration" && state.calibPointsPx.length === 2;

  return (
    <div className="app-layout">
      <Toolbar state={state} dispatch={dispatch} onNotice={showNotice} onExport={() => setExportOpen(true)} />
      {!storageReady && <div className="banner info">ローカル保存データを確認中…</div>}
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

      <main className="main-area">
        <LibraryPanel state={state} dispatch={dispatch} />
        <CanvasStage state={state} dispatch={dispatch} onCursorMm={setCursorMm} onNotice={showNotice} />
        <PropertyPanel state={state} dispatch={dispatch} onOpenGrid={setGridSourceId} onOpenPultArc={() => setPultArcOpen(true)} />
      </main>
      <StatusBar state={state} cursorMm={cursorMm} />
      {calibrationReady && <CalibrationDialog dispatch={dispatch} />}
      {verificationReady && <CalibrationVerificationDialog state={state} dispatch={dispatch} />}
      {exportOpen && <ExportDialog state={state} dispatch={dispatch} onClose={() => setExportOpen(false)} onNotice={showNotice} />}
      {gridSourceId && <ArrangementDialog state={state} dispatch={dispatch} sourceId={gridSourceId} onClose={() => setGridSourceId(null)} />}
      {pultArcOpen && <PultArcDialog state={state} dispatch={dispatch} onClose={() => setPultArcOpen(false)} />}
    </div>
  );
}

