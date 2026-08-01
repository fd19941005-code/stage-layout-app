// 初期オブジェクトプリセット(付録A)。
// 寸法は標準初期値。サイズ変更可否はObjectPreset.resizableを正本とする(FR-044)。
// 高さHはPhase 5で使用するが、Phase 0から定義に含める(FR-046)。

import type { InstrumentLabelLanguage, ObjectType, SceneObject, ShapeKind } from "../types/project";
import { instrumentBodyMasterForPreset } from "./instrumentCatalog";

export interface ObjectPreset {
  id: string;
  category: string;
  name: string;
  labelEn?: string;
  type: ObjectType;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  shape: ShapeKind;
  /** 幅・奥行きの数値編集可否。プリセット定義を唯一の正本とする。 */
  resizable: boolean;
  /** trueは配置時に複数の子オブジェクトへ展開する固定グループ。 */
  /** InstrumentPreset display labels are explicit catalog data. */
  labelJa?: string;
  labelEnShort?: string;
  /** Group preset expands into fixed child objects. */
  isGroupPreset?: boolean;
}

/** 打楽器の並び替えにだけ使う内部分類。UIのカテゴリ名はすべて「打楽器」のまま。 */
export interface PercussionLibraryGroup {
  id: "drums" | "metal" | "keyboard";
  presetIds: readonly string[];
}

/** 表示上のカテゴリは分けず、ライブラリ内の並び順だけを安定させる。 */
export const PERCUSSION_LIBRARY_GROUPS: readonly PercussionLibraryGroup[] = [
  {
    id: "drums",
    presetIds: [
      "drum-set-compact",
      "drum-set-standard",
      "drum-set-large",
      "timpani-set-4",
      "timpani-23",
      "timpani-26",
      "timpani-29",
      "timpani-32",
      "bass-drum",
      "snare-drum",
      "concert-tom-set-4",
      "conga-2",
      "bongo",
    ],
  },
  {
    id: "metal",
    presetIds: [
      "suspended-cymbal",
      "crash-cymbal-pair",
      "gong-tam-tam",
      "wind-chime",
    ],
  },
  {
    id: "keyboard",
    presetIds: [
      "marimba-5oct",
      "marimba-4oct",
      "vibraphone-standard",
      "xylophone-concert",
      "glockenspiel-concert",
      "tubular-bells-concert",
    ],
  },
];

export type InstrumentPreset = ObjectPreset & {
  type: "instrument";
  labelJa: string;
  labelEnShort: string;
};

/** 山台の段高プリセット(FR-046) */
export const RISER_HEIGHTS_MM = [150, 300, 450, 600] as const;

/** 校正距離プリセット(FR-021) */
export const CALIBRATION_DISTANCE_PRESETS_MM = [910, 1820, 900, 1800, 1000] as const;

/** 椅子1脚と譜面台1台をまとめて置くセットの識別子と標準間隔。 */
export const CHAIR_MUSIC_STAND_SET_PRESET_ID = "chair-music-stand-set";
export const CHAIR_MUSIC_STAND_SET_GAP_MM = 100;
export const CHAIR_MUSIC_STAND_SET_BOUNDS_MM = { widthMm: 480, depthMm: 1000 } as const;

export const INSTRUMENT_EN_SHORT_LABELS: Readonly<Record<string, string>> = {
  "concert-tom-16": "Tom",
  "concert-tom-14": "Tom",
  "concert-tom-12": "Tom",
  "concert-tom-10": "Tom",
  "concert-tom-set-4": "Tom Set",
  "grand-piano-full": "GP Full",
  "grand-piano-semi": "GP Semi",
  "upright-piano": "UP",
  celesta: "Cel.",
  "timpani-23": "Timp 23",
  "timpani-26": "Timp 26",
  "timpani-29": "Timp 29",
  "timpani-32": "Timp 32",
  "timpani-set-4": "Timp Set",
  "marimba-5oct": "Mar.",
  "marimba-4oct": "Mar.",
  marimba: "Mar.",
  "bass-drum": "BD",
  "vibraphone-standard": "Vib.",
  vibraphone: "Vib.",
  "xylophone-concert": "Xyl.",
  xylophone: "Xyl.",
  "glockenspiel-concert": "Glock.",
  "tubular-bells-concert": "Tub. Bells",
  chimes: "Tub. Bells",
  "snare-drum": "Snare",
  "suspended-cymbal": "Susp. Cym.",
  "crash-cymbal-pair": "Crash Cym.",
  "gong-tam-tam": "Gong/Tam-Tam",
  "conga-2": "Conga",
  bongo: "Bongo",
  "wind-chime": "Wind Chime",
  "drum-set-compact": "DS Compact",
  "drum-set-standard": "DS",
  "drum-set-large": "DS Large",
  "drum-set": "Drum Set",
  "legacy-xylophone-glockenspiel": "Xyl./Glock.",
  "legacy-drum-set": "Drum Set",
  "grand-harp-47": "Harp",
  harp: "Harp",
  "amp-speaker": "Amp",
};

