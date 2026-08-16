import assert from "node:assert/strict";
import {
  deriveGexFlowContractRatios,
  estimateGexFlowDirection,
  gexFlowMoneyness,
  gexFlowOiAnalysis,
  gexFlowContractRatioFromTradeSideStatistics,
  gexFlowPremium,
  gexFlowSpreadPosition,
  filterGexFlowRowsAtCutoff,
  normalizeGexFlowSide,
  scoreGexFlowRows,
} from "../src/lib/gexFlow.ts";

assert.ok(Math.abs(gexFlowSpreadPosition(8.29, 8.10, 8.30) - 0.95) < 1e-9, "spread position uses (fill-bid)/(ask-bid)");
assert.equal(normalizeGexFlowSide("A+"), "ABOVE_ASK");
assert.equal(normalizeGexFlowSide("B-"), "BELOW_BID");
assert.equal(estimateGexFlowDirection("CALL", "ASK"), "BULLISH");
assert.equal(estimateGexFlowDirection("PUT", "ASK"), "BEARISH");
assert.deepEqual(gexFlowMoneyness("CALL", 110, 100), { percent: 10, type: "OTM" });
assert.deepEqual(gexFlowMoneyness("PUT", 110, 100), { percent: -10, type: "ITM" });
assert.deepEqual(gexFlowPremium(2.5, 20, 100, null), { value: 5_000, source: "DERIVED" });
assert.deepEqual(gexFlowOiAnalysis(250, 500, 200), { volumeToOi: 2.5, sizeToOi: 1.25, sizeGreaterThanOi: true, volumeGreaterThanOi: true });

const providerRatio = gexFlowContractRatioFromTradeSideStatistics({
  data: {
    CALL: {
      ABOVE_ASK: { volume: 120 },
      ASK: { volume: 500 },
      MID_MARKET: { volume: 40 },
      BID: { volume: 300 },
      BELOW_BID: { volume: 40 },
    },
  },
}, "CALL");
assert.equal(providerRatio?.source, "PROVIDER");
assert.equal(providerRatio?.askRatio, 0.62);
assert.equal(providerRatio?.midRatio, 0.04);
assert.equal(providerRatio?.bidRatio, 0.34);
assert.deepEqual(filterGexFlowRowsAtCutoff([{ tradeTime: 100 }, { tradeTime: 200 }, { tradeTime: 300 }], 200), [{ tradeTime: 100 }, { tradeTime: 200 }], "replay strips every future print");

const ratios = deriveGexFlowContractRatios([
  { osi: "SPXW", ticker: "SPX", expirationDate: "2026-08-16", strikePrice: 6500, contractType: "CALL", side: "ASK", size: 620 },
  { osi: "SPXW", ticker: "SPX", expirationDate: "2026-08-16", strikePrice: 6500, contractType: "CALL", side: "MID", size: 40 },
  { osi: "SPXW", ticker: "SPX", expirationDate: "2026-08-16", strikePrice: 6500, contractType: "CALL", side: "BID", size: 340 },
]);
const ratio = ratios.get("SPXW");
assert.ok(ratio);
assert.equal(ratio.totalContracts, 1_000);
assert.equal(ratio.askRatio, 0.62);
assert.equal(ratio.midRatio, 0.04);
assert.equal(ratio.bidRatio, 0.34);
assert.equal(ratio.dominant, "ASK");

const scored = scoreGexFlowRows([
  { ticker: "SPX", sentiment: "BULLISH", sentimentSource: "ESTIMATED", contractType: "CALL", premium: 1_000_000, size: 500, volumeToOi: 4, sizeToOi: 2, spreadPercent: 0.02, side: "ABOVE_ASK", contractRatio: ratio, unusual: true, opening: true, sweep: true, block: false, split: false, multiLeg: false },
  { ticker: "SPX", sentiment: "BEARISH", sentimentSource: "ESTIMATED", contractType: "PUT", premium: 500_000, size: 200, volumeToOi: 1, sizeToOi: 0.5, spreadPercent: 0.08, side: "ASK", contractRatio: ratio, unusual: false, opening: false, sweep: false, block: true, split: false, multiLeg: false },
]);
assert.ok(scored[0].flowScore > 0, "bullish inferred flow scores positive");
assert.ok(scored[1].flowScore < 0, "bearish inferred flow scores negative");

console.log("GEX FLOW deterministic calculations passed.");
