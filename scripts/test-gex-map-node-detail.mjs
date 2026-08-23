import assert from "node:assert/strict";
import {
  GEX_NODE_CHANGE_WINDOWS,
  GEX_NODE_PERCENT_BASELINE_FLOOR,
  buildGexNodeSeries,
  gexNodeBias,
  gexNodeChangeOver,
  gexNodeCoverageMs,
  gexNodeTrend,
  gexNodeValueAt,
} from "../src/lib/gexMapNodeDetail.ts";

/**
 * The node panel reports a rate of change, so the one thing it must never do
 * is invent one. Frames cover a single session at one-minute resolution: an
 * hour is measurable once an hour has elapsed, a day never is. Substituting
 * the oldest held sample is how a node that opened near zero comes to show
 * "+1832% over 1 day" beneath a sparkline only ten minutes wide.
 */
const T0 = Date.UTC(2026, 7, 21, 13, 30);   // 09:30 New York
const MIN = 60_000;

/** Frames are incremental: only the strikes that moved appear in each. */
const frameAt = (minute, updates) => ({ timestamp: T0 + minute * MIN, updates });

// Strike 7680 rises; 7700 is present only to prove strikes do not bleed.
const frames = [];
for (let m = 0; m <= 120; m += 1) {
  const updates = [{ strike: 7680, call: 0, put: 0, net: 10_000_000 + m * 100_000 }];
  if (m % 7 === 0) updates.push({ strike: 7700, call: 0, put: 0, net: -4_000_000 });
  frames.push(frameAt(m, updates));
}
const NOW = T0 + 120 * MIN;
const series = buildGexNodeSeries(frames, 7680);

// --- the series is that strike's own history, oldest first ---
{
  assert.equal(series.length, 121);
  assert.deepEqual(series, [...series].sort((a, b) => a.timestamp - b.timestamp));
  assert.equal(series[0].value, 10_000_000);
  assert.equal(series.at(-1).value, 22_000_000);
  // A different strike must not contribute a single sample.
  assert.ok(series.every((s) => s.value >= 10_000_000), "strike 7700 leaked into 7680");
  assert.equal(buildGexNodeSeries(frames, 7700).length, 18);
  assert.equal(buildGexNodeSeries(frames, 9999).length, 0, "an untouched strike has no series");
}

// --- a value is carried forward from its last update, never assumed zero ---
{
  const sparse = buildGexNodeSeries(frames, 7700);
  // Between updates the strike still holds its last value.
  assert.equal(gexNodeValueAt(sparse, T0 + 10 * MIN), -4_000_000);
  // BEFORE its first update it has no value at all. Reading zero here is what
  // turns the first print into an infinite percentage rise.
  assert.equal(gexNodeValueAt(sparse, T0 - MIN), null);
}

// --- measurable windows are measured exactly ---
{
  for (const [windowMs, minutes] of [[MIN, 1], [5 * MIN, 5], [15 * MIN, 15], [60 * MIN, 60]]) {
    const change = gexNodeChangeOver(series, windowMs, NOW);
    assert.equal(change.available, true, `${minutes}m should be measurable`);
    assert.equal(change.absolute, minutes * 100_000, `${minutes}m absolute`);
    assert.equal(change.baseline, 22_000_000 - minutes * 100_000);
    assert.equal(change.current, 22_000_000);
  }
}

// --- THE bug: a window longer than the history is refused, not faked ---
{
  const day = gexNodeChangeOver(series, 24 * 60 * MIN, NOW);
  assert.equal(day.available, false, "a 2-hour session cannot report a 1-day change");
  assert.equal(day.absolute, null);
  assert.equal(day.percent, null);
  // It still knows the current value - it just will not claim a baseline.
  assert.equal(day.current, 22_000_000);

  // 4 hours is equally unmeasurable from two hours of frames.
  assert.equal(gexNodeChangeOver(series, 4 * 60 * MIN, NOW).available, false);

  // The boundary is exact: a window reaching precisely the first sample is
  // measurable, one minute beyond it is not.
  assert.equal(gexNodeChangeOver(series, 120 * MIN, NOW).available, true);
  assert.equal(gexNodeChangeOver(series, 121 * MIN, NOW).available, false);
}

// --- a series that STARTS inside the window cannot label itself with it ---
{
  // Ten minutes of history, asked for an hour - the exact shape of the
  // screenshot: a ten-minute sparkline under a "1 hour" row.
  const short = buildGexNodeSeries(frames.slice(-11), 7680);
  assert.equal(gexNodeCoverageMs(short), 10 * MIN);
  const hour = gexNodeChangeOver(short, 60 * MIN, NOW);
  assert.equal(hour.available, false, "ten minutes of frames is not an hour of history");
  assert.equal(hour.percent, null);
  // And the ten-minute window it CAN measure is still correct.
  const ten = gexNodeChangeOver(short, 10 * MIN, NOW);
  assert.equal(ten.available, true);
  assert.equal(ten.absolute, 1_000_000);
}

