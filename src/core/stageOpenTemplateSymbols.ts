import { symbolAssetForId, symbolAssetForRuntimeKey, type SymbolAsset } from "./symbolAssets";
import chairRaw from "../assets/stage-open-template/chair.svg?raw";
import chairBackRaw from "../assets/stage-open-template/chair-back.svg?raw";
import pianoBenchRaw from "../assets/stage-open-template/piano-bench.svg?raw";
import musicStandRaw from "../assets/stage-open-template/music-stand.svg?raw";
import lecternRaw from "../assets/stage-open-template/lectern.svg?raw";
import conductorStandRaw from "../assets/stage-open-template/conductor-stand.svg?raw";
import podiumRaw from "../assets/stage-open-template/podium.svg?raw";
import riser3x6Raw from "../assets/stage-open-template/riser-3x6.svg?raw";
import riser4x6Raw from "../assets/stage-open-template/riser-4x6.svg?raw";
import riser6x6Raw from "../assets/stage-open-template/riser-6x6.svg?raw";
import hakoumaRaw from "../assets/stage-open-template/hakouma.svg?raw";
import tableRaw from "../assets/stage-open-template/table.svg?raw";
import grandPianoFullRaw from "../assets/stage-open-template/grand-piano-d.svg?raw";
import grandPianoSemiRaw from "../assets/stage-open-template/grand-piano-bb.svg?raw";
import uprightPianoRaw from "../assets/stage-open-template/upright-piano.svg?raw";
import celestaRaw from "../assets/stage-open-template/celesta.svg?raw";
import marimbaDerivedRaw from "../assets/stage-open-template/marimba-a-derived.svg?raw";
import marimbaBRaw from "../assets/stage-open-template/marimba-b.svg?raw";
import marimba4OctRaw from "../assets/stage-open-template/marimba-4oct-a.svg?raw";
import bassDrumRaw from "../assets/stage-open-template/bass-drum.svg?raw";
import vibraphoneDerivedRaw from "../assets/stage-open-template/vibraphone-a-derived.svg?raw";
import vibraphoneBRaw from "../assets/stage-open-template/vibraphone-b.svg?raw";
import xylophoneDerivedRaw from "../assets/stage-open-template/xylophone-a-derived.svg?raw";
import xylophoneBRaw from "../assets/stage-open-template/xylophone-b.svg?raw";
import glockenspielDerivedRaw from "../assets/stage-open-template/glockenspiel-a-derived.svg?raw";
import glockenspielBRaw from "../assets/stage-open-template/glockenspiel-b.svg?raw";
import chimesRaw from "../assets/stage-open-template/chimes.svg?raw";
import drumSetRaw from "../assets/stage-open-template/drum-set.svg?raw";
import harpRaw from "../assets/stage-open-template/harp.svg?raw";
import contrabassRaw from "../assets/stage-open-template/contrabass.svg?raw";
import ampSpeakerRaw from "../assets/stage-open-template/amp-speaker.svg?raw";
import gongTamTamAgRaw from "../assets/stage-open-template/gong-tam-tam-ag.svg?raw";
import gongTamTamAwRaw from "../assets/stage-open-template/gong-tam-tam-aw.svg?raw";
import { SMALL_PERCUSSION_SVG_SOURCES } from "../assets/stage-open-template/smallPercussionSources";

export interface NormalizedStageOpenTemplateSvg {
  viewBox: string;
  rawSvg: string;
}

export interface StageOpenTemplateAsset extends SymbolAsset, NormalizedStageOpenTemplateSvg {}

function attribute(source: string, name: string): string | undefined {
  const match = source.match(new RegExp("\\b" + name + "\\s*=\\s*[\"']([^\"']+)[\"']", "i"));
  return match?.[1];
}

