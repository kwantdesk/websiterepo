import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createInterface } from "node:readline";

/**
 * Reads a recorded session all the way through, past the damage.
 *
 * The recorder appends one gzip member per flush, so a session file is a
 * multi-member archive. A process killed mid-write leaves that member
 * truncated, and every reader we had - gunzip, zcat, createGunzip, the LIQ MAP
 * replay, the bar backfill - stopped at the first bad member and reported what
 * it had. Restarts happen more than once in a session, so the damage is not
 * only at the tail: everything after the FIRST break was being discarded while
 * sitting perfectly readable on disk. Measured on the collector, an affected
 * session gave 933 readable minutes against 1,380 on a clean one.
 *
 * Piping the whole file through one gunzip cannot fix it. zlib buffers, so a
 * corrupt member aborts the stream before it emits ANY of the intact members
 * that preceded it - measured: "incorrect data check" with zero bytes
 * delivered. Members are independent, so they are decompressed one at a time
 * and a bad one costs only itself.
 *
 * Member starts are found by scanning for the gzip magic. That sequence also
 * occurs inside compressed data, so a candidate is only believed if the slice
 * it begins actually decompresses; a false positive costs one failed attempt.
 */

const GZIP_MAGIC = Buffer.from([0x1f, 0x8b, 0x08]);
const SCAN_CHUNK_BYTES = 1 << 22;
// A member is one flush of the recorder's buffer. This bound exists so a
// corrupt length cannot make us try to hold a gigabyte in memory.
const MAX_MEMBER_BYTES = 256 << 20;

/** Every offset where a gzip member might begin, in order. */
async function memberOffsets(path, size) {
  const offsets = [];
  let offset = 0;
  while (offset < size) {
    const end = Math.min(size, offset + SCAN_CHUNK_BYTES);
    const chunks = [];
    for await (const chunk of createReadStream(path, { start: offset, end: end - 1 })) {
      chunks.push(chunk);
    }
    if (!chunks.length) break;
    const buffer = Buffer.concat(chunks);
    let at = buffer.indexOf(GZIP_MAGIC);
    while (at >= 0) {
      const absolute = offset + at;
      if (offsets.at(-1) !== absolute) offsets.push(absolute);
      at = buffer.indexOf(GZIP_MAGIC, at + 1);
    }
    // Overlap so a header straddling the chunk edge is still seen, while the
    // offset always advances - without that guard a final short chunk spins.
    const advanced = Math.max(offset + 1, end - (GZIP_MAGIC.length - 1));
    if (advanced >= size) break;
    offset = advanced;
  }
  return offsets;
}

/**
 * Yields every parseable NDJSON record, skipping only the damaged members.
 *
 * `onRecord` receives each decoded object. The summary reports what was
 * skipped so a caller can say honestly that a session was partly unreadable
 * rather than presenting it as whole.
 */
export async function readArchiveRecords(path, onRecord, options = {}) {
  const { size } = await stat(path);
  let records = 0;
  let malformed = 0;
  let breaks = 0;
  let lastError = null;

  if (!path.endsWith(".gz")) {
    const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line) continue;
      try { onRecord(JSON.parse(line)); records += 1; } catch { malformed += 1; }
    }
    return { records, malformed, breaks, members: 1, bytes: size, lastError };
  }

  const starts = await memberOffsets(path, size);
  if (!starts.length) return { records, malformed, breaks, members: 0, bytes: size, lastError };

  const handle = await open(path, "r");
  // A record can straddle a member boundary, so the tail of one member may be
  // half a line. It is carried into the next rather than counted as junk.
  let carry = "";
  let members = 0;
  try {
    for (let index = 0; index < starts.length; index += 1) {
      const start = starts[index];
      const end = index + 1 < starts.length ? starts[index + 1] : size;
      const length = end - start;
      if (length <= 0 || length > MAX_MEMBER_BYTES) continue;

      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      let text;
      try {
        text = gunzipSync(buffer.subarray(0, bytesRead)).toString("utf8");
      } catch (error) {
        // Only this member is lost. A half-line carried into it is not a
        // record either, so it is dropped rather than joined to the next.
        breaks += 1;
        carry = "";
        lastError = error instanceof Error ? error.message : String(error);
        continue;
      }
      members += 1;
      const lines = (carry + text).split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        try { onRecord(JSON.parse(line)); records += 1; } catch { malformed += 1; }
      }
      if (options.onProgress && members % 500 === 0) options.onProgress({ records, breaks });
    }
    if (carry.trim()) {
      try { onRecord(JSON.parse(carry)); records += 1; } catch { malformed += 1; }
    }
  } finally {
    await handle.close();
  }

  return { records, malformed, breaks, members, bytes: size, lastError };
}
