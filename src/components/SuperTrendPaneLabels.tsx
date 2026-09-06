import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";

export default function SuperTrendPaneLabels({ series, points, bounds, rightInset = 0 }: {
  series: CalculatedIndicatorSeries;
  points: Array<{ x: number; y: number; value: number; color?: string }>;
  bounds: { left: number; top: number; right: number; bottom: number };
  rightInset?: number;
}) {
  const s = series.superTrendLabels;
  if (!s || (!s.nameLabel && !s.valueLabel)) return null;
  const { left, top, right, bottom } = bounds;
  let last: (typeof points)[number] | undefined;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const p = points[i];
    if ([p.x, p.y, p.value].every(Number.isFinite)
      && p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) {
      last = p;
      break;
    }
  }
  if (!last || right <= left || bottom <= top) return null;
  const color = last.color ?? series.color;
  const labelRight = Math.max(left + 1, right - Math.max(0, rightInset));
  const labels = [
    ...(s.nameLabel ? [{ key: "name", text: s.name, background: s.nameBackground }] : []),
    ...(s.valueLabel ? [{ key: "value", text: last.value.toLocaleString("en-US", { maximumFractionDigits: 2 }), background: s.valueBackground }] : []),
  ];
  const baseY = Math.max(top + 12, Math.min(bottom - labels.length * 17, last.y - labels.length * 17));
  return <svg x={left} y={top} width={right - left} height={bottom - top}
    viewBox={`${left} ${top} ${right - left} ${bottom - top}`} overflow="hidden" aria-hidden="true">
    {labels.map((label, i) => {
      const width = Math.min(labelRight - left, label.text.length * 6 + 10);
      const x = Math.max(left, Math.min(labelRight - width, last.x - width));
      const y = baseY + i * 17;
      return <g key={label.key} data-super-trend-label={label.key}>
        {label.background ? <rect x={x} y={y - 11} width={width} height={15}
          fill={s.chartColorForMarker ? "var(--chart-background, var(--background))" : color} stroke={color} /> : null}
        <text x={x + 4} y={y} fontSize={10} fontFamily="monospace"
          fill={label.background && !s.chartColorForMarker ? "var(--chart-background, var(--background))" : color}>{label.text}</text>
      </g>;
    })}
  </svg>;
}
