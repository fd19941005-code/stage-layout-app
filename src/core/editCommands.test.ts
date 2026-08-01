import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/appState";
import { createEmptyProject } from "./project";
import { canExecuteEditCommand } from "./editCommands";
import type { SceneObject } from "../types/project";

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

function stateWith(objects: SceneObject[], selectedIds: string[]) {
  const initial = createInitialState();
  const project = createEmptyProject("編集メニュー");
  project.objects = objects;
  return { ...initial, project, selectedIds };
}

describe("編集コマンドの実行可否", () => {
  it("選択状態に応じてコピー・切り取り・削除を有効化する", () => {
    const editable = stateWith([object("chair")], ["chair"]);
    expect(canExecuteEditCommand(editable, "copy", false)).toBe(true);
    expect(canExecuteEditCommand(editable, "cut", false)).toBe(true);
    expect(canExecuteEditCommand(editable, "delete", false)).toBe(true);

    const locked = stateWith([object("chair", { locked: true })], ["chair"]);
    expect(canExecuteEditCommand(locked, "copy", false)).toBe(true);
    expect(canExecuteEditCommand(locked, "cut", false)).toBe(true);
  });

  it("貼り付けはアプリ内クリップボードがある場合だけ有効化する", () => {
    const state = stateWith([], []);
    expect(canExecuteEditCommand(state, "paste", false)).toBe(false);
    expect(canExecuteEditCommand(state, "pasteInPlace", true)).toBe(true);
  });

  it("グループ解除は選択中にgroupIdがある場合だけ有効化する", () => {
    const grouped = stateWith([object("chair", { groupId: "group-1" })], ["chair"]);
    const ungrouped = stateWith([object("chair")], ["chair"]);
    expect(canExecuteEditCommand(grouped, "ungroup", false)).toBe(true);
    expect(canExecuteEditCommand(ungrouped, "ungroup", false)).toBe(false);
  });
});
