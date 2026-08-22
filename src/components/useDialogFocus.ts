import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

interface UseDialogFocusOptions {
  open?: boolean;
  onClose?: () => void;
}

/**
 * Blocking dialogの初期フォーカス、Tab循環、Escape、起動元復帰を共通化する。
 * 非モーダルのプレビューには適用せず、キャンバスのポインター操作を残す。
 */
export function useDialogFocus<T extends HTMLElement>(
  dialogRef: RefObject<T>,
  { open = true, onClose }: UseDialogFocusOptions = {},
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const dialogElement = dialog;

    const trigger = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => {
      const firstField = dialogElement.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
      const firstFocusable = dialogElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstField ?? firstFocusable ?? dialogElement).focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }

      const active = document.activeElement;
      const currentIndex = focusable.indexOf(active instanceof HTMLElement ? active : focusable[0]);
      if (event.shiftKey && (currentIndex <= 0 || !dialogElement.contains(active))) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && (currentIndex === focusable.length - 1 || !dialogElement.contains(active))) {
        event.preventDefault();
        focusable[0].focus();
      }
    }

    function focusBackInside(event: FocusEvent) {
      if (dialogElement.contains(event.target as Node)) return;
      const firstFocusable = dialogElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? dialogElement).focus();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", focusBackInside);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", focusBackInside);
      if (trigger?.isConnected) {
        window.requestAnimationFrame(() => trigger.focus());
      }
    };
  }, [dialogRef, open]);
}
