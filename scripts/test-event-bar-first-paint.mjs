import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/databento/market/route.ts", "utf8");
const workspace = readFileSync("src/components/KwantifyWorkspace.tsx", "utf8");

// 1. A short history window must be honoured, not clamped up to the default.
//    This is what made a one-session first paint impossible.
assert.match(route, /Math\.max\(1, Math\.min\(MAX_HISTORY_DAYS, Math\.round\(requestedDays\)\)\)/);
assert.doesNotMatch(
  route,
  /Math\.max\(DEFAULT_HISTORY_DAYS, Math\.min\(MAX_HISTORY_DAYS/,
  "the ten-day floor must not come back",
);

// 2. An unspecified window still defaults to the full ten days.
assert.match(route, /: DEFAULT_HISTORY_DAYS;/);

// 3. The window must reach the provider request AND the cache key, or every
//    window would share one cached payload.
assert.match(route, /\["cme-event-bars-v2", symbol, timeframe, `\$\{historyDays\}d`\]/);
assert.match(route, /\["cme-event-flow-v2", symbol, timeframe, `\$\{historyDays\}d`\]/);

// 4. The client asks for one session first, only for event-based intervals.
assert.match(workspace, /const EVENT_BAR_FIRST_PAINT_DAYS = 1;/);
assert.match(workspace, /isEventBasedChartInterval\(pane\.timeframe\)\s*\r?\n\s*&& !cachedBase\.length/);

// 5. The request key must carry the window, or the short and full requests
//    would deduplicate onto each other and only one would ever run.
assert.match(workspace, /\$\{healOnly \? "::heal" : ""\}::\$\{historyDays\}d/);

// 6. The short window must never replace a fuller series already committed.
assert.match(workspace, /quickCandles\.length > latestCandlesRef\.current\.length/);

// 7. Time-based intervals keep the original flow-first fast path.
assert.match(workspace, /&& !isEventBasedChartInterval\(pane\.timeframe\)\s*\r?\n\s*&& !cachedBase\.length/);

console.log("event bar first paint: 7/7 checks passed");
