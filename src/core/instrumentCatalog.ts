/**
 * 楽器本体の実寸マスター。
 *
 * ここで扱う幅・奥行き・直径は、奏者の余白や運搬時の占有域ではなく
 * 楽器本体の外形寸法(mm)です。画面上のpx値は保存せず、SceneObjectの
 * widthMm/depthMmを共通のmm->px変換へ渡して表示します。
 */
export interface InstrumentBodyMaster {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly diameterMm?: number;
}

export function inchesToMillimetres(inches: number): number {
  return Math.round(inches * 25.4);
}

export type TimpaniPresetId = "timpani-23" | "timpani-26" | "timpani-29" | "timpani-32";

export const TIMPANI_BODY_MASTERS: Readonly<Record<TimpaniPresetId, InstrumentBodyMaster>> = {
  "timpani-23": { widthMm: inchesToMillimetres(23), depthMm: inchesToMillimetres(23), diameterMm: inchesToMillimetres(23) },
  "timpani-26": { widthMm: inchesToMillimetres(26), depthMm: inchesToMillimetres(26), diameterMm: inchesToMillimetres(26) },
  "timpani-29": { widthMm: inchesToMillimetres(29), depthMm: inchesToMillimetres(29), diameterMm: inchesToMillimetres(29) },
  "timpani-32": { widthMm: inchesToMillimetres(32), depthMm: inchesToMillimetres(32), diameterMm: inchesToMillimetres(32) },
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
  { presetId: "timpani-23", centerXMm: 292, centerYMm: 292 },
  { presetId: "timpani-26", centerXMm: 900, centerYMm: 1100 },
  { presetId: "timpani-29", centerXMm: 1500, centerYMm: 368.5 },
  { presetId: "timpani-32", centerXMm: 2193.5, centerYMm: 1100 },
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
  };
}

export const TIMPANI_SET_BODY_SIZE = timpaniSetBodySize();

/**
 * 楽器プリセットが参照する本体寸法の正本。
 * 個別プリセット側へ数値を複製しないことで、表示・配置・出力の基準を揃える。
 */
export const INSTRUMENT_BODY_MASTERS: Readonly<Record<string, InstrumentBodyMaster>> = {
  "grand-piano-full": { widthMm: 1560, depthMm: 2740 },
  "grand-piano-semi": { widthMm: 1530, depthMm: 2120 },
  "upright-piano": { widthMm: 1500, depthMm: 650 },
  celesta: { widthMm: 1080, depthMm: 620 },
  ...TIMPANI_BODY_MASTERS,
  marimba: { widthMm: 2600, depthMm: 900 },
  "bass-drum": { widthMm: 900, depthMm: 600 },
  vibraphone: { widthMm: 1500, depthMm: 800 },
  xylophone: { widthMm: 1400, depthMm: 700 },
  chimes: { widthMm: 1000, depthMm: 600 },
  "drum-set": { widthMm: 1800, depthMm: 1300 },
  "timpani-set-4": TIMPANI_SET_BODY_SIZE,
  harp: { widthMm: 1000, depthMm: 600 },
  "amp-speaker": { widthMm: 600, depthMm: 450 },
};


/**
 * schemaVersion 1.3.0 and earlier stored these occupancy-oriented defaults.
 * Migration only replaces an untouched legacy default; custom mm values remain the source of truth.
 */
export const LEGACY_INSTRUMENT_BODY_MASTERS: Readonly<Record<string, InstrumentBodyMaster>> = {
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

export function instrumentBodyMasterForPreset(presetId: string): InstrumentBodyMaster | undefined {
  return INSTRUMENT_BODY_MASTERS[presetId];
}
