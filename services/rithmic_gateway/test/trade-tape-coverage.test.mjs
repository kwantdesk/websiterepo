import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  TRADE_TAPE_COVERAGE_SCHEMA,
  coverageFileName,
  createBackfillCoverageReceipt,
  provesCoverageWindow,
  readCoverageReceipt,
  writeCoverageReceipt,
} from "../src/trade-tape-coverage.mjs";

const healthy = (patch = {}) => createBackfillCoverageReceipt({
  exchange: "cme", symbol: "nqu6", tradingDate: "2026-09-04",
  observationFromMs: 1_000, observationToMs: 2_000, sourcePrintCount: 5,
  gapMarkers: 0, damagedMembers: 0, ...patch,
});

test("healthy extraction creates bounded Rithmic coverage evidence", () => {
  const receipt = healthy();
  assert.equal(receipt.schemaVersion, TRADE_TAPE_COVERAGE_SCHEMA);
  assert.equal(receipt.exchange, "CME");
  assert.equal(receipt.symbol, "NQU6");
  assert.equal(receipt.integrityComplete, true);
  assert.equal(receipt.executionOrderComplete, true);
  assert.equal(provesCoverageWindow(receipt, {
    exchange: "CME", symbol: "NQU6", fromMs: 1_100, toMs: 1_900,
  }), true);
});

test("a request outside observed bounds or for another contract fails closed", () => {
  const receipt = healthy();
  assert.equal(provesCoverageWindow(receipt, {
    exchange: "CME", symbol: "NQU6", fromMs: 999, toMs: 1_900,
  }), false);
  assert.equal(provesCoverageWindow(receipt, {
    exchange: "CME", symbol: "ESU6", fromMs: 1_100, toMs: 1_900,
  }), false);
});

test("disconnect markers, dropped messages and damaged gzip members can never prove coverage", () => {
  for (const patch of [{ gapMarkers: 1 }, { damagedMembers: 1 }, { observationFromMs: null }]) {
    const receipt = healthy(patch);
    assert.equal(receipt.integrityComplete, false);
    assert.equal(provesCoverageWindow(receipt, {
      exchange: "CME", symbol: "NQU6", fromMs: 1_100, toMs: 1_900,
    }), false);
  }
});

test("coverage receipt is atomically persisted and unreadable evidence returns null", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kwant-coverage-"));
  try {
    const file = join(dir, coverageFileName("CME", "NQU6"));
    const receipt = healthy();
    await writeCoverageReceipt(file, receipt);
    assert.deepEqual(await readCoverageReceipt(file), receipt);
    assert.equal(await readCoverageReceipt(join(dir, "missing.json")), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
