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
  const { calibration, stageTemplate } = state.project;
  const [mA, mB] = state.measurePointsMm;
  const autosaveLabel = autosaveStatus === "saving"
    ? "保存中…"
    : autosaveStatus === "saved"
      ? "保存済み"
    : autosaveStatus === "error"
      ? "保存失敗"
    : autosaveStatus === "pending"
      ? "待機中…"
      : "待機中";
  return (
    <footer className="status-bar" aria-label="図面の状態">
      <span className={!stageTemplate && calibration.mmPerPixel === null ? "warning" : ""}>
        {stageTemplate ? "実寸テンプレート: 1間 = 1,820mm" : calibration.mmPerPixel === null ? "縮尺未設定" : `縮尺設定済み: 1px = ${calibration.mmPerPixel.toFixed(2)}mm`}
      </span>
      <span>{cursorMm ? `X: ${Math.round(cursorMm.xMm)}mm / Y: ${Math.round(cursorMm.yMm)}mm` : "座標なし"}</span>
      <span>{mA && mB ? `距離: ${Math.round(mmDistance(mA, mB))}mm` : ""}</span>
      <span>選択: {state.selectedIds.length} / {state.project.objects.length}個</span>
      <span className={autosaveStatus === "error" ? "warning autosave-status" : "autosave-status"} aria-live="polite">
        自動保存: {autosaveLabel}
        {autosaveStatus === "error" && (
          <button type="button" className="status-retry" onClick={onRetryAutosave}>再試行</button>
        )}
      </span>
      <span>履歴: {state.past.length}/{50}</span>
    </footer>
  );
}
