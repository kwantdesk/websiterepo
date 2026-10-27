/** Bounded, opt-in source-to-paint diagnostics. Never changes price or cadence. */
let enabled: boolean | undefined;
const samples = new Map<string, { paints: number; lastPaint: number; lastSource: number; ages: number[]; gaps: number[] }>();
let timer: ReturnType<typeof setTimeout> | null = null;
let longTasks = 0, longestTask = 0;
const percentile = (values: number[], p: number) => values.length
  ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] : null;

export function recordChartTickPaint(instrument: string, sourceTimestamp?: number) {
  if (enabled === undefined) {
    enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("feedAudit") === "1";
    if (enabled && typeof PerformanceObserver !== "undefined") {
      try { new PerformanceObserver(list => {
        for (const entry of list.getEntries()) { longTasks++; longestTask = Math.max(longestTask, entry.duration); }
      }).observe({ type: "longtask", buffered: false }); } catch { /* unavailable in some browsers */ }
    }
  }
  if (!enabled) return;
  const now = Date.now(), sample = samples.get(instrument) ?? { paints: 0, lastPaint: 0, lastSource: 0, ages: [], gaps: [] };
  if (sample.lastPaint) sample.gaps.push(now - sample.lastPaint);
  sample.paints++; sample.lastPaint = now;
  if (Number.isFinite(sourceTimestamp) && Number(sourceTimestamp) > 0) {
    sample.lastSource = Number(sourceTimestamp); sample.ages.push(now - sample.lastSource);
  }
  if (sample.ages.length > 512) sample.ages.splice(0, sample.ages.length - 512);
  if (sample.gaps.length > 512) sample.gaps.splice(0, sample.gaps.length - 512);
  samples.set(instrument, sample);
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    document.documentElement.setAttribute("data-chart-tick-audit", JSON.stringify({ at: Date.now(), longTasks, longestTask,
      instruments: [...samples].map(([instrument, row]) => ({ instrument, paints: row.paints,
        lastSource: row.lastSource, lastPaint: row.lastPaint, sourceToPaintP50: percentile(row.ages, .5),
        sourceToPaintP95: percentile(row.ages, .95), paintGapP95: percentile(row.gaps, .95) })) }));
  }, 1000);
}
