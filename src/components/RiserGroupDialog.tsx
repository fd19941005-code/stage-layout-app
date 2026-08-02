import { useMemo, type Dispatch, type FormEvent } from "react";
import type { Action, AppState } from "../state/appState";
import { findPreset } from "../core/presets";
import {
  RISER_HEIGHTS_MM,
  RISER_DEFAULT_PARALLEL_GAP_MM,
  RISER_MAX_PARALLEL_COUNT,
  defaultRiserRotationDeg,
  RISER_PRESET_IDS,
  riserGroupBoundsMm,
  riserParallelRows,
  validateRiserGroupOptions,
  type RiserGroupLayoutOptions,
  type RiserParallelRow,
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
  const rows = useMemo(() => riserParallelRows(options), [options]);
  const bounds = useMemo(() => riserGroupBoundsMm(options, dimensions), [options, dimensions]);
  const parallelCount = options.parallelCount ?? rows.length;
  const parallelGapMm = options.parallelGapMm ?? RISER_DEFAULT_PARALLEL_GAP_MM;
  const totalCount = rows.reduce((sum, row) => sum + row.segments.reduce((rowSum, segment) => rowSum + (Number.isFinite(segment.count) ? segment.count : 0), 0), 0);
  const issues = validateRiserGroupOptions(options);
  const layer = state.project.layers.find((candidate) => candidate.id === session.layerId);

  function updateOptions(patch: Partial<RiserGroupLayoutOptions>) {
    onSessionChange({ ...session, options: { ...session.options, ...patch } });
  }

  function cloneRow(row: RiserParallelRow): RiserParallelRow {
    return { segments: row.segments.map((segment) => ({ ...segment })) };
  }

  function updateParallelRows(nextRows: RiserParallelRow[]) {
    const rowsCopy = nextRows.map(cloneRow);
    updateOptions({
      parallelRows: rowsCopy,
      parallelCount: rowsCopy.length,
      segments: rowsCopy[0]?.segments ?? options.segments,
    });
  }

  function resizeParallelRows(nextCount: number) {
    if (!Number.isInteger(nextCount) || nextCount < 1 || nextCount > RISER_MAX_PARALLEL_COUNT) {
      updateOptions({ parallelCount: nextCount });
      return;
    }
    const template = rows[rows.length - 1] ?? { segments: options.segments };
    const nextRows = Array.from({ length: nextCount }, (_, index) => rows[index] ? cloneRow(rows[index]) : cloneRow(template));
    updateParallelRows(nextRows);
  }

  function updateRowSegments(rowIndex: number, segments: readonly RiserSegment[]) {
    const nextRows = rows.map((row, index) => index === rowIndex ? { segments } : cloneRow(row));
    updateParallelRows(nextRows);
  }

  function updateRowSegment(rowIndex: number, segmentIndex: number, patch: Partial<RiserSegment>) {
    const row = rows[rowIndex];
    if (!row) return;
    const segments = row.segments.map((segment, index) => index === segmentIndex ? { ...segment, ...patch } : { ...segment });
    updateRowSegments(rowIndex, segments);
  }

  function addRowSegment(rowIndex: number) {
    const row = rows[rowIndex];
    if (!row) return;
    updateRowSegments(rowIndex, [...row.segments, { ...DEFAULT_SEGMENT }]);
  }

  function moveRowSegment(rowIndex: number, segmentIndex: number, delta: -1 | 1) {
    const row = rows[rowIndex];
    if (!row) return;
    const nextIndex = segmentIndex + delta;
    if (nextIndex < 0 || nextIndex >= row.segments.length) return;
    const segments = row.segments.map((segment) => ({ ...segment }));
    const current = segments[segmentIndex];
    const target = segments[nextIndex];
    if (!current || !target) return;
    segments[segmentIndex] = target;
    segments[nextIndex] = current;
    updateRowSegments(rowIndex, segments);
  }

  function removeRowSegment(rowIndex: number, segmentIndex: number) {
    const row = rows[rowIndex];
    if (!row || row.segments.length <= 1) return;
    updateRowSegments(rowIndex, row.segments.filter((_, index) => index !== segmentIndex));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (issues.length > 0 || !layer || layer.locked || !layer.visible) {
      onNotice(issues[0] ?? "\u914d\u7f6e\u5148\u30ec\u30a4\u30e4\u30fc\u304c\u975e\u8868\u793a\u307e\u305f\u306f\u30ed\u30c3\u30af\u3055\u308c\u3066\u3044\u307e\u3059\u3002");
      return;
    }
    dispatch({ type: "ADD_RISER_GROUP", options, layerId: session.layerId, fixedToBack: session.fixedToBack });
    onClose();
  }

  function rowPosition(rowIndex: number) {
    if (rows.length <= 1) return null;
    if (rowIndex === 0) return options.direction === "horizontal" ? "\u5965\u5074" : "\u5de6\u5074";
    if (rowIndex === rows.length - 1) return options.direction === "horizontal" ? "\u624b\u524d\u5074" : "\u53f3\u5074";
    return "\u4e2d\u9593";
  }

  return (
    <section className="riser-group-panel" role="region" aria-label="&#x5c71;&#x53f0;&#x306e;&#x69cb;&#x6210;&#x914d;&#x7f6e;&#x30d7;&#x30ec;&#x30d3;&#x30e5;&#x30fc">
      <form className="dialog riser-group-dialog" onSubmit={submit} aria-label="&#x5c71;&#x53f0;&#x306e;&#x69cb;&#x6210;&#x914d;&#x7f6e;">
        <div className="dialog-heading">
          <div><p className="eyebrow">&#x69cb;&#x6210;&#x914d;&#x7f6e;</p><h2>&#x5c71;&#x53f0;&#x3092;&#x4e00;&#x62ec;&#x914d;&#x7f6e;</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="&#x5c71;&#x53f0;&#x914d;&#x7f6e;&#x3092;&#x9589;&#x3058;&#x308b;">&#x00d7;</button>
        </div>
        <p className="hint">&#x30bb;&#x30b0;&#x30e1;&#x30f3;&#x30c8;&#x306f;&#x5217;&#x306e;&#x4e26;&#x3073;&#x9806;&#x3067;&#x3059;&#x3002;&#x5217;1&#x304c;&#x5965;&#x5074;&#x3001;&#x6700;&#x5f8c;&#x306e;&#x5217;&#x304c;&#x624b;&#x524d;&#x5074;&#x306b;&#x306a;&#x308a;&#x307e;&#x3059;&#x3002;&#x5404;&#x5217;&#x306e;&#x30bb;&#x30b0;&#x30e1;&#x30f3;&#x30c8;&#x306f;&#x500b;&#x5225;&#x306b;&#x7de8;&#x96c6;&#x3067;&#x304d;&#x307e;&#x3059;&#x3002</p>
        <p className="hint preview-interaction-hint">&#x30d7;&#x30ec;&#x30d3;&#x30e5;&#x30fc;&#x4e2d;&#x3067;&#x3059;&#x3002;&#x30ad;&#x30e3;&#x30f3;&#x30d0;&#x30b9;&#x4e0a;&#x306e;&#x914d;&#x7f6e;&#x7269;&#x306f;&#x64cd;&#x4f5c;&#x3067;&#x304d;&#x307e;&#x3059;&#x3002;Escape&#x307e;&#x305f;&#x306f;&#x9589;&#x3058;&#x308b;&#x3067;&#x30ad;&#x30e3;&#x30f3;&#x30bb;&#x30eb;&#x3057;&#x307e;&#x3059;&#x3002</p>
        <div className="dialog-form-grid riser-global-fields">
          <label>&#x6bb5;&#x9ad8;<select value={options.heightMm} onChange={(event) => updateOptions({ heightMm: Number(event.target.value) })}>{RISER_HEIGHTS_MM.map((heightMm) => <option key={heightMm} value={heightMm}>{heightMm} mm</option>)}</select></label>
          <label>&#x65b9;&#x5411;<select value={options.direction} onChange={(event) => updateOptions({ direction: event.target.value as RiserGroupLayoutOptions["direction"] })}><option value="horizontal">&#x6a2a;&#x4e00;&#x5217;</option><option value="vertical">&#x7e26;&#x4e00;&#x5217;</option></select></label>
          <label>&#x4e26;&#x5217;&#x6570;<input type="number" min={1} max={RISER_MAX_PARALLEL_COUNT} value={parallelCount} onChange={(event) => resizeParallelRows(Number(event.target.value))} /></label>
          <label>&#x5217;&#x9593;&#x9694; (mm)<input type="number" min={0} value={parallelGapMm} onChange={(event) => updateOptions({ parallelGapMm: Number(event.target.value) })} /></label>
          <label>X (mm)<input type="number" value={options.center.xMm} onChange={(event) => updateOptions({ center: { ...options.center, xMm: Number(event.target.value) } })} /></label>
          <label>Y (mm)<input type="number" value={options.center.yMm} onChange={(event) => updateOptions({ center: { ...options.center, yMm: Number(event.target.value) } })} /></label>
        </div>
        {rows.map((row, rowIndex) => (
          <section className="riser-parallel-row-editor" key={rowIndex} aria-labelledby={"riser-row-heading-" + rowIndex}>
            <div className="section-heading">
              <h3 id={"riser-row-heading-" + rowIndex}>&#x7b2c;{rowIndex + 1}&#x5217;{rowPosition(rowIndex) && <> ({rowPosition(rowIndex)})</>}</h3>
              <button type="button" onClick={() => addRowSegment(rowIndex)} disabled={totalCount >= 100}>&#x30bb;&#x30b0;&#x30e1;&#x30f3;&#x30c8;&#x3092;&#x8ffd;&#x52a0;</button>
            </div>
            <div className="riser-segment-editor">
              {row.segments.map((segment, segmentIndex) => (
                <div className="riser-segment-row" key={segmentIndex}>
                  <span className="riser-segment-index">{segmentIndex + 1}</span>
                  <label>&#x7a2e;&#x985e;<select value={segment.presetId} onChange={(event) => updateRowSegment(rowIndex, segmentIndex, { presetId: event.target.value as RiserPresetId })}>
                    {RISER_PRESET_IDS.map((presetId) => <option key={presetId} value={presetId}>{findPreset(presetId)?.name ?? presetId}</option>)}
                  </select></label>
                  <label>&#x679a;&#x6570;<input type="number" min={1} max={50} value={segment.count} onChange={(event) => updateRowSegment(rowIndex, segmentIndex, { count: Number(event.target.value) })} /></label>
                  <label>&#x5411;&#x304d;<select value={segment.rotationDeg === undefined ? "auto" : String(segment.rotationDeg)} onChange={(event) => updateRowSegment(rowIndex, segmentIndex, { rotationDeg: event.target.value === "auto" ? undefined : Number(event.target.value) as 0 | 90 })}>
                    <option value="auto">&#x65b9;&#x5411;&#x306b;&#x5408;&#x308f;&#x305b;&#x308b; ({defaultRiserRotationDeg(options.direction)}&#x00b0;)</option>
                    <option value="0">&#x6a19;&#x6e96; (0&#x00b0;)</option>
                    <option value="90">90&#x00b0;&#x56de;&#x8ee2; (&#x6a2a;&#x9577;)</option>
                  </select></label>
                  <div className="riser-segment-actions">
                    <button type="button" onClick={() => moveRowSegment(rowIndex, segmentIndex, -1)} disabled={segmentIndex === 0} aria-label="&#x5de6;&#x3078;&#x79fb;&#x52d5;">&#x2190;</button>
                    <button type="button" onClick={() => moveRowSegment(rowIndex, segmentIndex, 1)} disabled={segmentIndex === row.segments.length - 1} aria-label="&#x53f3;&#x3078;&#x79fb;&#x52d5;">&#x2192;</button>
                    <button type="button" onClick={() => removeRowSegment(rowIndex, segmentIndex)} disabled={row.segments.length <= 1} aria-label="&#x30bb;&#x30b0;&#x30e1;&#x30f3;&#x30c8;&#x3092;&#x524a;&#x9664;">&#x00d7;</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <div className="riser-anchor-actions">
          <button type="button" className={session.pickingAnchor ? "active" : undefined} onClick={() => onSessionChange({ ...session, pickingAnchor: !session.pickingAnchor })}>{session.pickingAnchor ? <>キャンバス上で位置をクリックしてください</> : <>キャンバスで配置位置を指定</>}</button>
          <label className="row"><input type="checkbox" checked={session.fixedToBack} onChange={(event) => onSessionChange({ ...session, fixedToBack: event.target.checked })} />&#x80cc;&#x666f;&#x306b;&#x56fa;&#x5b9a;&#x3057;&#x3066;&#x914d;&#x7f6e;</label>
        </div>
        <div className="riser-summary" aria-live="polite">
          <span>&#x5408;&#x8a08; {totalCount} &#x679a;</span>
          {bounds && <span>&#x5916;&#x5f62; {Math.round(bounds.widthMm)} &#x00d7; {Math.round(bounds.depthMm)} mm</span>}
          <span>&#x914d;&#x7f6e;&#x5148; {layer?.name ?? "\u4e0d\u660e"}</span>
          <span>{session.fixedToBack ? <>配置後に背景固定</> : <>配置後は通常配置</>}</span>
        </div>
        {issues.length > 0 && <p className="input-error" role="alert">{issues[0]}</p>}
        <div className="dialog-buttons"><button type="button" onClick={onClose}>&#x30ad;&#x30e3;&#x30f3;&#x30bb;&#x30eb;</button><button type="submit" className="primary" disabled={issues.length > 0 || !layer || layer.locked || !layer.visible}>&#x914d;&#x7f6e;&#x3059;&#x308b;</button></div>
      </form>
    </section>
  );
}
