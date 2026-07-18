// 右プロパティパネル(10.1): 背景、選択物の座標・寸法・角度・ラベル・ロック。
// 寸法変更は数値入力のみ(FR-042、FR-043)。ドラッグによる拡大縮小は提供しない。

import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import type { SceneObject } from "../types/project";
import { BackgroundPanel } from "./BackgroundPanel";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

type NumericField = "xMm" | "yMm" | "widthMm" | "depthMm" | "heightMm" | "rotationDeg";

const NUMERIC_FIELDS: { key: NumericField; label: string; min?: number }[] = [
  { key: "xMm", label: "X (mm)" },
  { key: "yMm", label: "Y (mm)" },
  { key: "widthMm", label: "幅 (mm)", min: 1 },
  { key: "depthMm", label: "奥行 (mm)", min: 1 },
  { key: "heightMm", label: "高さ (mm)", min: 0 },
  { key: "rotationDeg", label: "角度 (度)" },
];

export function PropertyPanel({ state, dispatch }: Props) {
  const selected: SceneObject | undefined = state.project.objects.find(
    (o) => o.id === state.selectedId,
  );

  function renderObjectProperties() {
    if (!selected) {
      return <p className="hint">オブジェクトを選択すると座標・寸法・角度を編集できます。</p>;
    }
    const selectedObject = selected;

    function commit(patch: Partial<SceneObject>) {
      dispatch({ type: "UPDATE_OBJECT", id: selectedObject.id, patch });
    }

    return (
      <>
        <p className="object-name">{selectedObject.name}</p>

        <label>
          ラベル
          <input
            value={selectedObject.label}
            onChange={(e) => commit({ label: e.target.value })}
          />
        </label>

        {NUMERIC_FIELDS.map(({ key, label, min }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              value={selectedObject[key]}
              min={min}
              disabled={selectedObject.locked}
              onChange={(e) => {
                const v = Number(e.target.value);
                // 不正な数値は反映しない(10.3)
                if (!Number.isFinite(v)) return;
                if (min !== undefined && v < min) return;
                commit({ [key]: v });
              }}
            />
          </label>
        ))}

        <label className="row">
          <input
            type="checkbox"
            checked={selectedObject.locked}
            onChange={(e) => commit({ locked: e.target.checked })}
          />
          ロック(FR-055)
        </label>

        <div className="actions">
          <button
            type="button"
            onClick={() => dispatch({ type: "DUPLICATE_OBJECT", id: selectedObject.id })}
          >
            複製
          </button>
          <button
            type="button"
            className="danger"
            disabled={selectedObject.locked}
            onClick={() => dispatch({ type: "DELETE_OBJECT", id: selectedObject.id })}
          >
            削除
          </button>
        </div>
      </>
    );
  }

  return (
    <aside className="property-panel">
      <BackgroundPanel state={state} dispatch={dispatch} />
      <section className="object-properties">
        <h2>プロパティ</h2>
        {renderObjectProperties()}
      </section>
    </aside>
  );
}
