import { describe, expect, it, vi } from "vitest";
import { handleDetailDialogKey } from "../dialogKeyboard";

function fixture() {
  const first = { tabIndex: 0, focus: vi.fn(), closest: () => null, getClientRects: () => [{}] };
  const last = { ...first, focus: vi.fn() };
  const hidden = { ...first, focus: vi.fn(), getClientRects: () => [] };
  const doc = { activeElement: first, querySelector: vi.fn(() => null as object | null) };
  const dialog = {
    isConnected: true, closest: vi.fn(() => null as object | null), ownerDocument: doc,
    querySelectorAll: vi.fn(() => [first, hidden, last]), focus: vi.fn(),
  };
  const close = vi.fn();
  const event = (key: string, extra = {}) => ({
    key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
    defaultPrevented: false, isComposing: false, repeat: false,
    preventDefault: vi.fn(), ...extra,
  });
  const run = (e: ReturnType<typeof event>) =>
    handleDetailDialogKey(e as unknown as KeyboardEvent, dialog as unknown as HTMLElement, close);
  return { first, last, hidden, doc, dialog, close, event, run };
}

describe("product detail dialog keyboard", () => {
  it("closes on Escape without treating composition/repeat as close", () => {
    const f = fixture();
    f.run(f.event("Escape", { isComposing: true }));
    f.run(f.event("Escape", { repeat: true }));
    expect(f.close).not.toHaveBeenCalled();
    const escape = f.event("Escape"); f.run(escape);
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    expect(f.close).toHaveBeenCalledOnce();
  });

  it("leaves Escape and Tab to the nested fullscreen gallery", () => {
    const f = fixture(); f.doc.querySelector.mockReturnValue({});
    const escape = f.event("Escape"), tab = f.event("Tab", { shiftKey: true });
    f.run(escape); f.run(tab);
    expect(f.close).not.toHaveBeenCalled();
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(f.last.focus).not.toHaveBeenCalled();
  });

  it("wraps Tab and Shift+Tab around visible controls only", () => {
    const f = fixture(); f.doc.activeElement = f.last;
    f.run(f.event("Tab")); expect(f.first.focus).toHaveBeenCalledOnce();
    f.doc.activeElement = f.first;
    f.run(f.event("Tab", { shiftKey: true })); expect(f.last.focus).toHaveBeenCalledOnce();
    expect(f.hidden.focus).not.toHaveBeenCalled();
  });

  it("lets normal editing and browser shortcuts keep their default behavior", () => {
    const f = fixture();
    for (const e of [f.event("ArrowLeft"), f.event("Tab", { ctrlKey: true }), f.event("Escape", { defaultPrevented: true })]) {
      f.run(e); expect(e.preventDefault).not.toHaveBeenCalled();
    }
    expect(f.close).not.toHaveBeenCalled();
  });

  it("focuses the dialog if there are no usable controls", () => {
    const f = fixture(); f.dialog.querySelectorAll.mockReturnValue([]);
    f.run(f.event("Tab")); expect(f.dialog.focus).toHaveBeenCalledOnce();
  });

  it("does not handle keys for an inert or disconnected detail", () => {
    const f = fixture(); f.dialog.closest.mockReturnValue({});
    f.run(f.event("Escape"));
    f.dialog.closest.mockReturnValue(null); f.dialog.isConnected = false;
    f.run(f.event("Escape")); expect(f.close).not.toHaveBeenCalled();
  });
});