function numericAttribute(source: string, name: string): number | undefined {
  const value = attribute(source, name);
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sourceViewBox(openTag: string): string {
  const viewBox = attribute(openTag, "viewBox");
  if (viewBox) return viewBox;
  const width = numericAttribute(openTag, "width") ?? 1000;
  const height = numericAttribute(openTag, "height") ?? 1000;
  return "0 0 " + width + " " + height;
}

function rotateStageOpenTemplateSvg(viewBox: string, body: string, rotationDeg: 0 | 90): NormalizedStageOpenTemplateSvg {
  if (rotationDeg === 0) return { viewBox, rawSvg: body };
  const values = viewBox.split(/\s+/).map(Number);
  const [minX, minY, width, height] = values;
  if (![minX, minY, width, height].every((value) => Number.isFinite(value)) || width <= 0 || height <= 0) {
    throw new Error("Invalid StageOpenTemplate SVG viewBox");
  }

  // Piano originals use the long axis as X; rotate the display wrapper only.
  return {
    viewBox: `0 0 ${height} ${width}`,
    rawSvg: `<g transform="matrix(0 1 -1 0 ${height + minY} ${-minX})">${body}</g>`,
  };
}

function removeElements(source: string, tag: string): string {
  return source
    .replace(new RegExp("<" + tag + "\\b[^>]*>[\\s\\S]*?</" + tag + ">", "gi"), "")
    .replace(new RegExp("<" + tag + "\\b[^>]*/>", "gi"), "");
}

/**
 * The source SVGs contain local symbols and English annotations. Normalize them
 * before placing several assets in one shared defs block.
 */
export function normalizeStageOpenTemplateSvg(raw: string, prefix: string, rotationDeg: 0 | 90 = 0): NormalizedStageOpenTemplateSvg {
  const openTagMatch = raw.match(/<svg\b[^>]*>/i);
  const closeTagIndex = raw.toLowerCase().lastIndexOf("</svg>");
  if (!openTagMatch || closeTagIndex < 0) {
    throw new Error("Invalid StageOpenTemplate SVG asset");
  }

  const openTag = openTagMatch[0];
  let body = raw.slice(openTagMatch.index! + openTag.length, closeTagIndex);
  body = removeElements(body, "metadata");
  body = removeElements(body, "sodipodi:namedview");
  body = removeElements(body, "style");
  body = removeElements(body, "text");
  body = body.replace(/<!--[\s\S]*?-->/g, "");

  const ids = new Set<string>();
  for (const match of body.matchAll(/\bid="([^"]+)"/g)) ids.add(match[1]);
  body = body.replace(/#([A-Za-z_][\w:.-]*)/g, (reference, id: string) => ids.has(id) ? "#" + prefix + "-" + id : reference);
  body = body.replace(/\bid="([^"]+)"/g, (_match, id: string) => "id=\"" + prefix + "-" + id + "\"");

  // Keep source white fills, while allowing the app color to control line work.
  body = body
    .replace(/#000000ff/gi, "currentColor")
    .replace(/#000000/gi, "currentColor")
    .replace(/#333333ff/gi, "currentColor")
    .replace(/#333333/gi, "currentColor")
    .replace(/#ffffffff/gi, "#ffffff");

  const normalized = { viewBox: sourceViewBox(openTag), rawSvg: body.trim() };
  return rotateStageOpenTemplateSvg(normalized.viewBox, normalized.rawSvg, rotationDeg);
}

function asset(raw: string, prefix: string, runtimeKey: string, rotationDeg: 0 | 90 = 0): StageOpenTemplateAsset {
  const metadata = symbolAssetForRuntimeKey(runtimeKey);
  if (!metadata) throw new Error("Missing symbol asset metadata: " + runtimeKey);
  return { ...metadata, ...normalizeStageOpenTemplateSvg(raw, prefix, rotationDeg) };
}

function assetForId(raw: string, prefix: string, assetId: string, rotationDeg: 0 | 90 = 0): StageOpenTemplateAsset {
  const metadata = symbolAssetForId(assetId);
  if (!metadata) throw new Error("Missing symbol asset metadata: " + assetId);
  return { ...metadata, ...normalizeStageOpenTemplateSvg(raw, prefix, rotationDeg) };
}
/**
 * Some source outlines reach the original viewBox edge, so the shared symbol viewport clips them.
 * Keep the source paths unchanged and expand only the derived display viewBox.
 */
function padStageOpenTemplateViewBox(raw: string, padding: number): string {
  const openTagMatch = raw.match(/<svg\b[^>]*>/i);
  const viewBoxMatch = openTagMatch?.[0].match(/\bviewBox\s*=\s*(["'])([^"']+)\1/i);
  if (!openTagMatch || !viewBoxMatch || !Number.isFinite(padding) || padding <= 0) return raw;

  const values = viewBoxMatch[2].trim().split(/\s+/).map(Number);
  if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) return raw;
  const [minX, minY, width, height] = values;
  const format = (value: number) => Number(value.toFixed(12)).toString();
  const paddedViewBox = [minX - padding, minY - padding, width + padding * 2, height + padding * 2].map(format).join(" ");
  const replacement = `viewBox="${paddedViewBox}"`;
  const updatedOpenTag = openTagMatch[0].replace(viewBoxMatch[0], replacement);
  return raw.slice(0, openTagMatch.index!) + updatedOpenTag + raw.slice(openTagMatch.index! + openTagMatch[0].length);
}

function assetWithPaddedViewBox(raw: string, prefix: string, runtimeKey: string): StageOpenTemplateAsset {
  return asset(padStageOpenTemplateViewBox(raw, 0.30), prefix, runtimeKey);
}

function assetForIdWithPaddedViewBox(raw: string, prefix: string, assetId: string): StageOpenTemplateAsset {
  return assetForId(padStageOpenTemplateViewBox(raw, 0.30), prefix, assetId);
}

export const STAGE_OPEN_TEMPLATE_ASSETS = {
  chair: asset(chairRaw, "stage-chair", "chair"),
  chairBack: asset(chairBackRaw, "stage-chair-back", "chairBack"),
  pianoBench: asset(pianoBenchRaw, "stage-piano-bench", "pianoBench"),
  musicStand: asset(musicStandRaw, "stage-music-stand", "musicStand"),
  lectern: asset(lecternRaw, "stage-lectern", "lectern"),
  conductorStand: asset(conductorStandRaw, "stage-conductor-stand", "conductorStand"),
  podium: asset(podiumRaw, "stage-podium", "podium"),
  riser3x6: asset(riser3x6Raw, "stage-riser-3x6", "riser3x6"),
  riser4x6: asset(riser4x6Raw, "stage-riser-4x6", "riser4x6"),
  riser6x6: asset(riser6x6Raw, "stage-riser-6x6", "riser6x6"),
  hakouma: asset(hakoumaRaw, "stage-hakouma", "hakouma"),
  table: asset(tableRaw, "stage-table", "table"),
  grandPianoFull: asset(grandPianoFullRaw, "stage-grand-piano-full", "grandPianoFull", 90),
  grandPianoSemi: asset(grandPianoSemiRaw, "stage-grand-piano-semi", "grandPianoSemi", 90),
  uprightPiano: asset(uprightPianoRaw, "stage-upright-piano", "uprightPiano"),
  celesta: asset(celestaRaw, "stage-celesta", "celesta"),
  marimba: asset(marimbaDerivedRaw, "stage-marimba", "marimba"),
  marimbaB: assetForId(marimbaBRaw, "stage-marimba-b", "stage-open-template/marimba-b"),
  marimba4Oct: asset(marimba4OctRaw, "stage-marimba-4oct", "marimba4Oct"),
  bassDrum: asset(bassDrumRaw, "stage-bass-drum", "bassDrum"),
  vibraphone: asset(vibraphoneDerivedRaw, "stage-vibraphone", "vibraphone"),
  vibraphoneB: assetForId(vibraphoneBRaw, "stage-vibraphone-b", "stage-open-template/vibraphone-b"),
  xylophone: asset(xylophoneDerivedRaw, "stage-xylophone", "xylophone"),
  xylophoneB: assetForId(xylophoneBRaw, "stage-xylophone-b", "stage-open-template/xylophone-b"),
  glockenspiel: asset(glockenspielDerivedRaw, "stage-glockenspiel-provisional", "glockenspiel"),
  glockenspielB: assetForId(glockenspielBRaw, "stage-glockenspiel-b", "stage-open-template/glockenspiel-b"),
  chimes: asset(chimesRaw, "stage-chimes", "chimes"),
  drumSet: asset(drumSetRaw, "stage-drum-set", "drumSet"),
  harp: asset(harpRaw, "stage-harp", "harp"),
  contrabass: asset(contrabassRaw, "stage-contrabass", "contrabass"),
  ampSpeaker: asset(ampSpeakerRaw, "stage-amp-speaker", "ampSpeaker"),
  snareA: assetWithPaddedViewBox(SMALL_PERCUSSION_SVG_SOURCES.snareA, "stage-snare-drum-a", "snareDrum"),
  snareB: assetForIdWithPaddedViewBox(SMALL_PERCUSSION_SVG_SOURCES.snareB, "stage-snare-drum-b", "stage-open-template/snare-drum-b"),
  suspendedCymbalAG: assetWithPaddedViewBox(SMALL_PERCUSSION_SVG_SOURCES.suspendedCymbalAG, "stage-suspended-cymbal-ag", "suspendedCymbal"),
  suspendedCymbalAW: assetForIdWithPaddedViewBox(SMALL_PERCUSSION_SVG_SOURCES.suspendedCymbalAW, "stage-suspended-cymbal-aw", "stage-open-template/suspended-cymbal-aw"),
  crashCymbalPair: asset(SMALL_PERCUSSION_SVG_SOURCES.crashCymbalPair, "stage-crash-cymbal-pair", "crashCymbalPair"),
  gongTamTamAG: asset(gongTamTamAgRaw, "stage-gong-tam-tam-ag", "gongTamTamAG"),
  gongTamTamAW: assetForId(gongTamTamAwRaw, "stage-gong-tam-tam-aw", "stage-open-template/gong-tam-tam-aw"),
  conga2AG: asset(SMALL_PERCUSSION_SVG_SOURCES.congaAG, "stage-conga-2-ag", "conga2"),
  conga2AW: assetForId(SMALL_PERCUSSION_SVG_SOURCES.congaAW, "stage-conga-2-aw", "stage-open-template/conga-2-aw"),
  conga2B: assetForId(SMALL_PERCUSSION_SVG_SOURCES.congaB, "stage-conga-2-b", "stage-open-template/conga-2-b"),
  bongoA: assetWithPaddedViewBox(SMALL_PERCUSSION_SVG_SOURCES.bongoA, "stage-bongo-a", "bongo"),
  bongoB: assetForIdWithPaddedViewBox(SMALL_PERCUSSION_SVG_SOURCES.bongoB, "stage-bongo-b", "stage-open-template/bongo-b"),
  windChime: asset(SMALL_PERCUSSION_SVG_SOURCES.windChime, "stage-wind-chime", "windChime"),
} as const;
