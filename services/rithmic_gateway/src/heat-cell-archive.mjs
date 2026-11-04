import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip, constants } from 'node:zlib';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { validateHeatCellArchiveQuery, heatRecord as record, heatFinite as finite, heatDateOf as dateOf, heatProblem as problem, heatEnsure as ensure, heatFingerprint as fingerprint } from './heat-cell-archive-policy.mjs';
export { validateHeatCellArchiveQuery } from './heat-cell-archive-policy.mjs';

const MiB = 1024 * 1024;
export const HEAT_CELL_ARCHIVE_LIMITS = Object.freeze({ compressedBytes: 32 * MiB, scanBytes: 128 * MiB, lineBytes: 12 * MiB, frames: 5000, rows: 256, timeMs: 2500 });
function cursorEncode(value, key) { const body = Buffer.from(JSON.stringify(value)).toString('base64url'); return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`; }
function cursorDecode(token, key) {
  try { const [body, signature, extra] = token.split('.'), expected = createHmac('sha256', key).update(body).digest(), actual = Buffer.from(signature, 'base64url'); ensure(!extra && expected.length === actual.length && timingSafeEqual(actual, expected)); return JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { throw problem('heat_cell_invalid_cursor'); }
}
function cellRow(frame, selection) {
  if (!record(frame) || !/^\/(?:v\d+\/)?options\/(?:tool\/)?heat-map$/.test(frame.path || '') || !record(frame.request) || !record(frame.payload)) return null;
  let sourceFingerprint; try { sourceFingerprint = fingerprint(frame.request); } catch { return null; }
  if (sourceFingerprint !== selection.sourceFingerprint) return null;
  const receivedAtMs = finite(frame.ts), pinned = frame.request.snapshotTime !== undefined;
  const time = pinned ? Date.parse(frame.request.snapshotTime) : receivedAtMs;
  if (!Number.isFinite(time) || time > selection.throughMs || dateOf(time) !== selection.sessionDate || !pinned && frame.request.sessionDate && frame.request.sessionDate !== selection.sessionDate) return null;
  const expiry = frame.payload.data?.[selection.expirationDate];
  const entries = record(expiry) ? Object.entries(expiry).filter(([strike]) => strike.trim() && Number(strike) === selection.strikePrice) : [];
  const cell = entries.length === 1 && record(entries[0][1]) ? entries[0][1] : null;
  const call = frame.payload.type === 'contract' ? finite(cell?.callValue) : null, put = frame.payload.type === 'contract' ? finite(cell?.putValue) : null;
  const exposure = selection.dataMode.endsWith('_EXPOSURE');
  const value = frame.payload.type === 'single' ? finite(cell?.value) : call !== null && put !== null ? exposure ? call + put : call - put : null;
  return { time, receivedAtMs, basis: pinned ? 'snapshot' : 'observation', call, put, value, ticker: selection.ticker, expirationDate: selection.expirationDate, strikePrice: selection.strikePrice, dataMode: selection.dataMode, sourceUnit: 'provider-native' };
}

/** Read-only bounded scan. The public class runs this away from the live collector loop. */
export async function scanHeatCellArchive({ dir, selection, key, now = Date.now(), limits = HEAT_CELL_ARCHIVE_LIMITS }) {
  const publicSelection = { ticker: selection.ticker, sessionDate: selection.sessionDate, expirationDate: selection.expirationDate, strikePrice: selection.strikePrice, dataMode: selection.dataMode, throughMs: selection.throughMs };
  const previousDate = new Date(Date.parse(selection.sessionDate + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10), files = [];
  // Opening-date convention: the NY cash session belongs to the preceding CME
  // folder, and observations after18ET belong to this date's folder.
  for (const date of [previousDate, selection.sessionDate]) for (const suffix of ['.ndjson.gz', '.ndjson']) {
    const candidate = join(dir, 'exposure', date, `options-tool-heat-map${suffix}`);
    try { const stat = await lstat(candidate); ensure(stat.isFile() && !stat.isSymbolicLink(), 'heat_cell_unsafe_archive', 409); files.push({ path: candidate, identity: `${stat.dev}:${stat.ino}`, size: stat.size }); break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!files.length) {
    ensure(!selection.cursor, 'heat_cell_stale_cursor', 409);
    return { rows: [], selection: publicSelection, coverage: { kind: 'observations-only', scanComplete: true, partial: true, scanPartial: false, reason: 'not-recorded' }, nextCursor: null };
  }
  const prior = selection.cursor ? cursorDecode(selection.cursor, key) : null;
  if (prior) {
    ensure(prior.v === 1 && prior.scope === selection.scope && Array.isArray(prior.files) && prior.files.length === files.length && Number.isSafeInteger(prior.afterLine) && prior.afterLine >= 0 && prior.expires > now, 'heat_cell_stale_cursor', 409);
    for (let i = 0; i < files.length; i++) { ensure(prior.files[i].identity === files[i].identity && Number.isSafeInteger(prior.files[i].size) && prior.files[i].size >= 0 && prior.files[i].size <= files[i].size, 'heat_cell_stale_cursor', 409); files[i].size = prior.files[i].size; }
  }
  const cursorFiles = files.map(({ identity, size }) => ({ identity, size })), afterLine = prior?.afterLine ?? 0, started = Date.now();
  const rows = [], counters = { compressedBytes: 0, scanBytes: 0, frames: 0, invalidFrames: 0 }; let lineNumber = 0, pending = [], pendingSize = 0, reason = null, nextCursor = null;
  try {
    files: for (const { path, size } of files) {
      if (!size) continue;
      const input = createReadStream(path, { end: size - 1, highWaterMark: 16384 });
      const stream = path.endsWith('.gz') ? input.pipe(createGunzip({ finishFlush: constants.Z_SYNC_FLUSH, chunkSize: 16384 })) : input;
      input.on('data', chunk => { counters.compressedBytes += chunk.length; }); input.on('error', error => stream.destroy(error));
      try { for await (const chunk of stream) {
      counters.scanBytes += chunk.length;
      if (counters.compressedBytes > limits.compressedBytes || counters.scanBytes > limits.scanBytes) { reason = 'scan-byte-limit'; break; }
      if (Date.now() - started > limits.timeMs) { reason = 'scan-time-limit'; break; }
      let offset = 0, newline;
      while ((newline = chunk.indexOf(10, offset)) >= 0) {
        const last = chunk.subarray(offset, newline), lineSize = pendingSize + last.length;
        if (lineSize > limits.lineBytes) { reason = 'frame-byte-limit'; break files; }
        const line = pending.length ? Buffer.concat([...pending, last], lineSize) : last;
        pending = []; pendingSize = 0; offset = newline + 1; lineNumber++;
        if (line.length > limits.lineBytes) { reason = 'frame-byte-limit'; break files; }
        counters.frames++; if (counters.frames > limits.frames) { reason = 'frame-count-limit'; break files; }
        if (lineNumber <= afterLine || !line.length) continue;
        let frame; try { frame = JSON.parse(line.toString('utf8')); } catch { counters.invalidFrames++; continue; }
        const row = cellRow(frame, selection); if (!row) continue; rows.push(row);
        if (rows.length >= selection.limit) { reason = 'page-limit'; nextCursor = cursorEncode({ v: 1, scope: selection.scope, files: cursorFiles, afterLine: lineNumber, expires: now + 300000 }, key); break files; }
      }
      if (offset < chunk.length) { const tail = chunk.subarray(offset); pending.push(tail); pendingSize += tail.length; }
      if (pendingSize > limits.lineBytes) { reason = 'frame-byte-limit'; break; }
      } } finally { input.destroy(); if (stream !== input) stream.destroy(); }
      if (reason) break;
      if (pendingSize) { reason = 'incomplete-final-frame'; break; }
    }
  } catch { throw problem('heat_cell_archive_unreadable', 502); }
  rows.sort((a, b) => a.time - b.time || (a.receivedAtMs ?? 0) - (b.receivedAtMs ?? 0));
  return { rows, nextCursor, selection: publicSelection, coverage: { kind: 'observations-only', scanComplete: reason === null, partial: true, scanPartial: reason !== null || counters.invalidFrames > 0, reason: reason ?? (counters.invalidFrames ? 'invalid-recorded-frames' : rows.length ? 'captured-observations' : 'no-matching-observations'), ...counters } };
}

export class HeatCellArchiveReader {
  constructor({ dir, key, now = Date.now } = {}) { this.dir = dir; this.key = key; this.now = now; this.active = false; }
  async read(input, { signal } = {}) {
    const selection = validateHeatCellArchiveQuery(input, this.now());
    ensure(this.dir && this.key, 'heat_cell_archive_unconfigured', 503); ensure(!signal?.aborted, 'heat_cell_cancelled', 499); ensure(!this.active, 'heat_cell_archive_busy', 503); this.active = true;
    try { return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: { heatCellScan: true, options: { dir: this.dir, key: this.key, selection, now: this.now() } }, resourceLimits: { maxOldGenerationSizeMb: 160 } });
      let stopping = null;
      const stop = code => { stopping = code; void worker.terminate(); };
      const cancel = () => stop('heat_cell_cancelled');
      const timeout = setTimeout(() => stop('heat_cell_scan_deadline'), 3500);
      const clean = () => { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); };
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel();
      worker.once('message', value => { clean(); if (stopping) return; if (value.error) reject(problem(value.error.code, value.error.status)); else resolve(value.result); });
      worker.once('error', () => { clean(); reject(problem('heat_cell_archive_unreadable', 502)); });
      worker.once('exit', code => { clean(); if (stopping) reject(problem(stopping, stopping === 'heat_cell_cancelled' ? 499 : 503)); else if (code !== 0) reject(problem('heat_cell_archive_unreadable', 502)); });
    }); } finally { this.active = false; }
  }
}
/** Called only after the gateway's existing authorization boundary. */
export async function heatCellArchiveRequest(request, url, reader, signal) {
  if (request.method !== 'POST') return { status: 405, body: { code: 'method_not_allowed', error: 'Method not allowed.' } };
  if (url.search) return { status: 400, body: { code: 'heat_cell_invalid_request', error: 'Unsupported parameter.' } };
  try {
    ensure(/^application\/json(?:;|$)/i.test(request.headers['content-type'] || ''), 'heat_cell_invalid_content_type', 415);
    const chunks = []; let bytes = 0;
    for await (const chunk of request) { bytes += chunk.length; ensure(bytes <= 65536, 'heat_cell_request_too_large', 413); chunks.push(chunk); }
    let input; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw problem('heat_cell_invalid_request'); }
    return { status: 200, body: await reader.read(input, { signal }) };
  } catch (error) { return { status: error.status || 502, body: { code: error.code || 'heat_cell_archive_unreadable', error: 'Recorded cell history is unavailable for this request.' } }; }
}
if (!isMainThread && workerData?.heatCellScan) scanHeatCellArchive(workerData.options).then(result => parentPort.postMessage({ result }), error => parentPort.postMessage({ error: { code: error.code || 'heat_cell_archive_unreadable', status: error.status || 502 } }));
