import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./project";
import { selectionBoundsMm } from "./layout";
import {
  createObjectClipboard,
  createPastedObjects,
  hasProtectedObjectInSelection,
  hasLockedObjectInSelection,
  isCuttableSelection,
} from "./objectClipboard";
import type { Project, SceneObject } from "../types/project";

function object(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: id,
    xMm: 0,
    yMm: 0,
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
    ...overrides,
  };
}

function projectWith(objects: SceneObject[]): Project {
  const project = createEmptyProject("クリップボードテスト");
  project.objects = objects;
  return project;
}

function idFactory() {
  let count = 0;
  return (prefix: string) => `${prefix}-paste-${++count}`;
}

describe("アプリ内オブジェクトクリップボード", () => {
  it("単一オブジェクトをコピーし、元位置から500mmずらして貼り付ける", () => {
    const source = object("source", { xMm: 100, yMm: 200, zIndex: 4, locked: true });
    const project = projectWith([source]);
    const clipboard = createObjectClipboard(project, [source.id]);
    expect(clipboard).not.toBeNull();

    const pasted = createPastedObjects(
      clipboard!,
      project,
      "layer-objects",
      { cursorMm: null, preservePosition: false },
      idFactory(),
    );

    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toMatchObject({
      id: "obj-paste-1",
      xMm: 600,
      yMm: 700,
      zIndex: 5,
      locked: false,
    });
    expect(clipboard!.objects[0]).toMatchObject({ id: "source", xMm: 100, yMm: 200, locked: true });
  });

  it("複数オブジェクトの相対位置を維持し、選択範囲の中心をカーソルへ合わせる", () => {
    const sources = [
      object("a", { xMm: 0, yMm: 0, widthMm: 100, depthMm: 100 }),
      object("b", { xMm: 1000, yMm: 500, widthMm: 200, depthMm: 100, zIndex: 1 }),
    ];
    const project = projectWith(sources);
    const clipboard = createObjectClipboard(project, ["a", "b"]);
    const pasted = createPastedObjects(
      clipboard!,
      project,
      "layer-objects",
      { cursorMm: { xMm: 5000, yMm: 6000 }, preservePosition: false },
      idFactory(),
    );

    expect(pasted[1]!.xMm - pasted[0]!.xMm).toBe(1000);
    expect(pasted[1]!.yMm - pasted[0]!.yMm).toBe(500);
    const pastedBounds = selectionBoundsMm(pasted, pasted.map((item) => item.id));
    expect(pastedBounds).not.toBeNull();
    expect((pastedBounds!.minXMm + pastedBounds!.maxXMm) / 2).toBe(5000);
    expect((pastedBounds!.minYMm + pastedBounds!.maxYMm) / 2).toBe(6000);
  });

  it("全IDを再生成し、グループ単位で新しいgroupIdへ分離する", () => {
    const sources = [
      object("a", { groupId: "source-group", zIndex: 2 }),
      object("b", { groupId: "source-group", xMm: 500, zIndex: 3 }),
    ];
    const project = projectWith([...sources, object("existing", { zIndex: 20 })]);
    const clipboard = createObjectClipboard(project, ["a", "b"]);
    const pasted = createPastedObjects(
      clipboard!,
      project,
      "layer-objects",
      { cursorMm: null, preservePosition: true },
      idFactory(),
    );

    expect(new Set(pasted.map((item) => item.id)).size).toBe(2);
    expect(pasted.map((item) => item.id)).not.toEqual(["a", "b"]);
    expect(new Set(pasted.map((item) => item.groupId)).size).toBe(1);
    expect(pasted[0]!.groupId).not.toBe("source-group");
    expect(pasted[0]!.groupId).toBe(pasted[1]!.groupId);
    expect(pasted.map((item) => item.zIndex)).toEqual([21, 22]);
  });

  it("onRiserIdを内部参照・同一プロジェクト外部参照・別プロジェクトで正しく解決する", () => {
    const sources = [
      object("riser", { type: "riser", presetId: "riser-3x6", onRiserId: null }),
      object("chair", { onRiserId: "riser" }),
      object("outside-chair", { onRiserId: "outside-riser" }),
      object("outside-riser", { type: "riser", presetId: "riser-3x6" }),
    ];
    const project = projectWith(sources);
    const internalClipboard = createObjectClipboard(project, ["riser", "chair"]);
    const internalPaste = createPastedObjects(
      internalClipboard!,
      project,
      "layer-objects",
      { cursorMm: null, preservePosition: true },
      idFactory(),
    );
    const newRiserId = internalPaste.find((item) => item.name === "riser")?.id;
    expect(internalPaste.find((item) => item.name === "chair")?.onRiserId).toBe(newRiserId);

    const externalClipboard = createObjectClipboard(project, ["outside-chair"]);
    const sameProjectPaste = createPastedObjects(
      externalClipboard!,
      project,
      "layer-objects",
      { cursorMm: null, preservePosition: true },
      idFactory(),
    );
    expect(sameProjectPaste[0]!.onRiserId).toBe("outside-riser");

    const otherProject = projectWith([]);
    const otherProjectPaste = createPastedObjects(
      externalClipboard!,
      otherProject,
      "layer-objects",
      { cursorMm: null, preservePosition: true },
      idFactory(),
    );
    expect(otherProjectPaste[0]!.onRiserId).toBeNull();
    expect(otherProjectPaste[0]!.layerId).toBe("layer-objects");
  });

  it("元位置貼り付けは座標と終点を維持し、使用不能な元レイヤーはactiveLayerへ切り替える", () => {
    const project = createEmptyProject("レイヤーテスト");
    project.layers.push({ id: "locked-layer", name: "ロック", visible: true, locked: true });
    const source = object("line", {
      type: "shape",
      annotationKind: "line",
      layerId: "locked-layer",
      xMm: 123,
      yMm: 456,
      endXMm: 789,
      endYMm: 987,
    });
    project.objects = [source];
    const clipboard = createObjectClipboard(project, [source.id]);
    const pasted = createPastedObjects(
      clipboard!,
      project,
      "layer-objects",
      { cursorMm: { xMm: 9999, yMm: 9999 }, preservePosition: true },
      idFactory(),
    );

    expect(pasted[0]).toMatchObject({
      xMm: 123,
      yMm: 456,
      endXMm: 789,
      endYMm: 987,
      layerId: "layer-objects",
      locked: false,
    });
  });

  it("コピー対象は可視かつ通常編集対象に限定し、切り取りの保護判定は全選択を対象にする", () => {
    const project = projectWith([
      object("visible"),
      object("hidden", { visible: false }),
      object("locked", { locked: true }),
      object("background", { backgroundFixed: true }),
    ]);
    expect(createObjectClipboard(project, ["visible", "hidden", "background"])?.objects.map((item) => item.id)).toEqual(["visible"]);
    expect(hasLockedObjectInSelection(project, ["visible", "locked"])).toBe(true);
    expect(hasProtectedObjectInSelection(project, ["visible", "background"])).toBe(true);
    expect(isCuttableSelection(project, ["visible", "locked"])).toBe(false);
    expect(isCuttableSelection(project, ["visible", "background"])).toBe(false);
    expect(isCuttableSelection(project, ["visible"])).toBe(true);
  });
});
