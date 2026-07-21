// 出力機能(FR-080〜085)。画面のスクリーンショットではなく、プロジェクトの
// mm正本から再描画する。選択枠・回転ハンドル・測定ガイドは出力しない。

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Background, Project, SceneObject } from "../types/project";
import { effectiveMmPerPixel } from "../state/appState";
import { getBackgroundDisplaySizePx, getEffectiveCrop, sceneObjectBoundsMm } from "./transform";
import { getSymbolLabelLayout, renderSymbolDefinitionsSvg, renderSymbolUseSvg, symbolIdForPreset, symbolLabelForPreset, type SymbolLabelLayout } from "./symbols";
import { resolveObjectStyle, type ObjectStyle } from "./visualStyle";

export const PDF_POINTS_PER_INCH = 72;
export const MM_PER_INCH = 25.4;
export const POINTS_PER_MM = PDF_POINTS_PER_INCH / MM_PER_INCH;

export interface ExportLayerOptions {
  background: boolean;
  objects: boolean;
  labels: boolean;
  grid: boolean;
  /** 注釈レイヤー。旧呼び出し元との互換性のため省略時は表示する。 */
  annotations?: boolean;
}

export const DEFAULT_EXPORT_LAYERS: ExportLayerOptions = {
  background: true,
  objects: true,
  labels: true,
  grid: false,
  annotations: true,
};

export interface ExportBounds {
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PngExportOptions {
  longSidePx: number;
  layers: ExportLayerOptions;
}

export interface PdfExportOptions {
  paper: "A4" | "A3";
  orientation: "portrait" | "landscape";
  scale: "1:50" | "1:100" | "fit";
  layers: ExportLayerOptions;
}

export function pageSizePoints(
  paper: "A4" | "A3",
  orientation: "portrait" | "landscape",
): { widthPt: number; heightPt: number } {
  const portrait = paper === "A4"
    ? { widthPt: 210 * POINTS_PER_MM, heightPt: 297 * POINTS_PER_MM }
    : { widthPt: 297 * POINTS_PER_MM, heightPt: 420 * POINTS_PER_MM };
  return orientation === "portrait"
    ? portrait
    : { widthPt: portrait.heightPt, heightPt: portrait.widthPt };
}

/** 実寸mmを指定縮尺のPDFポイントへ変換する(11.4、AC-012) */
export function mmToPdfPoints(mm: number, scaleDenominator: 50 | 100 | number): number {
  if (!Number.isFinite(mm) || !Number.isFinite(scaleDenominator) || scaleDenominator <= 0) {
    throw new Error("縮尺計算の入力値が不正です");
  }
  return (mm / scaleDenominator) * POINTS_PER_MM;
}

function layerIsVisible(project: Project, layerId: string): boolean {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  return layer ? layer.visible : true;
}

function isAnnotationObject(object: SceneObject): boolean {
  return object.annotationKind !== null && object.annotationKind !== undefined;
}

/** 出力対象レイヤーの選択ロジック(11.4) */
export function selectExportObjects(project: Project, layers: ExportLayerOptions): SceneObject[] {
  return project.objects.filter((object) => {
    if (!object.visible || !layerIsVisible(project, object.layerId)) return false;
    return isAnnotationObject(object) ? layers.annotations !== false : layers.objects;
  });
}

export function exportBoundsMm(project: Project, layers: ExportLayerOptions): ExportBounds {
  const mmPerPixel = effectiveMmPerPixel(project);
  const points: { xMm: number; yMm: number }[] = [];
  if (layers.background && project.background.visible && layerIsVisible(project, "layer-background") && project.background.imageDataUrl) {
    const size = getBackgroundDisplaySizePx(project.background);
    points.push(
      { xMm: 0, yMm: 0 },
      { xMm: size.widthPx * mmPerPixel, yMm: size.heightPx * mmPerPixel },
    );
  }
  for (const object of selectExportObjects(project, layers)) {
    const bounds = sceneObjectBoundsMm(object);
    points.push(
      { xMm: bounds.minXMm, yMm: bounds.minYMm },
      { xMm: bounds.maxXMm, yMm: bounds.maxYMm },
    );
  }
  if (points.length === 0) points.push({ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 1000 });
  const minXMm = Math.min(...points.map((point) => point.xMm));
  const minYMm = Math.min(...points.map((point) => point.yMm));
  const maxXMm = Math.max(...points.map((point) => point.xMm));
  const maxYMm = Math.max(...points.map((point) => point.yMm));
  return {
    minXMm,
    minYMm,
    maxXMm,
    maxYMm,
    widthMm: Math.max(1, maxXMm - minXMm),
    heightMm: Math.max(1, maxYMm - minYMm),
  };
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] ?? character));
}

