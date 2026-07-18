// 下部ステータスバー(10.1): 縮尺、カーソル座標、選択数、自動保存状態。
// 未校正状態を常時明示する(10.3)。

import type { PointMm } from "../types/project";
import type { AppState } from "../state/appState";
import { mmDistance } from "../core/transform";

interface Props {
  state: AppState;
  cursorMm: PointMm | null;
}

export function StatusBar({ state, cursorMm }: Props) {
  const { calibration } = state.project;
  const [mA, mB] = state.measurePointsMm;
  return (
    <footer className="status-bar">
      <span className={calibration.mmPerPixel === null ? "warning" : ""}>
        {calibration.mmPerPixel === null ? "未校正" : `校正済み: 1px = ${calibration.mmPerPixel.toFixed(2)}mm`}
      </span>
      <span>{cursorMm ? `X: ${Math.round(cursorMm.xMm)}mm / Y: ${Math.round(cursorMm.yMm)}mm` : "—"}</span>
      <span>{mA && mB ? `測定: ${Math.round(mmDistance(mA, mB))}mm` : ""}</span>
      <span>選択: {state.selectedIds.length} / {state.project.objects.length}個</span>
      <span>{state.saveState === "dirty" ? "未保存の変更あり" : "保存済み"}</span>
      <span>履歴: {state.past.length}/{50}</span>
    </footer>
  );
}
