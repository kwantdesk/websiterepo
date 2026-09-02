import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import { MarketDataRecorder } from "../src/recorder.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

const server = readFileSync(new URL("../src/server.mjs", import.meta.url), "utf8");

/**
 * A shutdown leaves a readable archive.
 *
 * closeStreams() called end() and returned. Ending a gzip stream is
 * asynchronous - the final deflate block and the gzip trailer are still to be
 * written - and the shutdown path then called process.exit, which does not
 * wait for pending writes. Worse, TWO signal handlers were registered for the
 * same signals and both called exit, so whichever won killed the process while
 * the other was still working.
 *
 * The result was that every restart truncated the last member of every open
 * file. A reader stops at "invalid block type" there, which cost about a third
 * of each session: 933 readable minutes out of roughly 1,380 on a day that
 * recorded normally. None of it can be re-requested - Rithmic sells no history
 * for the depth-by-order tape.
 */

const withRecorder = async (fn, options = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "kwant-rec-"));
  try {
    await fn(new MarketDataRecorder({ dir, enabled: true, flushMs: 10_000, ...options }), dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const T0 = Date.parse("2026-08-07T14:00:00Z");
const print = (ms, price) => ({
  exchange: "CME", symbol: "NQU6", type: "trade", price, size: 1, receivedAt: ms,
});
const sessionFile = (dir, ms) =>
  join(dir, chicagoTradingDate(ms), "CME-NQU6.ndjson.gz");

test("the gzip trailer reaches disk before close resolves", async () => {
  await withRecorder(async (recorder, dir) => {
    const client = new EventEmitter();
    recorder.attach(client);
    for (let i = 0; i < 200; i += 1) client.emit("marketData", print(T0 + i, 29000 + i));

    await recorder.close();

    // No delay, no polling: if close() resolved, the file must already be
    // complete. Reading it is what a backfill does.
    const rows = gunzipSync(readFileSync(sessionFile(dir, T0)))
      .toString("utf8").trim().split("\n").filter(Boolean);
    assert.equal(rows.length, 200, `expected 200 records, recovered ${rows.length}`);
    assert.equal(JSON.parse(rows.at(-1)).price, 29199, "the tail of the session is missing");
  });
});

test("a session roll does not orphan the new file", async () => {
  /*
   * The roll closes yesterday's handles from a synchronous path. When that
   * clearing happened after an await, the stream opened for the NEW session
   * moments later was swept out of the map while still open - nothing ever
   * ended it, so its trailer was never written and the whole new session read
   * as truncated. This is the exact shape of that bug.
   */
  await withRecorder(async (recorder, dir) => {
    const client = new EventEmitter();
    recorder.attach(client);
    // Before the 17:00 Chicago roll, then after it.
    const before = Date.parse("2026-08-07T21:00:00Z");
    const after = Date.parse("2026-08-07T23:00:00Z");
    assert.notEqual(chicagoTradingDate(before), chicagoTradingDate(after), "fixture does not cross a roll");

    client.emit("marketData", print(before, 29000));
    client.emit("marketData", print(after, 29100));
    await recorder.close();

    for (const [ms, price] of [[before, 29000], [after, 29100]]) {
      const path = sessionFile(dir, ms);
      assert.ok(existsSync(path), `no file for ${chicagoTradingDate(ms)}`);
      const rows = gunzipSync(readFileSync(path)).toString("utf8").trim().split("\n").filter(Boolean);
      assert.equal(rows.length, 1, `${chicagoTradingDate(ms)} is truncated`);
      assert.equal(JSON.parse(rows[0]).price, price);
    }
  });
});

test("closing twice is safe", async () => {
  // Two signal handlers used to race; a guard is only worth having if the
  // second call cannot corrupt what the first wrote.
  await withRecorder(async (recorder, dir) => {
    const client = new EventEmitter();
    recorder.attach(client);
    client.emit("marketData", print(T0, 29000));
    await recorder.close();
    await recorder.close();
    const rows = gunzipSync(readFileSync(sessionFile(dir, T0)))
      .toString("utf8").trim().split("\n").filter(Boolean);
    assert.equal(rows.length, 1);
  });
});

test("there is one shutdown path and it flushes the tape first", () => {
  assert.equal(
    (server.match(/process\.on\("SIGTERM"/g) ?? []).length,
    1,
    "SIGTERM is registered more than once again",
  );
  assert.equal((server.match(/process\.on\("SIGINT"/g) ?? []).length, 1);
  assert.match(server, /let shuttingDown = false;/, "shutdown is not guarded against re-entry");

  const body = server.slice(server.indexOf("async function shutdown() {"));
  const recorderAt = body.indexOf("await recorder.close()");
  const exitAt = body.indexOf("process.exit(0)");
  assert.ok(recorderAt > 0, "shutdown no longer closes the recorder");
  assert.ok(recorderAt < exitAt, "the process can exit before the tape is written");
  assert.match(body.slice(0, 900), /await chartHistory\.flush\(\)/, "the bar archive is not flushed on shutdown");
});

test("a stuck file cannot hold the process past the stop grace period", () => {
  /*
   * Losing the tail of one file is better than losing the shutdown: the
   * container runtime SIGKILLs after its grace period, and that kills every
   * other file too.
   */
  const recorderSource = readFileSync(new URL("../src/recorder.mjs", import.meta.url), "utf8");
  assert.match(recorderSource, /async closeStreams\(timeoutMs = 4_000\)/);
  assert.match(recorderSource, /timed out closing \$\{key\}/);
  assert.match(server, /setTimeout\(\(\) => process\.exit\(0\), 5_000\)/);
});