function backgroundRotationTransform(background: Background, mmPerPixel: number): string {
  const crop = getEffectiveCrop(background);
  const cropWidthMm = crop.widthPx * mmPerPixel;
  const cropHeightMm = crop.heightPx * mmPerPixel;
  switch (background.rotationDeg) {
    case 90:
      return `translate(${cropHeightMm} 0) rotate(90)`;
    case 180:
      return `translate(${cropWidthMm} ${cropHeightMm}) rotate(180)`;
    case 270:
      return `translate(0 ${cropWidthMm}) rotate(270)`;
    default:
      return "";
  }
}

function renderBackgroundSvg(project: Project, layers: ExportLayerOptions, mmPerPixel: number): string {
  const background = project.background;
  if (!layers.background || !background.imageDataUrl || !background.visible || !layerIsVisible(project, "layer-background")) return "";
  const crop = getEffectiveCrop(background);
  const cropWidthMm = crop.widthPx * mmPerPixel;
  const cropHeightMm = crop.heightPx * mmPerPixel;
  return `<g transform="${backgroundRotationTransform(background, mmPerPixel)}"><svg x="0" y="0" width="${cropWidthMm}" height="${cropHeightMm}" viewBox="${crop.xPx} ${crop.yPx} ${crop.widthPx} ${crop.heightPx}" preserveAspectRatio="none" overflow="visible"><image href="${escapeXml(background.imageDataUrl)}" x="0" y="0" width="${background.naturalWidthPx}" height="${background.naturalHeightPx}" opacity="${background.opacity}" preserveAspectRatio="none" /></svg></g>`;
}

function renderGridSvg(bounds: ExportBounds, intervalMm = 910): string {
  const lines: string[] = [];
  const firstX = Math.floor(bounds.minXMm / intervalMm) * intervalMm;
  const firstY = Math.floor(bounds.minYMm / intervalMm) * intervalMm;
  for (let x = firstX; x <= bounds.maxXMm; x += intervalMm) lines.push(`<line x1="${x}" y1="${bounds.minYMm}" x2="${x}" y2="${bounds.maxYMm}" />`);
  for (let y = firstY; y <= bounds.maxYMm; y += intervalMm) lines.push(`<line x1="${bounds.minXMm}" y1="${y}" x2="${bounds.maxXMm}" y2="${y}" />`);
  return `<g class="export-grid" stroke="#9aa6b2" stroke-width="8" opacity="0.35">${lines.join("")}</g>`;
}

function renderSvgText(value: string, x: number, y: number, style: ObjectStyle, anchor = "middle", className = "object-label", layout?: SymbolLabelLayout): string {
  const lines = layout?.lines ?? value.split(/\r?\n/);
  const lineHeight = layout?.lineHeightMm ?? style.labelFontSizeMm * 1.2;
  const firstY = y - ((lines.length - 1) * lineHeight) / 2;
  const tspans = lines.map((line, index) => '<tspan x="' + x + '" dy="' + (index === 0 ? 0 : lineHeight) + '">' + escapeXml(line) + '</tspan>').join("");
  const symbolStyle = className === "symbol-label"
    ? ' style="paint-order:stroke;stroke:' + (style.labelColor.toLowerCase() === "#ffffff" ? "rgba(18,21,26,0.65)" : "rgba(255,255,255,0.86)") + ';stroke-width:' + Math.max(8, (layout?.fontSizeMm ?? style.labelFontSizeMm) * 0.08) + '"'
    : "";
  return '<text class="' + className + '" x="' + x + '" y="' + firstY + '" text-anchor="' + anchor + '" fill="' + style.labelColor + '" font-size="' + (layout?.fontSizeMm ?? style.labelFontSizeMm) + '"' + symbolStyle + '>' + tspans + '</text>';
}

