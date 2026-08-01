import { describe, expect, it } from "vitest";
import { findPreset, OBJECT_PRESETS, PERCUSSION_LIBRARY_GROUPS } from "./presets";
import {
  filterLibraryPresets,
  matchesPreset,
  normalizeLibraryQuery,
  orderLibraryPresets,
  recordRecentPresets,
  toggleFavoritePreset,
  type LibraryPreferences,
} from "./library";

describe("library search and ordering", () => {
  it("normalizes Japanese and ASCII queries and searches Japanese, English, and abbreviations", () => {
    const marimba = findPreset("marimba-5oct");
    const piano = findPreset("grand-piano-full");
    const vibraphone = findPreset("vibraphone-standard");
    expect(marimba).toBeTruthy();
    expect(piano).toBeTruthy();
    expect(vibraphone).toBeTruthy();
    expect(normalizeLibraryQuery("  ＧＰ  ")).toBe("gp");
    expect(matchesPreset(marimba!, "マリンバ")).toBe(true);
    expect(matchesPreset(piano!, "grand piano")).toBe(true);
    expect(matchesPreset(piano!, "GP")).toBe(true);
    expect(matchesPreset(vibraphone!, "Vib.")).toBe(true);
  });

  it("combines the category filter with the normalized query", () => {
    const results = filterLibraryPresets(OBJECT_PRESETS, "piano", "鍵盤");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((preset) => preset.category === "鍵盤")).toBe(true);
    expect(filterLibraryPresets(OBJECT_PRESETS, "piano", "打楽器")).toHaveLength(0);
  });

  it("keeps a recently used preset available in its original category", () => {
    const seatPresets = filterLibraryPresets(OBJECT_PRESETS, "", "座席・譜面");
    expect(seatPresets.some((preset) => preset.id === "chair")).toBe(true);
    expect(seatPresets.some((preset) => preset.id === "music-stand")).toBe(true);
  });

  it("keeps one percussion category while applying the internal order", () => {
    const percussionIds = filterLibraryPresets(OBJECT_PRESETS, "", "打楽器").map((preset) => preset.id);
    const expectedIds = PERCUSSION_LIBRARY_GROUPS.flatMap((group) => group.presetIds);
    expect(percussionIds).toEqual(expectedIds);
    expect(new Set(expectedIds).size).toBe(expectedIds.length);
    expect(PERCUSSION_LIBRARY_GROUPS.find((group) => group.id === "keyboard")?.presetIds).toContain("tubular-bells-concert");
  });

  it("keeps favorites first and recent items in their recorded order", () => {
    const presets = [findPreset("chair")!, findPreset("music-stand")!, findPreset("grand-piano-full")!];
    let preferences: LibraryPreferences = { favoritePresetIds: [], recentPresetIds: [] };
    preferences = toggleFavoritePreset(preferences, "grand-piano-full");
    preferences = recordRecentPresets(preferences, ["music-stand", "chair"]);
    expect(orderLibraryPresets(presets, preferences).map((preset) => preset.id)).toEqual([
      "grand-piano-full",
      "music-stand",
      "chair",
    ]);
  });

  it("moves reused presets to the front and caps recent history at ten", () => {
    const ids = Array.from({ length: 12 }, (_, index) => `preset-${index}`);
    let preferences: LibraryPreferences = { favoritePresetIds: [], recentPresetIds: [] };
    preferences = recordRecentPresets(preferences, ids);
    expect(preferences.recentPresetIds).toHaveLength(10);
    preferences = recordRecentPresets(preferences, ["preset-8"]);
    expect(preferences.recentPresetIds[0]).toBe("preset-8");
    expect(preferences.recentPresetIds).toHaveLength(10);
  });
});
