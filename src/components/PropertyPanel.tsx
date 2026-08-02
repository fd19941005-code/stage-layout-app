// 右プロパティパネル(10.1): 背景、レイヤー、スナップ、選択物の編集。
// 寸法変更は数値入力のみ(FR-042、FR-043)。ドラッグによる拡大縮小は提供しない。

import { useEffect, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type ReactNode } from "react";
import type { Action, AppState } from "../state/appState";
import type { SceneObject, Wall } from "../types/project";
import type { Alignment } from "../core/layout";
import type { RequirementCount, RequirementScope } from "../core/requirements";
import { isObjectResizable } from "../core/presets";
import { stageCenterXMm } from "../core/orientation";
import { symbolAssetForId, visualAssetVariantsForPreset } from "../core/symbolAssets";
import { getSymbolDefinition, SYMBOL_VIEW_BOX, symbolIdForAssetVariantId, symbolPaintProps, type SymbolNode } from "../core/symbols";
import { chairArcLaunchIssue, chairLineLaunchIssue } from "../core/arrangement";
import { stringSectionTemplateLaunchIssue } from "../core/stringSectionTemplate";
import { resolveObjectStyle, STYLE_PRESETS, type ObjectStyle } from "../core/visualStyle";
import { BackgroundPanel } from "./BackgroundPanel";
import { LayerPanel } from "./LayerPanel";
import { SnapPanel } from "./SnapPanel";

import { GuidePanel } from "./GuidePanel";
import { RequirementsPanel } from "./RequirementsPanel";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onOpenSaveUserTemplate: () => void;
  onOpenGrid: (sourceId: string) => void;

  onOpenChairArcRows: () => void;
  onOpenChairLine: () => void;
  onOpenStringSectionTemplate: () => void;
  onOpenRiserGroup: () => void;
  onOpenLineArrangement: () => void;
  requirementCounts: RequirementCount[];
  requirementScope: RequirementScope;
  onRequirementScopeChange: (scope: RequirementScope) => void;
  onClose?: () => void;
  onFocusCanvas?: () => void;
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

interface DraftNumberFieldProps {
  label: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  onCommit: (value: number) => void;
}

function DraftNumberField({ label, value, min, max, disabled, className, onCommit }: DraftNumberFieldProps) {
  const currentValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const [draft, setDraft] = useState(String(currentValue));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(String(currentValue));
    setInvalid(false);
  }, [currentValue]);

  function reset() {
    setDraft(String(currentValue));
    setInvalid(false);
  }

  function commit() {
    const next = Number(draft);
    if (!draft.trim() || !Number.isFinite(next) || (min !== undefined && next < min) || (max !== undefined && next > max)) {
      setDraft(String(currentValue));
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(next);
  }

  return (
    <label className={className}>
      {label}
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        disabled={disabled}
        className={invalid ? "input-invalid" : undefined}
        aria-invalid={invalid}
        onChange={(event) => { setDraft(event.target.value); setInvalid(false); }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") { reset(); event.currentTarget.blur(); }
        }}
      />
      {invalid && <small className="input-error">数値を確認してください</small>}
    </label>
  );
}

interface DraftTextFieldProps {
  label: string;
  value: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  onCommit: (value: string) => void;
}

function DraftTextField({ label, value, multiline = false, rows = 3, disabled, placeholder, onCommit }: DraftTextFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  function commit() { if (draft !== value) onCommit(draft); }
  function reset() { setDraft(value); }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Escape") { reset(); event.currentTarget.blur(); }
    if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) event.currentTarget.blur();
  }
  return (
    <label>
      {label}
      {multiline
        ? <textarea rows={rows} className="multiline-label" value={draft} disabled={disabled} placeholder={placeholder} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)} onBlur={commit} onKeyDown={handleKeyDown} />
        : <input value={draft} disabled={disabled} placeholder={placeholder} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)} onBlur={commit} onKeyDown={handleKeyDown} />}
    </label>
  );
}

