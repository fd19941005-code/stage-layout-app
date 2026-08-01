import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AppState } from "../state/appState";
import { EditCommandList, handleCommandMenuKeyDown } from "./EditMenu";
import type { EditCommand } from "../core/editCommands";

interface ContextMenuPosition {
  readonly x: number;
  readonly y: number;
}

interface Props {
  state: AppState;
  clipboardAvailable: boolean;
  position: ContextMenuPosition | null;
  onCommand: (command: EditCommand) => void;
  onClose: () => void;
}

export function ObjectContextMenu({ state, clipboardAvailable, position, onCommand, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<ContextMenuPosition | null>(position);

  useEffect(() => {
    if (!position) return;
    setMenuPosition(position);
    const frame = window.requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;
      const rect = menu.getBoundingClientRect();
      const margin = 8;
      setMenuPosition({
        x: Math.max(margin, Math.min(position.x, window.innerWidth - rect.width - margin)),
        y: Math.max(margin, Math.min(position.y, window.innerHeight - rect.height - margin)),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [position]);

  useEffect(() => {
    if (!position) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [position, onClose]);

  useEffect(() => {
    if (!position) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [position]);

  if (!position || !menuPosition) return null;
  return (
    <div
      ref={menuRef}
      className="object-context-menu edit-menu-panel"
      role="menu"
      aria-label="オブジェクト編集メニュー"
      style={{ left: menuPosition.x, top: menuPosition.y }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => handleCommandMenuKeyDown(event, onClose)}
    >
      <EditCommandList state={state} clipboardAvailable={clipboardAvailable} onCommand={onCommand} onClose={onClose} />
    </div>
  );
}
