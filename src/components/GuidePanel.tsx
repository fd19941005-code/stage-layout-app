import { useEffect, useState, type Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import type { Guide, GuideKind } from "../types/project";
import { createArcGuide, createRadialGuide } from "../core/guides";
import { effectiveMmPerPixel } from "../state/appState";
import { generateId } from "../core/project";
import { getBackgroundDisplaySizePx } from "../core/transform";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const GUIDE_LABELS: Record<GuideKind, string> = {
  horizontal: "水平線",
  vertical: "垂直線",
  stageCenter: "舞台中央線",
  stageFrontOffset: "前端基準線",
  radial: "放射線",
  arc: "円弧ガイド",
};

function GuideNumber({ label, value, min, disabled, onCommit }: { label: string; value: number; min?: number; disabled?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label>
      {label}
      <input
        type="number"
        value={draft}
        min={min}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft);
          if (!Number.isFinite(next) || (min !== undefined && next < min)) {
            setDraft(String(value));
            return;
          }
          onCommit(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") { setDraft(String(value)); event.currentTarget.blur(); }
        }}
      />
    </label>
  );
}

function GuideFields({ guide, disabled, dispatch }: { guide: Guide; disabled: boolean; dispatch: Dispatch<Action> }) {
  const update = (patch: Partial<Guide>) => dispatch({ type: "UPDATE_GUIDE", id: guide.id, patch });
  if (guide.kind === "horizontal") return <GuideNumber label="Y (mm)" value={guide.yMm} disabled={disabled} onCommit={(value) => update({ yMm: value })} />;
  if (guide.kind === "vertical" || guide.kind === "stageCenter") return <GuideNumber label="X (mm)" value={guide.xMm} disabled={disabled} onCommit={(value) => update({ xMm: value })} />;
  if (guide.kind === "stageFrontOffset") return <GuideNumber label="前端から (mm)" value={guide.distanceMm ?? 0} min={0} disabled={disabled} onCommit={(value) => update({ distanceMm: value })} />;
  if (guide.kind === "radial") {
    return (
      <>
        <GuideNumber label="X (mm)" value={guide.xMm} disabled={disabled} onCommit={(value) => update({ xMm: value })} />
        <GuideNumber label="Y (mm)" value={guide.yMm} disabled={disabled} onCommit={(value) => update({ yMm: value })} />
        <GuideNumber label="角度 (度)" value={guide.angleDeg} disabled={disabled} onCommit={(value) => update({ angleDeg: value })} />
      </>
    );
  }
  return (
    <>
      <GuideNumber label="中心X (mm)" value={guide.xMm} disabled={disabled} onCommit={(value) => update({ xMm: value })} />
      <GuideNumber label="中心Y (mm)" value={guide.yMm} disabled={disabled} onCommit={(value) => update({ yMm: value })} />
      <GuideNumber label="半径 (mm)" value={guide.radiusMm} min={1} disabled={disabled} onCommit={(value) => update({ radiusMm: value })} />
      <GuideNumber label="開始角 (度)" value={guide.startAngleDeg} disabled={disabled} onCommit={(value) => update({ startAngleDeg: value })} />
      <GuideNumber label="終了角 (度)" value={guide.endAngleDeg} disabled={disabled} onCommit={(value) => update({ endAngleDeg: value })} />
    </>
  );
}