function renderShapeStyle(style: ObjectStyle): string {
  return 'fill="' + style.fillColor + '" fill-opacity="' + style.fillOpacity + '" stroke="' + style.color + '" stroke-width="' + style.strokeWidthMm + '"';
}

function renderSymbolStyle(style: ObjectStyle): string {
  return 'color="' + style.color + '" style="--symbol-body-opacity:' + style.fillOpacity + ';--symbol-solid-opacity:' + Math.min(1, style.fillOpacity + 0.16) + ';--symbol-stroke-width:' + style.strokeWidthMm + ';--symbol-detail-stroke-width:' + Math.max(6, style.strokeWidthMm * 0.84) + '"';
}

function renderObjectsSvg(objects: readonly SceneObject[], layers: ExportLayerOptions): string {
  return objects.map((object) => {
    const annotation = object.annotationKind;
    const style = resolveObjectStyle(object);
    const labelText = object.label || object.name;
    const symbolId = annotation ? null : symbolIdForPreset(object.presetId);
    const showLabel = Boolean(layers.labels && labelText && (object.label || style.labelVisible));

    if (annotation === "text") {
      return layers.labels ? renderSvgText(object.label || "注釈", object.xMm, object.yMm, style, "middle", "annotation-text") : "";
    }
    if (annotation === "line" || annotation === "arrow" || annotation === "dimension") {
      const endX = typeof object.endXMm === "number" && Number.isFinite(object.endXMm) ? object.endXMm : object.xMm + object.widthMm;
      const endY = typeof object.endYMm === "number" && Number.isFinite(object.endYMm) ? object.endYMm : object.yMm;
      const marker = annotation === "arrow" ? ' marker-end="url(#annotation-arrow)"' : "";
      const dimensionLabel = annotation === "dimension" && layers.labels
        ? renderSvgText(object.label || String(Math.round(Math.hypot(endX - object.xMm, endY - object.yMm))) + " mm", (object.xMm + endX) / 2, (object.yMm + endY) / 2 - 120, style)
        : "";
      return '<g class="annotation-segment" fill="none" stroke="' + style.color + '" stroke-width="' + style.strokeWidthMm + '"><line x1="' + object.xMm + '" y1="' + object.yMm + '" x2="' + endX + '" y2="' + endY + '"' + marker + ' />' + dimensionLabel + '</g>';
    }
    if (annotation === "rect" || annotation === "circle") {
      const shape = annotation === "circle"
        ? '<ellipse rx="' + object.widthMm / 2 + '" ry="' + object.depthMm / 2 + '" ' + renderShapeStyle(style) + ' />'
        : '<rect x="' + (-object.widthMm / 2) + '" y="' + (-object.depthMm / 2) + '" width="' + object.widthMm + '" height="' + object.depthMm + '" ' + renderShapeStyle(style) + ' />';
      const label = layers.labels && object.label ? renderSvgText(object.label, 0, 0, style) : "";
      return '<g transform="translate(' + object.xMm + ' ' + object.yMm + ') rotate(' + object.rotationDeg + ')">' + shape + label + '</g>';
    }
    if (symbolId) {
      const symbolText = symbolLabelForPreset(object.presetId, labelText, Boolean(object.label));
      const symbolLayout = getSymbolLabelLayout(symbolText, object.widthMm, object.depthMm, style.labelFontSizeMm);
      const symbolLabel = showLabel
        ? symbolLayout
          ? renderSvgText(symbolText, 0, 0, style, "middle", "symbol-label", symbolLayout)
          : renderSvgText(symbolText, 0, object.depthMm / 2 + 320, style)
        : "";
      return '<g transform="translate(' + object.xMm + ' ' + object.yMm + ') rotate(' + object.rotationDeg + ')" ' + renderSymbolStyle(style) + '>' + renderSymbolUseSvg(symbolId, object.widthMm, object.depthMm) + symbolLabel + '</g>';
    }
    const shape = object.shape === "circle"
      ? '<ellipse rx="' + object.widthMm / 2 + '" ry="' + object.depthMm / 2 + '" ' + renderShapeStyle(style) + ' />'
      : '<rect x="' + (-object.widthMm / 2) + '" y="' + (-object.depthMm / 2) + '" width="' + object.widthMm + '" height="' + object.depthMm + '" ' + renderShapeStyle(style) + ' />';
    const label = showLabel ? renderSvgText(labelText, 0, object.depthMm / 2 + 260, style) : "";
    return '<g transform="translate(' + object.xMm + ' ' + object.yMm + ') rotate(' + object.rotationDeg + ')">' + shape + label + '</g>';
  }).join("");
}
/** 出力専用SVG。編集UIを含めないためPNGとPDFの共通基盤になる */
export function renderProjectToSvg(
  project: Project,
  layers: ExportLayerOptions = DEFAULT_EXPORT_LAYERS,
  outputWidthPx?: number,
  outputHeightPx?: number,
): string {
  const bounds = exportBoundsMm(project, layers);
  const mmPerPixel = effectiveMmPerPixel(project);
  const widthPx = outputWidthPx ?? Math.max(1, Math.round(bounds.widthMm));
  const heightPx = outputHeightPx ?? Math.max(1, Math.round(bounds.heightMm));
  const grid = layers.grid ? renderGridSvg(bounds) : "";
  const objects = renderObjectsSvg(selectExportObjects(project, layers), layers);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="${bounds.minXMm} ${bounds.minYMm} ${bounds.widthMm} ${bounds.heightMm}"><defs><marker id="annotation-arrow" markerWidth="16" markerHeight="16" refX="12" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#d12f2f" /></marker>${renderSymbolDefinitionsSvg()}</defs><rect x="${bounds.minXMm}" y="${bounds.minYMm}" width="${bounds.widthMm}" height="${bounds.heightMm}" fill="#ffffff" />${renderBackgroundSvg(project, layers, mmPerPixel)}${grid}${objects}</svg>`;
}

