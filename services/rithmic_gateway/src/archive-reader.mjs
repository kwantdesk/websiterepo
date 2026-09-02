import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

/**
 * Reads a recorded session all the way through, past the damage.
 *
 * A session file is written by appending, so it is a gzip stream per RUN of
 * the collector, not per flush - the recorder's periodic flushes are deflate
 * blocks inside one continuous member. A 2.2 GB session is therefore usually a
 * single member, and a restart is what starts a new one. A process killed
 * mid-write truncates the member it was in, and every reader we had stopped
 * there and reported what it had. Since restarts happen more than once in a
 * session, everything after the FIRST break was being discarded while sitting
 * perfectly readable on disk: an affected session gave 933 readable minutes
 * against 1,380 on a clean one.
 *
 * Two things have to be true at once, and getting either wrong loses the file:
 *
 *   - Output already decoded before an error must be KEPT. zlib's async
 *     iterator rejects and discards its buffer, so `for await` throws away
 *     every intact record that preceded the damage. Measured on a fixture:
 *     "incorrect data check" with zero bytes delivered. Data events keep them.
 *
 *   - Damage must not end the read. Resume at the next member, bounded to that
 *     member's byte range so a later break cannot poison an earlier recovery.
 *
 * Member starts are found by scanning for the gzip magic and validating the
 * header, because that byte sequence also occurs inside compressed data - an
 * unvalidated candidate slices a healthy member in half and loses all of it.
 */

const SCAN_CHUNK_BYTES = 1 << 22;

/**
 * A member header, checked on eight bytes rather than three.
 *
 * Both writers put the same prefix down: magic 1f 8b, CM=08 deflate, FLG=00
 * (no name, no comment, no extra), and a zero MTIME - measured on a real
 * session file, 1f 8b 08 00 00 00 00 00 04 03. Only XFL and OS vary. Eight
 * fixed bytes make a false positive effectively impossible.
 *
 * The three-byte check that preceded this matched compressed data regularly,
 * and every false positive cut a healthy member in half: reading a real
 * session recovered 468 bars where reading it straight through gave 933.
 */
const MEMBER_HEADER = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);

function looksLikeHeader(buffer, at) {
  if (at + MEMBER_HEADER.length > buffer.length) return false;
  return buffer.compare(MEMBER_HEADER, 0, MEMBER_HEADER.length, at, at + MEMBER_HEADER.length) === 0;
}

/** The next plausible member start at or after `from`, or null. */
async function nextMemberOffset(path, from, size) {
  let offset = Math.max(0, from);
  while (offset < size) {
    const end = Math.min(size, offset + SCAN_CHUNK_BYTES);
    const chunks = [];
    for await (const chunk of createReadStream(path, { start: offset, end: end - 1 })) {
      chunks.push(chunk);
    }
    if (!chunks.length) break;
    const buffer = Buffer.concat(chunks);
    let at = buffer.indexOf(MEMBER_HEADER);
    while (at >= 0) {
      if (looksLikeHeader(buffer, at)) return offset + at;
      at = buffer.indexOf(MEMBER_HEADER, at + 1);
    }
    // Overlap so a header straddling the chunk edge is still seen, while the
    // offset always advances - without that guard a final short chunk spins.
    const advanced = Math.max(offset + 1, end - (MEMBER_HEADER.length - 1));
    if (advanced >= size) return null;
    offset = advanced;
  }
  return null;
}

/**
 * Decompress one byte range, handing every line to `take` as it arrives.
 *
 * Resolves whether or not the member was whole: what decoded before a failure
 * is real data and is kept.
 */
function readMember(path, start, end, take) {
  return new Promise((resolve) => {
    const source = createReadStream(path, { start, end: Math.max(start, end - 1) });
    const gunzip = createGunzip();
    let failed = false;
    let error = null;
    // pipe() does not forward source errors; make one a gunzip failure so a
    // single handler settles this.
    source.on("error", (cause) => { gunzip.destroy(cause); });
    gunzip.on("data", (chunk) => take(chunk.toString("utf8")));
    gunzip.on("end", () => { source.destroy(); resolve({ failed, error }); });
    gunzip.on("error", (cause) => {
      failed = true;
      error = cause instanceof Error ? cause.message : String(cause);
      source.destroy();
      resolve({ failed, error });
    });
    source.pipe(gunzip);
  });
}

/**
 * Yields every parseable NDJSON record, resuming past damaged members.
 *
 * The summary reports what was skipped so a caller can say honestly that a
 * session was partly unreadable rather than presenting it as whole.
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
  if (!size) return { records, malformed, breaks, members: 0, bytes: size, lastError };

  // A record can straddle a member boundary, so the tail of one may be half a
  // line. It is carried into the next rather than counted as junk.
  let carry = "";
  let members = 0;
  const maxResumes = Number.isFinite(options.maxResumes) ? options.maxResumes : 200;

  const take = (text) => {
    const lines = (carry + text).split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      try { onRecord(JSON.parse(line)); records += 1; } catch { malformed += 1; }
    }
  };

  /*
   * One member at a time, bounded to its own byte range.
   *
   * Bounding is only safe because the header check above is eight bytes: with
   * a weaker one a false positive splits a healthy member and everything past
   * the split is lost. It is necessary because reading onward to the end of
   * the file re-reads members already decoded and emits them twice, and
   * because a truncated tail does not always raise an error - zlib can treat
   * it as a clean end of stream, which silently ended the read with the
   * remaining members never looked at.
   */
  let start = 0;
  let guard = 0;
  while (start !== null && start < size && guard <= maxResumes) {
    guard += 1;
    const next = await nextMemberOffset(path, start + MEMBER_HEADER.length, size);
    const before = records;
    const { failed, error } = await readMember(path, start, next ?? size, take);
    if (records > before) members += 1;
    if (failed) {
      breaks += 1;
      lastError = error;
      // A half-line at the point of damage is not a record.
      carry = "";
    }
    if (options.onProgress) options.onProgress({ records, breaks });
    start = next;
  }

  if (carry.trim()) {
    try { onRecord(JSON.parse(carry)); records += 1; } catch { malformed += 1; }
  }

  return { records, malformed, breaks, members, bytes: size, lastError };
}
