// 校正確認(FR-024)。保存済みの基準線を再度打点し、入力値との誤差を表示する。

import { useRef, type Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import { measuredCalibrationDistanceMm, sourcePxToDisplayedPx } from "../core/transform";
import { useDialogFocus } from "./useDialogFocus";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function CalibrationVerificationDialog({ state, dispatch }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onClose: () => dispatch({ type: "CANCEL_CALIBRATION" }) });
  const [a, b] = state.calibPointsPx;
  const mmPerPixel = state.project.calibration.mmPerPixel;
  const expected = state.project.calibration.realDistanceMm;
  if (!a || !b || !mmPerPixel || !expected) return null;

  const measured = measuredCalibrationDistanceMm(sourcePxToDisplayedPx(a, state.project.background), sourcePxToDisplayedPx(b, state.project.background), mmPerPixel);
  const errorPercent = ((measured - expected) / expected) * 100;
  const withinTarget = Math.abs(errorPercent) <= 1;

  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-label="縮尺設定の確認結果" tabIndex={-1}>
        <h2>縮尺設定の確認結果</h2>
        <dl className="calibration-result">
          <div><dt>入力した基準距離</dt><dd>{Math.round(expected)} mm</dd></div>
          <div><dt>確認用の距離</dt><dd>{measured.toFixed(1)} mm</dd></div>
          <div><dt>誤差</dt><dd className={withinTarget ? "ok" : "error-value"}>{errorPercent.toFixed(2)}%</dd></div>
        </dl>
        <p className={withinTarget ? "success-message" : "error-message"}>
          {withinTarget
            ? "基準距離と一致しています。"
            : "誤差が1%を超えています。拡大して打点し直してください。"}
        </p>
        <div className="dialog-buttons">
          <button type="button" onClick={() => dispatch({ type: "CLEAR_CALIB_POINTS" })}>
            もう一度測る
          </button>
          <button type="button" onClick={() => dispatch({ type: "CANCEL_CALIBRATION" })}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