function instrumentPreset(
  id: string,
  category: string,
  name: string,
  heightMm: number,
  shape: ShapeKind = "rect",
): InstrumentPreset {
  const body = instrumentBodyMasterForPreset(id);
  const labelEnShort = INSTRUMENT_EN_SHORT_LABELS[id];
  if (!body) throw new Error("Missing instrument body master: " + id);
  if (!labelEnShort) throw new Error("Missing English instrument label: " + id);
  return { id, category, name, labelJa: name, labelEnShort, type: "instrument", widthMm: body.widthMm, depthMm: body.depthMm, heightMm, shape, resizable: false };
}


const INTERNAL_INSTRUMENT_PRESETS: InstrumentPreset[] = [
  instrumentPreset("concert-tom-16", "打楽器", "トムトム", 900, "circle"),
  instrumentPreset("concert-tom-14", "打楽器", "トムトム", 900, "circle"),
  instrumentPreset("concert-tom-12", "打楽器", "トムトム", 900, "circle"),
  instrumentPreset("concert-tom-10", "打楽器", "トムトム", 900, "circle"),
];

/**
 * 校正距離の数値だけでは尺貫法の図面に不慣れな利用者が判断しづらいため、
 * ホール図面での呼び方を併記する。保存データには影響しない表示用関数。
 */
export function calibrationDistanceLabel(distanceMm: number): string {
  if (distanceMm === 910) return "半間・3尺（910mm）";
  if (distanceMm === 1820) return "1間（1820mm）";
  return `${distanceMm}mm`;
}

