// 下部ステータスバー(10.1): 縮尺、カーソル座標、選択数、自動保存状態。
// 未校正状態を常時明示する(10.3)。

import type { PointMm } from "../types/project";
import type { AppState } from "../state/appState";
import { mmDistance } from "../core/transform";
export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";


interface Props {
  state: AppState;
  cursorMm: PointMm | null;
  autosaveStatus: AutosaveStatus;
  onRetryAutosave: () => void;
}

export function StatusBar({ state, cursorMm, autosaveStatus, onRetryAutosave }: Props) {
  const { calibration } = state.project;
  const [mA, mB] = state.measurePointsMm;
  const autosaveLabel = autosaveStatus === "saving"
    ? "自動保存中…"
    : autosaveStatus === "saved"
      ? "自動保存済み"
      : autosaveStatus === "error"
        ? "自動保存失敗"
        : autosaveStatus === "pending"
          ? "自動保存待機中…"
          : "自動保存待機中";
  return (
    <footer className="status-bar">
      <span className={calibration.mmPerPixel === null ? "warning" : ""}>
        {calibration.mmPerPixel === null ? "縮尺未設定" : `縮尺設定済み: 1px = ${calibration.mmPerPixel.toFixed(2)}mm`}
      </span>
      <span>{cursorMm ? `X: ${Math.round(cursorMm.xMm)}mm / Y: ${Math.round(cursorMm.yMm)}mm` : "—"}</span>
      <span>{mA && mB ? `距離: ${Math.round(mmDistance(mA, mB))}mm` : ""}</span>
      <span>選択: {state.selectedIds.length} / {state.project.objects.length}個</span>
      <span className={state.saveState === "dirty" ? "warning" : ""}>
        {state.saveState === "dirty" ? "ファイル未保存" : "ファイル保存済み"}
      </span>
      <span className={autosaveStatus === "error" ? "warning autosave-status" : "autosave-status"} aria-live="polite">
        {autosaveLabel}
        {autosaveStatus === "error" && (
          <button type="button" className="status-retry" onClick={onRetryAutosave}>再試行</button>
        )}
      </span>
      <span>履歴: {state.past.length}/{50}</span>
    </footer>
  );
}
