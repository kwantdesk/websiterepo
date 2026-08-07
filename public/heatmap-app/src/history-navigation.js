const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function panHistoryEnd({ currentEnd, columnShift, historyLength, visibleColumns }) {
  const length = Math.max(0, Math.floor(finite(historyLength)));
  if (length === 0) return 0;
  const latest = length - 1;
  const viewport = Math.max(1, Math.floor(finite(visibleColumns, 1)));
  const earliestFullViewport = Math.min(latest, viewport - 1);
  const candidate = Math.round(finite(currentEnd) + finite(columnShift));
  return Math.max(earliestFullViewport, Math.min(latest, candidate));
}

export function wheelColumnShift({ deltaX = 0, deltaY = 0, visibleColumns = 100, fast = false } = {}) {
  const horizontal = Math.abs(finite(deltaX)) > Math.abs(finite(deltaY));
  const delta = horizontal ? finite(deltaX) : -finite(deltaY);
  if (delta === 0) return 0;
  const maximum = Math.max(3, Math.round(Math.max(1, finite(visibleColumns, 100)) * 0.22));
  const multiplier = fast ? 4 : 1;
  const magnitude = Math.min(maximum, Math.max(3, Math.round(Math.abs(delta) / 8)) * multiplier);
  return Math.sign(delta) * magnitude;
}

export function panPriceCenter({ centerTick, deltaY = 0, plotHeight, visibleTickSpan }) {
  const height = Math.max(1, finite(plotHeight, 1));
  const span = Math.max(0, finite(visibleTickSpan));
  return finite(centerTick) + finite(deltaY) / height * span;
}
