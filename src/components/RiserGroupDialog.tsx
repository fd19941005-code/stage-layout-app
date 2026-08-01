import { useMemo, type Dispatch, type FormEvent } from "react";
import type { Action, AppState } from "../state/appState";
import { findPreset } from "../core/presets";
import {
  RISER_HEIGHTS_MM,
  defaultRiserRotationDeg,
  RISER_PRESET_IDS,
  riserGroupBoundsMm,
  validateRiserGroupOptions,
  type RiserGroupLayoutOptions,
  type RiserPresetId,
  type RiserSegment,
} from "../core/arrangement";

export interface RiserGroupSession {
  options: RiserGroupLayoutOptions;
  layerId: string;
  fixedToBack: boolean;
  pickingAnchor: boolean;
}

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  session: RiserGroupSession;
  onSessionChange: (session: RiserGroupSession) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
}

const DEFAULT_SEGMENT: RiserSegment = { presetId: "riser-6x6", count: 1 };

function dimensionsForSegments() {
  return Object.fromEntries(RISER_PRESET_IDS.map((presetId) => {
    const preset = findPreset(presetId);
    return [presetId, { widthMm: preset?.widthMm ?? 0, depthMm: preset?.depthMm ?? 0 }];
  })) as Record<RiserPresetId, { widthMm: number; depthMm: number }>;
}