function renderVariantNode(node: SymbolNode, key: string): ReactNode {
  const paint = symbolPaintProps(node.paint);
  switch (node.kind) {
    case "rect": return <rect key={key} {...paint} x={node.x} y={node.y} width={node.width} height={node.height} rx={node.rx} />;
    case "ellipse": return <ellipse key={key} {...paint} cx={node.cx} cy={node.cy} rx={node.rx} ry={node.ry} />;
    case "circle": return <circle key={key} {...paint} cx={node.cx} cy={node.cy} r={node.r} />;
    case "line": return <line key={key} {...paint} x1={node.x1} y1={node.y1} x2={node.x2} y2={node.y2} />;
    case "polyline": return <polyline key={key} {...paint} points={node.points.map((point) => point.x + "," + point.y).join(" ")} />;
    case "path": return <path key={key} {...paint} d={node.d} />;
  }
}

function SymbolVariantPicker({ object, editable, onSelect }: { object: SceneObject; editable: boolean; onSelect: (assetVariantId: string) => void }) {
  const variants = visualAssetVariantsForPreset(object.presetId);
  if (variants.length < 2) return null;
  const selectedAssetId = object.assetVariantId ?? variants[0]?.assetId;
  return (
    <section className="symbol-variant-editor" aria-label={"\u30b7\u30f3\u30dc\u30eb\u9078\u629e"}>
      <h3>{"\u30b7\u30f3\u30dc\u30eb"}</h3>
      <div className="symbol-variant-grid">
        {variants.map((variant) => {
          const definition = getSymbolDefinition(symbolIdForAssetVariantId(variant.assetId) ?? "");
          const assetLabel = symbolAssetForId(variant.assetId)?.label ?? variant.label;
          return (
            <button
              key={variant.assetId}
              type="button"
              className={"symbol-variant-option" + (selectedAssetId === variant.assetId ? " selected" : "")}
              aria-pressed={selectedAssetId === variant.assetId}
              aria-label={assetLabel + " / " + variant.label}
              disabled={!editable}
              onClick={() => onSelect(variant.assetId)}
            >
              <span className="symbol-variant-preview" aria-hidden="true">
                <svg viewBox={definition?.viewBox ?? SYMBOL_VIEW_BOX} preserveAspectRatio={definition?.preserveAspectRatio ?? "xMidYMid meet"}>
                  {definition?.rawSvg
                    ? <g dangerouslySetInnerHTML={{ __html: definition.rawSvg }} />
                    : definition?.nodes.map((node, index) => renderVariantNode(node, variant.assetId + "-" + index))}
                </svg>
              </span>
              <span className="symbol-variant-label"><strong>{variant.label}</strong><small>{assetLabel}</small></span>
            </button>
          );
        })}
      </div>
      <p className="hint">{"\u5bf8\u6cd5\u30fb\u4f4d\u7f6e\u30fb\u56de\u8ee2\u30fb\u30e9\u30d9\u30eb\u306f\u5909\u66f4\u3057\u307e\u305b\u3093"}</p>
    </section>
  );
}

function selectionCenterMm(objects: readonly SceneObject[]): { xMm: number; yMm: number } | null {
  if (objects.length === 0) return null;
  const total = objects.reduce((sum, object) => ({ xMm: sum.xMm + object.xMm, yMm: sum.yMm + object.yMm }), { xMm: 0, yMm: 0 });
  return { xMm: total.xMm / objects.length, yMm: total.yMm / objects.length };
}

function nearestPodium(objects: readonly SceneObject[], fromMm: { xMm: number; yMm: number } | null): SceneObject | null {
  let nearest: SceneObject | null = null;
  let nearestDistanceMm = Number.POSITIVE_INFINITY;
  for (const object of objects) {
    if (object.type !== "podium") continue;
    const distanceMm = fromMm ? Math.hypot(object.xMm - fromMm.xMm, object.yMm - fromMm.yMm) : 0;
    if (distanceMm < nearestDistanceMm) {
      nearest = object;
      nearestDistanceMm = distanceMm;
    }
  }
  return nearest;
}

interface WallPanelProps {
  state: AppState;
  dispatch: Dispatch<Action>;
}

