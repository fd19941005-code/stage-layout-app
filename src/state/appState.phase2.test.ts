import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, MAX_HISTORY_ENTRIES } from "./appState";
import type { SceneObject } from "../types/project";

function chair(id: string, xMm = 0, yMm = 0): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: "椅子",
    xMm,
    yMm,
    widthMm: 450,
    depthMm: 450,
    heightMm: 450,
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

function withObjects(objects: SceneObject[]) {
  let state = createInitialState();
  for (const object of objects) state = appReducer(state, { type: "ADD_OBJECT", object });
  return state;
}

describe("Undo/Redo (FR-053、AC-008)", () => {
  it("配置・回転・削除をUndo/Redoで再現できる", () => {
    let state = withObjects([chair("a")]);
    state = appReducer(state, { type: "UPDATE_OBJECT", id: "a", patch: { rotationDeg: 30 } });
    state = appReducer(state, { type: "MOVE_OBJECT", id: "a", xMm: 1000, yMm: 2000 });
    state = appReducer(state, { type: "DELETE_OBJECT", id: "a" });
    expect(state.project.objects).toHaveLength(0);

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects[0].xMm).toBe(1000);
    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects[0].rotationDeg).toBe(30);
    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects[0].xMm).toBe(1000);
    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects).toHaveLength(0);
  });

  it("履歴は最低50操作を保持する", () => {
    let state = withObjects([chair("a")]);
    for (let index = 0; index < 60; index += 1) {
      state = appReducer(state, { type: "UPDATE_OBJECT", id: "a", patch: { xMm: index } });
    }
    expect(state.past.length).toBe(MAX_HISTORY_ENTRIES);
  });

  it("ドラッグのpreviewはpointerupのcommitで1履歴になる", () => {
    let state = withObjects([chair("a")]);
    state = appReducer(state, {
      type: "MOVE_OBJECTS",
      moves: [{ id: "a", xMm: 100, yMm: 100 }],
      preview: true,
    });
    state = appReducer(state, {
      type: "MOVE_OBJECTS",
      moves: [{ id: "a", xMm: 200, yMm: 200 }],
      preview: true,
    });
    expect(state.past.length).toBe(1);
    state = appReducer(state, { type: "COMMIT_TRANSIENT_EDIT" });
    expect(state.past.length).toBe(2);
    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects[0].xMm).toBe(0);
  });
});

describe("キーボードナッジ (UX-009)", () => {
  it("選択中の複数オブジェクトをmm単位で移動し、ロック物は変更しない", () => {
    let state = withObjects([
      chair("editable", 1000, 2000),
      { ...chair("locked", 3000, 4000), locked: true },
    ]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["editable", "locked"] });
    state = appReducer(state, { type: "NUDGE_SELECTED", dxMm: 10, dyMm: -100 });

    expect(state.project.objects.find((object) => object.id === "editable")).toMatchObject({ xMm: 1010, yMm: 1900 });
    expect(state.project.objects.find((object) => object.id === "locked")).toMatchObject({ xMm: 3000, yMm: 4000 });
    expect(state.past).toHaveLength(3);
  });

  it("選択がなければナッジは履歴を増やさない", () => {
    const state = appReducer(createInitialState(), { type: "NUDGE_SELECTED", dxMm: 10, dyMm: 0 });
    expect(state.past).toHaveLength(0);
  });
});

