const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** One timestamp owns one candle/footprint pair, even on a compressed chart. */
export function footprintSidecarGeometry(anchorX: number, slotWidth: number, spacing: number, requestedWidth: number, reservedWidth = 0) {
  const gutter = Math.min(spacing, slotWidth * .25);
  const usable = Math.max(.5, slotWidth - gutter - reservedWidth);
  const candleWidth = Math.min(11, usable * .14);
  const gap = Math.min(8, usable * .08);
  const footprintWidth = Math.max(.1, Math.min(requestedWidth, usable - candleWidth - gap));
  const left = anchorX + candleWidth / 2 + gap;
  return { candleX: anchorX, candleWidth, left, footprintWidth, footprintX: left + footprintWidth / 2 };
}

/**
 * Exact order-statistic percentile for frame-local renderer metrics.
 *
 * Quickselect avoids sorting tens of thousands of visible footprint cell
 * values on every pan or zoom frame. The caller deliberately hands over a
 * disposable array because this function rearranges it in place.
 */
export function footprintPercentile(values: number[], fraction: number) {
  if (!values.length) return 1;
  const target = Math.min(
    values.length - 1,
    Math.floor((values.length - 1) * clamp(fraction, 0.5, 1)),
  );
  let left = 0;
  let right = values.length - 1;
  while (left < right) {
    const pivot = values[(left + right) >>> 1];
    let low = left;
    let high = right;
    while (low <= high) {
      while (values[low] < pivot) low += 1;
      while (values[high] > pivot) high -= 1;
      if (low <= high) {
        [values[low], values[high]] = [values[high], values[low]];
        low += 1;
        high -= 1;
      }
    }
    if (target <= high) right = high;
    else if (target >= low) left = low;
    else break;
  }
  return Math.max(1, values[target]);
}
