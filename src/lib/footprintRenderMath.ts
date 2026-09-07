const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

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
