import test from "node:test";
import assert from "node:assert/strict";
import { institutionalVolumeProfileRequest } from "../src/lib/institutionalMarketData.ts";
import { resolveVolumeProfileRange } from "../services/rithmic_gateway/src/trading-session.mjs";

test("Friday's browser business-date label requests Thursday's actual gateway session, not Friday night", () => {
  const { query } = institutionalVolumeProfileRequest({ symbol: "NQ", contractSymbol: "NQZ6", period: "daily", tradingDate: "2026-10-16" });
  const resolved = resolveVolumeProfileRange(query, Date.parse("2026-10-17T10:00:00Z"));
  assert.equal(resolved.startMs, Date.parse("2026-10-15T22:00:00Z"));
  assert.equal(resolved.endMs, Date.parse("2026-10-16T22:00:00Z"));
  assert.equal(resolved.tradingDate, "2026-10-16", "retain the chart's label for live-flow ownership");
});

test("DST and explicit custom windows remain exact", () => {
  const { query } = institutionalVolumeProfileRequest({ symbol: "ES", period: "daily", tradingDate: "2026-11-02" });
  assert.equal(Number(query.get("startMs")), Date.parse("2026-11-01T23:00:00Z"));
  const custom = institutionalVolumeProfileRequest({ symbol: "ES", period: "daily", tradingDate: "2026-11-02", startMs: 1000, endMs: 2000 });
  assert.equal(custom.query.get("startMs"), "1000");
  assert.equal(custom.query.get("endMs"), "2000");
});
