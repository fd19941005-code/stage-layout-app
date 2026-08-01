// キーボード入力の意味付けをUIのイベント配線から分離する。

export type KeyboardShortcut =
  | "escape"
  | "undo"
  | "redo"
  | "copy"
  | "cut"
  | "paste"
  | "pasteInPlace"
  | "duplicate"
  | "selectAll"
  | "group"
  | "ungroup"
  | "delete"
  | "arrowLeft"
  | "arrowRight"
  | "arrowUp"
  | "arrowDown";

export interface KeyboardShortcutInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

export interface KeyboardTargetInfo {
  readonly tagName: string | null;
  readonly contentEditable: boolean;
  readonly role: string | null;
  readonly hasContentEditableAncestor: boolean;
  readonly hasTextboxRoleAncestor: boolean;
  readonly tabIndex: number | null;
  readonly hasInteractiveAncestor: boolean;
}

export function getKeyboardShortcut(input: KeyboardShortcutInput): KeyboardShortcut | null {
  const modifier = input.ctrlKey || input.metaKey;
  const key = input.key.toLowerCase();

  if (input.key === "Escape") return "escape";

  if (modifier) {
    if (key === "z") return input.shiftKey ? "redo" : "undo";
    if (key === "y") return "redo";
    if (key === "c") return "copy";
    if (key === "x") return "cut";
    if (key === "v") return input.shiftKey ? "pasteInPlace" : "paste";
    if (key === "d") return "duplicate";
    if (key === "a") return "selectAll";
    if (key === "g") return input.shiftKey ? "ungroup" : "group";
    return null;
  }

  switch (input.key) {
    case "ArrowLeft": return "arrowLeft";
    case "ArrowRight": return "arrowRight";
    case "ArrowUp": return "arrowUp";
    case "ArrowDown": return "arrowDown";
    case "Delete":
    case "Backspace":
      return "delete";
    default:
      return null;
  }
}

/** 押しっぱなしで複製・クリップボード操作・グループ操作を連続実行しない。 */
export function suppressesKeyRepeat(shortcut: KeyboardShortcut): boolean {
  return shortcut === "copy"
    || shortcut === "cut"
    || shortcut === "paste"
    || shortcut === "pasteInPlace"
    || shortcut === "duplicate"
    || shortcut === "group"
    || shortcut === "ungroup";
}

export function blocksCanvasShortcut(target: KeyboardTargetInfo, shortcut?: KeyboardShortcut): boolean {
  const tagName = target.tagName?.toUpperCase() ?? "";
  const textEditing = tagName === "INPUT"
    || tagName === "TEXTAREA"
    || tagName === "SELECT"
    || target.contentEditable
    || target.role?.toLowerCase() === "textbox"
    || target.hasContentEditableAncestor
    || target.hasTextboxRoleAncestor;

  if (textEditing) return true;

  // Keep destructive and arrow-key canvas commands away from focused controls.
  // Modifier shortcuts remain global so Ctrl/Cmd+Z/C/V/etc. keep working.
  // Text fields are handled above as normal editing contexts.
  const canvasFocusShortcut = shortcut === "delete"
    || shortcut === "arrowLeft"
    || shortcut === "arrowRight"
    || shortcut === "arrowUp"
    || shortcut === "arrowDown";
  if (!canvasFocusShortcut) return false;

  const role = target.role?.toLowerCase() ?? "";
  const interactiveTag = tagName === "BUTTON" || tagName === "A" || tagName === "SUMMARY";
  const interactiveRole = [
    "button",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "tab",
    "slider",
    "switch",
    "checkbox",
    "radio",
    "combobox",
    "listbox",
    "treeitem",
  ].includes(role);
  return interactiveTag || interactiveRole || target.hasInteractiveAncestor || (
    target.tabIndex !== null && role !== "application"
  );
}

/** Browser DOMから入力先情報を取り出す。判定本体はblocksCanvasShortcutの純粋関数。 */
export function getKeyboardTargetInfo(target: EventTarget | null): KeyboardTargetInfo {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return {
      tagName: null,
      contentEditable: false,
      role: null,
      hasContentEditableAncestor: false,
      hasTextboxRoleAncestor: false,
      tabIndex: null,
      hasInteractiveAncestor: false,
    };
  }
  const htmlTarget = typeof HTMLElement !== "undefined" && target instanceof HTMLElement ? target : null;
  const tabIndexAttribute = target.getAttribute("tabindex");
  const interactiveAncestor = target.closest(
    'button, a, summary, [role="button"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="slider"], [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="listbox"], [role="treeitem"]',
  );
  return {
    tagName: target.tagName,
    contentEditable: Boolean(htmlTarget?.isContentEditable) || target.getAttribute("contenteditable") !== null,
    role: target.getAttribute("role"),
    hasContentEditableAncestor: target.closest("[contenteditable]") !== null,
    hasTextboxRoleAncestor: target.closest('[role="textbox"]') !== null,
    tabIndex: tabIndexAttribute === null ? null : Number(tabIndexAttribute),
    hasInteractiveAncestor: interactiveAncestor !== null && interactiveAncestor !== target,
  };
}
