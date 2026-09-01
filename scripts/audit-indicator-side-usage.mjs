/**
 * Which studies emit only ONE colour on data that clearly has two sides.
 *
 * The CVD bug was not a colour bug: the theme, the resolver and the renderer
 * were all correct, and the study still painted one block because its bodies
 * had no direction. That failure is invisible to every colour-layer check, so
 * it is looked for here instead - by running each study over bars that rise
 * and fall and counting the distinct colours that come out.
 */
import { readFileSync } from "node:fs";

const { calculateIndicatorSeries } = await import("../src/lib/chartIndicatorEngine.ts");
const { CHART_INDICATOR_CATALOG } = await import("../src/lib/chartIndicatorCatalog.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

const THEME = { primary: "#3B82F6", secondary: "#8B5CF6", positive: "#22C55E", negative: "#EF4444", muted: "#71717A" };
const CS = { upColor: "#22C55E", downColor: "#EF4444", borderUpColor: "#16A34A", borderDownColor: "#DC2626", gridColor: "#71717A", backgroundColor: "#050607" };

// 400 bars that genuinely alternate: price direction, aggressor delta, volume.
// deltaOpen is set equal to deltaClose, which is what our baked bars carry.
let price = 20000;
const candles = Array.from({ length: 400 }, (_, i) => {
  const rising = Math.sin(i / 7) > 0;
  const open = price;
  price += rising ? 3 : -3;
  const close = price;
  const ask = rising ? 900 : 150;
  const bid = rising ? 150 : 900;
  const delta = ask - bid;
  return {
    timestamp: 1_788_000_000_000 + i * 60_000,
    open, high: Math.max(open, close) + 2, low: Math.min(open, close) - 2, close,
    volume: ask + bid, askVolume: ask, bidVolume: bid,
    askTrades: ask / 10, bidTrades: bid / 10, trades: (ask + bid) / 10,
    delta, deltaClose: delta, deltaOpen: delta, deltaHigh: delta, deltaLow: delta,
  };
});

const rows = [];
for (const { id } of CHART_INDICATOR_CATALOG) {
  let settings;
  try { settings = { ...defaultIndicatorSettings(id, CS), useThemeColors: true, gradientPreset: "off" }; } catch { continue; }
  let out;
  try {
    out = calculateIndicatorSeries({ instanceId: "a", indicatorId: id, enabled: true, settings }, candles, THEME, { instrument: "NQ", tickSize: 0.25 });
  } catch (error) { rows.push({ id, note: `threw: ${String(error).slice(0, 60)}` }); continue; }
  for (const series of out ?? []) {
    const data = series.data ?? [];
    if (data.length < 10) continue;
    const withColour = data.filter((p) => p.color);
    if (!withColour.length) continue;
    const distinct = new Set(withColour.map((p) => p.color));
    // A study that colours per point but only ever produces one value is the
    // shape that hid the CVD bug.
    if (distinct.size === 1 && withColour.length === data.length) {
      rows.push({ id, series: series.key, kind: series.kind, colour: [...distinct][0], bars: data.length });
    }
  }
}
console.log(`ran ${CHART_INDICATOR_CATALOG.length} indicators over ${candles.length} alternating bars\n`);
if (!rows.length) console.log("every per-point study emitted both sides");
for (const r of rows) console.log(r.note ? `  ${r.id.padEnd(34)} ${r.note}` : `  ${r.id.padEnd(34)} ${String(r.series).padEnd(30)} kind=${String(r.kind).padEnd(12)} one colour ${r.colour} across ${r.bars} bars`);
