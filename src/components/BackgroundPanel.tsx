// 背景編集(FR-012〜014)。切り抜きは元画像を保持したまま表示変換として保存する。

import { useEffect, useState, type Dispatch } from "react";
import type { Action, AppState } from "../state/appState";
import type { CropPx } from "../types/project";
import { clampCrop, getEffectiveCrop } from "../core/transform";

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

type CropField = keyof CropPx;

const CROP_FIELDS: { key: CropField; label: string }[] = [
  { key: "xPx", label: "左 (px)" },
  { key: "yPx", label: "上 (px)" },
  { key: "widthPx", label: "幅 (px)" },
  { key: "heightPx", label: "高さ (px)" },
];

export function BackgroundPanel({ state, dispatch }: Props) {
  const { background } = state.project;
  const [cropDraft, setCropDraft] = useState<CropPx>(() => getEffectiveCrop(background));

  useEffect(() => {
    setCropDraft(getEffectiveCrop(background));
  }, [background]);

  function commitCrop() {
    dispatch({
      type: "SET_BACKGROUND_CROP",
      crop: clampCrop(cropDraft, background.naturalWidthPx, background.naturalHeightPx),
    });
  }

  return (
    <section className="background-panel">
      {!background.imageDataUrl ? (
        <p className="hint">PNG/JPEGまたはPDFを読み込むと編集できます。</p>
      ) : (
        <>
          <p className="source-label">
            {background.sourceType === "pdf" && background.sourcePage
              ? `PDF ${background.sourcePage}ページ`
              : "画像"} ({background.naturalWidthPx}×{background.naturalHeightPx}px)
          </p>
          <label className="row">
            <input
              type="checkbox"
              checked={background.visible}
              onChange={(e) => dispatch({ type: "SET_BACKGROUND_VISIBLE", visible: e.target.checked })}
            />
            表示
          </label>
          <label>
            透明度
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={background.opacity}
              onChange={(e) => dispatch({ type: "SET_BACKGROUND_OPACITY", opacity: Number(e.target.value) })}
            />
            <span className="range-value">{Math.round(background.opacity * 100)}%</span>
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={background.locked}
              onChange={(e) => dispatch({ type: "SET_BACKGROUND_LOCKED", locked: e.target.checked })}
            />
            背景をロック
          </label>

          <div className="background-actions">
            <button type="button" onClick={() => dispatch({ type: "ROTATE_BACKGROUND", delta: -90 })}>
              ↺ 90°
            </button>
            <strong>{background.rotationDeg}°</strong>
            <button type="button" onClick={() => dispatch({ type: "ROTATE_BACKGROUND", delta: 90 })}>
              ↻ 90°
            </button>
          </div>

          <h3>切り抜き</h3>
          <p className="hint">元画像は保持されます。範囲は元画像のpx座標です。</p>
          <div className="crop-grid">
            {CROP_FIELDS.map(({ key, label }) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min={key === "widthPx" || key === "heightPx" ? 1 : 0}
                  value={cropDraft[key]}
                  onChange={(e) => setCropDraft({ ...cropDraft, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <div className="background-actions">
            <button type="button" onClick={commitCrop}>切り抜きを適用</button>
            <button type="button" onClick={() => dispatch({ type: "SET_BACKGROUND_CROP", crop: null })}>
              リセット
            </button>
          </div>
        </>
      )}
    </section>
  );
}
