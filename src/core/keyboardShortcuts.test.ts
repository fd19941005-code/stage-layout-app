import { describe, expect, it } from "vitest";
import {
  blocksCanvasShortcut,
  getKeyboardShortcut,
  suppressesKeyRepeat,
  type KeyboardShortcutInput,
  type KeyboardTargetInfo,
} from "./keyboardShortcuts";

function key(key: string, overrides: Partial<KeyboardShortcutInput> = {}): KeyboardShortcutInput {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

function target(overrides: Partial<KeyboardTargetInfo> = {}): KeyboardTargetInfo {
  return {
    tagName: "DIV",
    contentEditable: false,
    role: null,
    hasContentEditableAncestor: false,
    hasTextboxRoleAncestor: false,
    tabIndex: null,
    hasInteractiveAncestor: false,
    ...overrides,
  };
}

describe("キーボードショートカット判定", () => {
  it("Ctrl/Cmdのコピー系・グループ系と既存コマンドを判定する", () => {
    expect(getKeyboardShortcut(key("c", { ctrlKey: true }))).toBe("copy");
    expect(getKeyboardShortcut(key("x", { metaKey: true }))).toBe("cut");
    expect(getKeyboardShortcut(key("v", { ctrlKey: true }))).toBe("paste");
    expect(getKeyboardShortcut(key("v", { metaKey: true, shiftKey: true }))).toBe("pasteInPlace");
    expect(getKeyboardShortcut(key("g", { ctrlKey: true }))).toBe("group");
    expect(getKeyboardShortcut(key("g", { metaKey: true, shiftKey: true }))).toBe("ungroup");
    expect(getKeyboardShortcut(key("z", { ctrlKey: true }))).toBe("undo");
    expect(getKeyboardShortcut(key("z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(getKeyboardShortcut(key("y", { metaKey: true }))).toBe("redo");
    expect(getKeyboardShortcut(key("d", { ctrlKey: true }))).toBe("duplicate");
    expect(getKeyboardShortcut(key("a", { ctrlKey: true }))).toBe("selectAll");
    expect(getKeyboardShortcut(key("Delete"))).toBe("delete");
    expect(getKeyboardShortcut(key("Backspace"))).toBe("delete");
    expect(getKeyboardShortcut(key("ArrowLeft"))).toBe("arrowLeft");
    expect(getKeyboardShortcut(key("Escape"))).toBe("escape");
  });

  it("コピー・切り取り・貼り付け・複製・グループ操作はrepeatを抑止する", () => {
    expect(suppressesKeyRepeat("copy")).toBe(true);
    expect(suppressesKeyRepeat("cut")).toBe(true);
    expect(suppressesKeyRepeat("paste")).toBe(true);
    expect(suppressesKeyRepeat("pasteInPlace")).toBe(true);
    expect(suppressesKeyRepeat("duplicate")).toBe(true);
    expect(suppressesKeyRepeat("undo")).toBe(false);
    expect(suppressesKeyRepeat("arrowLeft")).toBe(false);
  });

  it("入力欄では編集を優先し、操作可能なUIでは削除・矢印のキャンバス操作を止める", () => {
    expect(blocksCanvasShortcut(target({ tagName: "INPUT" }), "delete")).toBe(true);
    expect(blocksCanvasShortcut(target({ tagName: "TEXTAREA" }), "arrowLeft")).toBe(true);
    expect(blocksCanvasShortcut(target({ tagName: "SELECT" }), "arrowDown")).toBe(true);
    expect(blocksCanvasShortcut(target({ contentEditable: true }), "delete")).toBe(true);
    expect(blocksCanvasShortcut(target({ role: "textbox" }), "delete")).toBe(true);
    expect(blocksCanvasShortcut(target({ hasContentEditableAncestor: true }), "delete")).toBe(true);
    expect(blocksCanvasShortcut(target({ hasTextboxRoleAncestor: true }), "delete")).toBe(true);

    for (const control of [
      target({ tagName: "BUTTON" }),
      target({ role: "menuitem" }),
      target({ role: "tab" }),
      target({ role: "slider" }),
    ]) {
      expect(blocksCanvasShortcut(control, "delete")).toBe(true);
      expect(blocksCanvasShortcut(control, "arrowRight")).toBe(true);
      expect(blocksCanvasShortcut(control, "undo")).toBe(false);
    }

    expect(blocksCanvasShortcut(target({ role: "application", tabIndex: 0 }), "delete")).toBe(false);
    expect(blocksCanvasShortcut(target(), "delete")).toBe(false);
  });
});
