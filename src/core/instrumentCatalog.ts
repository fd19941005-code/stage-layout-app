import type { DimensionBasis, DimensionStatus } from "./symbolAssets";

/**
 * 楽器本体の実寸マスター。
 *
 * ここで扱う幅・奥行き・直径は、奏者の余白や運搬時の占有域ではなく
 * 楽器本体の外形寸法(mm)です。画面上のpx値は保存せず、SceneObjectの
 * widthMm/depthMmを共通のmm->px変換へ渡して表示します。
 */
export interface InstrumentBodyDimensions {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly diameterMm?: number;
}

export interface InstrumentBodyMaster extends InstrumentBodyDimensions {
  readonly dimensionBasis: DimensionBasis;
  readonly dimensionStatus: DimensionStatus;
  readonly note?: string;
}

export const LEGACY_XYLOPHONE_PRESET_ID = "legacy-xylophone-glockenspiel";
export const LEGACY_DRUM_SET_PRESET_ID = "legacy-drum-set";

function master(
  widthMm: number,
  depthMm: number,
  dimensionBasis: DimensionBasis,
  dimensionStatus: DimensionStatus,
  options: Pick<InstrumentBodyMaster, "diameterMm" | "note"> = {},
): InstrumentBodyMaster {
  return { widthMm, depthMm, dimensionBasis, dimensionStatus, ...options };
}

export function inchesToMillimetres(inches: number): number {
  return Math.round(inches * 25.4);
}

export type TimpaniPresetId = "timpani-23" | "timpani-26" | "timpani-29" | "timpani-32";
export type ConcertTomPresetId = "concert-tom-16" | "concert-tom-14" | "concert-tom-12" | "concert-tom-10";

export const TIMPANI_BODY_MASTERS: Readonly<Record<TimpaniPresetId, InstrumentBodyMaster>> = {
  "timpani-23": master(750, 750, "representative-layout", "representative", { diameterMm: 750 }),
  "timpani-26": master(800, 800, "representative-layout", "representative", { diameterMm: 800 }),
  "timpani-29": master(900, 900, "representative-layout", "representative", { diameterMm: 900 }),
  "timpani-32": master(950, 950, "representative-layout", "representative", { diameterMm: 950 }),
};

export interface TimpaniSetPart {
  readonly presetId: TimpaniPresetId;
  /** セット外接矩形の左上を原点にした、本体中心の座標(mm)。 */
  readonly centerXMm: number;
  readonly centerYMm: number;
}

/**
 * 4個セットは、単体マスターの直径を変えずに配置した構成として定義する。
 * 外接寸法もこのレイアウトから算出するため、別の表示用スケールを持たない。
 */
export const TIMPANI_SET_LAYOUT: readonly TimpaniSetPart[] = [
  // Keep the source SVG's arc: outer drums toward the front, middle drums toward the back.
  // Child diameters remain sourced from TIMPANI_BODY_MASTERS.
  { presetId: "timpani-23", centerXMm: 375, centerYMm: 525 },
  { presetId: "timpani-26", centerXMm: 750, centerYMm: 1230 },
  { presetId: "timpani-29", centerXMm: 1645, centerYMm: 1240 },
  { presetId: "timpani-32", centerXMm: 2275, centerYMm: 475 },
];

