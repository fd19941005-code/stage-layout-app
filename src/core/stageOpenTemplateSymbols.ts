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
import grandPianoFullRaw from "../assets/stage-open-template/grand-piano-full.svg?raw";
import grandPianoSemiRaw from "../assets/stage-open-template/grand-piano-semi.svg?raw";
import uprightPianoRaw from "../assets/stage-open-template/upright-piano.svg?raw";
import celestaRaw from "../assets/stage-open-template/celesta.svg?raw";
import timpaniSetRaw from "../assets/stage-open-template/timpani-set.svg?raw";
import marimbaRaw from "../assets/stage-open-template/marimba.svg?raw";
import bassDrumRaw from "../assets/stage-open-template/bass-drum.svg?raw";
import vibraphoneRaw from "../assets/stage-open-template/vibraphone.svg?raw";
import xylophoneRaw from "../assets/stage-open-template/xylophone.svg?raw";
import chimesRaw from "../assets/stage-open-template/chimes.svg?raw";
import drumSetRaw from "../assets/stage-open-template/drum-set.svg?raw";
import harpRaw from "../assets/stage-open-template/harp.svg?raw";
import contrabassRaw from "../assets/stage-open-template/contrabass.svg?raw";
import ampSpeakerRaw from "../assets/stage-open-template/amp-speaker.svg?raw";

export interface StageOpenTemplateAsset {
  viewBox: string;
  rawSvg: string;
}

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

function removeElements(source: string, tag: string): string {
  return source
    .replace(new RegExp("<" + tag + "\\b[^>]*>[\\s\\S]*?</" + tag + ">", "gi"), "")
    .replace(new RegExp("<" + tag + "\\b[^>]*/>", "gi"), "");
}

/**
 * The source SVGs contain local symbols and English annotations. Normalize them
 * before placing several assets in one shared defs block.
 */
export function normalizeStageOpenTemplateSvg(raw: string, prefix: string): StageOpenTemplateAsset {
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

  return { viewBox: sourceViewBox(openTag), rawSvg: body.trim() };
}

function asset(raw: string, prefix: string): StageOpenTemplateAsset {
  return normalizeStageOpenTemplateSvg(raw, prefix);
}

export const STAGE_OPEN_TEMPLATE_ASSETS = {
  chair: asset(chairRaw, "stage-chair"),
  chairBack: asset(chairBackRaw, "stage-chair-back"),
  pianoBench: asset(pianoBenchRaw, "stage-piano-bench"),
  musicStand: asset(musicStandRaw, "stage-music-stand"),
  lectern: asset(lecternRaw, "stage-lectern"),
  conductorStand: asset(conductorStandRaw, "stage-conductor-stand"),
  podium: asset(podiumRaw, "stage-podium"),
  riser3x6: asset(riser3x6Raw, "stage-riser-3x6"),
  riser4x6: asset(riser4x6Raw, "stage-riser-4x6"),
  riser6x6: asset(riser6x6Raw, "stage-riser-6x6"),
  hakouma: asset(hakoumaRaw, "stage-hakouma"),
  table: asset(tableRaw, "stage-table"),
  grandPianoFull: asset(grandPianoFullRaw, "stage-grand-piano-full"),
  grandPianoSemi: asset(grandPianoSemiRaw, "stage-grand-piano-semi"),
  uprightPiano: asset(uprightPianoRaw, "stage-upright-piano"),
  celesta: asset(celestaRaw, "stage-celesta"),
  timpaniSet: asset(timpaniSetRaw, "stage-timpani-set"),
  marimba: asset(marimbaRaw, "stage-marimba"),
  bassDrum: asset(bassDrumRaw, "stage-bass-drum"),
  vibraphone: asset(vibraphoneRaw, "stage-vibraphone"),
  xylophone: asset(xylophoneRaw, "stage-xylophone"),
  chimes: asset(chimesRaw, "stage-chimes"),
  drumSet: asset(drumSetRaw, "stage-drum-set"),
  harp: asset(harpRaw, "stage-harp"),
  contrabass: asset(contrabassRaw, "stage-contrabass"),
  ampSpeaker: asset(ampSpeakerRaw, "stage-amp-speaker"),
} as const;
