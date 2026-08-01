import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, selectionBoundsMm } from "./appState";
import { deserializeProject, serializeProject } from "../core/project";
import type { SceneObject } from "../types/project";

function genericRect(): SceneObject {
  return {
    id: "generic-rect",
    type: "shape",
    presetId: "generic-rect",
    name: "長方形",
    xMm: 0,
    yMm: 0,
    widthMm: 1000,
    depthMm: 1000,
    heightMm: 0,
    rotationDeg: 0,
    label: "",
    onRiserId: null,
    avatar: null,
    locked: false,
    visible: true,
    groupId: null,
    layerId: "layer-objects",
    zIndex: 0,
    shape: "rect",
  };
}

function rectObject(id: string, xMm: number, yMm: number, widthMm: number, depthMm: number): SceneObject {
  return { ...genericRect(), id, xMm, yMm, widthMm, depthMm };
}

function groupedObjectState(objects: SceneObject[]) {
  let state = createInitialState();
  for (const object of objects) {
    state = appReducer(state, { type: "ADD_OBJECT", object });
  }
  state = appReducer(state, { type: "SELECT_MANY", ids: objects.map((object) => object.id) });
  return appReducer(state, { type: "GROUP_SELECTED" });
}

function previewThroughRotationAngles(state: ReturnType<typeof createInitialState>, id: string) {
  return [15, 30, 45, 60, 75, 90].reduce(
    (current, rotationDeg) => appReducer(current, { type: "ROTATE_OBJECT", id, rotationDeg, preview: true }),
    state,
  );
}