function timpaniSetBodySize(): InstrumentBodyMaster {
  const bounds = TIMPANI_SET_LAYOUT.reduce(
    (result, part) => {
      const diameter = TIMPANI_BODY_MASTERS[part.presetId].diameterMm!;
      return {
        minX: Math.min(result.minX, part.centerXMm - diameter / 2),
        minY: Math.min(result.minY, part.centerYMm - diameter / 2),
        maxX: Math.max(result.maxX, part.centerXMm + diameter / 2),
        maxY: Math.max(result.maxY, part.centerYMm + diameter / 2),
      };
    },
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
  return {
    widthMm: Math.ceil(bounds.maxX - bounds.minX),
    depthMm: Math.ceil(bounds.maxY - bounds.minY),
    dimensionBasis: "representative-layout",
    dimensionStatus: "representative",
    note: "4台の単体ティンパニを固定相対座標で配置した外接寸法。",
  };
}

export const TIMPANI_SET_BODY_SIZE = timpaniSetBodySize();

export const CONCERT_TOM_BODY_MASTERS: Readonly<Record<ConcertTomPresetId, InstrumentBodyMaster>> = {
  "concert-tom-16": master(430, 430, "nominal-size-plus-small-margin", "representative", { diameterMm: 430 }),
  "concert-tom-14": master(380, 380, "nominal-size-plus-small-margin", "representative", { diameterMm: 380 }),
  "concert-tom-12": master(330, 330, "nominal-size-plus-small-margin", "representative", { diameterMm: 330 }),
  "concert-tom-10": master(280, 280, "nominal-size-plus-small-margin", "representative", { diameterMm: 280 }),
};

export interface ConcertTomSetPart {
  readonly presetId: ConcertTomPresetId;
  /** セット外接矩形の左上を原点にした、本体中心の座標(mm)。 */
  readonly centerXMm: number;
  readonly centerYMm: number;
}

/** 大小順を保った緩い弧。2×2配置へ戻らないよう固定座標で管理する。 */
export const CONCERT_TOM_SET_LAYOUT: readonly ConcertTomSetPart[] = [
  { presetId: "concert-tom-16", centerXMm: 215, centerYMm: 320 },
  { presetId: "concert-tom-14", centerXMm: 635, centerYMm: 240 },
  { presetId: "concert-tom-12", centerXMm: 1005, centerYMm: 210 },
  { presetId: "concert-tom-10", centerXMm: 1320, centerYMm: 290 },
];

function concertTomSetBodySize(): InstrumentBodyMaster {
  const bounds = CONCERT_TOM_SET_LAYOUT.reduce(
    (result, part) => {
      const diameter = CONCERT_TOM_BODY_MASTERS[part.presetId].diameterMm!;
      return {
        minX: Math.min(result.minX, part.centerXMm - diameter / 2),
        minY: Math.min(result.minY, part.centerYMm - diameter / 2),
        maxX: Math.max(result.maxX, part.centerXMm + diameter / 2),
        maxY: Math.max(result.maxY, part.centerYMm + diameter / 2),
      };
    },
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
  return {
    widthMm: Math.ceil(bounds.maxX - bounds.minX),
    depthMm: Math.ceil(bounds.maxY - bounds.minY),
    dimensionBasis: "representative-layout",
    dimensionStatus: "representative",
    note: "4台の単体コンサートトムを固定相対座標で配置した外接寸法。",
  };
}

export const CONCERT_TOM_SET_BODY_SIZE = concertTomSetBodySize();

/**
 * 楽器プリセットが参照する本体寸法の正本。
 * 個別プリセット側へ数値を複製しないことで、表示・配置・出力の基準を揃える。
 */
export const INSTRUMENT_BODY_MASTERS: Readonly<Record<string, InstrumentBodyMaster>> = {
  "grand-piano-full": master(1600, 2750, "yamaha-reference", "verified-reference"),
  "grand-piano-semi": master(1540, 2120, "yamaha-reference", "verified-reference"),
  "upright-piano": master(1530, 610, "yamaha-reference", "verified-reference"),
  celesta: master(1050, 650, "representative-layout", "representative"),
  ...TIMPANI_BODY_MASTERS,
  "marimba-5oct": master(2610, 1030, "yamaha-reference", "verified-reference"),
  "marimba-4oct": master(2030, 870, "yamaha-reference", "verified-reference", { note: "YAMAHA YM-4100A級（4オクターブ C28〜C76）。" }),
  "bass-drum": master(558.8, 914.4, "nominal-size-plus-small-margin", "representative"),
  "vibraphone-standard": master(1430, 820, "yamaha-reference", "verified-reference"),
  "xylophone-concert": master(1380, 750, "yamaha-reference", "verified-reference"),
  "glockenspiel-concert": master(1062, 564, "yamaha-reference", "verified-reference", { note: "専用グロッケンSVGがないため、表示は既存シロフォンSVGの暫定派生参照。" }),
  "tubular-bells-concert": master(800, 710, "yamaha-reference", "verified-reference"),
  "snare-drum": master(450, 450, "representative-layout", "representative"),
  "suspended-cymbal": master(550, 550, "representative-layout", "representative"),
  "crash-cymbal-pair": master(550, 550, "representative-layout", "representative"),
  "gong-tam-tam": master(1100, 615, "representative-layout", "representative", { diameterMm: 914.4, note: "公称直径914.4mm。平面図は横長投影SVGを使用。" }),
  "conga-2": master(760, 400, "representative-layout", "representative"),
  bongo: master(450, 300, "representative-layout", "representative"),
  "wind-chime": master(600, 300, "representative-layout", "representative"),
  "drum-set-compact": master(1600, 1400, "representative-layout", "representative"),
  "drum-set-standard": master(2000, 1800, "representative-layout", "representative"),
  "drum-set-large": master(2400, 2000, "representative-layout", "representative"),
  "timpani-set-4": TIMPANI_SET_BODY_SIZE,
  ...CONCERT_TOM_BODY_MASTERS,
  "concert-tom-set-4": CONCERT_TOM_SET_BODY_SIZE,
  "grand-harp-47": master(1050, 700, "representative-layout", "representative"),
  "amp-speaker": master(600, 450, "representative-layout", "representative", { note: "特定型番ではない既存アンプ／スピーカーの代表フットプリント。" }),
};


/**
 * schemaVersion 1.3.0 and earlier stored these occupancy-oriented defaults.
 * Migration only replaces an untouched legacy default; custom mm values remain the source of truth.
 */
export const LEGACY_INSTRUMENT_BODY_MASTERS: Readonly<Record<string, InstrumentBodyDimensions>> = {
  "timpani-23": { widthMm: 690, depthMm: 690 },
  "timpani-26": { widthMm: 760, depthMm: 760 },
  "timpani-29": { widthMm: 840, depthMm: 840 },
  "timpani-32": { widthMm: 910, depthMm: 910 },
  marimba: { widthMm: 2600, depthMm: 1100 },
  "bass-drum": { widthMm: 1100, depthMm: 700 },
  vibraphone: { widthMm: 1500, depthMm: 900 },
  xylophone: { widthMm: 1400, depthMm: 800 },
  "drum-set": { widthMm: 1800, depthMm: 1500 },
  "timpani-set-4": { widthMm: 2400, depthMm: 1500 },
  harp: { widthMm: 1000, depthMm: 1000 },
};

/**
 * schemaVersion 1.5.0で保存されていた、今回の安定ID変更前の既定値。
 * この値と完全一致した場合だけ、新しい寸法マスターへ更新する。
 */
export const SCHEMA_1_5_INSTRUMENT_BODY_MASTERS: Readonly<Record<string, InstrumentBodyDimensions>> = {
  marimba: { widthMm: 2600, depthMm: 900 },
  vibraphone: { widthMm: 1500, depthMm: 800 },
  xylophone: { widthMm: 1400, depthMm: 700 },
  chimes: { widthMm: 1000, depthMm: 600 },
  "drum-set": { widthMm: 1800, depthMm: 1300 },
  harp: { widthMm: 1000, depthMm: 600 },
};

/**
 * schemaVersion 1.4.0で保存されていた、現行仕様へ変更する直前の既定値。
 * ユーザーが個別編集した値とは区別して、未編集の値だけを移行する。
 */
export const PREVIOUS_INSTRUMENT_BODY_MASTERS: Readonly<Record<string, InstrumentBodyDimensions>> = {
  "grand-piano-full": { widthMm: 1560, depthMm: 2740 },
  "grand-piano-semi": { widthMm: 1530, depthMm: 2120 },
  "upright-piano": { widthMm: 1500, depthMm: 650 },
  celesta: { widthMm: 1080, depthMm: 620 },
  "timpani-23": { widthMm: 584, depthMm: 584 },
  "timpani-26": { widthMm: 660, depthMm: 660 },
  "timpani-29": { widthMm: 737, depthMm: 737 },
  "timpani-32": { widthMm: 813, depthMm: 813 },
  "bass-drum": { widthMm: 900, depthMm: 600 },
  "timpani-set-4": { widthMm: 2600, depthMm: 1507 },
};

export function instrumentBodyMasterForPreset(presetId: string): InstrumentBodyMaster | undefined {
  return INSTRUMENT_BODY_MASTERS[presetId];
}
