import type { ObjectStyle, ObjectStylePatch, SceneObject } from "../types/project";

export type { ObjectStyle, ObjectStylePatch } from "../types/project";


export interface StylePreset {
  id: string;
  name: string;
  style: ObjectStyle;
}

const INK = "#12151a";
const LABEL_RED = "#b2333f";

export const STYLE_PRESETS: readonly StylePreset[] = [
  {
    id: "instrument-ink",
    name: "楽器（黒）",
    style: { color: INK, fillColor: INK, fillOpacity: 0.92, labelColor: LABEL_RED, labelVisible: true, labelFontSizeMm: 180, strokeWidthMm: 12 },
  },
  {
    id: "seat-ink",
    name: "座席（黒）",
    style: { color: INK, fillColor: INK, fillOpacity: 0.96, labelColor: LABEL_RED, labelVisible: false, labelFontSizeMm: 150, strokeWidthMm: 12 },
  },
  {
    id: "riser-red",
    name: "山台（赤茶）",
    style: { color: "#612d37", fillColor: "#995c67", fillOpacity: 0.58, labelColor: "#ffffff", labelVisible: true, labelFontSizeMm: 200, strokeWidthMm: 16 },
  },
  {
    id: "stage-gold",
    name: "舞台設備（金）",
    style: { color: "#684b12", fillColor: "#b58b2d", fillOpacity: 0.86, labelColor: "#ffffff", labelVisible: true, labelFontSizeMm: 200, strokeWidthMm: 16 },
  },
  {
    id: "callout-blue",
    name: "注記（青）",
    style: { color: "#244a72", fillColor: "#4e7fb6", fillOpacity: 0.86, labelColor: "#ffffff", labelVisible: true, labelFontSizeMm: 220, strokeWidthMm: 16 },
  },
  {
    id: "annotation-red",
    name: "注釈（赤）",
    style: { color: "#bd343d", fillColor: "#bd343d", fillOpacity: 0.12, labelColor: "#bd343d", labelVisible: true, labelFontSizeMm: 220, strokeWidthMm: 18 },
  },
];

const STYLE_PRESET_MAP = new Map(STYLE_PRESETS.map((preset) => [preset.id, preset]));

export function stylePresetById(id: string): StylePreset | undefined {
  return STYLE_PRESET_MAP.get(id);
}

function baseStyle(color: string, fillColor: string, fillOpacity: number, labelColor: string, labelVisible: boolean): ObjectStyle {
  return { color, fillColor, fillOpacity, labelColor, labelVisible, labelFontSizeMm: 180, strokeWidthMm: 12 };
}

/** プリセットの種類から、参考図に近い初期表示を選ぶ。 */
export function defaultObjectStyle(object: Pick<SceneObject, "type" | "annotationKind">): ObjectStyle {
  const annotationKind = object.annotationKind ?? null;
  if (annotationKind === "rect" || annotationKind === "circle") return STYLE_PRESETS[4].style;
  if (annotationKind === "text" || annotationKind === "line" || annotationKind === "arrow" || annotationKind === "dimension") return STYLE_PRESETS[5].style;
  if (object.type === "riser") return STYLE_PRESETS[2].style;
  if (object.type === "podium") return STYLE_PRESETS[3].style;
  if (object.type === "instrument") return STYLE_PRESETS[0].style;
  if (object.type === "chair" || object.type === "musicStand") return STYLE_PRESETS[1].style;
  if (object.type === "text") return baseStyle("#bd343d", "#bd343d", 0, "#bd343d", true);
  return baseStyle("#2f7fd1", "#4e83b7", 0.35, "#2f7fd1", true);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** JSONから表示属性だけを取り出し、未知フィールドを無視する。 */
export function parseObjectStyle(value: unknown): ObjectStylePatch | undefined {
  if (!isRecord(value)) return undefined;
  const patch: ObjectStylePatch = {};
  if (isHexColor(value.color)) patch.color = value.color;
  if (isHexColor(value.fillColor)) patch.fillColor = value.fillColor;
  if (typeof value.fillOpacity === "number" && Number.isFinite(value.fillOpacity)) patch.fillOpacity = clamp(value.fillOpacity, 0, 1);
  if (isHexColor(value.labelColor)) patch.labelColor = value.labelColor;
  if (typeof value.labelVisible === "boolean") patch.labelVisible = value.labelVisible;
  if (typeof value.labelFontSizeMm === "number" && Number.isFinite(value.labelFontSizeMm)) patch.labelFontSizeMm = clamp(value.labelFontSizeMm, 80, 600);
  if (typeof value.strokeWidthMm === "number" && Number.isFinite(value.strokeWidthMm)) patch.strokeWidthMm = clamp(value.strokeWidthMm, 2, 80);
  return Object.keys(patch).length > 0 ? patch : undefined;
}

export function resolveObjectStyle(object: Pick<SceneObject, "type" | "annotationKind" | "style">): ObjectStyle {
  const fallback = defaultObjectStyle(object);
  const patch = object.style;
  return {
    color: isHexColor(patch?.color) ? patch.color : fallback.color,
    fillColor: isHexColor(patch?.fillColor) ? patch.fillColor : fallback.fillColor,
    fillOpacity: typeof patch?.fillOpacity === "number" && Number.isFinite(patch.fillOpacity) ? clamp(patch.fillOpacity, 0, 1) : fallback.fillOpacity,
    labelColor: isHexColor(patch?.labelColor) ? patch.labelColor : fallback.labelColor,
    labelVisible: typeof patch?.labelVisible === "boolean" ? patch.labelVisible : fallback.labelVisible,
    labelFontSizeMm: typeof patch?.labelFontSizeMm === "number" && Number.isFinite(patch.labelFontSizeMm) ? clamp(patch.labelFontSizeMm, 80, 600) : fallback.labelFontSizeMm,
    strokeWidthMm: typeof patch?.strokeWidthMm === "number" && Number.isFinite(patch.strokeWidthMm) ? clamp(patch.strokeWidthMm, 2, 80) : fallback.strokeWidthMm,
  };
}
