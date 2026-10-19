export class GallerySwipeGesture {
  private pointers = new Set<number>();
  private start: { id: number; x: number; y: number } | null = null;
  private suppressClick = false;

  begin(id: number, x: number, y: number, enabled: boolean) {
    if (this.pointers.size === 0) this.suppressClick = false;
    this.pointers.add(id);
    this.start = enabled && this.pointers.size === 1 ? { id, x, y } : null;
    if (this.pointers.size > 1) this.suppressClick = true;
  }

  move(id: number, x: number, y: number): boolean {
    if (!this.start || this.start.id !== id) return false;
    const dx = x - this.start.x;
    const dy = y - this.start.y;
    const horizontal = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2;
    if (horizontal) this.suppressClick = true;
    return horizontal;
  }

  end(id: number, x: number, y: number, enabled: boolean): "next" | "prev" | null {
    this.move(id, x, y);
    const start = this.start;
    this.pointers.delete(id);
    this.start = null;
    if (!enabled || !start || start.id !== id) return null;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy) * 1.2) return null;
    return dx < 0 ? "next" : "prev";
  }

  cancel(id: number) {
    this.pointers.delete(id);
    this.start = null;
  }

  consumeClick(): boolean {
    const suppress = this.suppressClick;
    this.suppressClick = false;
    return suppress;
  }

  reset() {
    this.pointers.clear();
    this.start = null;
    this.suppressClick = false;
  }
}
