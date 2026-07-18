// 右プロパティパネル(10.1): 背景、選択物の座標・寸法・角度・一括編集。
// 寸法変更は数値入力のみ(FR-042、FR-043)。ドラッグによる拡大縮小は提供しない。

import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import type { SceneObject } from "../types/project";
import type { Alignment } from "../core/layout";
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

const ALIGN_BUTTONS: { alignment: Alignment; label: string }[] = [
  { alignment: "left", label: "左揃え" },
  { alignment: "centerX", label: "左右中央" },
  { alignment: "right", label: "右揃え" },
  { alignment: "top", label: "上揃え" },
  { alignment: "centerY", label: "上下中央" },
  { alignment: "bottom", label: "下揃え" },
];

export function PropertyPanel({ state, dispatch }: Props) {
  const selectedObjects = state.project.objects.filter((object) => state.selectedIds.includes(object.id));
  const selected: SceneObject | undefined = selectedObjects[0] ?? state.project.objects.find((object) => object.id === state.selectedId);

  function renderMultipleProperties() {
    if (selectedObjects.length < 2) return null;
    return (
      <div className="multi-properties">
        <p className="object-name">{selectedObjects.length}個を選択中</p>
        <h3>整列</h3>
        <div className="property-button-grid">
          {ALIGN_BUTTONS.map(({ alignment, label }) => (
            <button key={alignment} type="button" onClick={() => dispatch({ type: "ALIGN_SELECTED", alignment })}>{label}</button>
          ))}
        </div>
        <h3>等間隔</h3>
        <div className="property-button-grid">
          <button type="button" onClick={() => dispatch({ type: "DISTRIBUTE_SELECTED", axis: "x" })}>水平</button>
          <button type="button" onClick={() => dispatch({ type: "DISTRIBUTE_SELECTED", axis: "y" })}>垂直</button>
        </div>
        <div className="property-button-grid">
          <button type="button" onClick={() => dispatch({ type: "GROUP_SELECTED" })}>グループ化</button>
          <button type="button" onClick={() => dispatch({ type: "UNGROUP_SELECTED" })}>解除</button>
          <button type="button" onClick={() => dispatch({ type: "SET_SELECTED_LOCKED", locked: true })}>ロック</button>
          <button type="button" onClick={() => dispatch({ type: "SET_SELECTED_LOCKED", locked: false })}>ロック解除</button>
          <button type="button" onClick={() => dispatch({ type: "DUPLICATE_SELECTED" })}>複製</button>
          <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_SELECTED" })}>削除</button>
        </div>
      </div>
    );
  }

  function renderSingleProperties() {
    if (!selected || selectedObjects.length > 1) return null;
    const selectedObject = selected;
    function commit(patch: Partial<SceneObject>) {
      dispatch({ type: "UPDATE_OBJECT", id: selectedObject.id, patch });
    }
    return (
      <>
        <p className="object-name">{selectedObject.name}</p>
        <label>ラベル<input value={selectedObject.label} onChange={(e) => commit({ label: e.target.value })} /></label>
        {NUMERIC_FIELDS.map(({ key, label, min }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              value={selectedObject[key]}
              min={min}
              disabled={selectedObject.locked}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (!Number.isFinite(value) || (min !== undefined && value < min)) return;
                commit({ [key]: value });
              }}
            />
          </label>
        ))}
        <label className="row"><input type="checkbox" checked={selectedObject.locked} onChange={(e) => commit({ locked: e.target.checked })} />ロック(FR-055)</label>
        <div className="actions">
          <button type="button" onClick={() => dispatch({ type: "DUPLICATE_OBJECT", id: selectedObject.id })}>複製</button>
          <button type="button" className="danger" disabled={selectedObject.locked} onClick={() => dispatch({ type: "DELETE_OBJECT", id: selectedObject.id })}>削除</button>
        </div>
      </>
    );
  }

  return (
    <aside className="property-panel">
      <BackgroundPanel state={state} dispatch={dispatch} />
      <section className="object-properties">
        <h2>プロパティ</h2>
        {selectedObjects.length === 0 && <p className="hint">オブジェクトを選択すると座標・寸法・角度を編集できます。</p>}
        {renderMultipleProperties()}
        {renderSingleProperties()}
      </section>
    </aside>
  );
}