describe("複数選択・一括編集 (FR-050、FR-052、FR-056)", () => {
  it("複数選択、複製、グループ化、ロック、削除をActionで実行できる", () => {
    let state = withObjects([chair("a"), chair("b", 1000), chair("c", 2000)]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    expect(state.selectedIds).toEqual(["a", "b"]);
    state = appReducer(state, { type: "GROUP_SELECTED" });
    const groupId = state.project.objects.find((object) => object.id === "a")?.groupId;
    expect(groupId).toBeTruthy();
    state = appReducer(state, { type: "SET_SELECTED_LOCKED", locked: true });
    expect(state.project.objects.filter((object) => object.groupId === groupId).every((object) => object.locked)).toBe(true);
    state = appReducer(state, { type: "DUPLICATE_SELECTED" });
    expect(state.project.objects).toHaveLength(5);
    state = appReducer(state, { type: "DELETE_SELECTED" });
    expect(state.project.objects).toHaveLength(3);
  });

  it("複製したグループは原本と独立したグループになる", () => {
    let state = withObjects([chair("a"), chair("b", 1000)]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    state = appReducer(state, { type: "GROUP_SELECTED" });
    const originalGroupId = state.project.objects.find((object) => object.id === "a")?.groupId;
    const historyBeforeDuplicate = state.past.length;

    state = appReducer(state, { type: "DUPLICATE_SELECTED" });

    const copiedObjects = state.selectedIds.map((id) => state.project.objects.find((object) => object.id === id));
    expect(copiedObjects).toHaveLength(2);
    expect(new Set(copiedObjects.map((object) => object?.groupId)).size).toBe(1);
    expect(copiedObjects[0]?.groupId).not.toBe(originalGroupId);
    expect(state.past).toHaveLength(historyBeforeDuplicate + 1);

    state = appReducer(state, { type: "SELECT_GROUP", id: "a" });
    expect(state.selectedIds).toEqual(["a", "b"]);
  });

  it("複製した山台上オブジェクトは複製先の山台を参照する", () => {
    const riser: SceneObject = {
      ...chair("riser"),
      type: "riser",
      presetId: "riser-6x6",
      name: "山台",
      widthMm: 1820,
      depthMm: 1820,
      heightMm: 450,
    };
    const chairOnRiser: SceneObject = {
      ...chair("chair-on-riser", 500, 500),
      onRiserId: "riser",
    };
    let state = withObjects([riser, chairOnRiser]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["riser", "chair-on-riser"] });
    state = appReducer(state, { type: "GROUP_SELECTED" });
    state = appReducer(state, { type: "DUPLICATE_SELECTED" });

    const copiedRiser = state.selectedIds.map((id) => state.project.objects.find((object) => object.id === id)).find((object) => object?.type === "riser");
    const copiedChair = state.selectedIds.map((id) => state.project.objects.find((object) => object.id === id)).find((object) => object?.id !== copiedRiser?.id);
    expect(copiedRiser).toBeTruthy();
    expect(copiedChair?.onRiserId).toBe(copiedRiser?.id);
    expect(copiedChair?.groupId).toBe(copiedRiser?.groupId);
  });

  it("山台を複製しない場合は既存の山台参照を維持する", () => {
    const riser: SceneObject = {
      ...chair("riser"),
      type: "riser",
      presetId: "riser-6x6",
      name: "山台",
      widthMm: 1820,
      depthMm: 1820,
      heightMm: 450,
    };
    const chairOnRiser: SceneObject = {
      ...chair("chair-on-riser", 500, 500),
      onRiserId: "riser",
    };
    let state = withObjects([riser, chairOnRiser]);
    state = appReducer(state, { type: "SELECT", id: "chair-on-riser" });
    state = appReducer(state, { type: "DUPLICATE_SELECTED" });

    const copiedChair = state.project.objects.find((object) => state.selectedIds.includes(object.id));
    expect(copiedChair?.onRiserId).toBe("riser");
  });

  it("SELECT_RECT additive preserves existing selection", () => {
    let state = withObjects([chair("a"), chair("b", 1000), chair("c", 2000)]);
    state = appReducer(state, { type: "SELECT", id: "a" });
    state = appReducer(state, {
      type: "SELECT_RECT",
      bounds: { minXMm: 700, minYMm: -300, maxXMm: 1300, maxYMm: 300 },
      additive: true,
    });
    expect(state.selectedIds).toEqual(["a", "b"]);
  });
  it("SELECT_RECT selects an object when its bounds partially overlap the marquee", () => {
    let state = withObjects([chair("partial", 1000), chair("outside", 1500)]);
    state = appReducer(state, { type: "SELECT_RECT", bounds: { minXMm: 700, minYMm: -300, maxXMm: 900, maxYMm: 300 } });
    expect(state.selectedIds).toEqual(["partial"]);
  });

});


describe("UX刷新の編集Action", () => {
  it("グループをクリック選択すると全員を移動し、ナッジは1履歴にまとまる", () => {
    let state = withObjects([chair("a", 100, 200), chair("b", 700, 200)]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    state = appReducer(state, { type: "GROUP_SELECTED" });
    const beforePast = state.past.length;
    state = appReducer(state, { type: "SELECT_GROUP", id: "a" });
    expect(state.selectedIds).toEqual(["a", "b"]);
    state = appReducer(state, { type: "NUDGE_SELECTED_PREVIEW", dxMm: 10, dyMm: -20 });
    expect(state.project.objects.find((object) => object.id === "a")).toMatchObject({ xMm: 110, yMm: 180 });
    expect(state.project.objects.find((object) => object.id === "b")).toMatchObject({ xMm: 710, yMm: 180 });
    expect(state.past).toHaveLength(beforePast);
    state = appReducer(state, { type: "COMMIT_TRANSIENT_EDIT" });
    expect(state.past).toHaveLength(beforePast + 1);
  });

  it("プレビュー編集は履歴を増やさず、確定時だけ保存する", () => {
    let state = withObjects([chair("a")]);
    const beforePast = state.past.length;
    state = appReducer(state, { type: "UPDATE_OBJECT_PREVIEW", id: "a", patch: { xMm: 250 } });
    expect(state.project.objects[0].xMm).toBe(250);
    expect(state.past).toHaveLength(beforePast);
    state = appReducer(state, { type: "COMMIT_TRANSIENT_EDIT" });
    expect(state.past).toHaveLength(beforePast + 1);
  });

  it("複数選択へスタイルプリセットを一括適用できる", () => {
    let state = withObjects([chair("a"), chair("b", 500)]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    state = appReducer(state, { type: "SET_SELECTED_STYLE", style: { fillOpacity: 0.65, labelVisible: true } });
    expect(state.project.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "a", style: expect.objectContaining({ fillOpacity: 0.65, labelVisible: true }) }),
      expect.objectContaining({ id: "b", style: expect.objectContaining({ fillOpacity: 0.65, labelVisible: true }) }),
    ]));
  });
});