function expectObjectPosesToMatch(actual: SceneObject[], expected: SceneObject[]) {
  expect(actual.map((object) => object.id)).toEqual(expected.map((object) => object.id));
  actual.forEach((object, index) => {
    const reference = expected[index];
    expect(object.xMm).toBeCloseTo(reference.xMm, 8);
    expect(object.yMm).toBeCloseTo(reference.yMm, 8);
    expect(object.rotationDeg).toBeCloseTo(reference.rotationDeg, 8);
    expect(object.widthMm).toBe(reference.widthMm);
    expect(object.depthMm).toBe(reference.depthMm);
  });
}
describe("ティンパニ・4トムの固定グループ配置", () => {
  it("ティンパニセットを4個の円形子オブジェクトとして配置する", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "ADD_GROUP_PRESET",
      presetId: "timpani-set-4",
      centerXMm: 5000,
      centerYMm: 4000,
      layerId: "layer-objects",
    });

    expect(state.project.objects).toHaveLength(4);
    expect(new Set(state.project.objects.map((object) => object.groupId)).size).toBe(1);
    expect(state.project.objects.map((object) => object.presetId)).toEqual([
      "timpani-23",
      "timpani-26",
      "timpani-29",
      "timpani-32",
    ]);
    expect(state.project.objects.every((object) => object.shape === "circle")).toBe(true);
    expect(state.project.objects.every((object) => object.assetVariantId === "generated/timpani-circle")).toBe(true);
    expect(state.selectedIds).toHaveLength(4);

    expect(state.project.objects.map(({ presetId, xMm, yMm, widthMm, depthMm }) => ({ presetId, xMm, yMm, widthMm, depthMm }))).toEqual([
      { presetId: "timpani-23", xMm: 4000, yMm: 3680, widthMm: 750, depthMm: 750 },
      { presetId: "timpani-26", xMm: 4375, yMm: 4385, widthMm: 800, depthMm: 800 },
      { presetId: "timpani-29", xMm: 5270, yMm: 4395, widthMm: 900, depthMm: 900 },
      { presetId: "timpani-32", xMm: 5900, yMm: 3630, widthMm: 950, depthMm: 950 },
    ]);
    const bounds = selectionBoundsMm(state.project.objects, state.project.objects.map((object) => object.id));
    expect(bounds).toMatchObject({ minXMm: 3625, minYMm: 3155, maxXMm: 6375, maxYMm: 4845 });

    const restored = deserializeProject(serializeProject(state.project));
    expect(restored.objects.map(({ presetId, xMm, yMm, widthMm, depthMm, groupId }) => ({ presetId, xMm, yMm, widthMm, depthMm, groupId }))).toEqual(
      state.project.objects.map(({ presetId, xMm, yMm, widthMm, depthMm, groupId }) => ({ presetId, xMm, yMm, widthMm, depthMm, groupId })),
    );

    state = appReducer(state, { type: "ROTATE_OBJECT", id: state.project.objects[0].id, rotationDeg: 90 });
    expect(state.project.objects.every((object) => object.rotationDeg === 90)).toBe(true);
    expect(state.project.objects.map((object) => [object.widthMm, object.depthMm])).toEqual([
      [750, 750],
      [800, 800],
      [900, 900],
      [950, 950],
    ]);
    const rotatedBounds = selectionBoundsMm(state.project.objects, state.project.objects.map((object) => object.id));
    expect(rotatedBounds).toMatchObject({ minXMm: 4155, minYMm: 2625, maxXMm: 5845, maxYMm: 5375 });
  });

  it("4トムを16/14/12/10の順で1グループへ配置し、解除できる", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "ADD_GROUP_PRESET",
      presetId: "concert-tom-set-4",
      centerXMm: 3000,
      centerYMm: 2500,
      layerId: "layer-objects",
    });

    expect(state.project.objects.map((object) => object.presetId)).toEqual([
      "concert-tom-16",
      "concert-tom-14",
      "concert-tom-12",
      "concert-tom-10",
    ]);
    expect(state.project.objects.map((object) => object.xMm)).toEqual([2485, 2905, 3275, 3590]);
    expect(state.project.objects.map((object) => object.yMm)).toEqual([2530, 2450, 2420, 2500]);
    const ids = state.project.objects.map((object) => object.id);
    const bounds = selectionBoundsMm(state.project.objects, ids);
    expect(bounds).not.toBeNull();
    expect(bounds!.maxXMm - bounds!.minXMm).toBe(1460);
    expect(bounds!.maxYMm - bounds!.minYMm).toBe(490);
    expect(new Set(state.project.objects.map((object) => object.groupId)).size).toBe(1);

    const before = state.project.objects.map((object) => ({ xMm: object.xMm, yMm: object.yMm, widthMm: object.widthMm, depthMm: object.depthMm }));
    state = appReducer(state, { type: "ROTATE_OBJECT", id: state.project.objects[0].id, rotationDeg: 90 });
    expect(state.project.objects.every((object) => object.rotationDeg === 90)).toBe(true);
    const centerXMm = 3000;
    const centerYMm = 2500;
    state.project.objects.forEach((object, index) => {
      const original = before[index];
      expect(object.xMm).toBeCloseTo(centerXMm - (original.yMm - centerYMm), 8);
      expect(object.yMm).toBeCloseTo(centerYMm + (original.xMm - centerXMm), 8);
      expect(object.widthMm).toBe(original.widthMm);
      expect(object.depthMm).toBe(original.depthMm);
    });

    state = appReducer(state, { type: "UNGROUP_SELECTED" });
    expect(state.project.objects.every((object) => object.groupId === null)).toBe(true);
  });

  it("consecutive tom previews match a direct 90 degree rotation", () => {
    const original = appReducer(createInitialState(), {
      type: "ADD_GROUP_PRESET",
      presetId: "concert-tom-set-4",
      centerXMm: 3000,
      centerYMm: 2500,
      layerId: "layer-objects",
    });
    const id = original.project.objects[0].id;
    const direct = appReducer(original, { type: "ROTATE_OBJECT", id, rotationDeg: 90 });
    const previewed = previewThroughRotationAngles(original, id);

    expectObjectPosesToMatch(previewed.project.objects, direct.project.objects);
  });

  it("consecutive previews keep the center for an asymmetric mixed-size group", () => {
    const original = groupedObjectState([
      rectObject("rect-a", 4000, 3000, 800, 400),
      rectObject("rect-b", 5200, 3350, 350, 700),
      rectObject("rect-c", 4600, 4300, 600, 250),
    ]);
    const id = original.project.objects[0].id;
    const direct = appReducer(original, { type: "ROTATE_OBJECT", id, rotationDeg: 90 });
    const previewed = previewThroughRotationAngles(original, id);

    expectObjectPosesToMatch(previewed.project.objects, direct.project.objects);
  });
  it("resizableな汎用プリセットはAction経由で寸法変更できる", () => {
    let state = appReducer(createInitialState(), { type: "ADD_OBJECT", object: genericRect() });
    state = appReducer(state, { type: "UPDATE_OBJECT", id: "generic-rect", patch: { widthMm: 1500, depthMm: 700 } });
    expect(state.project.objects[0]).toMatchObject({ widthMm: 1500, depthMm: 700 });
  });

  it("instrumentの幅・奥行はActionからも変更できない", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "ADD_GROUP_PRESET",
      presetId: "concert-tom-set-4",
      centerXMm: 0,
      centerYMm: 0,
      layerId: "layer-objects",
    });
    const object = state.project.objects[0];
    state = appReducer(state, { type: "UPDATE_OBJECT", id: object.id, patch: { widthMm: 9999, depthMm: 1 } });
    expect(state.project.objects[0].widthMm).toBe(430);
    expect(state.project.objects[0].depthMm).toBe(430);
  });
});
