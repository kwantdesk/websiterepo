import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { SessionProfileArchive } from "../src/session-profile-archive.mjs";
import { cmeSessionBounds } from "../src/trading-session.mjs";

test("weekly coverage lists missing interior sessions and excludes closed weekend dates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kd-weekly-coverage-"));
  try {
    const archive = new SessionProfileArchive({ dir });
    for (const date of ["2026-10-11", "2026-10-15"]) {
      const day = join(dir, "trades", date);
      await mkdir(day, { recursive: true });
      await writeFile(join(day, "CME-NQZ6.trades.history.ndjson.gz"),
        gzipSync(JSON.stringify([cmeSessionBounds(date).startMs + 1, 100, 5, 1]) + "\n"));
      await archive.sessionLevels(date, "CME", "NQZ6", .25);
    }
    const profile = await archive.load({ exchange: "CME", symbol: "NQZ6", tickSize: .25,
      fromMs: cmeSessionBounds("2026-10-11").startMs, toMs: cmeSessionBounds("2026-10-17").endMs });
    assert.deepEqual(profile.missingSessionDates, ["2026-10-12", "2026-10-13", "2026-10-14"]);
    assert.equal(profile.levels[0].volume, 10, "never invent the missing days' volume");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