describe("instrument symbol variant Action", () => {
  it("changes only assetVariantId and supports Undo/Redo", () => {
    const original = {
      ...chair("snare-1"),
      type: "instrument" as const,
      presetId: "snare-drum",
      name: "\u30b9\u30cd\u30a2\u30c9\u30e9\u30e0",
      widthMm: 400,
      depthMm: 400,
      assetVariantId: "stage-open-template/snare-drum-a",
    };
    let state = withObjects([original]);
    const before = state.project.objects[0];
    const selectedBefore = state.selectedIds;
    state = appReducer(state, { type: "SET_OBJECT_ASSET_VARIANT", id: original.id, assetVariantId: "stage-open-template/snare-drum-b" });
    const after = state.project.objects[0];
    const beforeWithoutVariant = { ...before };
    const afterWithoutVariant = { ...after };
    delete beforeWithoutVariant.assetVariantId;
    delete afterWithoutVariant.assetVariantId;

    expect(after.assetVariantId).toBe("stage-open-template/snare-drum-b");
    expect(afterWithoutVariant).toEqual(beforeWithoutVariant);
    expect(state.selectedIds).toEqual(selectedBefore);

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects[0].assetVariantId).toBe("stage-open-template/snare-drum-a");
    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects[0].assetVariantId).toBe("stage-open-template/snare-drum-b");
  });

  it("keyboard percussion B variants change only assetVariantId and support Undo/Redo", () => {
    const variants = [
      ["marimba-5oct", "stage-open-template/marimba-a", "stage-open-template/marimba-b"],
      ["vibraphone-standard", "stage-open-template/vibraphone-a", "stage-open-template/vibraphone-b"],
      ["xylophone-concert", "stage-open-template/xylophone-a", "stage-open-template/xylophone-b"],
      ["glockenspiel-concert", "stage-open-template/glockenspiel-concert-provisional", "stage-open-template/glockenspiel-b"],
    ] as const;

    for (const [index, [presetId, assetVariantA, assetVariantB]] of variants.entries()) {
      const original = {
        ...chair(`keyboard-${index}`, 1000 + index * 100, 2000 + index * 100),
        type: "instrument" as const,
        presetId,
        name: "鍵盤打楽器",
        widthMm: 1234,
        depthMm: 567,
        heightMm: 900,
        rotationDeg: 27,
        label: "B候補",
        assetVariantId: assetVariantA,
      };
      let state = withObjects([original]);
      const before = state.project.objects[0];
      const selectedBefore = state.selectedIds;

      state = appReducer(state, { type: "SET_OBJECT_ASSET_VARIANT", id: original.id, assetVariantId: assetVariantB });
      const after = state.project.objects[0];
      expect(after.assetVariantId).toBe(assetVariantB);
      expect(after).toMatchObject({
        presetId: before.presetId,
        xMm: before.xMm,
        yMm: before.yMm,
        widthMm: before.widthMm,
        depthMm: before.depthMm,
        heightMm: before.heightMm,
        rotationDeg: before.rotationDeg,
        label: before.label,
        groupId: before.groupId,
        layerId: before.layerId,
      });
      expect(state.selectedIds).toEqual(selectedBefore);

      state = appReducer(state, { type: "UNDO" });
      expect(state.project.objects[0].assetVariantId).toBe(assetVariantA);
      state = appReducer(state, { type: "REDO" });
      expect(state.project.objects[0].assetVariantId).toBe(assetVariantB);
    }
  });

  it("楽器以外の譜面台も×印へ切り替えられる", () => {
    const original = {
      ...chair("stand-1"),
      type: "musicStand" as const,
      presetId: "music-stand",
      name: "譜面台",
      widthMm: 480,
      depthMm: 450,
      assetVariantId: "stage-open-template/music-stand-a",
    };
    let state = withObjects([original]);
    state = appReducer(state, { type: "SET_OBJECT_ASSET_VARIANT", id: original.id, assetVariantId: "generated/music-stand-cross" });
    expect(state.project.objects[0].assetVariantId).toBe("generated/music-stand-cross");
    // 寸法・位置・回転はvariant切替では動かさない。
    expect(state.project.objects[0]).toMatchObject({ widthMm: 480, depthMm: 450, xMm: original.xMm, yMm: original.yMm });

    // variant台帳に無いassetIdは従来どおり拒否する。
    state = appReducer(state, { type: "SET_OBJECT_ASSET_VARIANT", id: original.id, assetVariantId: "stage-open-template/snare-drum-b" });
    expect(state.project.objects[0].assetVariantId).toBe("generated/music-stand-cross");
  });
});


