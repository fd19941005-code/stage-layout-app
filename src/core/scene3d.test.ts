import { describe, expect, it } from "vitest";
import {
  buildScene3D,
  firstPersonPoseForObject,
  objectBaseElevationMm,
  rotateFirstPersonPose,
  shouldUpdateOrbitControls,
} from "./scene3d";
import { createEmptyProject } from "./project";
import type { SceneObject } from "../types/project";

function object(id: string, type: SceneObject["type"], overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type,
    presetId: null,
    name: type === "riser" ? "山台" : "椅子",
    xMm: 1000,
    yMm: 2000,
    widthMm: type === "riser" ? 1820 : 450,
    depthMm: type === "riser" ? 910 : 450,
    heightMm: type === "riser" ? 300 : 450,
    rotationDeg: 0,
    label: "",
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-objects",
    zIndex: 0,
    shape: "rect",
    ...overrides,
  };
}

describe("Phase 5 3Dシーン計算", () => {
  it("AC-201: 壁の各線分を高さ付きの押し出しプリミティブへ変換する", () => {
    const project = createEmptyProject("ホール");
    project.walls = [{
      id: "wall-1",
      points: [{ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 }, { xMm: 3000, yMm: 2000 }],
      heightMm: 6000,
      closed: false,
    }];

    const model = buildScene3D(project, { showAvatars: false });

    expect(model.wallCount).toBe(1);
    expect(model.primitives.filter((item) => item.kind === "wall")).toHaveLength(2);
    expect(model.primitives.find((item) => item.id === "wall-1-segment-1")?.heightMm).toBe(6000);
    expect(model.primitives.find((item) => item.id === "wall-1-segment-2")?.rotationDeg).toBeCloseTo(90);
  });

  it("AC-201: 閉じた壁は始点へ戻る線分も押し出す", () => {
    const project = createEmptyProject("ホール");
    project.walls = [{
      id: "wall-closed",
      points: [{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 }],
      heightMm: 6000,
      closed: true,
    }];

    expect(buildScene3D(project, { showAvatars: false }).primitives.filter((item) => item.kind === "wall")).toHaveLength(3);
  });

  it("AC-203: 山台上の椅子とアバターは山台の段高分だけ上がる", () => {
    const project = createEmptyProject("ホール");
    project.objects = [
      object("riser", "riser"),
      object("chair", "chair", { onRiserId: "riser" }),
    ];

    expect(objectBaseElevationMm(project, "chair")).toBe(300);
    const model = buildScene3D(project);
    const avatar = model.primitives.find((item) => item.id === "chair-avatar");
    expect(avatar?.baseHeightMm).toBe(300);
    expect(avatar?.heightMm).toBe(1200);
  });

  it("AC-202: 選択した椅子からは座奏目線1200mmで見る", () => {
    const project = createEmptyProject("ホール");
    project.objects = [object("riser", "riser", { heightMm: 300 }), object("chair", "chair", { onRiserId: "riser", rotationDeg: 90 })];

    const pose = firstPersonPoseForObject(project, "chair");

    expect(pose?.eyeHeightMm).toBe(1500);
    expect(pose?.yawDeg).toBe(90);
    expect(pose?.xMm).toBeCloseTo(1150);
    expect(pose?.yMm).toBeCloseTo(2000);
  });

  it("AC-201: 不可視レイヤーのオブジェクトは3Dシーンへ含めない", () => {
    const project = createEmptyProject("ホール");
    project.layers.find((layer) => layer.id === "layer-objects")!.visible = false;
    project.objects = [object("chair", "chair")];

    const model = buildScene3D(project);

    expect(model.objectCount).toBe(0);
    expect(model.avatarCount).toBe(0);
  });

  it("AC-201: 背景画像の表示寸法を校正済みmmへ写像する", () => {
    const project = createEmptyProject("ホール");
    project.background = {
      ...project.background,
      imageDataUrl: "data:image/png;base64,placeholder",
      naturalWidthPx: 2000,
      naturalHeightPx: 1000,
      rotationDeg: 90,
    };
    project.calibration.mmPerPixel = 2;

    const model = buildScene3D(project, { showAvatars: false });

    expect(model.backgroundPlane).toMatchObject({ widthMm: 2000, depthMm: 4000, xMm: 1000, yMm: 2000 });
    expect(model.bounds.minXMm).toBeLessThanOrEqual(-1000);
    expect(model.bounds.maxYMm).toBeGreaterThanOrEqual(3000);
  });

  it("AC-201: 背景の切り抜き範囲と回転を3Dテクスチャ用メタデータへ引き継ぐ", () => {
    const project = createEmptyProject("ホール");
    project.background = {
      ...project.background,
      imageDataUrl: "data:image/png;base64,placeholder",
      naturalWidthPx: 2000,
      naturalHeightPx: 1000,
      crop: { xPx: 100, yPx: 200, widthPx: 500, heightPx: 300 },
      rotationDeg: 90,
    };
    project.calibration.mmPerPixel = 2;

    const model = buildScene3D(project, { showAvatars: false });

    expect(model.backgroundPlane).toMatchObject({
      widthMm: 600,
      depthMm: 1000,
      crop: { xPx: 100, yPx: 200, widthPx: 500, heightPx: 300 },
      rotationDeg: 90,
    });
  });

  it("AC-201: 非表示の背景または背景レイヤーは3D床へ表示しない", () => {
    const project = createEmptyProject("ホール");
    project.background = { ...project.background, imageDataUrl: "data:image/png;base64,placeholder", visible: false };
    expect(buildScene3D(project, { showAvatars: false }).backgroundPlane).toBeNull();

    project.background.visible = true;
    project.layers.find((layer) => layer.id === "layer-background")!.visible = false;
    expect(buildScene3D(project, { showAvatars: false }).backgroundPlane).toBeNull();
  });

  it("AC-201: 舞台前端が設定されると客席方向へ床の範囲を延長する", () => {
    const project = createEmptyProject("ホール");
    project.stageFront = { yMm: 0 };

    const model = buildScene3D(project, { showAvatars: false });

    expect(model.bounds.minYMm).toBeLessThanOrEqual(-9000);
  });

  it("AC-204: 一人称視点のドラッグ量を視線回転へ変換し上下角を制限する", () => {
    const pose = { xMm: 1000, yMm: 2000, eyeHeightMm: 1200, yawDeg: 10, pitchDeg: 0 };
    const rotated = rotateFirstPersonPose(pose, 40, -20);
    const clamped = rotateFirstPersonPose(pose, 0, 1000);
    expect(rotated).toMatchObject({ yawDeg: 20, pitchDeg: 4 });
    expect(clamped.pitchDeg).toBe(-75);
  });

  it("AC-204: 一人称中はOrbitControls更新を止めて視線姿勢を維持する", () => {
    expect(shouldUpdateOrbitControls("firstPerson")).toBe(false);
    expect(shouldUpdateOrbitControls("orbit")).toBe(true);
  });
});