export function RiserGroupDialog({ state, dispatch, session, onSessionChange, onClose, onNotice }: Props) {
  const { options } = session;
  const dimensions = useMemo(() => dimensionsForSegments(), []);
  const bounds = useMemo(() => riserGroupBoundsMm(options, dimensions), [options, dimensions]);
  const totalCount = options.segments.reduce((sum, segment) => sum + segment.count, 0);
  const issues = validateRiserGroupOptions(options);
  const layer = state.project.layers.find((candidate) => candidate.id === session.layerId);

  function updateOptions(patch: Partial<RiserGroupLayoutOptions>) {
    onSessionChange({ ...session, options: { ...session.options, ...patch } });
  }

  function updateSegment(index: number, patch: Partial<RiserSegment>) {
    const segments = options.segments.map((segment, segmentIndex) => segmentIndex === index ? { ...segment, ...patch } : segment);
    updateOptions({ segments });
  }

  function moveSegment(index: number, delta: -1 | 1) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= options.segments.length) return;
    const segments = [...options.segments];
    const current = segments[index];
    const target = segments[nextIndex];
    if (!current || !target) return;
    segments[index] = target;
    segments[nextIndex] = current;
    updateOptions({ segments });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (issues.length > 0 || !layer || layer.locked || !layer.visible) {
      onNotice(issues[0] ?? "配置先レイヤーが非表示またはロックされています。");
      return;
    }
    dispatch({ type: "ADD_RISER_GROUP", options, layerId: session.layerId, fixedToBack: session.fixedToBack });
    onClose();
  }

  return (
    <section className="riser-group-panel" role="region" aria-label="山台の構成配置プレビュー">
      <form className="dialog riser-group-dialog" onSubmit={submit} aria-label="山台の構成配置">
        <div className="dialog-heading">
          <div><p className="eyebrow">構成配置</p><h2>山台を一括配置</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="山台配置を閉じる">×</button>
        </div>
        <p className="hint">セグメントを左から右の順で連結します。例：3×6尺を1枚、6×6尺を5枚、3×6尺を1枚。</p>
        <p className="hint preview-interaction-hint">プレビュー中です。キャンバス上の配置物は操作できます。Escapeまたは閉じるでキャンセルします。</p>
        <section className="riser-segment-editor" aria-label="山台セグメント">
          <div className="section-heading"><h3>セグメント列</h3><button type="button" onClick={() => updateOptions({ segments: [...options.segments, { ...DEFAULT_SEGMENT }] })} disabled={totalCount >= 100}>＋セグメント</button></div>
          {options.segments.map((segment, index) => (
            <div className="riser-segment-row" key={index}>
              <span className="riser-segment-index">{index + 1}</span>
              <label>種類<select value={segment.presetId} onChange={(event) => updateSegment(index, { presetId: event.target.value as RiserPresetId })}>
                {RISER_PRESET_IDS.map((presetId) => <option key={presetId} value={presetId}>{findPreset(presetId)?.name ?? presetId}</option>)}
              </select></label>
              <label>枚数<input type="number" min={1} max={50} value={segment.count} onChange={(event) => updateSegment(index, { count: Number(event.target.value) })} /></label>
              <label>&#x5411;&#x304d;<select
                value={segment.rotationDeg === undefined ? "auto" : String(segment.rotationDeg)}
                onChange={(event) => updateSegment(index, {
                  rotationDeg: event.target.value === "auto" ? undefined : Number(event.target.value) as 0 | 90,
                })}
              >
                <option value="auto">&#x65b9;&#x5411;&#x306b;&#x5408;&#x308f;&#x305b;&#x308b; (
                  {defaultRiserRotationDeg(options.direction)}&#x00b0;
                )</option>
                <option value="0">&#x6a19;&#x6e96; (0&#x00b0;)</option>
                <option value="90">90&#x00b0;&#x56de;&#x8ee2; (&#x6a2a;&#x9577;)</option>
              </select></label>
              <div className="riser-segment-actions">
                <button type="button" onClick={() => moveSegment(index, -1)} disabled={index === 0} aria-label="左へ移動">←</button>
                <button type="button" onClick={() => moveSegment(index, 1)} disabled={index === options.segments.length - 1} aria-label="右へ移動">→</button>
                <button type="button" onClick={() => updateOptions({ segments: options.segments.filter((_, segmentIndex) => segmentIndex !== index) })} disabled={options.segments.length <= 1} aria-label="セグメントを削除">×</button>
              </div>
            </div>
          ))}
        </section>
        <div className="dialog-form-grid riser-global-fields">
          <label>段高<select value={options.heightMm} onChange={(event) => updateOptions({ heightMm: Number(event.target.value) })}>{RISER_HEIGHTS_MM.map((heightMm) => <option key={heightMm} value={heightMm}>{heightMm} mm</option>)}</select></label>
          <label>方向<select value={options.direction} onChange={(event) => updateOptions({ direction: event.target.value as RiserGroupLayoutOptions["direction"] })}><option value="horizontal">横一列</option><option value="vertical">縦一列</option></select></label>
          <label>X (mm)<input type="number" value={options.center.xMm} onChange={(event) => updateOptions({ center: { ...options.center, xMm: Number(event.target.value) } })} /></label>
          <label>Y (mm)<input type="number" value={options.center.yMm} onChange={(event) => updateOptions({ center: { ...options.center, yMm: Number(event.target.value) } })} /></label>
        </div>
        <div className="riser-anchor-actions">
          <button type="button" className={session.pickingAnchor ? "active" : undefined} onClick={() => onSessionChange({ ...session, pickingAnchor: !session.pickingAnchor })}>{session.pickingAnchor ? "キャンバス上で位置をクリックしてください" : "キャンバスで配置位置を指定"}</button>
          <label className="row"><input type="checkbox" checked={session.fixedToBack} onChange={(event) => onSessionChange({ ...session, fixedToBack: event.target.checked })} />背景化して配置（表示・出力は維持）</label>
        </div>
        <div className="riser-summary" aria-live="polite">
          <span>合計 {totalCount} 枚</span>
          {bounds && <span>外形 {Math.round(bounds.widthMm)} × {Math.round(bounds.depthMm)} mm</span>}
          <span>配置先: {layer?.name ?? "不明"}</span>
          <span>{session.fixedToBack ? "配置後: 背景化" : "配置後: 通常配置"}</span>
        </div>
        {issues.length > 0 && <p className="input-error" role="alert">{issues[0]}</p>}
        <div className="dialog-buttons"><button type="button" onClick={onClose}>キャンセル</button><button type="submit" className="primary" disabled={issues.length > 0 || !layer || layer.locked || !layer.visible}>配置する</button></div>
      </form>
    </section>
  );
}
