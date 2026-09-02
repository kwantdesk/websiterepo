import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { runArchiveFold } from "../src/archive-fold-worker-client.mjs";
import {
  EventLoopLoadGuard,
  isDeferrableDuringOverload,
} from "../src/event-loop-load-guard.mjs";

test("a long event-loop stall trips a bounded recovery window", () => {
  let now = 1_000;
  const guard = new EventLoopLoadGuard({
    sampleMs: 1_000,
    overloadLagMs: 500,
    recoveryMs: 30_000,
    now: () => now,
  });
  guard.observe(now);
  now = 3_600;
  assert.equal(guard.observe(now), 1_600);
  assert.equal(guard.isOverloaded(now), true);
  assert.equal(guard.status(now).tripCount, 1);
  assert.equal(guard.isOverloaded(now + 30_001), false);
});

test("load shedding protects live paths and defers archive work only", () => {
  assert.equal(isDeferrableDuringOverload("/v1/market-data/volume-profile"), true);
  assert.equal(isDeferrableDuringOverload("/v1/market-data/order-flow-levels"), true);
  assert.equal(isDeferrableDuringOverload("/v1/heatmap/replay"), true);
  assert.equal(isDeferrableDuringOverload("/health"), false);
  assert.equal(isDeferrableDuringOverload("/v1/market-data/trades"), false);
  assert.equal(isDeferrableDuringOverload("/v1/market-data/snapshot"), false);
});

test("a large archive fold cannot block live gateway timers", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kwant-archive-worker-"));
  try {
    const tradingDate = "2026-09-01";
    const start = Date.parse("2026-09-02T14:00:00Z");
    const rows = [];
    for (let index = 0; index < 250_000; index += 1) {
      rows.push(JSON.stringify([
        start + index * 10,
        29_000 + (index % 400) * 0.25,
        index % 20 + 1,
        index % 2 ? 1 : -1,
      ]));
    }
    const file = join(dir, "CME-NQU6.backfill.ndjson.gz");
    writeFileSync(file, gzipSync(Buffer.from(`${rows.join("\n")}\n`)));

    let last = performance.now();
    let worstGapMs = 0;
    const heartbeat = setInterval(() => {
      const current = performance.now();
      worstGapMs = Math.max(worstGapMs, current - last);
      last = current;
    }, 5);
    const result = await runArchiveFold({
      kind: "bar-flow",
      files: [file],
      tradingDate,
      ceiling: 500_000,
    });
    clearInterval(heartbeat);

    assert.ok(result.minutes.length > 0, "the worker did not fold the archive");
    assert.ok(
      worstGapMs < 250,
      `the archive worker blocked the gateway timer for ${worstGapMs.toFixed(1)}ms`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
