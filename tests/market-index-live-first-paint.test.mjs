import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const liveClient = readFileSync(
  new URL("../src/lib/marketIndexLiveClient.ts", import.meta.url),
  "utf8",
);

test("a verified market-index quote clears the pane spinner before history finishes", () => {
  const subscriptionStart = workspace.indexOf("if (usingMarketIndexPaneFeed) {");
  const subscriptionEnd = workspace.indexOf("let cancelled = false;", subscriptionStart);
  const marketIndexSubscription = workspace.slice(subscriptionStart, subscriptionEnd);

  assert.ok(subscriptionStart >= 0 && subscriptionEnd > subscriptionStart);
  assert.match(marketIndexSubscription, /if \(!snapshot\.marketOpen\) return;/);
  assert.match(marketIndexSubscription, /if \(!shouldAcceptMarketIndexFrame/);
  assert.match(marketIndexSubscription, /mergeLiveMidIntoCandles/);
  assert.match(
    marketIndexSubscription,
    /markMarketActive\(Date\.now\(\)\)/,
    "accepted index frames must use receipt time for feed liveness",
  );
  assert.doesNotMatch(
    marketIndexSubscription,
    /markMarketActive\(chartSourceTimestamp\(snapshot\.timestamp\)\)/,
    "the provider's candle-bucket timestamp must not stop the activity clock",
  );
  assert.match(
    marketIndexSubscription,
    /setSettledChartRequestKey\(requestedChartHydrationKey\);\s*setLoading\(false\);/,
    "the request-identity guard must settle before the loading flag is cleared",
  );
  assert.match(marketIndexSubscription, /setLoading\(false\);\s*setError\(null\);/);
  assert.doesNotMatch(
    marketIndexSubscription,
    /if \(historyHydratedRef\.current\) \{\s*setLoading\(false\)/,
    "live first paint must not be gated on historical hydration",
  );
});

test("a remounted index pane immediately receives the retained shared frame", () => {
  assert.match(liveClient, /new Map<string, MarketIndexLiveSnapshot>\(\)/);
  assert.match(liveClient, /const retained = lastDeliveredFrame\.get\(normalized\)/);
  assert.match(liveClient, /subscribers\.get\(normalized\)\?\.has\(subscriber\)/);
  assert.match(liveClient, /onSnapshot\(retained\)/);
});

test("market-index history failure cannot schedule the Databento-only reconciler", () => {
  const catchStart = workspace.indexOf("const loadFailure = loadError instanceof Error");
  const catchEnd = workspace.indexOf("const reconcileTail = async", catchStart);
  const failedLoad = workspace.slice(catchStart, catchEnd);

  assert.ok(catchStart >= 0 && catchEnd > catchStart);
  assert.match(failedLoad, /const willRetry = pane\.broker === "Databento"/);
  assert.match(failedLoad, /setLoading\(willRetry\)/);
});
