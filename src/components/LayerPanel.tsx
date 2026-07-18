// Phase 4レイヤー管理。表示・ロックはprojectへ保存し、描画と編集可否の両方へ反映する。
import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function LayerPanel({ state, dispatch }: Props) {
  return (
    <section className="layer-panel">
      <h2>レイヤー</h2>
      <div className="layer-list">
        {state.project.layers.map((layer) => (
          <div key={layer.id} className={`layer-row${state.activeLayerId === layer.id ? " active" : ""}`}>
            <button
              type="button"
              className="layer-name"
              aria-pressed={state.activeLayerId === layer.id}
              onClick={() => dispatch({ type: "SET_ACTIVE_LAYER", layerId: layer.id })}
            >
              {layer.name}
            </button>
            <button
              type="button"
              className="layer-icon-button"
              aria-label={`${layer.name}を${layer.visible ? "非表示" : "表示"}`}
              onClick={() => dispatch({ type: "SET_LAYER_VISIBLE", layerId: layer.id, visible: !layer.visible })}
            >
              {layer.visible ? "表示" : "非表示"}
            </button>
            <button
              type="button"
              className="layer-icon-button"
              aria-label={`${layer.name}を${layer.locked ? "編集可能" : "ロック"}にする`}
              onClick={() => dispatch({ type: "SET_LAYER_LOCKED", layerId: layer.id, locked: !layer.locked })}
            >
              {layer.locked ? "🔒" : "🔓"}
            </button>
          </div>
        ))}
      </div>
      <p className="hint">選択中: {state.project.layers.find((layer) => layer.id === state.activeLayerId)?.name ?? "—"}</p>
    </section>
  );
}

