import { createElement, type PointerEvent, type MouseEvent } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useGallerySwipe } from "../useGallerySwipe";

function setup() {
  const next = vi.fn(), prev = vi.fn();
  let handlers!: ReturnType<typeof useGallerySwipe>;
  function Probe() {
    handlers = useGallerySwipe(true, "gallery-a", next, prev);
    return null;
  }
  renderToString(createElement(Probe));
  const surface = { contains: vi.fn(() => true), setPointerCapture: vi.fn() };
  function event(x: number, options: { control?: boolean; buttons?: number; type?: string } = {}) {
    return {
      pointerId: 1, pointerType: options.type ?? "touch", button: 0,
      buttons: options.buttons ?? 1, clientX: x, clientY: 100,
      currentTarget: surface,
      target: { closest: () => options.control ? {} : null },
      preventDefault: vi.fn(), stopPropagation: vi.fn(), detail: 1,
    };
  }
  const pointer = (e: ReturnType<typeof event>) => e as unknown as PointerEvent<HTMLDivElement>;
  const click = (e: ReturnType<typeof event>) => e as unknown as MouseEvent<HTMLDivElement>;
  return { handlers, next, prev, surface, event, pointer, click };
}

describe("shared gallery pointer handlers", () => {
  it("navigates on touch and prevents its generated click from opening another gallery", () => {
    const { handlers, next, event, pointer, click } = setup();
    handlers.onPointerDown(pointer(event(200)));
    handlers.onPointerUp(pointer(event(100)));
    expect(next).toHaveBeenCalledOnce();
    const generatedClick = event(100);
    handlers.onClickCapture(click(generatedClick));
    expect(generatedClick.preventDefault).toHaveBeenCalledOnce();
    expect(generatedClick.stopPropagation).toHaveBeenCalledOnce();
  });

  it("captures mouse dragging, but releases stale gestures when the button is no longer held", () => {
    const { handlers, next, surface, event, pointer } = setup();
    handlers.onPointerDown(pointer(event(200, { type: "mouse" })));
    handlers.onPointerMove(pointer(event(130, { type: "mouse" })));
    expect(surface.setPointerCapture).toHaveBeenCalledWith(1);
    handlers.onPointerMove(pointer(event(100, { type: "mouse", buttons: 0 })));
    handlers.onPointerUp(pointer(event(100, { type: "mouse" })));
    expect(next).not.toHaveBeenCalled();
  });

  it("does not let a fullscreen portal gesture also advance its inline parent", () => {
    const { handlers, next, surface, event, pointer } = setup();
    surface.contains.mockReturnValue(false);
    handlers.onPointerDown(pointer(event(200)));
    handlers.onPointerUp(pointer(event(100)));
    expect(next).not.toHaveBeenCalled();
  });

  it("preserves arrow buttons and keyboard clicks after a drag", () => {
    const { handlers, event, pointer, click } = setup();
    handlers.onPointerDown(pointer(event(200)));
    handlers.onPointerUp(pointer(event(100)));
    const arrow = event(100, { control: true });
    handlers.onPointerDown(pointer(arrow));
    handlers.onClickCapture(click(arrow));
    expect(arrow.preventDefault).not.toHaveBeenCalled();
    const keyboard = { ...event(100), detail: 0 };
    handlers.onClickCapture(click(keyboard));
    expect(keyboard.preventDefault).not.toHaveBeenCalled();
  });
});
