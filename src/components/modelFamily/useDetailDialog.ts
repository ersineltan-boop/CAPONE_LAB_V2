import { useEffect, useRef } from "react";
import {
  detailDialogFocusable,
  detailDialogIsActive,
  handleDetailDialogKey,
} from "./dialogKeyboard";

export function useDetailDialog(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    // Gallery dialogs lock body separately; keep independent ownership so
    // unmounting nested dialogs cannot restore each other's stale scroll lock.
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKey = (event: KeyboardEvent) =>
      handleDetailDialogKey(event, dialog, () => onCloseRef.current());
    const handleFocus = (event: FocusEvent) => {
      if (!detailDialogIsActive(dialog) || dialog.contains(event.target as Node)) return;
      (detailDialogFocusable(dialog)[0] ?? dialog).focus();
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", handleFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", handleFocus);
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && !previousFocus.closest("[inert]")) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return { dialogRef, closeButtonRef };
}
