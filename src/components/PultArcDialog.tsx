// Phase 4のプルト弧状配置。1 Actionで椅子2脚+譜面台1台を生成する。
import { useRef, useState, type Dispatch, type FormEvent } from "react";
import type { Action, AppState } from "../state/appState";
import { useDialogFocus } from "./useDialogFocus";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onClose: () => void;
}

export function PultArcDialog({ state, dispatch, onClose }: Props) {
  const mmpp = state.project.calibration.mmPerPixel ?? 10;
  const backgroundWidthMm = state.project.background.naturalWidthPx * mmpp;
  const [centerX, setCenterX] = useState(Math.round(backgroundWidthMm > 0 ? backgroundWidthMm / 2 : 5000));
  const [centerY, setCenterY] = useState(4000);
  const [radiusMm, setRadiusMm] = useState(6000);
  const [startDeg, setStartDeg] = useState(-45);
  const [endDeg, setEndDeg] = useState(45);
  const [pultCount, setPultCount] = useState(14);
  const [pultSpacingMm, setPultSpacingMm] = useState(900);
  const dialogRef = useRef<HTMLFormElement>(null);
  useDialogFocus(dialogRef, { onClose });

  function submit(event: FormEvent) {
    event.preventDefault();
    dispatch({
      type: "ADD_PULT_ARC",
      options: {
        center: { xMm: centerX, yMm: centerY },
        radiusMm,
        startDeg,
        endDeg,
        pultCount,
        pultSpacingMm,
        layerId: state.activeLayerId,
      },
    });
    onClose();
  }

  return (
    <div className="dialog-backdrop">
      <form ref={dialogRef} className="dialog pult-dialog" role="dialog" aria-modal="true" aria-label="プルトを弧状配置" tabIndex={-1} onSubmit={submit}>
        <h2>プルトを弧状配置</h2>
        <p className="hint">1プルト=椅子2脚+譜面台1台。配置後は個別に編集できます。</p>
        <div className="dialog-form-grid">
          <label>中心X(mm)<input type="number" value={centerX} onChange={(e) => setCenterX(Number(e.target.value))} /></label>
          <label>中心Y(mm)<input type="number" value={centerY} onChange={(e) => setCenterY(Number(e.target.value))} /></label>
          <label>半径(mm)<input type="number" min={1} value={radiusMm} onChange={(e) => setRadiusMm(Number(e.target.value))} /></label>
          <label>開始角度(度)<input type="number" value={startDeg} onChange={(e) => setStartDeg(Number(e.target.value))} /></label>
          <label>終了角度(度)<input type="number" value={endDeg} onChange={(e) => setEndDeg(Number(e.target.value))} /></label>
          <label>プルト数<input type="number" min={1} max={100} value={pultCount} onChange={(e) => setPultCount(Number(e.target.value))} /></label>
          <label>プルト間隔(mm)<input type="number" min={1} value={pultSpacingMm} onChange={(e) => setPultSpacingMm(Number(e.target.value))} /></label>
        </div>
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary">配置する</button>
        </div>
      </form>
    </div>
  );
}

