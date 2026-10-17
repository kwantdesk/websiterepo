import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { loadExactTapeWindow } from "../src/exact-tape-window.mjs";

test("exact viewport archive is window bounded, coalesced and never samples over capacity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kd-exact-window-"));
  try {
    const t = Date.parse("2026-10-16T14:00:00Z"), day = join(dir, "trades", "2026-10-15");
    await mkdir(day, { recursive: true });
    const rows = Array.from({ length: 100001 }, (_, i) => [t + i, 100, 1, i % 2 ? 1 : -1]);
    await writeFile(join(day, "CME-NQZ6.trades.history.ndjson.gz"), gzipSync(rows.map(r => JSON.stringify(r)).join("\n") + "\n"));
    const args = { dir, exchange: "CME", symbol: "NQZ6", fromMs: t + 2, toMs: t + 5 };
    const first = loadExactTapeWindow(args);
    assert.equal(loadExactTapeWindow(args), first);
    const exact = await first;
    assert.equal(exact.truncated, false);
    assert.deepEqual(exact.records, rows.slice(2, 5));
    const oversized = await loadExactTapeWindow({ ...args, fromMs: t, toMs: t + 100002 });
    assert.equal(oversized.truncated, true);
    assert.equal(oversized.sourceRecordCount, 100001);
    assert.deepEqual(oversized.records, []);
    assert.throws(() => loadExactTapeWindow({ ...args, toMs: t - 1 }), /Invalid/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
