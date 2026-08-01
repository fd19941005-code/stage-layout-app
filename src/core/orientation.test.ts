import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./project";
import {
  createMirroredObjects,
  mirrorPointAcrossVerticalAxis,
  mirroredRotationDeg,
  rotateObjectsByDelta,
  rotateObjectsTowardPoint,
  rotationDegTowardPoint,
  setObjectsRotation,
  stageCenterXMm,
} from "./orientation";
import type { SceneObject } from "../types/project";

function object(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: id,
    xMm: 1000,
    yMm: 2000,
    widthMm: 450,
    depthMm: 600,
    heightMm: 450,
    rotationDeg: 30,
    label: "ラベル",
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

function idFactory() {
  let count = 0;
  return (prefix: string) => `${prefix}-${++count}`;
}

describe("左右対称配置と基準点回転の純粋関数", () => {
  it("垂直軸からの距離を保ち、回転・終点を鏡映する", () => {
    const sources = [
      object("riser", { type: "riser", presetId: "riser-3x6", xMm: 2000, rotationDeg: 90, groupId: "source-group" }),
      object("chair", {
        xMm: 1000,
        rotationDeg: 30,
        widthMm: 700,
        depthMm: 800,
        assetVariantId: "stage-open-template/chair-a",
        onRiserId: "riser",
        groupId: "source-group",
        endXMm: 1300,
        endYMm: 2400,
        style: { color: "#123456", labelVisible: true },
      }),
      object("center", { xMm: 5000 }),
      object("locked", { xMm: 7000, locked: true }),
    ];

    const copies = createMirroredObjects(sources, ["riser", "chair", "center", "locked"], 5000, idFactory(), 10);

    expect(copies).toHaveLength(2);
    const riser = copies[0]!;
    const chair = copies[1]!;
    expect(riser).toMatchObject({ xMm: 8000, yMm: 2000, rotationDeg: 270, zIndex: 10 });
    expect(chair).toMatchObject({
      xMm: 9000,
      yMm: 2000,
      widthMm: 700,
      depthMm: 800,
      rotationDeg: 330,
      label: "ラベル",
      assetVariantId: "stage-open-template/chair-a",
      endXMm: 8700,
      endYMm: 2400,
      groupId: riser.groupId,
      onRiserId: riser.id,
      style: { color: "#123456", labelVisible: true },
    });
    expect(chair.id).not.toBe("chair");
    expect(riser.id).not.toBe("riser");
    expect(riser.groupId).not.toBe("source-group");
    // 画像資産には反転指定を付けず、既存シンボルをrotationDegだけで描画する。
    expect(chair).not.toHaveProperty("flipX");
    expect(chair.style).not.toBe(sources[1]!.style);
    expect(Math.abs((chair.xMm + sources[1]!.xMm) / 2 - 5000)).toBeLessThan(0.000001);
  });

  it("中心線上のオブジェクトとロック中のオブジェクトを複製しない", () => {
    const sources = [object("center", { xMm: 5000 }), object("locked", { xMm: 7000, locked: true })];
    expect(createMirroredObjects(sources, ["center", "locked"], 5000, idFactory(), 0)).toEqual([]);
  });

  it("正面方向の規約に合わせて指定点への角度を計算する", () => {
    const origin = { xMm: 100, yMm: 100 };
    expect(rotationDegTowardPoint(origin, { xMm: 100, yMm: 0 })).toBe(0);
    expect(rotationDegTowardPoint(origin, { xMm: 200, yMm: 100 })).toBe(90);
    expect(rotationDegTowardPoint(origin, { xMm: 100, yMm: 200 })).toBe(180);
    expect(rotationDegTowardPoint(origin, { xMm: 0, yMm: 100 })).toBe(270);
    expect(rotationDegTowardPoint(origin, origin)).toBeNull();
    expect(mirrorPointAcrossVerticalAxis({ xMm: 1000, yMm: 2000 }, 5000)).toEqual({ xMm: 9000, yMm: 2000 });
    expect(mirroredRotationDeg(30)).toBe(330);
  });

  it("位置・寸法を変えず、選択物だけを一括回転する", () => {
    const sources = [object("a", { xMm: 1000, yMm: 2000, rotationDeg: 10 }), object("b", { xMm: 3000, rotationDeg: 20 }), object("locked", { locked: true, rotationDeg: 40 })];
    const aimed = rotateObjectsTowardPoint(sources, ["a", "b", "locked"], { xMm: 1000, yMm: 0 });
    expect(aimed[0]).toMatchObject({ xMm: 1000, yMm: 2000, widthMm: 450, depthMm: 600, rotationDeg: 0 });
    expect(aimed[1]).toMatchObject({ xMm: 3000, rotationDeg: 315 });
    expect(aimed[2]!.rotationDeg).toBe(40);

    const unified = setObjectsRotation(aimed, ["a", "b", "locked"], 90);
    expect(unified.map((item) => item.rotationDeg)).toEqual([90, 90, 40]);
    const plusFive = rotateObjectsByDelta(unified, ["a", "b", "locked"], 5);
    expect(plusFive.map((item) => item.rotationDeg)).toEqual([95, 95, 40]);
  });

  it("背景の実寸幅から舞台中心線を求める", () => {
    const project = createEmptyProject("中心線");
    project.background = { ...project.background, imageDataUrl: "data:image/png;base64,stub", naturalWidthPx: 1200, naturalHeightPx: 800 };
    project.calibration = { ...project.calibration, mmPerPixel: 2 };
    expect(stageCenterXMm(project)).toBe(1200);
    expect(stageCenterXMm(createEmptyProject("未校正"))).toBeNull();
  });
});
