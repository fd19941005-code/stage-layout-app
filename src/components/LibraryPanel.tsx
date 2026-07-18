// 左パネル: オブジェクトライブラリ(10.1)。
// プリセットを選択し、キャンバスをクリック/タップして配置する。

import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import { canPlaceObjects } from "../state/appState";
import { OBJECT_PRESETS, PRESET_CATEGORIES } from "../core/presets";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function LibraryPanel({ state, dispatch }: Props) {
  const calibrated = canPlaceObjects(state.project);
  const activeLayer = state.project.layers.find((layer) => layer.id === state.activeLayerId);
  const canPlace = calibrated && Boolean(activeLayer?.visible) && !activeLayer?.locked;
  return (
    <aside className="library-panel">
      <h2>ライブラリ</h2>
      {!calibrated && <p className="hint">未校正のため配置できません。先に背景を読み込み「校正」を実行してください。</p>}
      {calibrated && (!activeLayer?.visible || activeLayer.locked) && <p className="hint">選択中のレイヤーが非表示またはロックされています。</p>}
      {calibrated && <p className="hint">配置先: {activeLayer?.name ?? "—"}</p>}
      {PRESET_CATEGORIES.map((category) => (
        <section key={category}>
          <h3>{category}</h3>
          <ul>
            {OBJECT_PRESETS.filter((preset) => preset.category === category).map((preset) => (
              <li key={preset.id}>
                <button type="button" className={state.pendingPresetId === preset.id ? "active" : ""} disabled={!canPlace} onClick={() => dispatch({ type: "SET_PENDING_PRESET", presetId: state.pendingPresetId === preset.id ? null : preset.id })}>
                  <span>{preset.name}</span>
                  <span className="dims">{preset.widthMm}×{preset.depthMm}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}


