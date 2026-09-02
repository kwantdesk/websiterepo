import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readArchiveRecords } from "../src/archive-reader.mjs";

/**
 * A damaged session is read past the damage, not abandoned at it.
 *
 * The recorder appends one gzip member per flush, so a session file is a
 * multi-member archive. A process killed mid-write truncates that member, and
 * every reader we had stopped there and reported what it had. Restarts happen
 * more than once in a session, so the damage is not only at the tail:
 * everything after the FIRST break was discarded while sitting perfectly
 * readable on disk. Measured on the collector, an affected session gave 933
 * readable minutes against 1,380 on a clean one.
 */

// Awaited, or the finally deletes the directory out from under the test.
const withFile = async (fn) => {
  const dir = mkdtempSync(join(tmpdir(), "kwant-arc-"));
  try { await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};

const member = (rows) =>
  gzipSync(Buffer.from(rows.map((row) => `${JSON.stringify(row)}\n`).join("")));

const collect = async (path) => {
  const seen = [];
  const summary = await readArchiveRecords(path, (record) => seen.push(record));
  return { seen, summary };
};

test("a clean multi-member archive reads whole", async () => {
  await withFile(async (dir) => {
    const path = join(dir, "clean.ndjson.gz");
    writeFileSync(path, member([{ i: 1 }, { i: 2 }]));
    appendFileSync(path, member([{ i: 3 }]));
    appendFileSync(path, member([{ i: 4 }, { i: 5 }]));
    const { seen, summary } = await collect(path);
    assert.deepEqual(seen.map((r) => r.i), [1, 2, 3, 4, 5]);
    assert.equal(summary.breaks, 0, "a clean file should need no resume");
    assert.equal(summary.malformed, 0);
  });
});

test("everything after a truncated member is still recovered", async () => {
  /*
   * The reported loss. A member cut mid-stream used to end the read, so the
   * two complete members after it were thrown away.
   */
  await withFile(async (dir) => {
    const path = join(dir, "damaged.ndjson.gz");
    writeFileSync(path, member([{ i: 1 }, { i: 2 }]));
    const broken = member([{ i: 999 }]);
    appendFileSync(path, broken.subarray(0, Math.max(12, broken.length - 6)));
    appendFileSync(path, member([{ i: 3 }]));
    appendFileSync(path, member([{ i: 4 }]));

    const { seen, summary } = await collect(path);
    const values = seen.map((r) => r.i);
    assert.ok(values.includes(1) && values.includes(2), "records before the damage were lost");
    assert.ok(values.includes(3) && values.includes(4), `records after the damage were lost: ${values}`);
    assert.ok(summary.breaks >= 1, "the damage was not reported");
  });
});

test("damage in more than one place is survived", async () => {
  // Several restarts in one session means several breaks, not one.
  await withFile(async (dir) => {
    const path = join(dir, "multi.ndjson.gz");
    writeFileSync(path, member([{ i: 1 }]));
    const first = member([{ i: 900 }]);
    appendFileSync(path, first.subarray(0, Math.max(12, first.length - 5)));
    appendFileSync(path, member([{ i: 2 }]));
    const second = member([{ i: 901 }]);
    appendFileSync(path, second.subarray(0, Math.max(12, second.length - 5)));
    appendFileSync(path, member([{ i: 3 }]));

    const { seen } = await collect(path);
    const values = seen.map((r) => r.i);
    for (const wanted of [1, 2, 3]) {
      assert.ok(values.includes(wanted), `record ${wanted} was lost: ${values}`);
    }
  });
});

test("a record split across a member boundary is not counted as junk", async () => {
  /*
   * The recorder flushes on a timer, not on a line boundary, so half a record
   * can end one member and the rest begin the next.
   */
  await withFile(async (dir) => {
    const path = join(dir, "split.ndjson.gz");
    const row = `${JSON.stringify({ i: 7, note: "split across members" })}\n`;
    const cut = Math.floor(row.length / 2);
    writeFileSync(path, gzipSync(Buffer.from(row.slice(0, cut))));
    appendFileSync(path, gzipSync(Buffer.from(row.slice(cut))));
    const { seen, summary } = await collect(path);
    assert.deepEqual(seen, [{ i: 7, note: "split across members" }]);
    assert.equal(summary.malformed, 0, "a straddling record was counted as malformed");
  });
});

test("a file that is entirely rubbish terminates", async () => {
  // It must not spin looking for a header that will never decompress.
  await withFile(async (dir) => {
    const path = join(dir, "rubbish.ndjson.gz");
    writeFileSync(path, Buffer.alloc(4096, 0x1f));
    const { seen, summary } = await collect(path);
    assert.equal(seen.length, 0);
    assert.ok(Number.isFinite(summary.breaks));
  });
});

test("an uncompressed archive still reads", async () => {
  await withFile(async (dir) => {
    const path = join(dir, "plain.ndjson");
    writeFileSync(path, `${JSON.stringify({ i: 1 })}\n${JSON.stringify({ i: 2 })}\n`);
    const { seen } = await collect(path);
    assert.deepEqual(seen.map((r) => r.i), [1, 2]);
  });
});
