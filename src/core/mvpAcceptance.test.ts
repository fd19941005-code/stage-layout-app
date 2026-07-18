// MVP受入条件のうち、ブラウザ実機を要しない保存・配置禁止・出力契約を自動検証する。

import { describe, expect, it } from "vitest";
import { createEmptyProject, deserializeProject, serializeProject } from "./project";
import { findPreset } from "./presets";
import { renderProjectToSvg, mmToPdfPoints, pageSizePoints } from "./export";
import { appReducer, canPlaceObjects, createInitialState } from "../state/appState";
import type { SceneObject } from "../types/project";

function objectAt(id: string, index: number): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: "椅子",
    xMm: 1000 + index * 500,
    yMm: 2000 + index * 250,
    widthMm: 450,
    depthMm: 450,
    heightMm: 450,
    rotationDeg: index * 15,
    label: `C${index + 1}`,
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-objects",
    zIndex: index,
    shape: "rect",
  };
}

describe("MVP受入条件の保存・出力契約", () => {
  it("AC-009: 背景・校正・20個以上のオブジェクトを保存復元できる", () => {
    const project = createEmptyProject("20席の保存テスト");
    project.background = {
      ...project.background,
      imageDataUrl: "data:image/png;base64,fixture",
      naturalWidthPx: 2000,
      naturalHeightPx: 1200,
      rotationDeg: 90,
      crop: { xPx: 100, yPx: 80, widthPx: 1600, heightPx: 900 },
    };
    project.calibration = {
      mmPerPixel: 2.5,
      pointA: { xPx: 100, yPx: 100 },
      pointB: { xPx: 464, yPx: 100 },
      realDistanceMm: 910,
      calibratedAt: "2026-07-18T00:00:00.000Z",
    };
    project.objects = Array.from({ length: 20 }, (_, index) => objectAt(`chair-${index + 1}`, index));

    const restored = deserializeProject(serializeProject(project));
    expect(restored.background.rotationDeg).toBe(90);
    expect(restored.background.crop).toEqual({ xPx: 100, yPx: 80, widthPx: 1600, heightPx: 900 });
    expect(restored.calibration.mmPerPixel).toBe(2.5);
    expect(restored.objects).toHaveLength(20);
    expect(restored.objects.map((object) => [object.xMm, object.yMm, object.widthMm, object.depthMm, object.rotationDeg, object.heightMm])).toEqual(
      project.objects.map((object) => [object.xMm, object.yMm, object.widthMm, object.depthMm, object.rotationDeg, object.heightMm]),
    );
  });

  it("AC-013: 校正前は配置Actionの前提条件を満たさず、校正後だけ許可される", () => {
    const state = createInitialState();
    expect(canPlaceObjects(state.project)).toBe(false);
    const calibrated = appReducer(state, {
      type: "APPLY_CALIBRATION",
      realDistanceMm: 910,
    });
    expect(canPlaceObjects(calibrated.project)).toBe(false);
    const project = { ...state.project, calibration: { ...state.project.calibration, mmPerPixel: 2.5 } };
    expect(canPlaceObjects(project)).toBe(true);
  });

  it("AC-010: 出力SVGは背景と配置物をmm座標で重ね、編集UIを含めない", () => {
    const project = createEmptyProject("相対位置");
    project.calibration.mmPerPixel = 1;
    project.background = { ...project.background, imageDataUrl: "data:image/png;base64,fixture", naturalWidthPx: 4000, naturalHeightPx: 3000 };
    project.objects = [objectAt("chair-1", 2)];
    const svg = renderProjectToSvg(project);
    expect(svg).toContain('viewBox="0 0 4000 3000"');
    expect(svg).toContain("translate(2000 2500) rotate(30)");
    expect(svg).not.toContain("rotate-handle");
    expect(svg).not.toContain("selection-marquee");
  });

  it("AC-011/AC-012: A3横のページ寸法と1:100の1820mmは物理寸法へ変換される", () => {
    const page = pageSizePoints("A3", "landscape");
    expect(page.widthPt).toBeCloseTo(420 * 72 / 25.4, 5);
    expect(page.heightPt).toBeCloseTo(297 * 72 / 25.4, 5);
    expect(mmToPdfPoints(1820, 100) * 25.4 / 72).toBeCloseTo(18.2, 6);
  });

  it("AC-014: 破損プロジェクトは例外として扱え、復元処理自体はクラッシュしない", () => {
    expect(() => deserializeProject("not-json")).toThrow(/解析できません/);
    expect(() => deserializeProject(JSON.stringify({ schemaVersion: "1.0.0", objects: "broken" }))).not.toThrow();
  });

  it("AC-016: 山台プリセットの段高300mmとラベルは保存復元される", () => {
    const riser = findPreset("riser-3x6");
    expect(riser?.heightMm).toBe(300);
    const project = createEmptyProject("山台");
    const state = appReducer(createInitialState(project), {
      type: "ADD_OBJECT",
      object: { ...objectAt("riser-1", 0), type: "riser", presetId: "riser-3x6", name: riser?.name ?? "山台", widthMm: riser?.widthMm ?? 910, depthMm: riser?.depthMm ?? 1820, heightMm: riser?.heightMm ?? 300, label: "段高300mm" },
    });
    const restored = deserializeProject(serializeProject(state.project));
    expect(restored.objects[0].heightMm).toBe(300);
    expect(restored.objects[0].label).toContain("300mm");
  });
});
