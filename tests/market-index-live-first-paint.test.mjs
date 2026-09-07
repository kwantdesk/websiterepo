import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
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
  assert.match(marketIndexSubscription, /setLoading\(false\);\s*setError\(null\);/);
  assert.doesNotMatch(
    marketIndexSubscription,
    /if \(historyHydratedRef\.current\) \{\s*setLoading\(false\)/,
    "live first paint must not be gated on historical hydration",
  );
});
