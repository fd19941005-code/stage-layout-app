import type { Dispatch, FormEvent } from "react";
import type { Action, AppState } from "../state/appState";
import { selectionUnits, validateLineArrangement, type DistributionAxis, type LineArrangementOptions } from "../core/layout";

export interface LineArrangementSession extends LineArrangementOptions {
  ids: string[];
  initialGapMm: number;
}

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  session: LineArrangementSession;
  onSessionChange: (session: LineArrangementSession) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
}

export function LineArrangementDialog({ state, dispatch, session, onSessionChange, onClose, onNotice }: Props) {
  const units = selectionUnits(state.project.objects, session.ids);
  const issues = validateLineArrangement(state.project.objects, session.ids, session);
  const locked = units.flatMap((unit) => unit.objectIds).some((id) => {
    const object = state.project.objects.find((candidate) => candidate.id === id);
    const layer = object && state.project.layers.find((candidate) => candidate.id === object.layerId);
    return Boolean(object?.locked || layer?.locked);
  });

  function update(patch: Partial<LineArrangementSession>) {
    onSessionChange({ ...session, ...patch });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (issues.length > 0 || locked) {
      onNotice(locked ? "ロック中のオブジェクトを含むため配置できません。" : (issues[0] ?? "入力を確認してください。"));
      return;
    }
    dispatch({ type: "ARRANGE_SELECTED_LINE", ids: session.ids, options: { axis: session.axis, gapMm: session.gapMm } });
    onClose();
  }

  function cancel() {
    dispatch({ type: "CANCEL_TRANSIENT_EDIT" });
    onClose();
  }

  return (
    <section className="line-arrangement-panel" role="region" aria-label="一直線配置プレビュー">
      <form className="dialog line-arrangement-dialog" onSubmit={submit} aria-label="一直線配置">
        <div className="dialog-heading"><div><p className="eyebrow">整列</p><h2>一直線に並べる</h2></div><button type="button" className="icon-button" onClick={cancel} aria-label="一直線配置を閉じる">×</button></div>
        <p className="hint">選択したオブジェクトを外形間の一定間隔で並べます。グループは内部配置を保ったまま1単位として扱います。</p>
        <p className="hint preview-interaction-hint">プレビュー中です。キャンバス上の配置物は操作できます。Escapeまたは閉じるでキャンセルします。</p>
        <div className="dialog-form-grid">
          <label>方向<select value={session.axis} onChange={(event) => update({ axis: event.target.value as DistributionAxis })}><option value="x">横一列（Yを揃える）</option><option value="y">縦一列（Xを揃える）</option></select></label>
          <label>外形間隔 (mm)<input type="number" min={0} step={1} value={Number.isFinite(session.gapMm) ? session.gapMm : ""} onChange={(event) => update({ gapMm: Number(event.target.value) })} /></label>
        </div>
        <div className="line-arrangement-summary" aria-live="polite"><span>{units.length}単位を配置</span><span>先頭位置は固定</span><span>間隔 {Number.isFinite(session.gapMm) ? Math.round(session.gapMm) : 0} mm</span></div>
        <p className="hint">キャンバス上の終端ハンドルをドラッグして間隔を調整できます。Escまたはキャンセルでプレビューを破棄します。</p>
        {(issues.length > 0 || locked) && <p className="input-error" role="alert">{locked ? "ロック中のオブジェクトを含むため配置できません。" : issues[0]}</p>}
        <div className="dialog-buttons"><button type="button" onClick={cancel}>キャンセル</button><button type="submit" className="primary" disabled={issues.length > 0 || locked}>適用</button></div>
      </form>
    </section>
  );
}
