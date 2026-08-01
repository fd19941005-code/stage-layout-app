import { describe, expect, it } from "vitest";
import { createPlacedObjectsFromUserTemplate } from "../core/userTemplate";
import { createEmptyProject } from "../core/project";
import { appReducer, createInitialState } from "./appState";
import type { SceneObject } from "../types/project";

function object(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    type: "chair",
    presetId: "chair",
    name: id,
    xMm: 1000,
    yMm: 2000,
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

describe("ユーザーテンプレートReducer Action", () => {
  it("複数選択から保存・名前変更・複製・削除をAction経由で行う", () => {
    let state = createInitialState();
    state = appReducer(state, { type: "ADD_OBJECT", object: object("a") });
    state = appReducer(state, { type: "ADD_OBJECT", object: object("b", { xMm: 1800, zIndex: 1 }) });
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    const beforeProjectHistory = state.past.length;

    state = appReducer(state, { type: "SAVE_USER_TEMPLATE", name: "椅子2脚" });
    expect(state.userTemplates).toHaveLength(1);
    expect(state.userTemplates[0]!.name).toBe("椅子2脚");
    expect(state.past).toHaveLength(beforeProjectHistory);

    const templateId = state.userTemplates[0]!.id;
    state = appReducer(state, { type: "RENAME_USER_TEMPLATE", id: templateId, name: "前列" });
    expect(state.userTemplates[0]!.name).toBe("前列");
    state = appReducer(state, { type: "DUPLICATE_USER_TEMPLATE", id: templateId });
    expect(state.userTemplates).toHaveLength(2);
    expect(state.userTemplates[1]!.id).not.toBe(templateId);
    state = appReducer(state, { type: "DELETE_USER_TEMPLATE", id: state.userTemplates[1]!.id });
    expect(state.userTemplates).toHaveLength(1);
  });

  it("テンプレート配置をADD_OBJECTS 1回へまとめ、1回のUndoで全生成物を消す", () => {
    let state = createInitialState();
    state = appReducer(state, { type: "ADD_OBJECT", object: object("source") });
    state = appReducer(state, { type: "ADD_OBJECT", object: object("source-2", { xMm: 1600, zIndex: 1 }) });
    state = appReducer(state, { type: "SELECT_MANY", ids: ["source", "source-2"] });
    state = appReducer(state, { type: "SAVE_USER_TEMPLATE", name: "配置セット" });
    const template = state.userTemplates[0]!;
    state = appReducer(state, { type: "SET_PENDING_USER_TEMPLATE", templateId: template.id });
    expect(state.pendingUserTemplateId).toBe(template.id);

    const beforeObjects = state.project.objects.length;
    const beforeHistory = state.past.length;
    let count = 0;
    const placed = createPlacedObjectsFromUserTemplate(
      template,
      state.project,
      state.activeLayerId,
      { xMm: 7000, yMm: 8000 },
      (prefix) => `${prefix}-placed-${++count}`,
    );
    state = appReducer(state, { type: "ADD_OBJECTS", objects: placed });

    expect(state.project.objects).toHaveLength(beforeObjects + placed.length);
    expect(state.selectedIds).toEqual(placed.map((item) => item.id));
    expect(state.pendingUserTemplateId).toBeNull();
    expect(state.past).toHaveLength(beforeHistory + 1);

    state = appReducer(state, { type: "UNDO" });
    expect(state.project.objects).toHaveLength(beforeObjects);
    expect(state.project.objects.some((item) => item.id === placed[0]!.id)).toBe(false);
  });

  it("新規／別プロジェクト読込でもライブラリのテンプレートを保持する", () => {
    let state = createInitialState();
    state = appReducer(state, { type: "ADD_OBJECT", object: object("a") });
    state = appReducer(state, { type: "ADD_OBJECT", object: object("b", { xMm: 1600 }) });
    state = appReducer(state, { type: "SELECT_MANY", ids: ["a", "b"] });
    state = appReducer(state, { type: "SAVE_USER_TEMPLATE", name: "共有セット" });
    const template = state.userTemplates[0]!;
    state = appReducer(state, { type: "LOAD_PROJECT", project: createEmptyProject("別プロジェクト") });
    expect(state.userTemplates).toEqual([template]);
    state = appReducer(state, { type: "NEW_PROJECT" });
    expect(state.userTemplates[0]!.name).toBe("共有セット");
  });
});
