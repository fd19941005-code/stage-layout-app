// 自動テスト必須領域(11.4): 校正計算・座標変換・回転境界

import { describe, expect, it } from "vitest";
import {
  computeMmPerPixel,
  displayedPxToSourcePx,
  getBackgroundDisplaySizePx,
  imagePxToMm,
  measuredCalibrationDistanceMm,
  mmDistance,
  mmToImagePx,
  mmToScreen,
  normalizeDeg,
  rotatedBoundsMm,
  screenToMm,
  sourcePxToDisplayedPx,
  toMm,
  zoomAt,
} from "./transform";
import type { Background, ViewState } from "../types/project";

describe("computeMmPerPixel (FR-020 2点校正)", () => {
  it("2点距離と実距離からmm/pxを算出する", () => {
    const mmpp = computeMmPerPixel({ xPx: 0, yPx: 0 }, { xPx: 100, yPx: 0 }, 910);
    expect(mmpp).toBeCloseTo(9.1);
  });

  it("斜め方向の2点でも正しく計算する", () => {
    const mmpp = computeMmPerPixel({ xPx: 0, yPx: 0 }, { xPx: 30, yPx: 40 }, 1000);
    expect(mmpp).toBeCloseTo(20);
  });

  it("実距離が0以下なら拒否する(6.1)", () => {
    expect(() => computeMmPerPixel({ xPx: 0, yPx: 0 }, { xPx: 100, yPx: 0 }, 0)).toThrow();
    expect(() => computeMmPerPixel({ xPx: 0, yPx: 0 }, { xPx: 100, yPx: 0 }, -910)).toThrow();
  });

  it("同一2点なら拒否する", () => {
    expect(() => computeMmPerPixel({ xPx: 5, yPx: 5 }, { xPx: 5, yPx: 5 }, 910)).toThrow();
  });
});

describe("toMm (FR-022 単位入力の正規化)", () => {
  it("mm/cm/mをmmへ正規化する", () => {
    expect(toMm(910, "mm")).toBe(910);
    expect(toMm(91, "cm")).toBe(910);
    expect(toMm(0.91, "m")).toBeCloseTo(910);
  });
});

describe("px⇔mm 双方向座標変換 (11.4)", () => {
  it("画像px⇔mmの往復で元の値に戻る", () => {
    const mmpp = 9.1;
    const p = { xPx: 123.4, yPx: 567.8 };
    const back = mmToImagePx(imagePxToMm(p, mmpp), mmpp);
    expect(back.xPx).toBeCloseTo(p.xPx);
    expect(back.yPx).toBeCloseTo(p.yPx);
  });

  it("画面px⇔mmの往復で元の値に戻る", () => {
    const view: ViewState = { zoom: 0.04, panX: 40, panY: 60 };
    const p = { x: 300, y: 200 };
    const back = mmToScreen(screenToMm(p, view), view);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it("ズーム変更しても実寸座標は変化しない(AC-003)", () => {
    const view1: ViewState = { zoom: 0.25, panX: 0, panY: 0 };
    const pMm = { xMm: 5000, yMm: 3000 };
    const view2: ViewState = { zoom: 4, panX: 120, panY: -80 };
    const roundTrip = screenToMm(mmToScreen(pMm, view1), view1);
    const roundTrip2 = screenToMm(mmToScreen(pMm, view2), view2);
    expect(roundTrip.xMm).toBeCloseTo(pMm.xMm);
    expect(roundTrip2.xMm).toBeCloseTo(pMm.xMm);
    expect(roundTrip2.yMm).toBeCloseTo(pMm.yMm);
  });
});

describe("背景の切り抜き・回転変換 (FR-012、FR-013)", () => {
  const background: Background = {
    imageDataUrl: "data:image/png;base64,x",
    naturalWidthPx: 1000,
    naturalHeightPx: 600,
    sourceType: "image",
    sourcePage: null,
    rotationDeg: 90,
    crop: { xPx: 100, yPx: 50, widthPx: 800, heightPx: 400 },
    opacity: 1,
    visible: true,
    locked: true,
  };

  it("回転後の表示寸法は切り抜き寸法を入れ替える", () => {
    expect(getBackgroundDisplaySizePx(background)).toEqual({ widthPx: 400, heightPx: 800 });
  });

  it("元画像pxと表示pxの往復が90度回転・切り抜き後も成立する", () => {
    const source = { xPx: 300, yPx: 200 };
    const displayed = sourcePxToDisplayedPx(source, background);
    const back = displayedPxToSourcePx(displayed, background);
    expect(back.xPx).toBeCloseTo(source.xPx);
    expect(back.yPx).toBeCloseTo(source.yPx);
  });

  it("校正確認の再測定値は元の基準線距離と一致する", () => {
    const a = { xPx: 100, yPx: 100 };
    const b = { xPx: 200, yPx: 100 };
    const mmpp = computeMmPerPixel(a, b, 10000);
    expect(measuredCalibrationDistanceMm(a, b, mmpp)).toBeCloseTo(10000);
  });
});

describe("zoomAt (カーソル位置中心ズーム)", () => {
  it("アンカー点の実寸座標がズーム前後で不変", () => {
    const view: ViewState = { zoom: 0.04, panX: 40, panY: 60 };
    const anchor = { x: 250, y: 180 };
    const before = screenToMm(anchor, view);
    const after = screenToMm(anchor, zoomAt(view, anchor, 0.16));
    expect(after.xMm).toBeCloseTo(before.xMm);
    expect(after.yMm).toBeCloseTo(before.yMm);
  });
});

describe("mmDistance (FR-031 距離測定)", () => {
  it("2点間の実寸距離を返す", () => {
    expect(mmDistance({ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 4000 })).toBeCloseTo(5000);
  });
});

describe("normalizeDeg", () => {
  it("0〜360へ正規化する(9.2)", () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(370)).toBe(10);
    expect(normalizeDeg(-30)).toBe(330);
  });
});

describe("rotatedBoundsMm (回転を含む境界計算)", () => {
  it("無回転では寸法そのままの外接矩形", () => {
    const b = rotatedBoundsMm({ xMm: 0, yMm: 0, widthMm: 450, depthMm: 450, rotationDeg: 0 });
    expect(b.minXMm).toBeCloseTo(-225);
    expect(b.maxXMm).toBeCloseTo(225);
  });

  it("90度回転で幅と奥行が入れ替わった外接矩形になる(値自体は不変: AC-006)", () => {
    const b = rotatedBoundsMm({ xMm: 0, yMm: 0, widthMm: 400, depthMm: 600, rotationDeg: 90 });
    expect(b.maxXMm - b.minXMm).toBeCloseTo(600);
    expect(b.maxYMm - b.minYMm).toBeCloseTo(400);
  });

  it("45度回転の外接矩形は対角寸法になる", () => {
    const b = rotatedBoundsMm({ xMm: 0, yMm: 0, widthMm: 100, depthMm: 100, rotationDeg: 45 });
    expect(b.maxXMm - b.minXMm).toBeCloseTo(100 * Math.SQRT2);
  });
});