describe("椅子の円内略称", () => {
  it("複数の椅子へ略称を一括適用し、Undo/Redoできる", () => {
    let state = withObjects([chair("a"), chair("b", 500), chair("c", 1000)]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b", "c"] });
    state = appReducer(state, { type: "SET_SELECTED_CHAIR_LABEL", label: "①" });

    expect(state.project.objects.map((object) => object.label)).toEqual(["①", "①", "①"]);
    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects.map((object) => object.label)).toEqual(["", "", ""]);
    state = appReducer(state, { type: "REDO" });
    expect(state.project.objects.map((object) => object.label)).toEqual(["①", "①", "①"]);
  });

  it("椅子以外とロック中の椅子は変更しない", () => {
    const stand: SceneObject = { ...chair("stand"), type: "musicStand", presetId: "music-stand", name: "譜面台" };
    let state = withObjects([chair("editable"), { ...chair("locked"), locked: true }, stand]);
    state = appReducer(state, { type: "SELECT_MANY", ids: ["editable", "locked", "stand"] });
    state = appReducer(state, { type: "SET_SELECTED_CHAIR_LABEL", label: "Cl" });

    expect(state.project.objects.find((object) => object.id === "editable")?.label).toBe("Cl");
    expect(state.project.objects.find((object) => object.id === "locked")?.label).toBe("");
    expect(state.project.objects.find((object) => object.id === "stand")?.label).toBe("");
  });
});
