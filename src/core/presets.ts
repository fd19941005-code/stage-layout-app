// 初期オブジェクトプリセット(付録A)。
// 寸法は標準初期値であり、ユーザーが実測値へ変更できる(FR-044)。
// 高さHはPhase 5で使用するが、Phase 0から定義に含める(FR-046)。

import type { ObjectType, ShapeKind } from "../types/project";

export interface ObjectPreset {
  id: string;
  category: string;
  name: string;
  type: ObjectType;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  shape: ShapeKind;
}

/** 山台の段高プリセット(FR-046) */
export const RISER_HEIGHTS_MM = [150, 300, 450, 600] as const;

/** 校正距離プリセット(FR-021) */
export const CALIBRATION_DISTANCE_PRESETS_MM = [910, 1820, 900, 1800, 1000] as const;

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
  { id: "chair", category: "座席・譜面", name: "椅子", type: "chair", widthMm: 450, depthMm: 450, heightMm: 450, shape: "rect" },
  { id: "chair-back", category: "座席・譜面", name: "背付き椅子", type: "chair", widthMm: 480, depthMm: 520, heightMm: 800, shape: "rect" },
  { id: "piano-bench", category: "座席・譜面", name: "ピアノ椅子", type: "chair", widthMm: 550, depthMm: 330, heightMm: 500, shape: "rect" },
  { id: "music-stand", category: "座席・譜面", name: "譜面台", type: "musicStand", widthMm: 480, depthMm: 450, heightMm: 1300, shape: "rect" },
  { id: "lectern", category: "座席・譜面", name: "演台", type: "podium", widthMm: 600, depthMm: 450, heightMm: 1100, shape: "rect" },
  { id: "conductor-stand", category: "座席・譜面", name: "指揮者用譜面台", type: "musicStand", widthMm: 550, depthMm: 500, heightMm: 1300, shape: "rect" },
  // 指揮・平台
  { id: "podium", category: "指揮・平台", name: "指揮台", type: "podium", widthMm: 900, depthMm: 900, heightMm: 200, shape: "rect" },
  { id: "riser-3x6", category: "指揮・平台", name: "山台(平台)3×6尺", type: "riser", widthMm: 910, depthMm: 1820, heightMm: 300, shape: "rect" },
  { id: "riser-4x6", category: "指揮・平台", name: "山台 4×6尺", type: "riser", widthMm: 1220, depthMm: 1820, heightMm: 300, shape: "rect" },
  { id: "riser-6x6", category: "指揮・平台", name: "山台 6×6尺", type: "riser", widthMm: 1820, depthMm: 1820, heightMm: 300, shape: "rect" },
  { id: "hakouma", category: "指揮・平台", name: "箱馬", type: "riser", widthMm: 300, depthMm: 450, heightMm: 300, shape: "rect" },
  { id: "table-long", category: "指揮・平台", name: "長机", type: "shape", widthMm: 1800, depthMm: 450, heightMm: 700, shape: "rect" },
  // 鍵盤
  { id: "grand-piano-full", category: "鍵盤", name: "グランドピアノ(フル)", type: "instrument", widthMm: 1560, depthMm: 2740, heightMm: 1020, shape: "rect" },
  { id: "grand-piano-semi", category: "鍵盤", name: "グランドピアノ(セミ)", type: "instrument", widthMm: 1530, depthMm: 2120, heightMm: 1020, shape: "rect" },
  { id: "upright-piano", category: "鍵盤", name: "アップライトピアノ", type: "instrument", widthMm: 1500, depthMm: 650, heightMm: 1250, shape: "rect" },
  { id: "celesta", category: "鍵盤", name: "チェレスタ", type: "instrument", widthMm: 1080, depthMm: 620, heightMm: 970, shape: "rect" },
  // 打楽器
  { id: "timpani-26", category: "打楽器", name: "ティンパニ 26\"", type: "instrument", widthMm: 760, depthMm: 760, heightMm: 900, shape: "circle" },
  { id: "timpani-29", category: "打楽器", name: "ティンパニ 29\"", type: "instrument", widthMm: 840, depthMm: 840, heightMm: 900, shape: "circle" },
  { id: "marimba", category: "打楽器", name: "マリンバ", type: "instrument", widthMm: 2600, depthMm: 1100, heightMm: 950, shape: "rect" },
  { id: "bass-drum", category: "打楽器", name: "バスドラム", type: "instrument", widthMm: 1100, depthMm: 700, heightMm: 1400, shape: "rect" },
  { id: "vibraphone", category: "打楽器", name: "ヴィブラフォン", type: "instrument", widthMm: 1500, depthMm: 900, heightMm: 950, shape: "rect" },
  { id: "xylophone", category: "打楽器", name: "シロフォン/グロッケン", type: "instrument", widthMm: 1400, depthMm: 800, heightMm: 950, shape: "rect" },
  { id: "chimes", category: "打楽器", name: "チャイム", type: "instrument", widthMm: 1000, depthMm: 600, heightMm: 1900, shape: "rect" },
  { id: "drum-set", category: "打楽器", name: "ドラムセット", type: "instrument", widthMm: 1800, depthMm: 1500, heightMm: 1200, shape: "rect" },
  { id: "timpani-23", category: "打楽器", name: "ティンパニ 23インチ", type: "instrument", widthMm: 690, depthMm: 690, heightMm: 900, shape: "circle" },
  { id: "timpani-32", category: "打楽器", name: "ティンパニ 32インチ", type: "instrument", widthMm: 910, depthMm: 910, heightMm: 900, shape: "circle" },
  { id: "timpani-set-4", category: "打楽器", name: "ティンパニ 4個セット", type: "instrument", widthMm: 2400, depthMm: 1500, heightMm: 900, shape: "rect" },
  // 大型弦・他
  { id: "harp", category: "大型弦・他", name: "ハープ", type: "instrument", widthMm: 1000, depthMm: 1000, heightMm: 1800, shape: "rect" },
  { id: "contrabass-stool", category: "大型弦・他", name: "コントラバス用椅子(占有域)", type: "chair", widthMm: 900, depthMm: 1200, heightMm: 1900, shape: "rect" },
  { id: "amp-speaker", category: "大型弦・他", name: "アンプ/スピーカー", type: "instrument", widthMm: 600, depthMm: 450, heightMm: 600, shape: "rect" },
  // 汎用
  { id: "generic-rect", category: "汎用", name: "長方形(任意寸法)", type: "shape", widthMm: 1000, depthMm: 1000, heightMm: 0, shape: "rect" },
  { id: "generic-circle", category: "汎用", name: "円(任意径)", type: "shape", widthMm: 1000, depthMm: 1000, heightMm: 0, shape: "circle" },
];

export function findPreset(id: string): ObjectPreset | undefined {
  return OBJECT_PRESETS.find((p) => p.id === id);
}

export const PRESET_CATEGORIES: string[] = [
  ...new Set(OBJECT_PRESETS.map((p) => p.category)),
];