// --- percentages are refused against a baseline too small to carry one ---
{
  const fromNothing = [
    { timestamp: T0, value: 1_000 },
    { timestamp: T0 + 60 * MIN, value: 21_920_000 },
  ];
  const change = gexNodeChangeOver(fromNothing, 60 * MIN, T0 + 60 * MIN);
  assert.equal(change.available, true, "the window IS covered");
  assert.equal(change.absolute, 21_919_000, "so the absolute change is real and reported");
  assert.equal(change.percent, null, "but +2,191,900% is arithmetic, not information");

  // Just above the floor a percentage is allowed through.
  const solid = [
    { timestamp: T0, value: GEX_NODE_PERCENT_BASELINE_FLOOR },
    { timestamp: T0 + 60 * MIN, value: GEX_NODE_PERCENT_BASELINE_FLOOR * 2 },
  ];
  assert.equal(gexNodeChangeOver(solid, 60 * MIN, T0 + 60 * MIN).percent, 100);
}

// --- signed exposure: a flip is not a negative percentage ---
{
  const flip = [
    { timestamp: T0, value: -5_000_000 },
    { timestamp: T0 + 60 * MIN, value: 5_000_000 },
  ];
  const change = gexNodeChangeOver(flip, 60 * MIN, T0 + 60 * MIN);
  assert.equal(change.absolute, 10_000_000);
  // Against the raw baseline this would be -200%, which reads as a collapse
  // when the node has in fact flipped from short to long gamma.
  assert.equal(change.percent, 200, "the ratio is taken against the magnitude");
}

// --- bias and trend ---
{
  assert.equal(gexNodeBias(21_920_000), "POSITIVE");
  assert.equal(gexNodeBias(-21_920_000), "NEGATIVE");
  assert.equal(gexNodeBias(0), "NEUTRAL");
  assert.equal(gexNodeBias(null), "NEUTRAL");
  // Below the floor the sign is noise, not a lean.
  assert.equal(gexNodeBias(GEX_NODE_PERCENT_BASELINE_FLOOR - 1), "NEUTRAL");

  assert.equal(gexNodeTrend(series, NOW), "INCREASING");
  const falling = series.map((s) => ({ ...s, value: -s.value }));
  assert.equal(gexNodeTrend(falling, NOW), "DECREASING");
  const flat = series.map((s) => ({ ...s, value: 15_000_000 }));
  assert.equal(gexNodeTrend(flat, NOW), "STEADY");
  assert.equal(gexNodeTrend([], NOW), "UNKNOWN", "one sample is not a direction");
  assert.equal(gexNodeTrend([{ timestamp: NOW, value: 1 }], NOW), "UNKNOWN");
}

// --- replay cannot read past its own clock ---
{
  const mid = T0 + 30 * MIN;
  const clipped = buildGexNodeSeries(frames, 7680, mid);
  assert.equal(clipped.at(-1).timestamp, mid);
  assert.equal(clipped.at(-1).value, 13_000_000);
  assert.ok(clipped.every((s) => s.timestamp <= mid), "no sample may come from after the clock");
}

// --- the panel offers exactly the windows in the design ---
{
  assert.deepEqual(
    GEX_NODE_CHANGE_WINDOWS.map((w) => w.label),
    ["1 min", "5 min", "10 min", "15 min", "1 hour", "4 hours", "1 day"],
  );
  assert.deepEqual(
    GEX_NODE_CHANGE_WINDOWS.filter((w) => w.extended).map((w) => w.id),
    ["1h", "4h", "1d"],
  );
  // Ascending, so the panel reads shortest-first without re-sorting.
  const ms = GEX_NODE_CHANGE_WINDOWS.map((w) => w.ms);
  assert.deepEqual(ms, [...ms].sort((a, b) => a - b));
}

// --- the map actually opens the panel on a node ---
{
  const { readFileSync } = await import("node:fs");
  const workspace = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("GexMapNodePanel"), "the map has to render the panel");
  assert.ok(workspace.includes("setDetailStrike"), "and open it from a node");
  // Selection is held by strike, so a refresh of the exposure surface does not
  // close the panel or point it at a stale object.
  assert.ok(workspace.includes("detailStrike, setDetailStrike] = useState<number | null>"));
  // Replay safety: the panel must be bounded by the scrub clock.
  assert.ok(workspace.includes("throughMs={effectiveTimestamp"),
    "a scrubbed map must not show a node exposure it only reaches later");

  const panel = readFileSync(new URL("../src/components/gex-map/GexMapNodePanel.tsx", import.meta.url), "utf8");
  // An unmeasurable window says so rather than printing a number.
  assert.ok(panel.includes("no history"), "unavailable windows must be labelled, not filled in");
  assert.ok(panel.includes("change.percent === null"), "a refused percentage must render as such");
  // The sparkline axis is driven by real coverage, never a fixed span.
  assert.ok(panel.includes("relativeLabel(coverageMs)"),
    "the axis must state the history actually held");
}

console.log("GEX map node detail tests passed.");
