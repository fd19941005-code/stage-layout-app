// 左パネル: オブジェクトライブラリ(10.1)。
// プリセットを選択し、キャンバスをクリック/タップして配置する。

import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import { OBJECT_PRESETS, PRESET_CATEGORIES } from "../core/presets";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function LibraryPanel({ state, dispatch }: Props) {
  const calibrated = state.project.calibration.mmPerPixel !== null;

  return (
    <aside className="library-panel">
      <h2>ライブラリ</h2>
      {!calibrated && (
        <p className="hint">
          未校正のため配置できません。先に背景を読み込み「校正」を実行してください。
        </p>
      )}
      {PRESET_CATEGORIES.map((category) => (
        <section key={category}>
          <h3>{category}</h3>
          <ul>
            {OBJECT_PRESETS.filter((p) => p.category === category).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={state.pendingPresetId === p.id ? "active" : ""}
                  disabled={!calibrated}
                  onClick={() =>
                    dispatch({
                      type: "SET_PENDING_PRESET",
                      presetId: state.pendingPresetId === p.id ? null : p.id,
                    })
                  }
                >
                  <span>{p.name}</span>
                  <span className="dims">
                    {p.widthMm}×{p.depthMm}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