export const OBJECT_PRESETS: ObjectPreset[] = [
  // 座席・譜面
  { id: "chair", category: "座席・譜面", name: "椅子", type: "chair", widthMm: 450, depthMm: 450, heightMm: 450, shape: "rect", resizable: true },
  { id: "chair-back", category: "座席・譜面", name: "背付き椅子", type: "chair", widthMm: 480, depthMm: 520, heightMm: 800, shape: "rect", resizable: true },
  { id: "piano-bench", category: "座席・譜面", name: "ピアノ椅子", type: "chair", widthMm: 550, depthMm: 330, heightMm: 500, shape: "rect", resizable: true },
  { id: "music-stand", category: "座席・譜面", name: "譜面台", type: "musicStand", widthMm: 480, depthMm: 450, heightMm: 1300, shape: "rect", resizable: true },
  { id: CHAIR_MUSIC_STAND_SET_PRESET_ID, category: "座席・譜面", name: "椅子＋譜面台セット", type: "chair", widthMm: CHAIR_MUSIC_STAND_SET_BOUNDS_MM.widthMm, depthMm: CHAIR_MUSIC_STAND_SET_BOUNDS_MM.depthMm, heightMm: 1300, shape: "rect", resizable: false, isGroupPreset: true },
  { id: "lectern", category: "座席・譜面", name: "演台", type: "podium", widthMm: 600, depthMm: 450, heightMm: 1100, shape: "rect", resizable: true },
  { id: "conductor-stand", category: "座席・譜面", name: "指揮者用譜面台", type: "musicStand", widthMm: 550, depthMm: 500, heightMm: 1300, shape: "rect", resizable: true },
  // 指揮・平台
  { id: "podium", category: "指揮・平台", name: "指揮台", type: "podium", widthMm: 900, depthMm: 900, heightMm: 200, shape: "rect", resizable: true },
  { id: "riser-3x6", category: "指揮・平台", name: "山台(平台)3×6尺", type: "riser", widthMm: 910, depthMm: 1820, heightMm: 300, shape: "rect", resizable: true },
  { id: "riser-4x6", category: "指揮・平台", name: "山台 4×6尺", type: "riser", widthMm: 1220, depthMm: 1820, heightMm: 300, shape: "rect", resizable: true },
  { id: "riser-6x6", category: "指揮・平台", name: "山台 6×6尺", type: "riser", widthMm: 1820, depthMm: 1820, heightMm: 300, shape: "rect", resizable: true },
  { id: "hakouma", category: "指揮・平台", name: "箱馬", type: "riser", widthMm: 300, depthMm: 450, heightMm: 300, shape: "rect", resizable: true },
  { id: "table-long", category: "指揮・平台", name: "長机", type: "shape", widthMm: 1800, depthMm: 450, heightMm: 700, shape: "rect", resizable: true },
  // 鍵盤
  instrumentPreset("grand-piano-full", "鍵盤", "グランドピアノ(フル)", 1020),
  instrumentPreset("grand-piano-semi", "鍵盤", "グランドピアノ(セミ)", 1020),
  instrumentPreset("upright-piano", "鍵盤", "アップライトピアノ", 1250),
  instrumentPreset("celesta", "鍵盤", "チェレスタ", 970),
  // 打楽器
  instrumentPreset("drum-set-compact", "打楽器", "ドラムセット（コンパクト）", 1200),
  instrumentPreset("drum-set-standard", "打楽器", "ドラムセット（標準）", 1200),
  instrumentPreset("drum-set-large", "打楽器", "ドラムセット（大型）", 1200),
  { ...instrumentPreset("timpani-set-4", "打楽器", "ティンパニ 4個セット", 900), isGroupPreset: true },
  instrumentPreset("timpani-23", "打楽器", "ティンパニ 23インチ", 900, "circle"),
  instrumentPreset("timpani-26", "打楽器", "ティンパニ 26\"", 900, "circle"),
  instrumentPreset("timpani-29", "打楽器", "ティンパニ 29\"", 900, "circle"),
  instrumentPreset("timpani-32", "打楽器", "ティンパニ 32インチ", 900, "circle"),
  instrumentPreset("bass-drum", "打楽器", "バスドラム", 1400),
  instrumentPreset("snare-drum", "打楽器", "スネアドラム", 0),
  { ...instrumentPreset("concert-tom-set-4", "打楽器", "トムトム", 900), isGroupPreset: true },
  instrumentPreset("conga-2", "打楽器", "コンガ（2本）", 0),
  instrumentPreset("bongo", "打楽器", "ボンゴ", 0),
  instrumentPreset("suspended-cymbal", "打楽器", "サスペンデッドシンバル", 0),
  instrumentPreset("crash-cymbal-pair", "打楽器", "クラッシュシンバル一対", 0),
  instrumentPreset("gong-tam-tam", "打楽器", "銅鑼／タムタム", 0),
  instrumentPreset("wind-chime", "打楽器", "ウィンドチャイム", 0),
  instrumentPreset("marimba-5oct", "打楽器", "マリンバ（5オクターブ）", 950),
  instrumentPreset("marimba-4oct", "打楽器", "マリンバ（4オクターブ）", 950),
  instrumentPreset("vibraphone-standard", "打楽器", "ヴィブラフォン", 950),
  instrumentPreset("xylophone-concert", "打楽器", "シロフォン", 950),
  instrumentPreset("glockenspiel-concert", "打楽器", "グロッケンシュピール", 950),
  instrumentPreset("tubular-bells-concert", "打楽器", "チャイム", 1900),
  // 大型弦・他
  instrumentPreset("grand-harp-47", "大型弦・他", "ハープ", 1800),
  { id: "contrabass-stool", category: "大型弦・他", name: "コントラバス用椅子(占有域)", type: "chair", widthMm: 900, depthMm: 1200, heightMm: 1900, shape: "rect", resizable: true },
  instrumentPreset("amp-speaker", "大型弦・他", "アンプ/スピーカー", 600),
  // 汎用
  { id: "generic-rect", category: "汎用", name: "長方形(任意寸法)", type: "shape", widthMm: 1000, depthMm: 1000, heightMm: 0, shape: "rect", resizable: true },
  { id: "generic-circle", category: "汎用", name: "円(任意径)", type: "shape", widthMm: 1000, depthMm: 1000, heightMm: 0, shape: "circle", resizable: true },
];

export function findPreset(id: string): ObjectPreset | undefined {
  return OBJECT_PRESETS.find((p) => p.id === id) ?? INTERNAL_INSTRUMENT_PRESETS.find((p) => p.id === id);
}

export function instrumentLabelForPreset(presetId: string | null, language: InstrumentLabelLanguage): string | null {
  if (!presetId) return null;
  const preset = findPreset(presetId);
  if (preset?.type === "instrument" && preset.labelJa && preset.labelEnShort) {
    return language === "enShort" ? preset.labelEnShort : preset.labelJa;
  }
  return language === "enShort" ? INSTRUMENT_EN_SHORT_LABELS[presetId] ?? null : null;
}

export function isPresetResizable(presetId: string | null): boolean {
  return presetId !== null && findPreset(presetId)?.resizable === true;
}

/**
 * 保存済みの未知楽器は寸法を勝手に標準化しないため固定扱いにする。
 * presetIdがない注釈・旧汎用オブジェクトは従来どおり数値編集できる。
 */
export function isObjectResizable(object: Pick<SceneObject, "presetId" | "type">): boolean {
  return object.presetId === null ? object.type !== "instrument" : isPresetResizable(object.presetId);
}

export const PRESET_CATEGORIES: string[] = [
  ...new Set(OBJECT_PRESETS.map((p) => p.category)),
];
