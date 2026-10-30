export const normalizeCvdStyle = () => 'line';

/** CVD and price must share the data edge, including the map's live gap. */
export function cvdTimeCoordinate(history, layout, timestamp) {
  const { start, end, xForIndex } = layout;
  const target = Number(timestamp);
  if (target <= Number(history[start]?.timestamp || 0)) return xForIndex(start);
  if (target >= Number(history[end]?.timestamp || 0)) return xForIndex(end);
  let low = start, high = end;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (Number(history[middle]?.timestamp || 0) <= target) low = middle;
    else high = middle;
  }
  const left = Number(history[low]?.timestamp), right = Number(history[high]?.timestamp);
  const fraction = right > left ? Math.max(0, Math.min(1, (target - left) / (right - left))) : 0;
  return xForIndex(low) + (xForIndex(high) - xForIndex(low)) * fraction;
}

/** Presentation-only easing; source points, timestamps and volumes are untouched. */
export function advanceCvdPresentation(previous, target, { key, live, now }) {
  const signature = JSON.stringify(target);
  if (!live || !previous || previous.key !== key) {
    return { ...target, key, signature, lastAt: now, changedAt: now, active: false };
  }
  const changedAt = signature === previous.signature ? previous.changedAt : now;
  const elapsed = Math.max(0, Math.min(100, now - previous.lastAt));
  const weight = now - changedAt >= 200 ? 1 : 1 - Math.exp(-elapsed / 35);
  const next = { key, signature, lastAt: now, changedAt, active: false };
  for (const field of Object.keys(target)) {
    const distance = target[field] - previous[field];
    next[field] = Math.abs(distance) < .005 || weight === 1
      ? target[field] : previous[field] + distance * weight;
    if (next[field] !== target[field]) next.active = true;
  }
  return next;
}

/** Freeze the default reference scale per book, never the current zoom/pan. */
export function tradeClusterReference(layout, previous) {
  const key = `${layout.config.key}:${layout.config.contract}:${layout.config.tickSize}`;
  if (previous?.key === key) return previous;
  return { key, rowTicks: 1, rowPixels: Math.max(.1, layout.plotHeight / (layout.config.defaultVisibleRows || 112)), columnPixels: 1.24 };
}

export function tradeBubbleZoom(layout, reference) {
  const priceScale = (layout.plotHeight / layout.visibleTickSpan) / reference.rowPixels;
  const timeScale = layout.columnPixels / reference.columnPixels;
  return Math.max(.2, Math.min(5, Math.sqrt(Math.max(.001, priceScale * timeScale))));
}
