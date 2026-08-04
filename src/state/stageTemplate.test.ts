import { describe, expect, it } from "vitest";
import { appReducer, canPlaceObjects, createInitialState } from "./appState";

describe("実寸舞台テンプレートのプロジェクト状態", () => {
  it("寸法mmで新規テンプレートを作成し、配置可能にする", () => {
    const state = appReducer(createInitialState(), {
      type: "NEW_PROJECT_WITH_STAGE_TEMPLATE",
      name: "13m x 10m",
      widthMm: 13000,
      depthMm: 10000,
    });

    expect(state.project.stageTemplate).toMatchObject({ widthMm: 13000, depthMm: 10000, gridIntervalMm: 1820 });
    expect(state.project.calibration.mmPerPixel).toBeNull();
    expect(canPlaceObjects(state.project)).toBe(true);
  });

  it("背景図面を読み込むとテンプレートを解除する", () => {
    const templateState = appReducer(createInitialState(), {
      type: "NEW_PROJECT_WITH_STAGE_TEMPLATE",
      name: "template",
      widthMm: 13000,
      depthMm: 10000,
    });
    const next = appReducer(templateState, {
      type: "SET_BACKGROUND",
      imageDataUrl: "data:image/png;base64,test",
      naturalWidthPx: 100,
      naturalHeightPx: 100,
      sourceType: "image",
      sourcePage: null,
    });

    expect(next.project.stageTemplate).toBeNull();
    expect(canPlaceObjects(next.project)).toBe(false);
  });
});
