import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AppState } from "../state/appState";
import { canExecuteEditCommand, type EditCommand } from "../core/editCommands";

interface EditMenuProps {
  state: AppState;
  clipboardAvailable: boolean;
  onCommand: (command: EditCommand) => void;
}

interface EditCommandListProps extends EditMenuProps {
  onClose: () => void;
}

interface EditMenuItem {
  readonly command: EditCommand;
  readonly label: string;
  readonly shortcut?: string;
  readonly separatorBefore?: boolean;
  readonly danger?: boolean;
}

const EDIT_MENU_ITEMS: readonly EditMenuItem[] = [
  { command: "undo", label: "元に戻す", shortcut: "Ctrl/Cmd+Z" },
  { command: "redo", label: "やり直す", shortcut: "Ctrl/Cmd+Y" },
  { command: "copy", label: "コピー", shortcut: "Ctrl/Cmd+C", separatorBefore: true },
  { command: "cut", label: "切り取り", shortcut: "Ctrl/Cmd+X" },
  { command: "paste", label: "貼り付け", shortcut: "Ctrl/Cmd+V" },
  { command: "pasteInPlace", label: "元の座標へ貼り付け", shortcut: "Ctrl/Cmd+Shift+V" },
  { command: "duplicate", label: "複製", shortcut: "Ctrl/Cmd+D", separatorBefore: true },
  { command: "group", label: "グループ化", shortcut: "Ctrl/Cmd+G" },
  { command: "ungroup", label: "グループ解除", shortcut: "Ctrl/Cmd+Shift+G" },
  { command: "selectAll", label: "すべて選択", shortcut: "Ctrl/Cmd+A" },
  { command: "delete", label: "削除", shortcut: "Delete / Backspace", separatorBefore: true, danger: true },
];

/** メニュー内の矢印移動とEscapeを、編集メニューと右クリックメニューで共有する。 */
export function handleCommandMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>, onClose: () => void) {
  const menu = event.currentTarget;
  const isMenuNavigationKey = event.key === "Escape"
    || event.key === "ArrowDown"
    || event.key === "ArrowUp"
    || event.key === "Home"
    || event.key === "End";
  if (isMenuNavigationKey) event.stopPropagation();
  const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  const focusAt = (index: number) => {
    event.preventDefault();
    items[(index + items.length) % items.length]?.focus();
  };

  if (event.key === "Escape") {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key === "ArrowDown") {
    focusAt(currentIndex < 0 ? 0 : currentIndex + 1);
    return;
  }
  if (event.key === "ArrowUp") {
    focusAt(currentIndex < 0 ? items.length - 1 : currentIndex - 1);
    return;
  }
  if (event.key === "Home") {
    focusAt(0);
    return;
  }
  if (event.key === "End") {
    focusAt(items.length - 1);
  }
}

export function EditCommandList({ state, clipboardAvailable, onCommand, onClose }: EditCommandListProps) {
  return (
    <>
      {EDIT_MENU_ITEMS.map((item) => {
        const disabled = !canExecuteEditCommand(state, item.command, clipboardAvailable);
        return (
          <div key={item.command} className={item.separatorBefore ? "edit-menu-segment separated" : "edit-menu-segment"}>
            {item.separatorBefore && <div className="edit-menu-separator" role="separator" />}
            <button
              type="button"
              role="menuitem"
              className={`edit-command-item${item.danger ? " danger" : ""}`}
              disabled={disabled}
              aria-keyshortcuts={item.shortcut}
              onClick={() => {
                onCommand(item.command);
                onClose();
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && <kbd>{item.shortcut}</kbd>}
            </button>
          </div>
        );
      })}
    </>
  );
}

export function EditMenu({ state, clipboardAvailable, onCommand }: EditMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open]);

  return (
    <div ref={rootRef} className="edit-menu">
      <button
        ref={triggerRef}
        type="button"
        className="edit-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        編集
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div ref={menuRef} className="edit-menu-panel" role="menu" aria-label="編集操作" onKeyDown={(event) => handleCommandMenuKeyDown(event, close)}>
          <EditCommandList state={state} clipboardAvailable={clipboardAvailable} onCommand={onCommand} onClose={close} />
        </div>
      )}
    </div>
  );
}
