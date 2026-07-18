// 右プロパティパネル(10.1): 背景、レイヤー、スナップ、選択物の編集。
// 寸法変更は数値入力のみ(FR-042、FR-043)。ドラッグによる拡大縮小は提供しない。

import type { Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import type { SceneObject, Wall } from "../types/project";
import type { Alignment } from "../core/layout";
import { BackgroundPanel } from "./BackgroundPanel";
import { LayerPanel } from "./LayerPanel";
import { SnapPanel } from "./SnapPanel";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onOpenGrid: (sourceId: string) => void;
  onOpenPultArc: () => void;
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

interface WallPanelProps {
  state: AppState;
  dispatch: Dispatch<Action>;
}

function WallPanel({ state, dispatch }: WallPanelProps) {
  const walls = state.project.walls;
  return (
    <section className="wall-panel">
      <h2>3D用の壁・舞台前端</h2>
      <p className="hint">「壁トレース」で背景上をクリックして折れ線を作成します。高さはmmで保存されます。</p>
      {walls.length === 0 && <p className="hint">登録された壁はありません。</p>}
      {walls.map((wall: Wall, wallIndex) => (
        <details key={wall.id} className="wall-editor" open>
          <summary>壁{wallIndex + 1}（{wall.points.length}点）</summary>
          <label>壁の高さ(mm)
            <input type="number" min={1} value={wall.heightMm} onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value > 0) dispatch({ type: "UPDATE_WALL", id: wall.id, patch: { heightMm: value } });
            }} />
          </label>
          <label className="row"><input type="checkbox" checked={wall.closed} onChange={(e) => dispatch({ type: "UPDATE_WALL", id: wall.id, patch: { closed: e.target.checked } })} />閉じた壁として扱う</label>
          <div className="wall-points">
            {wall.points.map((point, pointIndex) => (
              <div className="wall-point-row" key={wall.id + "-point-" + pointIndex}>
                <span>{pointIndex + 1}</span>
                <input aria-label={"壁" + (wallIndex + 1) + "の点" + (pointIndex + 1) + " X"} type="number" value={point.xMm} onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) dispatch({ type: "UPDATE_WALL_POINT", wallId: wall.id, index: pointIndex, point: { xMm: value, yMm: point.yMm } });
                }} />
                <input aria-label={"壁" + (wallIndex + 1) + "の点" + (pointIndex + 1) + " Y"} type="number" value={point.yMm} onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) dispatch({ type: "UPDATE_WALL_POINT", wallId: wall.id, index: pointIndex, point: { xMm: point.xMm, yMm: value } });
                }} />
                <button type="button" disabled={wall.points.length <= 2} onClick={() => dispatch({ type: "DELETE_WALL_POINT", wallId: wall.id, index: pointIndex })} aria-label={"壁" + (wallIndex + 1) + "の点" + (pointIndex + 1) + "を削除"}>×</button>
              </div>
            ))}
          </div>
          <div className="actions">
            <button type="button" onClick={() => {
              const last = wall.points[wall.points.length - 1] ?? { xMm: 0, yMm: 0 };
              dispatch({ type: "ADD_WALL_POINT", wallId: wall.id, point: { xMm: last.xMm + 500, yMm: last.yMm } });
            }}>頂点追加</button>
            <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_WALL", id: wall.id })}>壁を削除</button>
          </div>
        </details>
      ))}
      <label>舞台前端Y (mm)
        <input type="number" value={state.project.stageFront?.yMm ?? ""} placeholder="未設定" onChange={(e) => {
          if (e.target.value.trim() === "") dispatch({ type: "SET_STAGE_FRONT", yMm: null });
          else {
            const value = Number(e.target.value);
            if (Number.isFinite(value)) dispatch({ type: "SET_STAGE_FRONT", yMm: value });
          }
        }} />
      </label>
    </section>
  );
}

