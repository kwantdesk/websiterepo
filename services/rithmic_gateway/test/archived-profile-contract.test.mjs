import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archivedProfileContract } from "../src/archived-profile-contract.mjs";

test("offline historical profiles select an actual archived contract, not a guessed or parent book", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kd-profile-contract-"));
  try {
    const day = join(dir, "trades", "2026-10-15");
    await mkdir(day, { recursive: true });
    for (const symbol of ["NQZ6", "MNQZ6", "ESZ6"]) await writeFile(join(day, `CME-${symbol}.trades.history.ndjson.gz`), "");
    const start = Date.parse("2026-10-15T22:00:00Z"), end = Date.parse("2026-10-16T22:00:00Z");
    assert.equal(archivedProfileContract(dir, "CME", "NQ", start, end), "NQZ6");
    assert.equal(archivedProfileContract(dir, "CME", "MNQ", start, end), "MNQZ6");
    assert.equal(archivedProfileContract(dir, "CBOT", "NQ", start, end), null);
    assert.equal(archivedProfileContract(dir, "CME", "NQ", 0, end), null);
    await writeFile(join(day, "CME-NQH7.trades.ndjson.gz"), "");
    assert.equal(archivedProfileContract(dir, "CME", "NQ", start, end), null,
      "ambiguous rollover requires an explicit contract, never arbitrary selection");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
