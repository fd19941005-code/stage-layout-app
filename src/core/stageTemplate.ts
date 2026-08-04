import type { Project, StageTemplate } from "../types/project";

export const KEN_MM = 1820;

export type StageTemplateInputUnit = "ken" | "m" | "cm" | "mm";

const UNIT_TO_MM: Record<StageTemplateInputUnit, number> = {
  ken: KEN_MM,
  m: 1000,
  cm: 10,
  mm: 1,
};

export interface StageTemplateBoundsMm {
  minXMm: 0;
  minYMm: 0;
  maxXMm: number;
  maxYMm: number;
}

export interface StageTemplateGridLines {
  verticalLinesMm: number[];
  horizontalLinesMm: number[];
}

export interface StageTemplateGridOrigins {
  xMm: number;
  yMm: number;
}

function positiveMm(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) return null;
  return Math.round(value);
}

export function stageDimensionToMm(
  value: number | string,
  unit: StageTemplateInputUnit,
): number | null {
  const numericValue = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return positiveMm(numericValue * UNIT_TO_MM[unit]);
}

export function createStageTemplate(
  widthMm: number,
  depthMm: number,
  gridIntervalMm = KEN_MM,
): StageTemplate | null {
  const normalizedWidthMm = positiveMm(widthMm);
  const normalizedDepthMm = positiveMm(depthMm);
  const normalizedGridIntervalMm = positiveMm(gridIntervalMm);
  if (normalizedWidthMm === null || normalizedDepthMm === null || normalizedGridIntervalMm === null) {
    return null;
  }
  return {
    kind: "rectangular-grid",
    widthMm: normalizedWidthMm,
    depthMm: normalizedDepthMm,
    gridIntervalMm: normalizedGridIntervalMm,
    horizontalAnchor: "center",
    verticalAnchor: "bottom",
  };
}

export function stageTemplateBoundsMm(
  template: StageTemplate | null | undefined,
): StageTemplateBoundsMm | null {
  if (!template || template.kind !== "rectangular-grid") return null;
  if (template.widthMm <= 0 || template.depthMm <= 0) return null;
  return {
    minXMm: 0,
    minYMm: 0,
    maxXMm: template.widthMm,
    maxYMm: template.depthMm,
  };
}

function lineValues(originMm: number, intervalMm: number, minMm: number, maxMm: number): number[] {
  const firstIndex = Math.ceil((minMm - originMm) / intervalMm);
  const lastIndex = Math.floor((maxMm - originMm) / intervalMm);
  const lines: number[] = [];
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const value = originMm + index * intervalMm;
    if (value > minMm && value < maxMm) lines.push(Math.round(value));
  }
  return lines;
}

export function stageTemplateGridOrigins(
  template: StageTemplate | null | undefined,
): StageTemplateGridOrigins | null {
  if (!template || template.kind !== "rectangular-grid") return null;
  return {
    xMm: template.widthMm / 2 - template.gridIntervalMm / 2,
    yMm: template.depthMm,
  };
}

export function stageTemplateGridLines(
  template: StageTemplate | null | undefined,
): StageTemplateGridLines {
  const bounds = stageTemplateBoundsMm(template);
  const origins = stageTemplateGridOrigins(template);
  if (!bounds || !origins || !template) {
    return { verticalLinesMm: [], horizontalLinesMm: [] };
  }
  return {
    verticalLinesMm: lineValues(
      origins.xMm,
      template.gridIntervalMm,
      bounds.minXMm,
      bounds.maxXMm,
    ),
    horizontalLinesMm: lineValues(
      origins.yMm,
      template.gridIntervalMm,
      bounds.minYMm,
      bounds.maxYMm,
    ).sort((a, b) => a - b),
  };
}

export function isProjectReadyForPlacement(
  project: Pick<Project, "calibration" | "stageTemplate">,
): boolean {
  return project.calibration.mmPerPixel !== null || project.stageTemplate !== null;
}