function WallPanel({ state, dispatch }: WallPanelProps) {
  const walls = state.project.walls;
  return (
    <section className="wall-panel">
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

export function PropertyPanel({ state, dispatch, onOpenSaveUserTemplate, onOpenGrid, onOpenChairArcRows, onOpenChairLine, onOpenStringSectionTemplate, onOpenRiserGroup, onOpenLineArrangement, requirementCounts, requirementScope, onRequirementScopeChange, onClose, onFocusCanvas }: Props) {
  function dispatchAndFocus(action: Action) {
    dispatch(action);
    onFocusCanvas?.();
  }

  const chairArcIssue = chairArcLaunchIssue(state.project, state.selectedIds, state.activeLayerId);
  const chairLineIssue = chairLineLaunchIssue(state.project, state.activeLayerId);
  const stringTemplateIssue = stringSectionTemplateLaunchIssue(state.project, state.activeLayerId);
  const selectedObjects = state.project.objects.filter((object) => state.selectedIds.includes(object.id));
  const projectStageCenterXMm = stageCenterXMm(state.project);
  const editableSelectedObjects = selectedObjects.filter((object) => {
    const layer = state.project.layers.find((candidate) => candidate.id === object.layerId);
    return !object.locked && !object.backgroundFixed && !layer?.locked;
  });
  const selectedChairObjects = selectedObjects.filter((object) => object.type === "chair");
  const editableChairObjects = editableSelectedObjects.filter((object) => object.type === "chair");
  const chairLabelBatchEnabled = selectedChairObjects.length >= 2;
  const chairLabelsMixed = chairLabelBatchEnabled && new Set(selectedChairObjects.map((object) => object.label)).size > 1;
  const sharedChairLabel = chairLabelBatchEnabled && !chairLabelsMixed ? selectedChairObjects[0]?.label ?? "" : "";
  // 向き・対称複製は1個選択でも使えるようにする。reducerは選択集合で動くため条件だけを緩める。
  const orientationEditEnabled = editableSelectedObjects.length > 0;
  // 指揮台は選択に含まれていればそれを、なければ選択範囲の中心から最も近いものを基準にする。
  const selectedPodium = selectedObjects.find((object) => object.type === "podium")
    ?? nearestPodium(state.project.objects, selectionCenterMm(selectedObjects));
  const [mirrorAxisXMm, setMirrorAxisXMm] = useState(0);
  const [targetXMm, setTargetXMm] = useState(0);
  const [targetYMm, setTargetYMm] = useState(0);
  const [uniformRotationDeg, setUniformRotationDeg] = useState(0);
  useEffect(() => {
    if (projectStageCenterXMm !== null) setMirrorAxisXMm(projectStageCenterXMm);
    if (selectedObjects[0]) setUniformRotationDeg(selectedObjects[0].rotationDeg);
  }, [projectStageCenterXMm, selectedObjects[0]?.id, selectedObjects[0]?.rotationDeg]);
  const selected: SceneObject | undefined = selectedObjects[0] ?? state.project.objects.find((object) => object.id === state.selectedId);
  const activeLayer = state.project.layers.find((layer) => layer.id === state.activeLayerId);
  const risers = state.project.objects.filter((object) => object.type === "riser");
  const lineArrangementEnabled = selectedObjects.length >= 2 && selectedObjects.every((object) => {
    const layer = state.project.layers.find((candidate) => candidate.id === object.layerId);
    return !object.locked && !object.backgroundFixed && !layer?.locked;
  });
  const riserGroupSelected = selectedObjects.length >= 2 && selectedObjects.every((object) => object.type === "riser" && object.groupId);
  const riserGroupFixed = riserGroupSelected && selectedObjects.every((object) => object.backgroundFixed);

  /**
   * 選択物の向きと左右対称複製。1個選択でも複数選択でも同じ操作を出す。
   * 使用頻度の高い「向ける」「±度」を先に置き、基準点指定と対称複製は折りたたむ。
   */
  function renderOrientationTools() {
    if (selectedObjects.length === 0) return null;
    return (
      <div className="multi-properties">
        <section className="multi-orientation-editor">
          <h3>{"向きを揃える"}</h3>
          <div className="property-button-grid">
            <button
              type="button"
              disabled={!orientationEditEnabled || selectedPodium === null}
              title={selectedPodium === null ? "指揮台が図面にありません" : undefined}
              onClick={() => {
                if (selectedPodium) dispatchAndFocus({ type: "ROTATE_SELECTED_TO_PODIUM", podiumId: selectedPodium.id });
              }}
            >
              {"指揮台へ向ける"}
            </button>
            <button
              type="button"
              disabled={!orientationEditEnabled}
              onClick={() => dispatchAndFocus({ type: "SET_MODE", mode: "aimPoint" })}
            >
              {"指定点へ向ける"}
            </button>
          </div>
          <div className="property-button-grid">
            <button type="button" disabled={!orientationEditEnabled} onClick={() => dispatchAndFocus({ type: "ROTATE_SELECTED_DELTA", deltaDeg: -15 })}>{"－15度"}</button>
            <button type="button" disabled={!orientationEditEnabled} onClick={() => dispatchAndFocus({ type: "ROTATE_SELECTED_DELTA", deltaDeg: 15 })}>{"＋15度"}</button>
            <button type="button" disabled={!orientationEditEnabled} onClick={() => dispatchAndFocus({ type: "ROTATE_SELECTED_DELTA", deltaDeg: -5 })}>{"－5度"}</button>
            <button type="button" disabled={!orientationEditEnabled} onClick={() => dispatchAndFocus({ type: "ROTATE_SELECTED_DELTA", deltaDeg: 5 })}>{"＋5度"}</button>
          </div>
          <div className="dialog-form-grid">
            <DraftNumberField label={"統一角度 (度)"} value={uniformRotationDeg} disabled={!orientationEditEnabled} onCommit={setUniformRotationDeg} />
            <button
              type="button"
              className="wide"
              disabled={!orientationEditEnabled}
              onClick={() => dispatchAndFocus({ type: "SET_SELECTED_ROTATION", rotationDeg: uniformRotationDeg })}
            >
              {"角度を統一"}
            </button>
          </div>
          <details className="orientation-advanced">
            <summary>{"基準点を指定・左右対称複製"}</summary>
            <div className="dialog-form-grid">
              <DraftNumberField label={"基準X (mm)"} value={targetXMm} disabled={!orientationEditEnabled} onCommit={setTargetXMm} />
              <DraftNumberField label={"基準Y (mm)"} value={targetYMm} disabled={!orientationEditEnabled} onCommit={setTargetYMm} />
            </div>
            <div className="property-button-grid">
              <button
                type="button"
                className="wide"
                disabled={!orientationEditEnabled}
                onClick={() => dispatchAndFocus({ type: "ROTATE_SELECTED_TO_POINT", point: { xMm: targetXMm, yMm: targetYMm } })}
              >
                {"指定X・Yへ向ける"}
              </button>
            </div>
            <div className="property-button-grid">
              <button
                type="button"
                className="wide"
                disabled={!orientationEditEnabled || projectStageCenterXMm === null}
                onClick={() => {
                  if (projectStageCenterXMm !== null) dispatchAndFocus({ type: "MIRROR_SELECTED", axisXMm: projectStageCenterXMm });
                }}
              >
                {"左右対称に複製（舞台中心線）"}
              </button>
            </div>
            <div className="dialog-form-grid">
              <DraftNumberField label={"基準X (mm)"} value={mirrorAxisXMm} disabled={!orientationEditEnabled} onCommit={setMirrorAxisXMm} />
              <button
                type="button"
                className="wide"
                disabled={!orientationEditEnabled}
                onClick={() => dispatchAndFocus({ type: "MIRROR_SELECTED", axisXMm: mirrorAxisXMm })}
              >
                {"左右対称に複製（指定X）"}
              </button>
            </div>
            {projectStageCenterXMm === null && <p className="hint">{"舞台中心線を使うには、背景を読み込み、校正してください。"}</p>}
          </details>
          {!orientationEditEnabled && <p className="hint">{"ロック中のオブジェクトは変更対象から除外されます。"}</p>}
        </section>
      </div>
    );
  }

  /** 2個以上でしか意味を持たない操作。整列・等間隔・一括スタイル・グループ化など。 */
  function renderMultipleProperties() {
    if (selectedObjects.length < 2) return null;
    return (
      <div className="multi-properties">
        <div className="template-save-action">
          <button type="button" className="primary" onClick={onOpenSaveUserTemplate}>テンプレートとして保存</button>
        </div>
        {chairLabelBatchEnabled && (
          <section className="multi-style-editor multi-chair-label-editor">
            <h3>椅子の円内略称</h3>
            <p className="hint">選択中の椅子だけに適用します。短い略称や記号を入力し、空欄で一括クリアできます。椅子以外の選択物は変更されません。</p>
            <DraftTextField
              label="円内に表示する文字"
              value={sharedChairLabel}
              placeholder="例: Vn / ①"
              disabled={editableChairObjects.length === 0}
              onCommit={(label) => dispatch({ type: "SET_SELECTED_CHAIR_LABEL", label })}
            />
            {chairLabelsMixed && <p className="hint">現在の選択には異なる略称が含まれています。入力すると全選択椅子を同じ文字に揃えます。</p>}
            {editableChairObjects.length < selectedChairObjects.length && <p className="hint">ロック中の椅子は変更対象から除外されます。</p>}
          </section>
        )}
        <section className="multi-style-editor">
          <h3>一括スタイル</h3>
          <div className="style-palette compact-style-palette">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="style-palette-button"
                style={{ backgroundColor: preset.style.fillColor, color: preset.style.labelColor, borderColor: preset.style.color }}
                onClick={() => dispatch({ type: "SET_SELECTED_STYLE", style: preset.style })}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </section>
        <h3>整列</h3>
        <div className="property-button-grid">
          {ALIGN_BUTTONS.map(({ alignment, label }) => (
            <button key={alignment} type="button" onClick={() => dispatchAndFocus({ type: "ALIGN_SELECTED", alignment })}>{label}</button>
          ))}
        </div>
        <h3>等間隔</h3>
        <div className="property-button-grid">
          <button type="button" onClick={() => dispatchAndFocus({ type: "DISTRIBUTE_SELECTED", axis: "x" })}>水平</button>
          <button type="button" onClick={() => dispatchAndFocus({ type: "DISTRIBUTE_SELECTED", axis: "y" })}>垂直</button>
        </div>
        <div className="property-button-grid">
          <button type="button" disabled={!lineArrangementEnabled} onClick={onOpenLineArrangement}>一直線配置</button>
        </div>
        {riserGroupSelected && (
          <section className="riser-background-controls">
            <h3>山台グループ</h3>
            <p className="hint">背景化すると表示・出力には残り、範囲選択・移動・複製の対象外になります。</p>
            <div className="property-button-grid">
              <button type="button" disabled={riserGroupFixed} onClick={() => dispatch({ type: "SET_SELECTED_BACKGROUND_FIXED", fixed: true })}>背景化する</button>
              <button type="button" disabled={!riserGroupFixed} onClick={() => dispatch({ type: "SET_SELECTED_BACKGROUND_FIXED", fixed: false })}>背景化を解除</button>
            </div>
          </section>
        )}
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
    const editable = !selectedObject.locked && !selectedObject.backgroundFixed && !objectLayer?.locked;
    const physicalSizeLocked = !isObjectResizable(selectedObject);
    function commit(patch: Partial<SceneObject>) {
      dispatch({ type: "UPDATE_OBJECT", id: selectedObject.id, patch });
    }
    const visualStyle = resolveObjectStyle(selectedObject);
    function updateStyle(patch: Partial<ObjectStyle>, preview = false) {
      const style = { ...(selectedObject.style ?? {}), ...patch };
      if (preview) dispatch({ type: "UPDATE_OBJECT_PREVIEW", id: selectedObject.id, patch: { style } });
      else commit({ style });
    }
    return (
      <>
        <p className="object-name">{selectedObject.name}</p>
        {physicalSizeLocked && <p className="hint">幅・奥行はこのプリセットの寸法仕様で固定されています。</p>}
        <SymbolVariantPicker object={selectedObject} editable={editable} onSelect={(assetVariantId) => dispatch({ type: "SET_OBJECT_ASSET_VARIANT", id: selectedObject.id, assetVariantId })} />
        <label>レイヤー
          <select value={selectedObject.layerId} disabled={!editable} onChange={(e) => commit({ layerId: e.target.value })}>
            {state.project.layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}{layer.locked ? " 🔒" : ""}</option>)}
          </select>
        </label>
        <DraftTextField
          label={selectedObject.type === "chair" ? "円内の略称" : "ラベル"}
          value={selectedObject.label}
          multiline={selectedObject.annotationKind === "text" || selectedObject.annotationKind === "rect"}
          rows={4}
          placeholder={selectedObject.type === "chair" ? "例: Vn / ①" : undefined}
          disabled={!editable}
          onCommit={(label) => commit({ label })}
        />
        {selectedObject.type === "chair" && <p className="hint">短い文字は椅子の円内に表示されます。</p>}
        {NUMERIC_FIELDS.map(({ key, label, min }) => (
          <DraftNumberField
            key={key}
            label={label}
            value={selectedObject[key]}
            min={min}
            disabled={!editable || (physicalSizeLocked && (key === "widthMm" || key === "depthMm"))}
            onCommit={(value) => commit({ [key]: value } as Partial<SceneObject>)}
          />
        ))}
        {renderOrientationTools()}
        <details className="object-style-editor">
          <summary>表示スタイル</summary>
          <div className="style-palette" aria-label="表示スタイルプリセット">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="style-palette-button"
                disabled={!editable}
                title={preset.name}
                style={{ backgroundColor: preset.style.fillColor, color: preset.style.labelColor, borderColor: preset.style.color }}
                onClick={() => updateStyle(preset.style)}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <div className="style-color-grid">
            <label>記号・線色<input type="color" value={visualStyle.color} disabled={!editable} onChange={(e) => updateStyle({ color: e.target.value })} /></label>
            <label>塗り色<input type="color" value={visualStyle.fillColor} disabled={!editable} onChange={(e) => updateStyle({ fillColor: e.target.value })} /></label>
            <label>ラベル色<input type="color" value={visualStyle.labelColor} disabled={!editable} onChange={(e) => updateStyle({ labelColor: e.target.value })} /></label>
          </div>
          <label>塗りの濃さ
            <input type="range" min={0} max={1} step={0.05} value={visualStyle.fillOpacity} disabled={!editable} onChange={(e) => updateStyle({ fillOpacity: Number(e.target.value) }, true)} onPointerUp={() => dispatch({ type: "COMMIT_TRANSIENT_EDIT" })} onBlur={() => dispatch({ type: "COMMIT_TRANSIENT_EDIT" })} />
            <span className="style-value">{Math.round(visualStyle.fillOpacity * 100)}%</span>
          </label>
          <DraftNumberField label="線幅(mm)" min={2} max={80} value={visualStyle.strokeWidthMm} disabled={!editable} className="style-number-field" onCommit={(value) => updateStyle({ strokeWidthMm: value })} />
          <DraftNumberField label="ラベル文字サイズ(mm)" min={80} max={600} value={visualStyle.labelFontSizeMm} disabled={!editable} className="style-number-field" onCommit={(value) => updateStyle({ labelFontSizeMm: value })} />
          <label className="row"><input type="checkbox" checked={visualStyle.labelVisible} disabled={!editable} onChange={(e) => updateStyle({ labelVisible: e.target.checked })} />既定ラベルを表示</label>
        </details>
        {(selectedObject.annotationKind === "line" || selectedObject.annotationKind === "arrow" || selectedObject.annotationKind === "dimension") && (
          <div className="dialog-form-grid">
            <DraftNumberField label="終点X(mm)" value={selectedObject.endXMm ?? selectedObject.xMm} disabled={!editable} onCommit={(value) => commit({ endXMm: value })} />
            <DraftNumberField label="終点Y(mm)" value={selectedObject.endYMm ?? selectedObject.yMm} disabled={!editable} onCommit={(value) => commit({ endYMm: value })} />
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
        {selectedObject.type === "riser" && selectedObject.groupId && (
          <div className="riser-background-controls">
            <h3>山台グループ</h3>
            <p className="hint">背景化すると表示・出力には残り、範囲選択・移動・複製の対象外になります。</p>
            <div className="property-button-grid">
              <button type="button" disabled={Boolean(selectedObject.backgroundFixed) || Boolean(objectLayer?.locked)} onClick={() => dispatch({ type: "SET_SELECTED_BACKGROUND_FIXED", fixed: true })}>背景化する</button>
              <button type="button" disabled={!selectedObject.backgroundFixed || Boolean(objectLayer?.locked)} onClick={() => dispatch({ type: "SET_SELECTED_BACKGROUND_FIXED", fixed: false })}>背景化を解除</button>
            </div>
          </div>
        )}
        <div className="actions">
          <button type="button" disabled={Boolean(objectLayer?.locked)} onClick={() => onOpenGrid(selectedObject.id)}>行列配置</button>
          <button type="button" disabled={selectedObject.locked || Boolean(selectedObject.backgroundFixed) || Boolean(objectLayer?.locked)} onClick={() => dispatch({ type: "DUPLICATE_OBJECT", id: selectedObject.id })}>複製</button>
          <button type="button" className="danger" disabled={!editable} onClick={() => dispatch({ type: "DELETE_OBJECT", id: selectedObject.id })}>削除</button>
        </div>
      </>
    );
  }

  return (
    <aside className="property-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">図面情報 / 編集</span><h2>インスペクター</h2></div>
        {onClose && <button type="button" className="panel-close" onClick={onClose} aria-label="インスペクターを閉じる">×</button>}
      </div>
      <section className="object-properties">
        <h2>プロパティ</h2>
        {selectedObjects.length === 0 && <p className="hint">オブジェクトを選択すると座標・寸法・角度を編集できます。</p>}
        {selectedObjects.length >= 2 && <p className="object-name" role="status" aria-live="polite">{selectedObjects.length}個を選択中</p>}
        {renderSingleProperties()}
        {selectedObjects.length >= 2 && renderOrientationTools()}
        {renderMultipleProperties()}
      </section>
      <details className="inspector-section" open>
        <summary>一括配置</summary>
        <section className="arrangement-tools">

        <button type="button" disabled={!activeLayer || activeLayer.locked || !activeLayer.visible || state.project.calibration.mmPerPixel === null} onClick={onOpenRiserGroup}>山台を一括配置</button>
        <button
          type="button"
          disabled={chairArcIssue !== null}
          title={chairArcIssue ?? "選択中の指揮台を中心に、列ごとの脚数で椅子を同心円弧上へ配置します"}
          onClick={onOpenChairArcRows}
        >
          椅子を多列円弧配置
        </button>
        {chairArcIssue && <p className="hint">多列円弧配置: {chairArcIssue}</p>}
        <button
          type="button"
          disabled={chairLineIssue !== null}
          title={chairLineIssue ?? "\u6821\u6b63\u6e08\u307f\u306e\u56f3\u9762\u4e0a\u3067\u3001\u6307\u5b9a\u3057\u305f\u500b\u6570\u306e\u6905\u5b50\u3092X\u65b9\u5411\u3078\u6a2a\u4e00\u5217\u306b\u914d\u7f6e\u3057\u307e\u3059"}
          onClick={onOpenChairLine}
        >
          {"\u6905\u5b50\u3092\u6a2a\u4e00\u5217\u914d\u7f6e"}
        </button>
        {chairLineIssue && <p className="hint">{"\u6a2a\u4e00\u5217\u914d\u7f6e: " + chairLineIssue}</p>}
        <button
          type="button"
          disabled={stringTemplateIssue !== null}
          title={stringTemplateIssue ?? "指揮者位置を基準に、12型標準配置の20プルト(椅子36脚・コントラバス用椅子4脚・譜面台20台)を一括配置します"}
          onClick={onOpenStringSectionTemplate}
        >
          弦楽器テンプレ配置
        </button>
        {stringTemplateIssue && <p className="hint">弦楽器テンプレ配置: {stringTemplateIssue}</p>}
        <p className="hint">選択物が1つのとき「行列配置」を使えます。</p>
        <p className="hint">複数選択中は「一直線配置」で椅子などをmm間隔で整列できます。</p>
        </section>
      </details>
      <details className="inspector-section">
        <summary>スナップ</summary>
        <SnapPanel state={state} dispatch={dispatch} />
      </details>
      <details className="inspector-section" open>
        <summary>レイヤー</summary>
        <LayerPanel state={state} dispatch={dispatch} />
      </details>
      <RequirementsPanel counts={requirementCounts} scope={requirementScope} onScopeChange={onRequirementScopeChange} />
      <details className="inspector-section">
        <summary>背景</summary>
        <BackgroundPanel state={state} dispatch={dispatch} />
      </details>
      <details className="inspector-section">
        <summary>編集ガイド</summary>
        <GuidePanel state={state} dispatch={dispatch} />
      </details>
      <details className="inspector-section">
        <summary>3D用の壁・舞台前端</summary>
        <WallPanel state={state} dispatch={dispatch} />
      </details>
    </aside>
  );
}
