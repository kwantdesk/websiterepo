import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/databento/market/route.ts", "utf8");
const workspace = readFileSync("src/components/KwantifyWorkspace.tsx", "utf8");

// 1. A short history window must be honoured, not clamped up to the default.
assert.match(route, /Math\.max\(1, Math\.min\(MAX_HISTORY_DAYS, Math\.round\(requestedDays\)\)\)/);
assert.doesNotMatch(
  route,
  /Math\.max\(DEFAULT_HISTORY_DAYS, Math\.min\(MAX_HISTORY_DAYS/,
  "the ten-day floor must not come back",
);

// 2. An unspecified window still defaults to the full ten days.
assert.match(route, /: DEFAULT_HISTORY_DAYS;/);

// 3. The window must reach the durable cache key, or every window would share
//    one cached payload.
assert.ok(route.includes('"cme-event-bars-v2", symbol, timeframe, `${historyDays}d`'));
assert.ok(route.includes('"cme-event-flow-v2", symbol, timeframe, `${historyDays}d`'));

// 4. The live stream must never BUILD event bars from an empty series. Volume,
//    range and tick bars close on cumulative traded size, so starting from
//    nothing accumulates from whenever the stream happened to connect and
//    produces bars belonging to no real window — a chart with gaps that jumps
//    once the authoritative history lands.
assert.match(workspace, /const canExtendEventBars = latestCandlesRef\.current\.length > 0;/);
assert.ok(
  /\? !canExtendEventBars\s+\? latestCandlesRef\.current/.test(workspace),
  "an empty series must not be extended into invented bars",
);

// 5. The short-window first paint must be gone: a one-day and a ten-day build
//    bin the tape differently, so painting one and replacing it with the other
//    is itself a visible glitch.
assert.doesNotMatch(workspace, /EVENT_BAR_FIRST_PAINT_DAYS/);

// 6. Time-based intervals keep their flow-first fast path.
assert.ok(
  /&& !isEventBasedChartInterval\(pane\.timeframe\)\s+&& !cachedBase\.length/.test(workspace),
  "time-based intervals must keep the flow-first fast path",
);

// 7. The request key must still carry the window so distinct windows do not
//    deduplicate onto each other.
assert.ok(workspace.includes('${healOnly ? "::heal" : ""}::${historyDays}d'));

console.log("event bar first paint: 7/7 checks passed");
