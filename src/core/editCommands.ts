// 編集メニュー、コンテキストメニュー、ショートカットが共有する操作名と
// メニュー上の実行可否を、UIイベントから分離する。

import type { AppState } from "../state/appState";
import { createObjectClipboard } from "./objectClipboard";

export type EditCommand =
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
  | "delete";

/** 編集メニューで操作を有効にする条件。実行時にも同じ条件を再確認する。 */
export function canExecuteEditCommand(
  state: Pick<AppState, "past" | "future" | "project" | "selectedIds">,
  command: EditCommand,
  clipboardAvailable: boolean,
): boolean {
  switch (command) {
    case "undo": return state.past.length > 0;
    case "redo": return state.future.length > 0;
    case "copy": return createObjectClipboard(state.project, state.selectedIds) !== null;
    case "cut": return state.selectedIds.length > 0
      && createObjectClipboard(state.project, state.selectedIds) !== null;
    case "paste":
    case "pasteInPlace": return clipboardAvailable;
    case "duplicate":
    case "delete": return state.selectedIds.length > 0;
    case "group": return state.selectedIds.length >= 2;
    case "ungroup": return state.selectedIds.some((id) => {
      const object = state.project.objects.find((candidate) => candidate.id === id);
      return object?.groupId !== null && object?.groupId !== undefined;
    });
    case "selectAll": return state.project.objects.some((object) => object.visible);
  }
}