export function GuidePanel({ state, dispatch }: Props) {
  const [frontDistanceMm, setFrontDistanceMm] = useState(1820);
  const [radial, setRadial] = useState({ xMm: 0, yMm: 0, angleDeg: 0, podiumId: "" });
  const [arc, setArc] = useState({ xMm: 0, yMm: 0, radiusMm: 1000, startAngleDeg: 0, endAngleDeg: 90 });
  const podiums = state.project.objects.filter((object) => object.type === "podium" && object.visible);
  const mmPerPixel = effectiveMmPerPixel(state.project);
  const stageWidthMm = state.project.background.naturalWidthPx > 0 ? getBackgroundDisplaySizePx(state.project.background).widthPx * mmPerPixel : 0;
  const hasStageFront = state.project.stageFront !== null;

  function addRadial() {
    const podium = podiums.find((candidate) => candidate.id === radial.podiumId);
    dispatch({
      type: "ADD_GUIDE",
      guide: createRadialGuide(
        generateId("guide"),
        podium ? { xMm: podium.xMm, yMm: podium.yMm } : { xMm: radial.xMm, yMm: radial.yMm },
        radial.angleDeg,
        podium?.id ?? null,
      ),
    });
  }

  function addArc() {
    dispatch({ type: "ADD_GUIDE", guide: createArcGuide(generateId("guide"), { xMm: arc.xMm, yMm: arc.yMm }, arc.radiusMm, arc.startAngleDeg, arc.endAngleDeg) });
  }

  return (
    <section className="guide-panel">
      <p className="hint">ガイドは作業中だけ表示され、PNG・PDF・3Dには出力されません。</p>
      <div className="guide-add-buttons">
        <button type="button" onClick={() => dispatch({ type: "ADD_GUIDE", guide: { id: generateId("guide"), kind: "horizontal", xMm: 0, yMm: 0, angleDeg: 0, radiusMm: 0, startAngleDeg: 0, endAngleDeg: 90, distanceMm: null, podiumId: null, locked: false, visible: true } })}>水平線を追加</button>
        <button type="button" onClick={() => dispatch({ type: "ADD_GUIDE", guide: { id: generateId("guide"), kind: "vertical", xMm: 0, yMm: 0, angleDeg: 0, radiusMm: 0, startAngleDeg: 0, endAngleDeg: 90, distanceMm: null, podiumId: null, locked: false, visible: true } })}>垂直線を追加</button>
        <button type="button" onClick={() => dispatch({ type: "ADD_STAGE_CENTER_GUIDE" })} disabled={stageWidthMm <= 0}>舞台中央線を追加</button>
        <label>前端から (mm)<input type="number" min={0} value={frontDistanceMm} onChange={(event) => setFrontDistanceMm(Number(event.target.value))} /></label>
        <button type="button" onClick={() => dispatch({ type: "ADD_STAGE_FRONT_GUIDE", distanceMm: frontDistanceMm })} disabled={!hasStageFront || !Number.isFinite(frontDistanceMm) || frontDistanceMm < 0}>前端基準線を追加</button>
      </div>
      <details className="guide-advanced-add">
        <summary>放射線・円弧を追加</summary>
        <div className="guide-fields">
          <label>指揮台<select value={radial.podiumId} onChange={(event) => setRadial((current) => ({ ...current, podiumId: event.target.value }))}><option value="">指定点を使用</option>{podiums.map((podium) => <option key={podium.id} value={podium.id}>{podium.name}</option>)}</select></label>
          <GuideNumber label="点X (mm)" value={radial.xMm} onCommit={(value) => setRadial((current) => ({ ...current, xMm: value }))} />
          <GuideNumber label="点Y (mm)" value={radial.yMm} onCommit={(value) => setRadial((current) => ({ ...current, yMm: value }))} />
          <GuideNumber label="放射角 (度)" value={radial.angleDeg} onCommit={(value) => setRadial((current) => ({ ...current, angleDeg: value }))} />
        </div>
        <button type="button" onClick={addRadial}>放射線を追加</button>
        <div className="guide-fields">
          <GuideNumber label="中心X (mm)" value={arc.xMm} onCommit={(value) => setArc((current) => ({ ...current, xMm: value }))} />
          <GuideNumber label="中心Y (mm)" value={arc.yMm} onCommit={(value) => setArc((current) => ({ ...current, yMm: value }))} />
          <GuideNumber label="半径 (mm)" value={arc.radiusMm} min={1} onCommit={(value) => setArc((current) => ({ ...current, radiusMm: value }))} />
          <GuideNumber label="開始角 (度)" value={arc.startAngleDeg} onCommit={(value) => setArc((current) => ({ ...current, startAngleDeg: value }))} />
          <GuideNumber label="終了角 (度)" value={arc.endAngleDeg} onCommit={(value) => setArc((current) => ({ ...current, endAngleDeg: value }))} />
        </div>
        <button type="button" onClick={addArc}>円弧を追加</button>
      </details>
      <div className="guide-list">
        {state.project.guides.length === 0 && <p className="hint">ガイドはまだありません。</p>}
        {state.project.guides.map((guide) => (
          <article key={guide.id} className={`guide-item${guide.locked ? " locked" : ""}`}>
            <header>
              <strong>{GUIDE_LABELS[guide.kind]}</strong>
              <label><input type="checkbox" checked={guide.visible} onChange={(event) => dispatch({ type: "SET_GUIDE_VISIBLE", id: guide.id, visible: event.target.checked })} />表示</label>
              <label><input type="checkbox" checked={guide.locked} onChange={(event) => dispatch({ type: "SET_GUIDE_LOCKED", id: guide.id, locked: event.target.checked })} />ロック</label>
            </header>
            <div className="guide-fields"><GuideFields guide={guide} disabled={guide.locked} dispatch={dispatch} /></div>
            <button type="button" className="danger" disabled={guide.locked} onClick={() => dispatch({ type: "DELETE_GUIDE", id: guide.id })}>削除</button>
          </article>
        ))}
      </div>
    </section>
  );
}
