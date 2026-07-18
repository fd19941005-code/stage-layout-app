import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";

describe("Phase 5 reducer", () => {
  it("壁の追加・頂点編集・高さ編集・頂点削除をAction経由で保存する", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "ADD_WALL",
      wall: {
        id: "wall-1",
        points: [{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 }],
        heightMm: 6000,
        closed: false,
      },
    });
    expect(state.project.walls).toHaveLength(1);
    expect(state.mode).toBe("select");

    state = appReducer(state, { type: "UPDATE_WALL", id: "wall-1", patch: { heightMm: 4500, closed: true } });
    state = appReducer(state, { type: "UPDATE_WALL_POINT", wallId: "wall-1", index: 1, point: { xMm: 1200, yMm: 50 } });
    state = appReducer(state, { type: "DELETE_WALL_POINT", wallId: "wall-1", index: 2 });

    expect(state.project.walls[0]).toMatchObject({ heightMm: 4500, closed: true });
    expect(state.project.walls[0].points).toEqual([{ xMm: 0, yMm: 0 }, { xMm: 1200, yMm: 50 }]);
    expect(state.past.length).toBe(4);
  });

  it("2点未満の壁、重複ID、無効な頂点を保存しない", () => {
    let state = createInitialState();
    const invalid = {
      id: "wall-1",
      points: [{ xMm: Number.NaN, yMm: Number.POSITIVE_INFINITY }],
      heightMm: Number.NaN,
      closed: false,
    };
    state = appReducer(state, { type: "ADD_WALL", wall: invalid });
    expect(state.project.walls).toEqual([]);

    state = appReducer(state, {
      type: "ADD_WALL",
      wall: { ...invalid, points: [{ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 10 }] },
    });
    state = appReducer(state, {
      type: "ADD_WALL",
      wall: { id: "wall-1", points: [{ xMm: 1, yMm: 1 }, { xMm: 2, yMm: 2 }], heightMm: 100, closed: false },
    });
    expect(state.project.walls).toHaveLength(1);
    expect(state.project.walls[0].points[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(state.project.walls[0].heightMm).toBe(6000);
  });
});
