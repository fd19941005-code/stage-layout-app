import { describe, expect, it } from "vitest";
import {
  blocksCanvasShortcut,
  getFavoritePresetDigit,
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

  it("Phase Aの操作高速化キーを正しく分類する", () => {
    expect(getKeyboardShortcut(key("V"))).toBe("modeSelect");
    expect(getKeyboardShortcut(key("b"))).toBe("modeSelectRect");
    expect(getKeyboardShortcut(key("m"))).toBe("modeMeasure");
    expect(getKeyboardShortcut(key("w"))).toBe("modeTraceWall");
    expect(getKeyboardShortcut(key("k"))).toBe("modeCalibrate");
    expect(getKeyboardShortcut(key("p"))).toBe("modeAimPoint");
    expect(getKeyboardShortcut(key("t"))).toBe("modeAnnotationText");
    expect(getKeyboardShortcut(key("l"))).toBe("modeAnnotationLine");
    expect(getKeyboardShortcut(key("a"))).toBe("modeAnnotationArrow");
    expect(getKeyboardShortcut(key("r"))).toBe("modeAnnotationRect");
    expect(getKeyboardShortcut(key("o"))).toBe("modeAnnotationCircle");
    expect(getKeyboardShortcut(key("n"))).toBe("modeAnnotationDimension");
    expect(getKeyboardShortcut(key("]"))).toBe("rotateCw");
    expect(getKeyboardShortcut(key("["))).toBe("rotateCcw");
    expect(getKeyboardShortcut(key("}", { shiftKey: true }))).toBe("rotateCwFine");
    expect(getKeyboardShortcut(key("{", { shiftKey: true }))).toBe("rotateCcwFine");
    expect(getKeyboardShortcut(key("f"))).toBe("zoomFit");
    expect(getKeyboardShortcut(key("f", { shiftKey: true }))).toBe("zoomSelection");
    expect(getKeyboardShortcut(key("="))).toBe("zoomIn");
    expect(getKeyboardShortcut(key("+", { shiftKey: true }))).toBe("zoomIn");
    expect(getKeyboardShortcut(key("-"))).toBe("zoomOut");
    expect(getKeyboardShortcut(key("q"))).toBe("repeatLastPreset");
    expect(getKeyboardShortcut(key("1"))).toBe("favoritePreset");
    expect(getKeyboardShortcut(key("Tab"))).toBe("nextSelection");
    expect(getKeyboardShortcut(key("Tab", { shiftKey: true }))).toBe("previousSelection");
    expect(getFavoritePresetDigit(key("9"))).toBe(9);
    expect(getFavoritePresetDigit(key("1", { ctrlKey: true }))).toBeNull();
  });

  it("IMEと修飾キーによる誤起動を抑止する", () => {
    expect(getKeyboardShortcut(key("v", { ctrlKey: true }))).toBe("paste");
    expect(getKeyboardShortcut(key("v", { isComposing: true }))).toBeNull();
    expect(getKeyboardShortcut(key("v", { keyCode: 229 }))).toBeNull();
    expect(getKeyboardShortcut(key("v", { shiftKey: true }))).toBeNull();
    expect(getKeyboardShortcut(key("q", { altKey: true }))).toBeNull();
  });

  it("新しい一回操作キーのrepeatを抑止する", () => {
    for (const shortcut of ["modeSelect", "modeAnnotationText", "rotateCw", "zoomFit", "repeatLastPreset", "favoritePreset", "nextSelection"] as const) {
      expect(suppressesKeyRepeat(shortcut)).toBe(true);
    }
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
