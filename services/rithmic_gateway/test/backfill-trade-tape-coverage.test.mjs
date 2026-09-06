import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { backfillFileName, instrumentFileName } from "../src/trade-tape-archive.mjs";
import { coverageFileName } from "../src/trade-tape-coverage.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/backfill-trade-tape.mjs", import.meta.url));
const T0 = Date.parse("2026-09-03T23:00:00Z");

function rawRecord(timestamp, payload = {}) {
  return { exchange: "CME", symbol: "NQU6", receivedAt: new Date(timestamp).toISOString(), payload };
}

function runFixture({ gapAt = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kwant-backfill-proof-"));
  const tradingDate = chicagoTradingDate(T0);
  const rawDir = join(dir, tradingDate);
  const tapeDir = join(dir, "trades", tradingDate);
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(tapeDir, { recursive: true });
  const rows = [
    rawRecord(T0, { templateId: 4 }),
    rawRecord(T0 + 60_000, { tradePrice: 29000, tradeSize: 2, aggressor: 1,
      ssboe: Math.floor((T0 + 60_000) / 1_000), usecs: 0 }),
    rawRecord(T0 + 120_000, { templateId: 5 }),
    ...(gapAt === null ? [] : [{ type: "GAP", exchange: "CME", symbol: "NQU6", receivedAt: gapAt }]),
  ];
  writeFileSync(join(rawDir, "CME-NQU6.ndjson.gz"), gzipSync(Buffer.from(
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
  )));
  // Live collector takes over after the observed quote bound. A later GAP is
  // outside this backfill segment and must not invalidate it.
  writeFileSync(join(tapeDir, instrumentFileName("CME", "NQU6")), gzipSync(Buffer.from(
    `${JSON.stringify([T0 + 150_000, 29001, 1, 1])}\n`,
  )));
  const result = spawnSync(process.execPath, [SCRIPT, "--dir", dir, "--date", tradingDate, "--roots", "NQ"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(readFileSync(join(tapeDir, coverageFileName("CME", "NQU6")), "utf8"));
  return { dir, receipt };
}

test("backfill receipt uses raw observation bounds, not merely first and last trade", () => {
  const { dir, receipt } = runFixture({ gapAt: T0 + 180_000 });
  try {
    assert.equal(receipt.observationFromMs, T0);
    assert.equal(receipt.observationToMs, T0 + 120_000);
    assert.equal(receipt.sourcePrintCount, 1);
    assert.equal(receipt.gapMarkers, 0);
    assert.equal(receipt.integrityComplete, true);
    assert.ok(readFileSync(join(dir, "trades", chicagoTradingDate(T0), backfillFileName("CME", "NQU6"))).length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a recorder gap inside the backfilled observation segment fails integrity", () => {
  const { dir, receipt } = runFixture({ gapAt: T0 + 90_000 });
  try {
    assert.equal(receipt.gapMarkers, 1);
    assert.equal(receipt.integrityComplete, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
