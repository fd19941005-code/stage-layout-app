// Phase 4の行列配置。計算結果はreducerの1 Actionとして履歴へ入る。
import { useState, type Dispatch, type FormEvent } from "react";
import type { Action, AppState } from "../state/appState";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  sourceId: string;
  onClose: () => void;
}

export function ArrangementDialog({ state, dispatch, sourceId, onClose }: Props) {
  const source = state.project.objects.find((object) => object.id === sourceId);
  const [rows, setRows] = useState(2);
  const [columns, setColumns] = useState(2);
  const [gapXMm, setGapXMm] = useState(0);
  const [gapYMm, setGapYMm] = useState(0);
  if (!source) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    dispatch({ type: "DUPLICATE_GRID", sourceId, options: { rows, columns, gapXMm, gapYMm } });
    onClose();
  }

  return (
    <div className="dialog-backdrop">
      <form className="dialog arrangement-dialog" onSubmit={submit}>
        <h2>行列配置</h2>
        <p className="hint">基準: {source.label || source.name} ({source.widthMm}×{source.depthMm}mm)</p>
        <div className="dialog-form-grid">
          <label>行<input type="number" min={1} max={100} value={rows} onChange={(e) => setRows(Number(e.target.value))} /></label>
          <label>列<input type="number" min={1} max={100} value={columns} onChange={(e) => setColumns(Number(e.target.value))} /></label>
          <label>左右間隔(mm)<input type="number" min={0} value={gapXMm} onChange={(e) => setGapXMm(Number(e.target.value))} /></label>
          <label>上下間隔(mm)<input type="number" min={0} value={gapYMm} onChange={(e) => setGapYMm(Number(e.target.value))} /></label>
        </div>
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary">配置する</button>
        </div>
      </form>
    </div>
  );
}

