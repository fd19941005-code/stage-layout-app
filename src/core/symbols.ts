import { STAGE_OPEN_TEMPLATE_ASSETS, type StageOpenTemplateAsset } from "./stageOpenTemplateSymbols";

// 配置物の上面図シンボル定義。
// 寸法・位置・回転はSceneObjectのmm値を正本とし、ここでは表示用の
// 1000 x 1000座標系だけを定義する。SVGのsymbol/useで画面と出力へ共有する。

export const SYMBOL_VIEW_BOX = "0 0 1000 1000";

export type SymbolPaint = "body" | "detail" | "solid";

export type SymbolNode =
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number; paint?: SymbolPaint }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; paint?: SymbolPaint }
  | { kind: "circle"; cx: number; cy: number; r: number; paint?: SymbolPaint }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; paint?: SymbolPaint }
  | { kind: "polyline"; points: readonly { x: number; y: number }[]; paint?: SymbolPaint }
  | { kind: "path"; d: string; paint?: SymbolPaint };

export interface SymbolDefinition {
  id: string;
  nodes: readonly SymbolNode[];
  viewBox?: string;
  rawSvg?: string;
  preserveAspectRatio?: "none" | "xMidYMid meet";
}

/** React描画とSVG文字列描画で共通に使う塗り・線属性。 */
export function symbolPaintProps(paint: SymbolPaint = "detail") {
  if (paint === "body") {
    return {
      fill: "currentColor",
      fillOpacity: "var(--symbol-body-opacity, 0.10)",
      stroke: "currentColor",
      strokeWidth: "var(--symbol-stroke-width, 16)",
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };
  }
  if (paint === "solid") {
    return {
      fill: "currentColor",
      fillOpacity: "var(--symbol-solid-opacity, 0.24)",
      stroke: "currentColor",
      strokeWidth: "var(--symbol-stroke-width, 16)",
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };
  }
  return {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "var(--symbol-detail-stroke-width, 13)",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function rect(x: number, y: number, width: number, height: number, paint: SymbolPaint = "detail", rx?: number): SymbolNode {
  return { kind: "rect", x, y, width, height, paint, ...(rx === undefined ? {} : { rx }) };
}

function ellipse(cx: number, cy: number, rx: number, ry: number, paint: SymbolPaint = "detail"): SymbolNode {
  return { kind: "ellipse", cx, cy, rx, ry, paint };
}

function circle(cx: number, cy: number, r: number, paint: SymbolPaint = "detail"): SymbolNode {
  return { kind: "circle", cx, cy, r, paint };
}

function line(x1: number, y1: number, x2: number, y2: number, paint: SymbolPaint = "detail"): SymbolNode {
  return { kind: "line", x1, y1, x2, y2, paint };
}

function path(d: string, paint: SymbolPaint = "detail"): SymbolNode {
  return { kind: "path", d, paint };
}

const chair: SymbolDefinition = {
  id: "stage-symbol-chair",
  nodes: [
    // 四角い座面と背の二重線で、縮小時も「椅子」と判別できる形にする。
    rect(145, 135, 710, 730, "body", 42),
    rect(220, 205, 560, 230, "solid", 28),
    line(220, 500, 780, 500),
    line(300, 865, 245, 940),
    line(700, 865, 755, 940),
    line(390, 865, 350, 940),
    line(610, 865, 650, 940),
  ],
};

const chairBack: SymbolDefinition = {
  id: "stage-symbol-chair-back",
  nodes: [
    rect(125, 105, 750, 780, "body", 46),
    rect(195, 170, 610, 270, "solid", 32),
    line(195, 510, 805, 510),
    line(280, 875, 230, 950),
    line(720, 875, 770, 950),
  ],
};

const pianoBench: SymbolDefinition = {
  id: "stage-symbol-piano-bench",
  nodes: [
    rect(120, 260, 760, 300, "body", 50),
    line(190, 330, 810, 330),
    line(220, 600, 220, 850),
    line(780, 600, 780, 850),
    line(220, 850, 780, 850),
  ],
};

const musicStand: SymbolDefinition = {
  id: "stage-symbol-music-stand",
  nodes: [
    path("M150 120 L850 120 L720 470 L280 470 Z", "body"),
    line(500, 470, 500, 820),
    line(380, 860, 620, 860),
    line(410, 820, 590, 820),
  ],
};

const lectern: SymbolDefinition = {
  id: "stage-symbol-lectern",
  nodes: [
    path("M120 100 L880 100 L760 570 L240 570 Z", "body"),
    line(500, 570, 500, 850),
    rect(240, 850, 520, 55, "solid", 18),
  ],
};

const podium: SymbolDefinition = {
  id: "stage-symbol-podium",
  nodes: [
    rect(70, 70, 860, 860, "body", 24),
    rect(150, 150, 700, 700, "detail", 18),
    line(500, 150, 500, 850),
    line(150, 500, 850, 500),
  ],
};

const riser: SymbolDefinition = {
  id: "stage-symbol-riser",
  nodes: [
    rect(25, 25, 950, 950, "body", 12),
    rect(65, 65, 870, 870, "detail", 8),
    line(65, 65, 935, 935),
    line(935, 65, 65, 935),
    line(500, 65, 500, 935),
  ],
};

const table: SymbolDefinition = {
  id: "stage-symbol-table",
  nodes: [
    rect(35, 170, 930, 660, "body", 24),
    line(80, 500, 920, 500),
    line(500, 170, 500, 830),
  ],
};

const grandPiano: SymbolDefinition = {
  id: "stage-symbol-grand-piano",
  nodes: [
    path("M105 105 L390 105 C605 110 835 225 915 425 C1000 640 865 845 635 895 L105 895 Z", "body"),
    path("M390 235 C605 255 795 360 855 500 C905 620 820 770 635 820", "detail"),
    path("M390 235 L390 760 Q515 800 635 820", "detail"),
    rect(105, 105, 300, 135, "solid", 10),
    line(155, 105, 155, 240),
    line(205, 105, 205, 240),
    line(255, 105, 255, 240),
    line(305, 105, 305, 240),
    line(355, 105, 355, 240),
    ...Array.from({ length: 7 }, (_, index) => rect(180 + index * 31, 105, 15, 72, "solid", 2)),
    line(430, 350, 470, 375),
    line(470, 375, 488, 438),
    line(525, 805, 500, 900),
    line(740, 785, 770, 880),
    ellipse(430, 875, 28, 12, "solid"),
    ellipse(505, 875, 28, 12, "solid"),
    ellipse(580, 870, 28, 12, "solid"),
  ],
};

const uprightPiano: SymbolDefinition = {
  id: "stage-symbol-upright-piano",
  nodes: [
    rect(45, 110, 910, 780, "body", 22),
    rect(120, 110, 760, 150, "solid", 8),
    line(190, 110, 190, 260),
    line(260, 110, 260, 260),
    line(330, 110, 330, 260),
    line(400, 110, 400, 260),
    line(470, 110, 470, 260),
    line(540, 110, 540, 260),
    line(610, 110, 610, 260),
    line(680, 110, 680, 260),
    line(750, 110, 750, 260),
    line(820, 110, 820, 260),
    ...Array.from({ length: 8 }, (_, index) => rect(220 + index * 75, 165, 22, 65, "solid", 2)),
    line(100, 750, 900, 750),
    line(180, 790, 180, 890),
    line(820, 790, 820, 890),
  ],
};

const celesta: SymbolDefinition = {
  id: "stage-symbol-celesta",
  nodes: [
    rect(80, 180, 840, 650, "body", 20),
    rect(140, 180, 720, 145, "solid", 8),
    line(220, 180, 220, 325),
    line(300, 180, 300, 325),
    line(380, 180, 380, 325),
    line(460, 180, 460, 325),
    line(540, 180, 540, 325),
    line(620, 180, 620, 325),
    line(700, 180, 700, 325),
    line(780, 180, 780, 325),
    ...Array.from({ length: 7 }, (_, index) => rect(250 + index * 75, 205, 22, 65, "solid", 2)),
    line(150, 720, 850, 720),
    line(180, 760, 180, 880),
    line(820, 760, 820, 880),
  ],
};

const timpani: SymbolDefinition = {
  id: "stage-symbol-timpani",
  nodes: [
    ellipse(500, 465, 360, 350, "body"),
    ellipse(500, 410, 300, 275, "detail"),
    ellipse(500, 410, 315, 290, "detail"),
    circle(500, 410, 25, "solid"),
    line(250, 410, 750, 410),
    line(315, 265, 685, 265),
    line(500, 720, 500, 865),
    line(390, 865, 610, 865),
    line(410, 720, 350, 840),
    line(590, 720, 650, 840),
  ],
};

function keyboardBars(y: number, width: number, count: number): SymbolNode[] {
  return Array.from({ length: count - 1 }, (_, index) => {
    const x = 100 + (width * (index + 1)) / count;
    return line(x, y, x, y + 110);
  });
}

const marimba: SymbolDefinition = {
  id: "stage-symbol-marimba",
  nodes: [
    rect(70, 150, 860, 690, "body", 26),
    rect(105, 170, 790, 145, "solid", 8),
    ...keyboardBars(170, 790, 12),
    path("M170 390 Q300 520 430 390 M570 390 Q700 520 830 390", "detail"),
    line(160, 530, 840, 530),
    line(500, 330, 500, 700),
    line(150, 760, 150, 890),
    line(850, 760, 850, 890),
    line(250, 760, 250, 890),
    line(750, 760, 750, 890),
  ],
};

const keyboardPercussion: SymbolDefinition = {
  id: "stage-symbol-keyboard-percussion",
  nodes: [
    rect(70, 160, 860, 640, "body", 26),
    rect(110, 180, 780, 145, "solid", 8),
    ...keyboardBars(180, 780, 10),
    ...Array.from({ length: 7 }, (_, index) => rect(245 + index * 75, 190, 22, 65, "solid", 2)),
    line(150, 500, 850, 500),
    line(180, 650, 820, 650),
    line(180, 800, 180, 900),
    line(820, 800, 820, 900),
  ],
};

const bassDrum: SymbolDefinition = {
  id: "stage-symbol-bass-drum",
  nodes: [
    ellipse(500, 465, 420, 320, "body"),
    ellipse(500, 465, 300, 225, "detail"),
    ellipse(500, 465, 340, 260, "detail"),
    line(170, 465, 830, 465),
    line(500, 145, 500, 785),
    line(220, 300, 780, 630),
    line(780, 300, 220, 630),
    line(500, 785, 500, 890),
  ],
};

const vibraphone: SymbolDefinition = {
  id: "stage-symbol-vibraphone",
  nodes: [
    rect(65, 150, 870, 680, "body", 26),
    rect(105, 175, 790, 145, "solid", 8),
    ...keyboardBars(175, 790, 13),
    ...Array.from({ length: 8 }, (_, index) => rect(235 + index * 70, 190, 22, 65, "solid", 2)),
    line(150, 445, 850, 445),
    line(170, 590, 830, 590),
    line(180, 790, 180, 900),
    line(820, 790, 820, 900),
    line(500, 790, 500, 900),
  ],
};

const chimes: SymbolDefinition = {
  id: "stage-symbol-chimes",
  nodes: [
    rect(150, 80, 700, 840, "body", 18),
    line(220, 180, 220, 760),
    line(300, 140, 300, 760),
    line(380, 180, 380, 760),
    line(460, 140, 460, 760),
    line(540, 180, 540, 760),
    line(620, 140, 620, 760),
    line(700, 180, 700, 760),
    line(780, 140, 780, 760),
    line(230, 820, 770, 820),
  ],
};

const drumSet: SymbolDefinition = {
  id: "stage-symbol-drum-set",
  nodes: [
    circle(305, 580, 205, "body"),
    circle(305, 580, 125, "detail"),
    circle(570, 470, 105, "solid"),
    circle(760, 580, 105, "solid"),
    circle(540, 235, 92, "solid"),
    circle(800, 230, 80, "solid"),
    ellipse(500, 95, 220, 42, "detail"),
    ellipse(820, 390, 150, 35, "detail"),
    line(305, 580, 540, 470),
    line(305, 580, 760, 580),
    line(305, 580, 500, 95),
    line(570, 470, 540, 235),
    line(540, 235, 500, 95),
    line(760, 580, 820, 390),
    line(500, 700, 500, 900),
    line(430, 900, 570, 900),
    line(245, 750, 180, 900),
    line(365, 750, 430, 900),
  ],
};

const harp: SymbolDefinition = {
  id: "stage-symbol-harp",
  nodes: [
    path("M160 870 L285 170 Q330 110 390 145 L850 870 Z", "body"),
    path("M350 210 Q490 300 760 820", "detail"),
    ...Array.from({ length: 9 }, (_, index) => {
      const x = 380 + index * 42;
      return line(x, 260 + index * 18, x + 220, 820);
    }),
    line(160, 870, 850, 870),
  ],
};

const contrabass: SymbolDefinition = {
  id: "stage-symbol-contrabass",
  nodes: [
    path("M500 100 L535 100 L555 300 C670 370 700 540 610 650 C575 695 575 760 610 850 L390 850 C425 760 425 695 390 650 C300 540 330 370 445 300 L465 100 Z", "body"),
    line(500, 110, 500, 820),
    ellipse(500, 500, 65, 95, "detail"),
    line(430, 850, 570, 850),
  ],
};

const ampSpeaker: SymbolDefinition = {
  id: "stage-symbol-amp-speaker",
  nodes: [
    rect(110, 80, 780, 840, "body", 20),
    rect(180, 170, 640, 650, "detail", 12),
    circle(500, 405, 190, "detail"),
    circle(500, 405, 80, "detail"),
    line(250, 720, 750, 720),
  ],
};

function withStageAsset(definition: SymbolDefinition, asset: StageOpenTemplateAsset): SymbolDefinition {
  return { ...definition, nodes: [], viewBox: asset.viewBox, rawSvg: asset.rawSvg, preserveAspectRatio: "xMidYMid meet" };
}

function namedStageAssetSymbol(id: string, asset: StageOpenTemplateAsset): SymbolDefinition {
  return { id, nodes: [], viewBox: asset.viewBox, rawSvg: asset.rawSvg, preserveAspectRatio: "xMidYMid meet" };
}

const stageChair = withStageAsset(chair, STAGE_OPEN_TEMPLATE_ASSETS.chair);
const stageChairBack = withStageAsset(chairBack, STAGE_OPEN_TEMPLATE_ASSETS.chairBack);
const stagePianoBench = withStageAsset(pianoBench, STAGE_OPEN_TEMPLATE_ASSETS.pianoBench);
const stageMusicStand = withStageAsset(musicStand, STAGE_OPEN_TEMPLATE_ASSETS.musicStand);
const stageLectern = withStageAsset(lectern, STAGE_OPEN_TEMPLATE_ASSETS.lectern);
const stageConductorStand = namedStageAssetSymbol("stage-symbol-conductor-stand", STAGE_OPEN_TEMPLATE_ASSETS.conductorStand);
const stagePodium = withStageAsset(podium, STAGE_OPEN_TEMPLATE_ASSETS.podium);
const stageRiser3x6 = withStageAsset(riser, STAGE_OPEN_TEMPLATE_ASSETS.riser3x6);
const stageRiser4x6 = namedStageAssetSymbol("stage-symbol-riser-4x6", STAGE_OPEN_TEMPLATE_ASSETS.riser4x6);
const stageRiser6x6 = namedStageAssetSymbol("stage-symbol-riser-6x6", STAGE_OPEN_TEMPLATE_ASSETS.riser6x6);
const stageHakouma = namedStageAssetSymbol("stage-symbol-hakouma", STAGE_OPEN_TEMPLATE_ASSETS.hakouma);
const stageTable = withStageAsset(table, STAGE_OPEN_TEMPLATE_ASSETS.table);
const stageGrandPiano = withStageAsset(grandPiano, STAGE_OPEN_TEMPLATE_ASSETS.grandPianoFull);
const stageGrandPianoSemi = namedStageAssetSymbol("stage-symbol-grand-piano-semi", STAGE_OPEN_TEMPLATE_ASSETS.grandPianoSemi);
const stageUprightPiano = withStageAsset(uprightPiano, STAGE_OPEN_TEMPLATE_ASSETS.uprightPiano);
const stageCelesta = withStageAsset(celesta, STAGE_OPEN_TEMPLATE_ASSETS.celesta);
const stageMarimba = withStageAsset(marimba, STAGE_OPEN_TEMPLATE_ASSETS.marimba);
const stageKeyboardPercussion = withStageAsset(keyboardPercussion, STAGE_OPEN_TEMPLATE_ASSETS.xylophone);
const stageBassDrum = withStageAsset(bassDrum, STAGE_OPEN_TEMPLATE_ASSETS.bassDrum);
const stageVibraphone = withStageAsset(vibraphone, STAGE_OPEN_TEMPLATE_ASSETS.vibraphone);
const stageChimes = withStageAsset(chimes, STAGE_OPEN_TEMPLATE_ASSETS.chimes);
const stageDrumSet = withStageAsset(drumSet, STAGE_OPEN_TEMPLATE_ASSETS.drumSet);
const stageHarp = withStageAsset(harp, STAGE_OPEN_TEMPLATE_ASSETS.harp);
const stageContrabass = withStageAsset(contrabass, STAGE_OPEN_TEMPLATE_ASSETS.contrabass);
const stageAmpSpeaker = withStageAsset(ampSpeaker, STAGE_OPEN_TEMPLATE_ASSETS.ampSpeaker);
const stageTimpaniSet = namedStageAssetSymbol("stage-symbol-timpani-set", STAGE_OPEN_TEMPLATE_ASSETS.timpaniSet);

export const SYMBOL_DEFINITIONS: readonly SymbolDefinition[] = [
  stageChair,
  stageChairBack,
  stagePianoBench,
  stageMusicStand,
  stageLectern,
  stageConductorStand,
  stagePodium,
  stageRiser3x6,
  stageRiser4x6,
  stageRiser6x6,
  stageHakouma,
  stageTable,
  stageGrandPiano,
  stageGrandPianoSemi,
  stageUprightPiano,
  stageCelesta,
  timpani,
  stageTimpaniSet,
  stageMarimba,
  stageKeyboardPercussion,
  stageBassDrum,
  stageVibraphone,
  stageChimes,
  stageDrumSet,
  stageHarp,
  stageContrabass,
  stageAmpSpeaker,
];

const PRESET_SYMBOL_IDS: Readonly<Record<string, string>> = {
  chair: chair.id,
  "chair-back": chairBack.id,
  "piano-bench": pianoBench.id,
  "music-stand": musicStand.id,
  "conductor-stand": stageConductorStand.id,
  lectern: lectern.id,
  podium: podium.id,
  "riser-3x6": stageRiser3x6.id,
  "riser-4x6": stageRiser4x6.id,
  "riser-6x6": stageRiser6x6.id,
  hakouma: stageHakouma.id,
  "table-long": table.id,
  "grand-piano-full": stageGrandPiano.id,
  "grand-piano-semi": stageGrandPianoSemi.id,
  "upright-piano": uprightPiano.id,
  celesta: celesta.id,
  "timpani-23": timpani.id,
  "timpani-26": timpani.id,
  "timpani-29": timpani.id,
  "timpani-32": timpani.id,
  "timpani-set-4": stageTimpaniSet.id,
  marimba: marimba.id,
  "bass-drum": bassDrum.id,
  vibraphone: vibraphone.id,
  xylophone: stageKeyboardPercussion.id,
  chimes: chimes.id,
  "drum-set": drumSet.id,
  harp: harp.id,
  "contrabass-stool": contrabass.id,
  "amp-speaker": ampSpeaker.id,
};

const SYMBOL_BY_ID = new Map(SYMBOL_DEFINITIONS.map((definition) => [definition.id, definition]));

/** 既存SceneObjectのpresetIdから表示用シンボルIDを得る。汎用図形はnull。 */
export function symbolIdForPreset(presetId: string | null): string | null {
  if (!presetId) return null;
  const symbolId = PRESET_SYMBOL_IDS[presetId];
  return symbolId && SYMBOL_BY_ID.has(symbolId) ? symbolId : null;
}

export function getSymbolDefinition(symbolId: string): SymbolDefinition | undefined {
  return SYMBOL_BY_ID.get(symbolId);
}

const PRESET_SYMBOL_LABELS: Readonly<Record<string, string>> = {
  "chair": "椅子",
  "chair-back": "背付椅子",
  "piano-bench": "ピアノ椅子",
  "music-stand": "譜面台",
  "conductor-stand": "指揮者台",
  "lectern": "演台",
  "podium": "指揮台",
  "riser-3x6": "平台",
  "riser-4x6": "平台",
  "riser-6x6": "平台",
  "hakouma": "箱馬",
  "table-long": "長机",
  "grand-piano-full": "ピアノ",
  "grand-piano-semi": "ピアノ",
  "upright-piano": "アップライト",
  "celesta": "チェレスタ",
  "timpani-23": "ティンパニ\n23\"",
  "timpani-26": "ティンパニ\n26\"",
  "timpani-29": "ティンパニ\n29\"",
  "timpani-32": "ティンパニ\n32\"",
  "timpani-set-4": "ティンパニ\n4個セット",
  "marimba": "マリンバ",
  "bass-drum": "バスドラム",
  "vibraphone": "ヴィブラフォン",
  "xylophone": "シロフォン",
  "chimes": "チャイム",
  "drum-set": "ドラムセット",
  "harp": "ハープ",
  "contrabass-stool": "コントラバス",
  "amp-speaker": "アンプ"
};

/** シンボル内に収めるための短い既定名。任意ラベルは原文を優先する。 */
export function symbolLabelForPreset(presetId: string | null, fallback: string, custom = false): string {
  const value = fallback.trim();
  if (custom && value) return value;
  return PRESET_SYMBOL_LABELS[presetId ?? ""] ?? value;
}

export interface SymbolLabelLayout {
  lines: string[];
  fontSizeMm: number;
  lineHeightMm: number;
}

function symbolLabelWidthUnits(value: string): number {
  return [...value].reduce((total, character) => {
    if (/\s/.test(character)) return total + 0.45;
    if (/[A-Za-z0-9]/.test(character)) return total + 0.65;
    return total + 1;
  }, 0);
}

/** ラベルが実寸フットプリント内に収まる場合だけ内側表示する。 */
export function getSymbolLabelLayout(
  value: string,
  widthMm: number,
  depthMm: number,
  preferredFontSizeMm: number,
): SymbolLabelLayout | null {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0 || !Number.isFinite(widthMm) || !Number.isFinite(depthMm)) return null;
  const availableWidthMm = Math.max(1, widthMm) * 0.78;
  const availableHeightMm = Math.max(1, depthMm) * 0.42;
  const longestLineUnits = Math.max(...lines.map(symbolLabelWidthUnits), 1);
  const preferred = Number.isFinite(preferredFontSizeMm) ? Math.min(600, Math.max(80, preferredFontSizeMm)) : 160;
  const widthFit = availableWidthMm / (longestLineUnits * 0.92);
  const heightFit = availableHeightMm / (lines.length * 1.2);
  const fontSizeMm = Math.min(preferred, widthFit, heightFit);
  if (fontSizeMm < 76) return null;
  return {
    lines,
    fontSizeMm,
    lineHeightMm: fontSizeMm * 1.2,
  };
}

function svgPaintAttributes(paint: SymbolPaint = "detail"): string {
  const props = symbolPaintProps(paint);
  return `fill="${props.fill}"${props.fillOpacity === undefined ? "" : ` fill-opacity="${props.fillOpacity}"`} stroke="${props.stroke}" stroke-width="${props.strokeWidth}" stroke-linecap="${props.strokeLinecap}" stroke-linejoin="${props.strokeLinejoin}"`;
}

function renderSymbolNodeSvg(node: SymbolNode): string {
  const paint = svgPaintAttributes(node.paint);
  switch (node.kind) {
    case "rect":
      return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}"${node.rx === undefined ? "" : ` rx="${node.rx}"`} ${paint} />`;
    case "ellipse":
      return `<ellipse cx="${node.cx}" cy="${node.cy}" rx="${node.rx}" ry="${node.ry}" ${paint} />`;
    case "circle":
      return `<circle cx="${node.cx}" cy="${node.cy}" r="${node.r}" ${paint} />`;
    case "line":
      return `<line x1="${node.x1}" y1="${node.y1}" x2="${node.x2}" y2="${node.y2}" ${paint} />`;
    case "polyline":
      return `<polyline points="${node.points.map((point) => `${point.x},${point.y}`).join(" ")}" ${paint} />`;
    case "path":
      return `<path d="${node.d}" ${paint} />`;
  }
}

/** 出力SVGのdefsへ埋め込むシンボル定義。外部URLは参照しない。 */
export function renderSymbolDefinitionsSvg(): string {
  return SYMBOL_DEFINITIONS
    .map((definition) => {
      const content = definition.rawSvg ?? definition.nodes.map(renderSymbolNodeSvg).join("");
      return `<symbol id="${definition.id}" viewBox="${definition.viewBox ?? SYMBOL_VIEW_BOX}" preserveAspectRatio="${definition.preserveAspectRatio ?? "none"}">${content}</symbol>`;
    })
    .join("");
}

export function renderSymbolUseSvg(symbolId: string, widthMm: number, depthMm: number): string {
  return `<use class="symbol-use" href="#${symbolId}" x="${-widthMm / 2}" y="${-depthMm / 2}" width="${widthMm}" height="${depthMm}" />`;
}
