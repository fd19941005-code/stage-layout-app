// Phase 4の一括配置計算。入力・出力はすべて実寸mmで扱い、
// ID生成だけを呼び出し側から注入できる純粋な座標生成関数にする。

import type { PointMm, SceneObject } from "../types/project";
import { normalizeDeg } from "./transform";

export interface GridPlacementOptions {
  rows: number;
  columns: number;
  gapXMm: number;
  gapYMm: number;
}

export interface PultArcOptions {
  center: PointMm;
  radiusMm: number;
  startDeg: number;
  endDeg: number;
  pultCount: number;
  pultSpacingMm: number;
  layerId: string;
}

export type ArrangementIdFactory = (index: number, role: string, pultIndex?: number) => string;

function positiveInteger(value: number, fallback: number, max: number): number {
  return Math.min(max, Math.max(1, Math.floor(Number.isFinite(value) ? value : fallback)));
}

function cloneForPlacement(
  source: SceneObject,
  id: string,
  xMm: number,
  yMm: number,
  rotationDeg: number,
  layerId: string,
  zIndex: number,
  label: string = source.label,
): SceneObject {
  const deltaX = xMm - source.xMm;
  const deltaY = yMm - source.yMm;
  return {
    ...source,
    id,
    xMm,
    yMm,
    endXMm: typeof source.endXMm === "number" ? source.endXMm + deltaX : source.endXMm,
    endYMm: typeof source.endYMm === "number" ? source.endYMm + deltaY : source.endYMm,
    rotationDeg: normalizeDeg(rotationDeg),
    label,
    layerId,
    zIndex,
    locked: false,
    groupId: null,
  };
}

/** 元オブジェクトを左上のセルとして、残りのセル分だけ複製する。間隔は外形間のmm。 */
export function createGridCopies(
  source: SceneObject,
  options: GridPlacementOptions,
  idFactory: ArrangementIdFactory = (index) => `grid-${index + 1}`,
): SceneObject[] {
  const rows = positiveInteger(options.rows, 1, 100);
  const columns = positiveInteger(options.columns, 1, 100);
  const gapX = Math.max(0, Number.isFinite(options.gapXMm) ? options.gapXMm : 0);
  const gapY = Math.max(0, Number.isFinite(options.gapYMm) ? options.gapYMm : 0);
  const copies: SceneObject[] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (row === 0 && column === 0) continue;
      copies.push(cloneForPlacement(
        source,
        idFactory(index, "grid"),
        source.xMm + column * (source.widthMm + gapX),
        source.yMm + row * (source.depthMm + gapY),
        source.rotationDeg,
        source.layerId,
        source.zIndex + index + 1,
      ));
      index += 1;
    }
  }
  return copies;
}

/** 椅子2脚+譜面台1台を1プルトとして弧状に生成する。 */
export function createPultArcObjects(
  chairTemplate: SceneObject,
  standTemplate: SceneObject,
  options: PultArcOptions,
  idFactory: ArrangementIdFactory = (index, role, pultIndex = 0) => `pult-${pultIndex + 1}-${role}-${index + 1}`,
): SceneObject[] {
  const count = positiveInteger(options.pultCount, 1, 100);
  const radius = Math.max(1, Number.isFinite(options.radiusMm) ? options.radiusMm : 1);
  const spacing = Math.max(1, Number.isFinite(options.pultSpacingMm) ? options.pultSpacingMm : 900);
  const start = Number.isFinite(options.startDeg) ? options.startDeg : 0;
  const end = Number.isFinite(options.endDeg) ? options.endDeg : start;
  const result: SceneObject[] = [];
  let zIndex = Math.max(chairTemplate.zIndex, standTemplate.zIndex);
  let index = 0;

  for (let pultIndex = 0; pultIndex < count; pultIndex += 1) {
    const ratio = count === 1 ? 0.5 : pultIndex / (count - 1);
    const angleDeg = start + (end - start) * ratio;
    const angleRad = (angleDeg * Math.PI) / 180;
    const radial = { xMm: Math.cos(angleRad), yMm: Math.sin(angleRad) };
    const tangent = { xMm: -radial.yMm, yMm: radial.xMm };
    const base = {
      xMm: options.center.xMm + radial.xMm * radius,
      yMm: options.center.yMm + radial.yMm * radius,
    };
    const chairRotation = angleDeg + 90;
    const chairOffset = spacing / 2;
    const chairPositions = [-chairOffset, chairOffset];
    chairPositions.forEach((offset, chairIndex) => {
      const chair = cloneForPlacement(
        chairTemplate,
        idFactory(index, "chair", pultIndex),
        base.xMm + tangent.xMm * offset,
        base.yMm + tangent.yMm * offset,
        chairRotation,
        options.layerId,
        zIndex,
        `プルト${pultIndex + 1}-${chairIndex + 1}`,
      );
      result.push(chair);
      index += 1;
      zIndex += 1;
    });

    const standOffset = Math.max(350, standTemplate.depthMm / 2 + 100);
    result.push(cloneForPlacement(
      standTemplate,
      idFactory(index, "stand", pultIndex),
      base.xMm - radial.xMm * standOffset,
      base.yMm - radial.yMm * standOffset,
      chairRotation,
      options.layerId,
      zIndex,
      `譜面台${pultIndex + 1}`,
    ));
    index += 1;
    zIndex += 1;
  }

  return result;
}


