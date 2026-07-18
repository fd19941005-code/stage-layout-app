import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";

describe("背景編集Action (FR-012、FR-013、FR-014)", () => {
  it("90度回転と切り抜きはプロジェクトへ保存可能な状態になる", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "SET_BACKGROUND",
      imageDataUrl: "data:image/png;base64,x",
      naturalWidthPx: 1000,
      naturalHeightPx: 800,
      sourceType: "image",
      sourcePage: null,
    });
    state = appReducer(state, { type: "ROTATE_BACKGROUND", delta: 90 });
    state = appReducer(state, {
      type: "SET_BACKGROUND_CROP",
      crop: { xPx: 100, yPx: 50, widthPx: 700, heightPx: 500 },
    });
    expect(state.project.background.rotationDeg).toBe(90);
    expect(state.project.background.crop).toEqual({ xPx: 100, yPx: 50, widthPx: 700, heightPx: 500 });
    expect(state.saveState).toBe("dirty");
  });

  it("範囲外の切り抜きを画像内へ補正する", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "SET_BACKGROUND",
      imageDataUrl: "data:image/png;base64,x",
      naturalWidthPx: 1000,
      naturalHeightPx: 800,
      sourceType: "image",
      sourcePage: null,
    });
    state = appReducer(state, {
      type: "SET_BACKGROUND_CROP",
      crop: { xPx: -20, yPx: 790, widthPx: 5000, heightPx: 5000 },
    });
    expect(state.project.background.crop).toEqual({ xPx: 0, yPx: 790, widthPx: 1000, heightPx: 10 });
  });
});

describe("校正確認の状態遷移 (FR-024)", () => {
  it("校正確認モードで2点を保持し、再測定でクリアできる", () => {
    let state = createInitialState();
    state = appReducer(state, { type: "SET_MODE", mode: "verifyCalibration" });
    state = appReducer(state, { type: "ADD_CALIB_POINT", point: { xPx: 10, yPx: 10 } });
    state = appReducer(state, { type: "ADD_CALIB_POINT", point: { xPx: 110, yPx: 10 } });
    expect(state.calibPointsPx).toHaveLength(2);
    state = appReducer(state, { type: "CLEAR_CALIB_POINTS" });
    expect(state.calibPointsPx).toHaveLength(0);
  });
});
