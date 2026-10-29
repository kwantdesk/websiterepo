export const MIN_VISIBLE_PRICE_ROWS = 8;
export function priceScaleRows(value, config = {}) {
  const tickSize = Number(config.tickSize);
  const depthRange = Number(config.depthRangePoints);
  const fullBookRows = tickSize > 0 && depthRange > 0 ? Math.round(depthRange * 2 / tickSize) : 320;
  const rows = Number(value);
  return Math.max(MIN_VISIBLE_PRICE_ROWS, Math.min(Math.max(320, fullBookRows),
    Number.isFinite(rows) && rows > 0 ? rows : Number(config.defaultVisibleRows) || 112));
}
export function priceWheelFactor({ deltaY = 0, deltaMode = 0 }) {
  const units = deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1;
  const delta = Math.max(-240, Math.min(240, Number(deltaY) * units || 0));
  return Math.exp(delta * .0015);
}
