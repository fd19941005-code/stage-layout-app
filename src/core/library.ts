// ライブラリ検索・お気に入り・最近使用の純粋な判定ロジック。
// 端末保存やReact stateには依存せず、プロジェクトJSONにも含めない。

import type { ObjectPreset } from "./presets";

export const MAX_RECENT_PRESETS = 10;
export const LIBRARY_PREFERENCES_KEY = "library-preferences.v1";

export interface LibraryPreferences {
  favoritePresetIds: string[];
  recentPresetIds: string[];
}

export const DEFAULT_LIBRARY_PREFERENCES: LibraryPreferences = {
  favoritePresetIds: [],
  recentPresetIds: [],
};

/** 表示名の全角英数・大文字小小文字・前後空白を検索用に揃える。 */
export function normalizeLibraryQuery(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
}

/** 現行プリセットに付随する英語正式名。カタログ定義を保存形式へ混ぜない。 */
const PRESET_ENGLISH_NAMES: Readonly<Record<string, string>> = {
  chair: "Chair",
  "chair-back": "Chair with Back",
  "piano-bench": "Piano Bench",
  "music-stand": "Music Stand",
  lectern: "Lectern",
  "conductor-stand": "Conductor Music Stand",
  podium: "Conductor Podium",
  "riser-3x6": "Riser 3x6 Shaku",
  "riser-4x6": "Riser 4x6 Shaku",
  "riser-6x6": "Riser 6x6 Shaku",
  hakouma: "Hakouma Riser Box",
  "table-long": "Long Table",
  "grand-piano-full": "Grand Piano Full",
  "grand-piano-semi": "Grand Piano Semi",
  "upright-piano": "Upright Piano",
  celesta: "Celesta",
  "timpani-26": "Timpani 26 inch",
  "timpani-29": "Timpani 29 inch",
  "timpani-23": "Timpani 23 inch",
  "timpani-32": "Timpani 32 inch",
  marimba: "Marimba",
  "marimba-5oct": "Marimba 5 Octave",
  "marimba-4oct": "Marimba 4 Octave",
  "bass-drum": "Bass Drum",
  "vibraphone-standard": "Vibraphone",
  vibraphone: "Vibraphone",
  "xylophone-concert": "Concert Xylophone",
  xylophone: "Xylophone",
  "glockenspiel-concert": "Concert Glockenspiel",
  "tubular-bells-concert": "Tubular Bells",
  chimes: "Tubular Bells",
  "snare-drum": "Snare Drum",
  "suspended-cymbal": "Suspended Cymbal",
  "crash-cymbal-pair": "Crash Cymbal Pair",
  "gong-tam-tam": "Gong / Tam-Tam",
  "conga-2": "Congas Pair",
  bongo: "Bongos",
  "wind-chime": "Wind Chime",
  "drum-set-compact": "Compact Drum Set",
  "drum-set-standard": "Standard Drum Set",
  "drum-set-large": "Large Drum Set",
  "timpani-set-4": "Timpani Set",
  "concert-tom-set-4": "Concert Tom Set",
  "grand-harp-47": "Grand Harp 47-string",
  harp: "Grand Harp",
  "contrabass-stool": "Double Bass Stool",
  "amp-speaker": "Amplifier / Speaker",
  "generic-rect": "Rectangle",
  "generic-circle": "Circle",
};

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
}

export function normalizeLibraryPreferences(value: Partial<LibraryPreferences> | null | undefined): LibraryPreferences {
  return {
    favoritePresetIds: uniqueIds(value?.favoritePresetIds ?? []),
    recentPresetIds: uniqueIds(value?.recentPresetIds ?? []).slice(0, MAX_RECENT_PRESETS),
  };
}
/** Return the normalized favorite preset id assigned to digit 1-9. */
export function favoritePresetIdForDigit(preferences: LibraryPreferences, digit: number): string | null {
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return null;
  return normalizeLibraryPreferences(preferences).favoritePresetIds[digit - 1] ?? null;
}

export function toggleFavoritePreset(preferences: LibraryPreferences, presetId: string): LibraryPreferences {
  const current = normalizeLibraryPreferences(preferences);
  const exists = current.favoritePresetIds.includes(presetId);
  return {
    ...current,
    favoritePresetIds: exists
      ? current.favoritePresetIds.filter((id) => id !== presetId)
      : [presetId, ...current.favoritePresetIds],
  };
}

/** 同じプリセットを再使用したときは常に先頭へ移動する。 */
export function recordRecentPresets(preferences: LibraryPreferences, presetIds: readonly string[]): LibraryPreferences {
  const current = normalizeLibraryPreferences(preferences);
  const ids = uniqueIds(presetIds);
  return {
    ...current,
    recentPresetIds: [...ids, ...current.recentPresetIds.filter((id) => !ids.includes(id))].slice(0, MAX_RECENT_PRESETS),
  };
}

export function presetSearchText(preset: ObjectPreset): string {
  return normalizeLibraryQuery([
    preset.name,
    preset.labelJa,
    preset.labelEn,
    preset.labelEnShort,
    PRESET_ENGLISH_NAMES[preset.id],
    preset.category,
    String(preset.widthMm),
    String(preset.depthMm),
  ].filter(Boolean).join(" "));
}

export function matchesPreset(preset: ObjectPreset, query: string): boolean {
  const normalized = normalizeLibraryQuery(query);
  return normalized.length === 0 || presetSearchText(preset).includes(normalized);
}

export function filterLibraryPresets(
  presets: readonly ObjectPreset[],
  query: string,
  category: string,
  allCategory = "すべて",
): ObjectPreset[] {
  return presets.filter((preset) =>
    (category === allCategory || preset.category === category)
    && matchesPreset(preset, query),
  );
}

function rankMap(ids: readonly string[]): Map<string, number> {
  return new Map(ids.map((id, index) => [id, index]));
}

/** お気に入りを先頭、その中では登録順、次に最近使用順で安定ソートする。 */
export function orderLibraryPresets(
  presets: readonly ObjectPreset[],
  preferences: LibraryPreferences,
): ObjectPreset[] {
  const current = normalizeLibraryPreferences(preferences);
  const favorites = rankMap(current.favoritePresetIds);
  const recents = rankMap(current.recentPresetIds);
  return presets
    .map((preset, index) => ({ preset, index }))
    .sort((a, b) => {
      const aFavorite = favorites.has(a.preset.id);
      const bFavorite = favorites.has(b.preset.id);
      if (aFavorite !== bFavorite) return aFavorite ? -1 : 1;
      if (aFavorite && bFavorite) return favorites.get(a.preset.id)! - favorites.get(b.preset.id)!;
      const aRecent = recents.get(a.preset.id);
      const bRecent = recents.get(b.preset.id);
      if (aRecent !== undefined || bRecent !== undefined) {
        if (aRecent === undefined) return 1;
        if (bRecent === undefined) return -1;
        return aRecent - bRecent;
      }
      return a.index - b.index;
    })
    .map(({ preset }) => preset);
}

export function favoritePresets(presets: readonly ObjectPreset[], preferences: LibraryPreferences): ObjectPreset[] {
  const ids = new Set(normalizeLibraryPreferences(preferences).favoritePresetIds);
  return orderLibraryPresets(presets.filter((preset) => ids.has(preset.id)), preferences);
}

export function recentPresets(presets: readonly ObjectPreset[], preferences: LibraryPreferences): ObjectPreset[] {
  const current = normalizeLibraryPreferences(preferences);
  const ids = new Set(current.recentPresetIds);
  return orderLibraryPresets(presets.filter((preset) => ids.has(preset.id)), { ...current, favoritePresetIds: [] });
}