function clampLongSide(value: number): number {
  return Math.min(6000, Math.max(2000, Math.round(value)));
}

/** ブラウザのcanvasで出力SVGをPNG化する */
export async function renderProjectToPng(project: Project, options: PngExportOptions): Promise<Blob> {
  if (project.calibration.mmPerPixel === null) throw new Error("未校正のため出力できません");
  const bounds = exportBoundsMm(project, options.layers);
  const longSidePx = clampLongSide(options.longSidePx);
  const landscape = bounds.widthMm >= bounds.heightMm;
  const widthPx = landscape ? longSidePx : Math.max(1, Math.round(longSidePx * bounds.widthMm / bounds.heightMm));
  const heightPx = landscape ? Math.max(1, Math.round(longSidePx * bounds.heightMm / bounds.widthMm)) : longSidePx;
  const svg = renderProjectToSvg(project, options.layers, widthPx, heightPx);
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("PNG出力用の図面を描画できません"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG出力用のキャンバスを作成できません");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, widthPx, heightPx);
    context.drawImage(image, 0, 0, widthPx, heightPx);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNGを生成できません")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaleDenominator(scale: PdfExportOptions["scale"]): number | null {
  if (scale === "1:50") return 50;
  if (scale === "1:100") return 100;
  return null;
}

function safePdfText(value: string): string {
  // 標準Helveticaは日本語グリフを持たないため、文字化けでPDF生成を壊さない。
  return [...value].map((character) => character.charCodeAt(0) <= 0x7e ? character : "?").join("").replace(/[\\r\\n]+/g, " ");
}

export function renderPdfInfoSvg(project: Project, scale: PdfExportOptions["scale"], denominator: number): string {
  const metadata = project.metadata;
  const lines = [
    `タイトル: ${project.name}`,
    `ホール: ${metadata.hallName}  公演名: ${metadata.performanceName}  日付: ${metadata.date}`,
    `作成者: ${metadata.author}  備考: ${metadata.notes}`,
    `縮尺: ${scale === "fit" ? `用紙にフィット（計算値1:${denominator.toFixed(2)}）` : scale}  印刷時は倍率100%（拡大縮小なし）`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="260" viewBox="0 0 1600 260"><rect width="1600" height="260" fill="#ffffff"/><g font-family="sans-serif" font-size="28" fill="#222">${lines.map((line, index) => `<text x="24" y="${42 + index * 54}">${escapeXml(line.replace(/[\\r\\n]+/g, " "))}</text>`).join("")}</g></svg>`;
}

async function renderPdfInfoToPng(project: Project, scale: PdfExportOptions["scale"], denominator: number): Promise<Blob> {
  const svg = renderPdfInfoSvg(project, scale, denominator);
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("PDF出力情報欄を描画できません"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 260;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF出力情報欄のキャンバスを作成できません");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PDF出力情報欄を生成できません")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
/** A4/A3と1:50/1:100からページ内の描画倍率を求める */
export function resolvePdfScaleDenominator(
  bounds: ExportBounds,
  options: Pick<PdfExportOptions, "paper" | "orientation" | "scale">,
): number {
  const fixed = scaleDenominator(options.scale);
  if (fixed) return fixed;
  const page = pageSizePoints(options.paper, options.orientation);
  const marginPt = 36;
  const infoHeightPt = 64;
  const availableWidthMm = Math.max(1, (page.widthPt - marginPt * 2) / POINTS_PER_MM);
  const availableHeightMm = Math.max(1, (page.heightPt - marginPt * 2 - infoHeightPt) / POINTS_PER_MM);
  return Math.max(bounds.widthMm / availableWidthMm, bounds.heightMm / availableHeightMm);
}

export async function createProjectPdf(project: Project, options: PdfExportOptions): Promise<Blob> {
  if (project.calibration.mmPerPixel === null) throw new Error("未校正のため出力できません");
  const bounds = exportBoundsMm(project, options.layers);
  const denominator = resolvePdfScaleDenominator(bounds, options);
  const pageSize = pageSizePoints(options.paper, options.orientation);
  const marginPt = 36;
  const infoHeightPt = 64;
  const imageWidthPt = mmToPdfPoints(bounds.widthMm, denominator);
  const imageHeightPt = mmToPdfPoints(bounds.heightMm, denominator);
  const imageBlob = await renderProjectToPng(project, { longSidePx: 4000, layers: options.layers });
  const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageSize.widthPt, pageSize.heightPt]);
  const image = await pdf.embedPng(imageBytes);
  const imageY = marginPt + infoHeightPt + Math.max(0, (pageSize.heightPt - marginPt * 2 - infoHeightPt - imageHeightPt) / 2);
  page.drawImage(image, {
    x: Math.max(marginPt, (pageSize.widthPt - imageWidthPt) / 2),
    y: imageY,
    width: imageWidthPt,
    height: imageHeightPt,
  });

  const infoBlob = await renderPdfInfoToPng(project, options.scale, denominator);
  const infoBytes = new Uint8Array(await infoBlob.arrayBuffer());
  const infoImage = await pdf.embedPng(infoBytes);
  page.drawImage(infoImage, {
    x: marginPt,
    y: marginPt,
    width: pageSize.widthPt - marginPt * 2,
    height: infoHeightPt,
  });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const scaleBarPt = mmToPdfPoints(1820, denominator);
  const barY = marginPt + 7;
  page.drawLine({ start: { x: marginPt, y: barY }, end: { x: marginPt + scaleBarPt, y: barY }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`1820 mm reference / 1:${denominator}`, { x: marginPt, y: barY - 11, size: 7, font, color: rgb(0.15, 0.18, 0.22) });
  pdf.setTitle(safePdfText(project.name));
  const bytes = await pdf.save();
  // pdf-libのUint8ArrayはArrayBufferLikeを保持するため、BlobのDOM型へ明示的に変換する。
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}






