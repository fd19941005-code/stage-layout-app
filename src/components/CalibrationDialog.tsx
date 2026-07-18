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
      <div className="dialog calibration-dialog" role="dialog" aria-label="図面の縮尺を合わせる">
        <h2>図面の縮尺を合わせる</h2>
        <p className="calibration-lead">
          これは「距離を測る」画面ではありません。図面上でクリックした2点間の、正しい実寸を登録します。
        </p>
        <div className="calibration-guide">
          <strong>やること</strong>
          <ol>
            <li>図面の既知寸法の始点と終点をクリックする</li>
            <li>その2点間の実寸を下から選ぶ</li>
            <li>校正後に未知の距離を測るときは、上部の「測定」を使う</li>
          </ol>
          <p><b>例:</b> グリッド1マスが910mmなら、1マス分の両端をクリックして「910mm」を押します。</p>
        </div>
        <h3>クリックした2点間の実寸</h3>
        <div className="preset-buttons">
          {CALIBRATION_DISTANCE_PRESETS_MM.map((mm) => (
            <button key={mm} type="button" onClick={() => apply(mm)}>{mm}mm</button>
          ))}
        </div>
        <div className="custom-input">
          <input
            type="number"
            value={text}
            placeholder="図面に書かれた実寸"
            aria-label="クリックした2点間の実寸"
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            autoFocus
          />
          <select value={unit} aria-label="単位" onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
          </select>
          <button type="button" onClick={() => apply(toMm(Number(text), unit))}>確定</button>
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

