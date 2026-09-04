export function imbalanceZoneHorizontalBounds(
  startX: number,
  endX: number,
  futureBars: number,
  barSpacing: number,
) {
  const projectedEnd = endX
    + Math.max(0, Number.isFinite(futureBars) ? futureBars : 0)
      * Math.max(1, Number.isFinite(barSpacing) ? barSpacing : 1);
  const left = Math.min(startX, projectedEnd);
  return { left, width: Math.max(2, Math.abs(projectedEnd - startX)) };
}
