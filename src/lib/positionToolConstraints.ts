/** Drawing calculators only. Real order stops may legitimately lock in profit. */
export function clampPositionStopPrice(tool: string, entry: number, price: number): number {
  if (!Number.isFinite(entry) || !Number.isFinite(price)) return price;
  return tool === "longPosition" ? Math.min(price, entry)
    : tool === "shortPosition" ? Math.max(price, entry) : price;
}

/** Closest handle wins, not whichever target happens to be tested first. */
export function nearestPositionHandle<T extends { x: number; y: number }>(handles: readonly T[], x: number, y: number, radius = 14): T | null {
  let best: T | null = null, distance = radius;
  for (const handle of handles) {
    const next = Math.hypot(handle.x - x, handle.y - y);
    if (Number.isFinite(next) && next <= distance) { best = handle; distance = next; }
  }
  return best;
}