export function PropertyPanel({ state, dispatch, onOpenGrid, onOpenPultArc }: Props) {
  const selectedObjects = state.project.objects.filter((object) => state.selectedIds.includes(object.id));
  const selected: SceneObject | undefined = selectedObjects[0] ?? state.project.objects.find((object) => object.id === state.selectedId);
  const activeLayer = state.project.layers.find((layer) => layer.id === state.activeLayerId);
  const risers = state.project.objects.filter((object) => object.type === "riser");

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
    const objectLayer = state.project.layers.find((layer) => layer.id === selectedObject.layerId);
    const editable = !selectedObject.locked && !objectLayer?.locked;
    function commit(patch: Partial<SceneObject>) {
      dispatch({ type: "UPDATE_OBJECT", id: selectedObject.id, patch });
    }
    return (
      <>
        <p className="object-name">{selectedObject.name}</p>
        <label>レイヤー
          <select value={selectedObject.layerId} disabled={!editable} onChange={(e) => commit({ layerId: e.target.value })}>
            {state.project.layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}{layer.locked ? " 🔒" : ""}</option>)}
          </select>
        </label>
        <label>ラベル<input value={selectedObject.label} disabled={!editable} onChange={(e) => commit({ label: e.target.value })} /></label>
        {NUMERIC_FIELDS.map(({ key, label, min }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              value={selectedObject[key]}
              min={min}
              disabled={!editable}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (!Number.isFinite(value) || (min !== undefined && value < min)) return;
                commit({ [key]: value });
              }}
            />
          </label>
        ))}
        {(selectedObject.annotationKind === "line" || selectedObject.annotationKind === "arrow" || selectedObject.annotationKind === "dimension") && (
          <div className="dialog-form-grid">
            <label>終点X(mm)<input type="number" value={selectedObject.endXMm ?? selectedObject.xMm} disabled={!editable} onChange={(e) => commit({ endXMm: Number(e.target.value) })} /></label>
            <label>終点Y(mm)<input type="number" value={selectedObject.endYMm ?? selectedObject.yMm} disabled={!editable} onChange={(e) => commit({ endYMm: Number(e.target.value) })} /></label>
          </div>
        )}
        {selectedObject.type !== "riser" && (
          <label>載っている山台
            <select value={selectedObject.onRiserId ?? ""} disabled={!editable} onChange={(e) => commit({ onRiserId: e.target.value || null })}>
              <option value="">なし</option>
              {risers.filter((riser) => riser.id !== selectedObject.id).map((riser) => <option key={riser.id} value={riser.id}>{riser.label || riser.name} ({Math.round(riser.xMm)}, {Math.round(riser.yMm)})</option>)}
            </select>
          </label>
        )}
        <label className="row"><input type="checkbox" checked={selectedObject.locked} disabled={Boolean(objectLayer?.locked)} onChange={(e) => commit({ locked: e.target.checked })} />ロック(FR-055)</label>
        <div className="actions">
          <button type="button" disabled={Boolean(objectLayer?.locked)} onClick={() => onOpenGrid(selectedObject.id)}>行列配置</button>
          <button type="button" disabled={selectedObject.locked || Boolean(objectLayer?.locked)} onClick={() => dispatch({ type: "DUPLICATE_OBJECT", id: selectedObject.id })}>複製</button>
          <button type="button" className="danger" disabled={!editable} onClick={() => dispatch({ type: "DELETE_OBJECT", id: selectedObject.id })}>削除</button>
        </div>
      </>
    );
  }

  return (
    <aside className="property-panel">
      <BackgroundPanel state={state} dispatch={dispatch} />
      <LayerPanel state={state} dispatch={dispatch} />
      <SnapPanel state={state} dispatch={dispatch} />
      <WallPanel state={state} dispatch={dispatch} />
      <section className="arrangement-tools">
        <h2>一括配置</h2>
        <button type="button" disabled={!activeLayer || activeLayer.locked || !activeLayer.visible} onClick={onOpenPultArc}>プルトを弧状配置</button>
        <p className="hint">選択物が1つのとき「行列配置」を使えます。</p>
      </section>
      <section className="object-properties">
        <h2>プロパティ</h2>
        {selectedObjects.length === 0 && <p className="hint">オブジェクトを選択すると座標・寸法・角度を編集できます。</p>}
        {renderMultipleProperties()}
        {renderSingleProperties()}
      </section>
    </aside>
  );
}

