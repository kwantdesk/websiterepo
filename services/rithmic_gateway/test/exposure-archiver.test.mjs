import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ExposureArchiver, endpointSlug, requestKey } from "../src/exposure-archiver.mjs";

/**
 * The options exposure archive.
 *
 * Futures have a permanent tape; options had nothing, so gamma history could
 * not accumulate and yesterday's surface was unrecoverable at any price. This
 * archives the provider's own responses at the vendor boundary, which is the
 * one place every GEX surface passes through.
 *
 * The load-bearing behaviour is the dedupe. The desk polls these surfaces far
 * more often than the provider updates them, so without it the archive is
 * mostly identical copies and a month of gamma costs far more disk than it
 * needs to.
 */

const newArchiver = (over = {}) => new ExposureArchiver({
  dir: mkdtempSync(join(tmpdir(), "exposure-archive-")),
  enabled: true,
  ...over,
});

const body = (value) => Buffer.from(JSON.stringify(value));
// A fixed instant so the trading date is deterministic rather than "today".
const AT = Date.parse("2026-08-25T18:30:00Z");

test("one file per surface, named after the endpoint", async () => {
  assert.equal(endpointSlug("/v1/options/exposure-by-strike"), "options-exposure-by-strike");
  assert.equal(endpointSlug("/v1/options/interval-map"), "options-interval-map");
  // The slug becomes a filename, so nothing unexpected may survive into it.
  assert.equal(endpointSlug("/v1/../../etc/passwd"), "etc-passwd");
  assert.equal(endpointSlug(""), "unknown");
  assert.equal(endpointSlug(null), "unknown");
});

test("the same surface for two symbols is two different frames", async () => {
  // The endpoint alone is not the identity — one path serves every underlying.
  const spx = requestKey("/v1/options/exposure-by-strike", body({ ticker: "SPX" }));
  const ndx = requestKey("/v1/options/exposure-by-strike", body({ ticker: "NDX" }));
  assert.notEqual(spx, ndx);
  assert.equal(spx, requestKey("/v1/options/exposure-by-strike", body({ ticker: "SPX" })));
});

test("an unchanged repeat is not written twice", async () => {
  // THE POINT OF THE WHOLE THING. Panes poll every 15-30s; the provider moves
  // about once a minute. Without this the archive is mostly duplicates.
  const archiver = newArchiver();
  const request = body({ ticker: "SPX" });
  const payload = body({ strikes: [1, 2, 3] });

  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload, receivedAtMs: AT }), true);
  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload, receivedAtMs: AT + 15_000 }), false);
  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload, receivedAtMs: AT + 30_000 }), false);

  const status = archiver.status();
  assert.equal(status.archived["options-exposure-by-strike"], 1);
  assert.equal(status.skipped["options-exposure-by-strike"], 2);
  await archiver.stop();
});

test("a changed surface IS written", async () => {
  const archiver = newArchiver();
  const request = body({ ticker: "SPX" });
  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload: body({ strikes: [1] }), receivedAtMs: AT }), true);
  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload: body({ strikes: [2] }), receivedAtMs: AT + 60_000 }), true);
  assert.equal(archiver.status().archived["options-exposure-by-strike"], 2);
  await archiver.stop();
});

test("two symbols on one endpoint do not deduplicate each other", async () => {
  // Sharing a dedupe key across symbols would drop every second frame while
  // the surfaces alternated, and the loss would look like a quiet provider.
  const archiver = newArchiver();
  const payload = body({ strikes: [1] });
  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: body({ ticker: "SPX" }), payload, receivedAtMs: AT }), true);
  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: body({ ticker: "NDX" }), payload, receivedAtMs: AT }), true);
  assert.equal(archiver.status().archived["options-exposure-by-strike"], 2);
  await archiver.stop();
});

test("a new session starts clean instead of skipping its first frame", async () => {
  // Carrying hashes across the rotation would drop the opening surface of the
  // day as a duplicate of yesterday's close, which is the single frame a
  // replay most needs.
  const archiver = newArchiver();
  const request = body({ ticker: "SPX" });
  const payload = body({ strikes: [1] });
  const beforeRoll = Date.parse("2026-08-25T20:00:00Z");
  const afterRoll = Date.parse("2026-08-26T20:00:00Z");

  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload, receivedAtMs: beforeRoll }), true);
  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload, receivedAtMs: beforeRoll + 1_000 }), false);
  assert.equal(
    archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload, receivedAtMs: afterRoll }),
    true,
    "the same surface on a new trading date must be archived again",
  );
  await archiver.stop();
});

