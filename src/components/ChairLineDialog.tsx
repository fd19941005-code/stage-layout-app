import type { Dispatch, FormEvent } from "react";
import type { Action, AppState } from "../state/appState";
import { createPresetObject } from "../state/appState";
import {
  CHAIR_LINE_DEFAULT_COUNT,
  CHAIR_LINE_DEFAULT_GAP_MM,
  CHAIR_LINE_DEFAULT_ROTATION_DEG,
  CHAIR_LINE_MAX_COUNT,
  CHAIR_LINE_MIN_COUNT,
  createChairLinePlacements,
  validateChairLineOptions,
  type ChairLineOptions,
} from "../core/arrangement";

export interface ChairLineSession {
  options: ChairLineOptions;
  pickingAnchor: boolean;
}

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  session: ChairLineSession;
  onSessionChange: (session: ChairLineSession) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
}

const TITLE = "\u6905\u5b50\u3092\u6a2a\u4e00\u5217\u914d\u7f6e";

function numericValue(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function createChairLineSession(start: { xMm: number; yMm: number }, layerId: string): ChairLineSession {
  return {
    options: {
      start,
      count: CHAIR_LINE_DEFAULT_COUNT,
      gapMm: CHAIR_LINE_DEFAULT_GAP_MM,
      rotationDeg: CHAIR_LINE_DEFAULT_ROTATION_DEG,
      layerId,
      includeMusicStands: false,
    },
    pickingAnchor: false,
  };
}

export function ChairLineDialog({ state, dispatch, session, onSessionChange, onClose, onNotice }: Props) {
  const { options } = session;
  const chairTemplate = createPresetObject("chair", options.layerId, 0);
  const placements = chairTemplate ? createChairLinePlacements(chairTemplate, options) : [];
  const issues = validateChairLineOptions(options);
  const layer = state.project.layers.find((candidate) => candidate.id === options.layerId);
  const totalWidthMm = chairTemplate && options.count >= CHAIR_LINE_MIN_COUNT
    ? chairTemplate.widthMm + Math.max(0, options.count - 1) * (chairTemplate.widthMm + options.gapMm)
    : 0;

  function update(patch: Partial<ChairLineOptions>) {
    onSessionChange({ ...session, options: { ...options, ...patch } });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (issues.length > 0 || placements.length === 0 || !layer || layer.locked || !layer.visible) {
      onNotice(issues[0] ?? "\u914d\u7f6e\u5148\u30ec\u30a4\u30e4\u30fc\u304c\u975e\u8868\u793a\u307e\u305f\u306f\u30ed\u30c3\u30af\u3055\u308c\u3066\u3044\u307e\u3059\u3002");
      return;
    }
    dispatch({ type: "ADD_CHAIR_LINE", options });
    onNotice(placements.length + "\u811a\u306e\u6905\u5b50" + (options.includeMusicStands ? "\u30fb\u8b5c\u9762\u53f0" + placements.length + "\u53f0" : "") + "\u3092\u6a2a\u4e00\u5217\u306b\u914d\u7f6e\u3057\u307e\u3057\u305f\u3002");
    onClose();
  }

  return (
    <section className="chair-line-panel" role="region" aria-label={TITLE}>
      <form className="dialog chair-line-dialog" onSubmit={submit}>
        <div className="dialog-heading">
          <div><p className="eyebrow">{"\u4e00\u62ec\u914d\u7f6e"}</p><h2>{TITLE}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={"\u6905\u5b50\u6a2a\u4e00\u5217\u914d\u7f6e\u3092\u9589\u3058\u308b"}>{"\u00d7"}</button>
        </div>
        <p className="hint">{"1\u811a\u76ee\u306e\u4e2d\u5fc3\u4f4d\u7f6e\u3092\u57fa\u6e96\u306b\u3001X\u65b9\u5411\u3078\u540c\u3058\u5411\u304d\u306e\u6905\u5b50\u3092\u4e26\u3079\u307e\u3059\u3002\u500b\u6570\u306f1\u301c" + CHAIR_LINE_MAX_COUNT + "\u811a\u3067\u3059\u3002"}</p>
        <p className="hint preview-interaction-hint">プレビュー中です。キャンバス上の配置物は操作できます。Escapeまたは閉じるでキャンセルします。</p>
        <div className="dialog-form-grid">
          <label>{"\u811a\u6570"}<input type="number" min={CHAIR_LINE_MIN_COUNT} max={CHAIR_LINE_MAX_COUNT} step={1} value={options.count} onChange={(event) => update({ count: Math.floor(numericValue(event.target.value)) })} /></label>
          <label>{"\u6905\u5b50\u9593\u306e\u96a3\u308a\u5408\u3044\u8ddd\u96e2"} (mm)<input type="number" min={0} step={10} value={options.gapMm} onChange={(event) => update({ gapMm: numericValue(event.target.value) })} /></label>
          <label>{"\u958b\u59cbX"} (mm)<input type="number" value={options.start.xMm} onChange={(event) => update({ start: { ...options.start, xMm: numericValue(event.target.value) } })} /></label>
          <label>{"\u958b\u59cbY"} (mm)<input type="number" value={options.start.yMm} onChange={(event) => update({ start: { ...options.start, yMm: numericValue(event.target.value) } })} /></label>
          <label>{"\u6905\u5b50\u306e\u5411\u304d (\u5ea6)"}<input type="number" step={1} value={options.rotationDeg} onChange={(event) => update({ rotationDeg: numericValue(event.target.value) })} /></label>
        </div>
        <label className="chair-line-stand-option">
          <input
            type="checkbox"
            checked={options.includeMusicStands ?? false}
            onChange={(event) => update({ includeMusicStands: event.target.checked })}
          />
          {"\u5404\u6905\u5b50\u306e\u524d\u306b\u8b5c\u9762\u53f0\u3092\u914d\u7f6e"}
        </label>
        <div className="chair-line-anchor-actions">
          <button type="button" className={session.pickingAnchor ? "active" : undefined} onClick={() => onSessionChange({ ...session, pickingAnchor: !session.pickingAnchor })}>
            {session.pickingAnchor ? "\u30ad\u30e3\u30f3\u30d0\u30b9\u4e0a\u3067\u958b\u59cb\u4f4d\u7f6e\u3092\u30af\u30ea\u30c3\u30af\u3057\u3066\u304f\u3060\u3055\u3044" : "\u30ad\u30e3\u30f3\u30d0\u30b9\u3067\u958b\u59cb\u4f4d\u7f6e\u3092\u6307\u5b9a"}
          </button>
        </div>
        <div className="chair-line-summary" aria-live="polite">
          <span>{placements.length + "\u811a"}</span>
          <span>{"\u5168\u9577 " + Math.round(totalWidthMm) + " mm"}</span>
          <span>{"\u914d\u7f6e\u5148: " + (layer?.name ?? "\u4e0d\u660e")}</span>
          {options.includeMusicStands && <span>{"\u8b5c\u9762\u53f0 " + placements.length + "\u53f0"}</span>}
        </div>
        {issues.length > 0 && <p className="input-error" role="alert">{issues[0]}</p>}
        <p className="hint">{"\u30d7\u30ec\u30d3\u30e5\u30fc\u306f\u300c\u914d\u7f6e\u3059\u308b\u300d\u307e\u3067\u56f3\u9762\u306b\u4fdd\u5b58\u3055\u308c\u307e\u305b\u3093\u3002"}</p>
        <div className="dialog-buttons"><button type="button" onClick={onClose}>{"\u30ad\u30e3\u30f3\u30bb\u30eb"}</button><button type="submit" className="primary" disabled={issues.length > 0 || placements.length === 0 || !layer || layer.locked || !layer.visible}>{"\u914d\u7f6e\u3059\u308b"}</button></div>
      </form>
    </section>
  );
}
