// Phase 4スナップ設定。間隔と閾値はmmで保存し、ズーム倍率から独立させる。
import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function SnapPanel({ state, dispatch }: Props) {
  const settings = state.project.snapSettings;
  function patch(patch: Partial<typeof settings>) {
    dispatch({ type: "SET_SNAP_SETTINGS", settings: { ...settings, ...patch } });
  }
  return (
    <section className="snap-panel">
      <label className="row"><input type="checkbox" checked={settings.grid} onChange={(e) => patch({ grid: e.target.checked })} />グリッド（線を表示）</label>
      <label className="row"><input type="checkbox" checked={settings.objects} onChange={(e) => patch({ objects: e.target.checked })} />他オブジェクトの中心</label>
      <label className="row"><input type="checkbox" checked={settings.stageCenter} onChange={(e) => patch({ stageCenter: e.target.checked })} />舞台中央線</label>
      <label className="row"><input type="checkbox" checked={settings.guides ?? false} onChange={(e) => patch({ guides: e.target.checked })} />編集ガイド</label>
      <p className="hint">オブジェクトの端・中心どうしの整列ガイドは、移動中つねに働きます（閾値を共有）。</p>
      <div className="snap-number-grid">
        <label>間隔(mm)<input type="number" min={1} value={settings.gridIntervalMm} onChange={(e) => patch({ gridIntervalMm: Number(e.target.value) })} /></label>
        <label>閾値(mm)<input type="number" min={0} value={settings.thresholdMm} onChange={(e) => patch({ thresholdMm: Number(e.target.value) })} /></label>
        <label>ガイド閾値(mm)<input type="number" min={0} value={settings.guideThresholdMm ?? settings.thresholdMm} onChange={(e) => patch({ guideThresholdMm: Number(e.target.value) })} /></label>
      </div>
    </section>
  );
}