test("frames land on disk, readable, with the request that produced them", async () => {
  const archiver = newArchiver();
  archiver.archive({
    path: "/v1/options/exposure-by-strike",
    requestBody: body({ ticker: "SPX", greek: "gamma" }),
    payload: body({ strikes: [{ strike: 7000, gamma: 12.5 }] }),
    receivedAtMs: AT,
  });
  await archiver.stop();

  // A CME trading date is named for the day the session OPENED at 17:00
  // Chicago, so 18:30Z on the 25th (13:30 Chicago) belongs to the session that
  // began on the 24th. The rest of the archive files sessions this way and
  // replay reads them that way; picking the calendar date here instead would
  // put gamma frames in a different folder from the tape they line up with.
  const dayDir = join(archiver.dir, "2026-08-24");
  const files = readdirSync(dayDir);
  assert.deepEqual(files, ["options-exposure-by-strike.ndjson.gz"]);

  const lines = gunzipSync(readFileSync(join(dayDir, files[0]))).toString("utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.ts, AT);
  assert.equal(record.path, "/v1/options/exposure-by-strike");
  // Without the request a replay cannot tell which underlying this answers.
  assert.deepEqual(record.request, { ticker: "SPX", greek: "gamma" });
  assert.deepEqual(record.payload, { strikes: [{ strike: 7000, gamma: 12.5 }] });
});

test("disabled or empty archives nothing", async () => {
  const off = new ExposureArchiver({ dir: null, enabled: false });
  assert.equal(off.archive({ path: "/v1/x", requestBody: body({}), payload: body({}), receivedAtMs: AT }), false);

  const on = newArchiver();
  assert.equal(on.archive({ path: "/v1/x", requestBody: body({}), payload: Buffer.alloc(0), receivedAtMs: AT }), false);
  assert.equal(on.archive({ path: "/v1/x", requestBody: body({}), payload: null, receivedAtMs: AT }), false);
  await on.stop();
});

test("a saturated writer counts the loss instead of hiding it", async () => {
  // Roomy enough for a couple of frames, far too small for twenty — the point
  // is the transition from writing to counting, not the exact cut-off. Nothing
  // drains the buffer here because flush() runs on the timer that start() owns.
  const archiver = newArchiver({ maxPendingBytes: 1_200 });
  const request = body({ ticker: "SPX" });
  let written = 0;
  for (let index = 0; index < 20; index += 1) {
    if (archiver.archive({
      path: "/v1/options/exposure-by-strike",
      requestBody: request,
      payload: body({ strikes: Array.from({ length: 40 }, (_, n) => n + index) }),
      receivedAtMs: AT + index * 60_000,
    })) written += 1;
  }
  const status = archiver.status();
  assert.ok(written > 0, "some frames must get through");
  assert.ok(status.dropped["options-exposure-by-strike"] > 0, "and the rest must be counted as dropped");
  await archiver.stop();
});

test("a dropped frame is retried rather than remembered as written", async () => {
  // Recording the hash before the buffer succeeds would mark a frame that never
  // reached the disk as archived, and the retry would be skipped as a duplicate
  // — a hole that nothing reports.
  const archiver = newArchiver({ maxPendingBytes: 1 });
  const request = body({ ticker: "SPX" });
  const payload = body({ strikes: [1, 2, 3] });
  assert.equal(archiver.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload, receivedAtMs: AT }), false);
  assert.equal(archiver.status().dropped["options-exposure-by-strike"], 1);

  // Same payload again on a writer with room: it must still be considered new.
  const roomy = newArchiver();
  assert.equal(roomy.archive({ path: "/v1/options/exposure-by-strike", requestBody: request, payload, receivedAtMs: AT }), true);
  await archiver.stop();
  await roomy.stop();
});

test("the tracked-key set cannot grow without bound", async () => {
  const archiver = newArchiver({ maxTrackedKeys: 10 });
  for (let index = 0; index < 100; index += 1) {
    archiver.archive({
      path: "/v1/options/exposure-by-strike",
      requestBody: body({ ticker: `SYM${index}` }),
      payload: body({ strikes: [index] }),
      receivedAtMs: AT,
    });
  }
  assert.ok(archiver.lastHashes.size <= 10, `tracked keys must stay bounded, got ${archiver.lastHashes.size}`);
  await archiver.stop();
});
