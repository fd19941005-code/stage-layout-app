import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../core/project";
import { createStageCenterGuide } from "../core/guides";
import { appReducer, createInitialState } from "./appState";

describe("舞台設定に追従する自動生成ガイド", () => {
  it("背景の表示幅と校正値から舞台中央線を更新する", () => {
    const project = createEmptyProject("generated-guide-test");
    project.background.naturalWidthPx = 1000;
    project.background.naturalHeightPx = 500;
    project.calibration.mmPerPixel = 2;
    project.guides = [createStageCenterGuide("center", 2000)];
    const initial = createInitialState(project);
    const rotated = appReducer(initial, { type: "ROTATE_BACKGROUND", delta: 90 });
    expect(rotated.project.guides[0]?.xMm).toBe(500);
  });

  it("舞台前端の変更で前端基準線を更新する", () => {
    const project = createEmptyProject("front-guide-test");
    project.stageFront = { yMm: 5000 };
    const initial = createInitialState(project);
    const added = appReducer(initial, { type: "ADD_STAGE_FRONT_GUIDE", distanceMm: 1000 });
    const changed = appReducer(added, { type: "SET_STAGE_FRONT", yMm: 6000 });
    expect(changed.project.guides[0]?.yMm).toBe(5000);
    expect(changed.project.guides[0]?.distanceMm).toBe(1000);
  });
});
