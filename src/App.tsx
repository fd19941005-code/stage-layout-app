// アプリ全体の画面構成(10.1)とデータフロー。
// 自動保存(FR-002): 最終操作から1.5秒後にデバウンスして実行する(6.3)。

import { useEffect, useReducer, useRef, useState } from "react";
import type { PointMm } from "./types/project";
import { appReducer, createInitialState } from "./state/appState";
import { deserializeProject, serializeProject } from "./core/project";
import { Toolbar } from "./components/Toolbar";
import { LibraryPanel } from "./components/LibraryPanel";
import { CanvasStage } from "./components/CanvasStage";
import { PropertyPanel } from "./components/PropertyPanel";
import { StatusBar } from "./components/StatusBar";
import { CalibrationDialog } from "./components/CalibrationDialog";
import { CalibrationVerificationDialog } from "./components/CalibrationVerificationDialog";

// Phase 3でIndexedDBへ移行するまでの互換保存キー。JSON形式は引き続き入出力できる。
const AUTOSAVE_KEY = "stageLayout.autosave.v1";

function loadAutosave() {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    return json ? deserializeProject(json) : undefined;
  } catch {
    return undefined;
  }
}

export function App() {
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    () => createInitialState(loadAutosave()),
  );
  const [cursorMm, setCursorMm] = useState<PointMm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  function showNotice(message: string) {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }

  // 自動保存(デバウンス)。復元はページ再読み込み後も有効(NFR-007)
  useEffect(() => {
    if (state.saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, serializeProject(state.project));
      } catch {
        showNotice("自動保存に失敗しました(容量超過の可能性があります)");
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [state.project, state.saveState]);

  const calibrationReady = state.mode === "calibrate" && state.calibPointsPx.length === 2;
  const verificationReady =
    state.mode === "verifyCalibration" && state.calibPointsPx.length === 2;

  return (
    <div className="app-layout">
      <Toolbar state={state} dispatch={dispatch} onNotice={showNotice} />

      {state.project.calibration.mmPerPixel === null && (
        <div className="banner warning">
          未校正です。背景を読み込み、「校正」で図面上の2点と実距離(例: 1マス=910mm)を指定してください。
        </div>
      )}
      {state.mode === "calibrate" && state.calibPointsPx.length < 2 && (
        <div className="banner info">
          校正モード: 図面上の既知距離の{state.calibPointsPx.length === 0 ? "始点" : "終点"}をクリックしてください({state.calibPointsPx.length}/2)
        </div>
      )}
      {state.mode === "verifyCalibration" && state.calibPointsPx.length < 2 && (
        <div className="banner info">
          校正確認: 保存済みの基準距離と同じ2点をクリックしてください({state.calibPointsPx.length}/2)
        </div>
      )}
      {state.mode === "measure" && (
        <div className="banner info">測定モード: 2点をクリックすると距離を表示します</div>
      )}
      {notice && <div className="banner notice">{notice}</div>}

      <main className="main-area">
        <LibraryPanel state={state} dispatch={dispatch} />
        <CanvasStage
          state={state}
          dispatch={dispatch}
          onCursorMm={setCursorMm}
          onNotice={showNotice}
        />
        <PropertyPanel state={state} dispatch={dispatch} />
      </main>

      <StatusBar state={state} cursorMm={cursorMm} />

      {calibrationReady && <CalibrationDialog dispatch={dispatch} />}
      {verificationReady && <CalibrationVerificationDialog state={state} dispatch={dispatch} />}
    </div>
  );
}
