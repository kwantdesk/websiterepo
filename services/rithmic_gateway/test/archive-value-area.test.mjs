import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { buildArchivedValueAreaProfile } from "../src/archive-value-area.mjs";
import { cmeSessionBounds } from "../src/trading-session.mjs";

test("completed Rithmic tape reconstructs an exact prior-session value area", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kwantdesk-value-area-"));
  try {
    const bounds = cmeSessionBounds("2026-08-12");
    assert.ok(bounds);
    const dayDir = join(dir, "2026-08-12");
    mkdirSync(dayDir, { recursive: true });
    const records = [
      [100, 2],
      [100.25, 5],
      [100.5, 8],
      [100.75, 3],
      [101, 1],
    ].map(([tradePrice, tradeSize], index) => ({
      templateId: 150,
      exchange: "CME",
      symbol: "NQU6",
      payload: {
        tradePrice,
        tradeSize,
        ssboe: Math.floor((bounds.startMs + 1_000 + index * 1_000) / 1_000),
        usecs: 0,
      },
      receivedAt: new Date(bounds.startMs + 1_000 + index * 1_000).toISOString(),
    }));
    writeFileSync(
      join(dayDir, "CME-NQU6.ndjson.gz"),
      gzipSync(`${records.map((record) => JSON.stringify(record)).join("\n")}\n`),
    );

    const profile = await buildArchivedValueAreaProfile({
      dir,
      exchange: "CME",
      symbol: "NQU6",
      startMs: bounds.startMs,
      endMs: bounds.endMs,
      tickSize: 0.25,
      valueAreaPercent: 0.7,
    });
    assert.ok(profile);
    assert.equal(profile.tradeRecords, 5);
    assert.equal(profile.totalVolume, 19);
    assert.equal(profile.poc, 100.5);
    assert.equal(profile.vah, 100.75);
    assert.equal(profile.val, 100.25);
    assert.equal(profile.integrityGaps, 0);
    assert.equal(profile.droppedMessages, 0);
    assert.equal(profile.tradingDate, "2026-08-12");
    assert.equal(existsSync(join(dayDir, "CME-NQU6.ndjson.gz.kwant-value-area.json")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
