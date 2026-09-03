import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * What a chart shows when its history will not load.
 *
 * A range chart sat on the loading spinner indefinitely. The load failed, the
 * failure was caught, the reason was put into state - and then the loader was
 * turned back ON, on the reasoning that an empty chart is still waiting. For a
 * time interval that is true, because a reconciliation timer retries two
 * seconds later. For an EVENT interval that retry is explicitly skipped, so
 * nothing ever ran again and the spinner outlived the tab.
 *
 * The pane now binds loading/error settlement to the exact chart request. A
 * retry keeps the cover up; a terminal failure settles the request and reveals
 * the provider error. Partial cache geometry is never the fallback.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the loader only stays up when a retry is actually coming", () => {
  assert.match(
    workspace,
    /const willRetry = tailNeedsReconciliation && !isEventBasedChartInterval\(pane\.timeframe\);/,
    "whether a retry is scheduled is not established before deciding to keep loading",
  );
  assert.match(
    workspace,
    /setLoading\(willRetry\);/,
    "the loader and the scheduled retry can still disagree",
  );
  assert.match(
    workspace,
    /if \(!willRetry\) \{\s*setError\(loadFailure\);\s*setSettledChartRequestKey\(requestedChartHydrationKey\);/,
    "a terminal failure can still leave the exact chart request unsettled",
  );
  // The exact shape of the bug, which must not come back.
  assert.doesNotMatch(
    workspace,
    /setLoading\(!\(latestCandlesRef\.current\.length \|\| cachedCandles\.length\)\);/,
    "a failed load can still turn the loader back on unconditionally",
  );
});

check("the retry and the loader agree with each other", () => {
  /*
   * These were two separate conditions saying different things: the loader
   * stayed up for event intervals, the retry ran only for time intervals. One
   * value now drives both, so they cannot disagree again.
   */
  assert.match(workspace, /if \(willRetry\) \{\s*\n\s*reconciliationTimer = window\.setTimeout\(/);
  // Scoped to the FAILURE path. The success path a few lines above schedules
  // reconciliation off the same idea, but it is not deciding whether to leave a
  // loader up, so it is none of this check's business.
  const afterWillRetry = workspace.slice(workspace.indexOf("const willRetry ="));
  const block = afterWillRetry.slice(0, afterWillRetry.indexOf("const reconcileTail"));
  assert.doesNotMatch(
    block,
    /if \(tailNeedsReconciliation && !isEventBasedChartInterval\(pane\.timeframe\)\) \{/,
    "the failed-load retry still tests its own separate condition",
  );
});

check("the reason reaches the trader instead of a fixed sentence", () => {
  /*
   * The route already answers provider-neutrally and specifically. "CME history
   * is only available up to 2026-08-30" says what is wrong; a fixed
   * "temporarily unavailable" tells someone to keep waiting for something that
   * is not coming back on its own.
   */
  assert.match(
    workspace,
    /const loadFailure = loadError instanceof Error && loadError\.message\s*\n?\s*\? loadError\.message/,
    "the route's own message is discarded",
  );
  assert.doesNotMatch(workspace, /setError\("CME history is temporarily unavailable\."\);/);
});

check("a loader still wins over an error while genuinely loading", () => {
  // The precedence itself is correct and must stay - it is only wrong when the
  // loading flag lies.
  assert.match(workspace, /\) : error \? \(\s*\n\s*<div className="flex h-full items-center justify-center text-\[13px\] text-muted">\{error\}<\/div>/);
});

console.log(`\nchart history state: ${passed}/${passed} checks passed`);
