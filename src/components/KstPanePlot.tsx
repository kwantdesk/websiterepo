import type { KstSeries } from "@/lib/knowSureThingSeries";

type Point = { x: number; y: number; value: number; color?: string; breakBefore?: boolean };
type Bounds = { left: number; top: number; right: number; bottom: number };

/** KST-only painter: other established pane studies keep their existing path. */
export default function KstPanePlot({ series, points, bounds, vertical = false, nameRow = 0, referenceCoordinate }: {
  series: KstSeries; points: Point[]; bounds: Bounds; vertical?: boolean;
  nameRow?: number; referenceCoordinate?: number;
}) {
  const { left, top, right, bottom } = bounds;
  const dash = series.lineStyle === "dashed" ? "6 4" : series.lineStyle === "dotted" ? "2 3" : undefined;
  const strokeWidth = series.lineWidth ?? 1;
  if (series.horizontalPriceLine) {
    if (referenceCoordinate === undefined || !Number.isFinite(referenceCoordinate)) return null;
    if (vertical ? referenceCoordinate < left || referenceCoordinate > right : referenceCoordinate < top || referenceCoordinate > bottom) return null;
    return <line data-kst-reference="true" x1={vertical ? referenceCoordinate : left} x2={vertical ? referenceCoordinate : right}
      y1={vertical ? top : referenceCoordinate} y2={vertical ? bottom : referenceCoordinate}
      stroke={series.color} strokeWidth={strokeWidth} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />;
  }
  if (!points.length || right <= left || bottom <= top) return null;
  const segments: { color: string; path: string }[] = [];
  const dots = new Map<string, string[]>();
  let previous: Point | undefined;
  for (const p of points) {
    if (![p.x, p.y, p.value].every(Number.isFinite)) { previous = undefined; continue; }
    const color = p.color ?? series.color;
    const active = segments.at(-1);
    if (!previous || p.breakBefore || !active || active.color !== color) {
      const bridge = previous && !p.breakBefore ? `M${previous.x},${previous.y}L` : "M";
      segments.push({ color, path: `${bridge}${p.x},${p.y}` });
    } else active.path += `L${p.x},${p.y}`;
    if (series.pointMarkersVisible) {
      const paths = dots.get(color) ?? [];
      // A zero-length round-capped stroke batches all dots of one colour.
      paths.push(`M${p.x},${p.y}h0`); dots.set(color, paths);
    }
    previous = p;
  }
  const last = points.at(-1);
  const labels = series.kstPresentation;
  const lastVisible = last && Number.isFinite(last.value) && last.x >= left && last.x <= right && last.y >= top && last.y <= bottom;
  const ink = last?.color ?? series.color;
  const label = (text: string, x: number, y: number, background: boolean, key: string) => {
    const width = Math.min(right - left, text.length * 5.5 + 8);
    const labelX = Math.max(left, Math.min(right - width, x));
    const labelY = Math.max(top + 10, Math.min(bottom - 2, y));
    return <g key={key} data-kst-label={key}>
      {background ? <rect x={labelX} y={labelY - 10} width={width} height={13} fill={labels?.chartMarker ? "var(--chart-background)" : "var(--panel)"} stroke={ink} strokeWidth={0.5} /> : null}
      <text x={labelX + 4} y={labelY} fill={ink} fontSize={9} fontFamily="var(--font-mono), monospace">{text}</text>
    </g>;
  };
  return <svg x={left} y={top} width={right - left} height={bottom - top} viewBox={`${left} ${top} ${right - left} ${bottom - top}`} overflow="hidden" data-kst-plot={series.key}>
    {series.lineVisible !== false ? segments.map((s, i) => <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />) : null}
    {[...dots].map(([color, paths]) => <path key={color} data-kst-points="true" d={paths.join("")} stroke={color} strokeWidth={strokeWidth + 2} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />)}
    {labels?.nameLabel ? label(series.label, left + 2, top + 12 + nameRow * 15, labels.nameBackground, "name") : null}
    {lastVisible && labels?.valueLabel ? label(last.value.toLocaleString("en-US", { maximumFractionDigits: 2 }), vertical ? last.x : right - 100, vertical ? bottom - 3 : last.y, labels.valueBackground, "value") : null}
  </svg>;
}
