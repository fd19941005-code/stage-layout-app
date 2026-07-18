// 2点校正の実距離入力ダイアログ(FR-020〜022、6.1)。
// 距離プリセット(910/1820/900/1800/1000mm)で日本のホール図面入力を高速化する。

import { useState, type Dispatch } from "react";
import type { Action } from "../state/appState";
import { CALIBRATION_DISTANCE_PRESETS_MM } from "../core/presets";
import { toMm } from "../core/transform";

interface Props {
  dispatch: Dispatch<Action>;
}

type Unit = "mm" | "cm" | "m";

export function CalibrationDialog({ dispatch }: Props) {
  const [text, setText] = useState("");
  const [unit, setUnit] = useState<Unit>("mm");
  const [error, setError] = useState<string | null>(null);

  function apply(distanceMm: number) {
    // 正数のみ確定可(6.1)
    if (!Number.isFinite(distanceMm) || distanceMm <= 0) {
      setError("正の数値を入力してください");
      return;
    }
    dispatch({ type: "APPLY_CALIBRATION", realDistanceMm: distanceMm });
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-label="実距離の入力">
        <h2>2点間の実距離を入力</h2>
        <div className="preset-buttons">
          {CALIBRATION_DISTANCE_PRESETS_MM.map((mm) => (
            <button key={mm} type="button" onClick={() => apply(mm)}>
              {mm}mm
            </button>
          ))}
        </div>
        <div className="custom-input">
          <input
            type="number"
            value={text}
            placeholder="任意の距離"
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            autoFocus
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
          </select>
          <button type="button" onClick={() => apply(toMm(Number(text), unit))}>
            確定
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          className="cancel"
          onClick={() => dispatch({ type: "CANCEL_CALIBRATION" })}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
