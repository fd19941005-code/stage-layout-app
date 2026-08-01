import { describe, expect, it } from "vitest";
import { createHorizontalGuide } from "../core/guides";
import { appReducer, createInitialState } from "./appState";

describe("guide reducer actions", () => {
  it("keeps a locked guide immutable for geometry edits and deletion", () => {
    const initial = createInitialState();
    const added = appReducer(initial, { type: "ADD_GUIDE", guide: createHorizontalGuide("guide-1", 1000) });
    const locked = appReducer(added, { type: "SET_GUIDE_LOCKED", id: "guide-1", locked: true });
    const edited = appReducer(locked, { type: "UPDATE_GUIDE", id: "guide-1", patch: { yMm: 2000 } });
    const deleted = appReducer(locked, { type: "DELETE_GUIDE", id: "guide-1" });
    expect(edited.project.guides[0]?.yMm).toBe(1000);
    expect(deleted.project.guides).toHaveLength(1);
  });

  it("includes guide edits in one-step undo and redo", () => {
    const initial = createInitialState();
    const added = appReducer(initial, { type: "ADD_GUIDE", guide: createHorizontalGuide("guide-1", 1000) });
    const edited = appReducer(added, { type: "UPDATE_GUIDE", id: "guide-1", patch: { yMm: 2000 } });
    const undone = appReducer(edited, { type: "UNDO" });
    const redone = appReducer(undone, { type: "REDO" });
    expect(undone.project.guides[0]?.yMm).toBe(1000);
    expect(redone.project.guides[0]?.yMm).toBe(2000);
  });

  it("keeps library preferences when switching projects", () => {
    const initial = createInitialState();
    const loaded = appReducer(initial, { type: "LOAD_LIBRARY_PREFERENCES", preferences: { favoritePresetIds: ["chair"], recentPresetIds: ["music-stand"] } });
    const nextProject = appReducer(loaded, { type: "NEW_PROJECT" });
    expect(nextProject.libraryPreferences.favoritePresetIds).toEqual(["chair"]);
    expect(nextProject.libraryPreferences.recentPresetIds).toEqual(["music-stand"]);
  });
});
