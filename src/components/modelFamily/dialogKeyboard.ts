const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function detailDialogIsActive(dialog: HTMLElement): boolean {
  return dialog.isConnected &&
    !dialog.closest('[inert], [aria-hidden="true"]') &&
    !dialog.ownerDocument.querySelector("[data-product-gallery-modal]");
}

export function detailDialogFocusable(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.tabIndex >= 0 && element.getClientRects().length > 0 &&
      !element.closest('[inert], [aria-hidden="true"]'),
  );
}

export function handleDetailDialogKey(
  event: KeyboardEvent,
  dialog: HTMLElement,
  onClose: () => void,
): void {
  if (event.defaultPrevented || event.isComposing || !detailDialogIsActive(dialog)) return;
  if (event.key === "Escape") {
    if (event.repeat) return;
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey) return;
  const focusable = detailDialogFocusable(dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const index = focusable.indexOf(dialog.ownerDocument.activeElement as HTMLElement);
  if (event.shiftKey && index <= 0) {
    event.preventDefault();
    focusable[focusable.length - 1]?.focus();
  } else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
    event.preventDefault();
    focusable[0]?.focus();
  }
}
