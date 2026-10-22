import { mkdir, lstat, readdir, statfs, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { extractEodSession, eodEntryName, EOD_LIMITS } from './gexbot-eod-session.mjs';

const MiB = 1024 * 1024, MAX_DISK = 1024 * MiB, MIN_FREE = 512 * MiB, HOUR = 3600000;
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
function problem(code, status = 502, retryAfterSeconds = null) { return Object.assign(new Error(code), { code, status, retryAfterSeconds }); }
function requireThat(value, code, status) { if (!value) throw problem(code, status); }
function dateParts(epoch) { const p = Object.fromEntries(clock.formatToParts(epoch).map(x => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }; }
function validate(ticker, date, now) {
  try { eodEntryName({ ticker, date, package: 'orderflow', category: 'orderflow' }); } catch { throw problem('EOD_INVALID_SELECTION', 400); }
  const today = dateParts(now), requested = Date.parse(`${date}T00:00:00Z`), current = Date.parse(`${today.date}T00:00:00Z`);
  requireThat(requested <= current && current - requested <= 90 * 86400000 && (date !== today.date || today.hour >= 17), 'EOD_SESSION_NOT_CLOSED', 400);
}
async function diskBytes(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  requireThat(entries.length <= 8192, 'EOD_STORAGE_LIMIT', 507);
  let size = 0;
  for (const entry of entries) { requireThat(entry.isFile(), 'EOD_STORAGE_LAYOUT', 507); size += (await lstat(join(dir, entry.name))).size; }
  return size;
}
function filenameDate(header, ticker) {
  // Never accept a path, alternate ticker, ambiguous filename, or silently rename today's report.
  const matches = [...String(header || '').matchAll(/(?:^|;)\s*filename\s*=\s*(?:"([^"\r\n]+)"|([^;\s]+))/gi)];
  requireThat(matches.length === 1, 'EOD_INVALID_FILENAME');
  const name = matches[0][1] || matches[0][2], match = /^eod_report_([A-Z0-9_]+)_(\d{4}-\d{2}-\d{2})\.zip$/.exec(name);
  requireThat(match && match[1] === ticker, 'EOD_INVALID_FILENAME'); return match[2];
}

/** Request-driven cache only. No timers, retention deletion, retries or provider fallback. */
export function createEodStore({ dir, key, fetchImpl = fetch, now = Date.now } = {}) {
  requireThat(typeof dir === 'string' && dir.length > 0, 'EOD_STORAGE_REQUIRED', 503);
  const attempts = new Map(); let downloading = null;
  async function parse(path, ticker, date) {
    const result = await extractEodSession(path, { ticker, date, package: 'orderflow', category: 'orderflow' });
    requireThat(result.jsonBytes <= 16_000_000 && result.rows.length <= 30000, 'EOD_SESSION_OUTPUT_LIMIT');
    const last = result.rows.at(-1).timestamp, first = result.rows[0].timestamp;
    const epoch = value => value < 1e12 ? value * 1000 : value;
    const envelope = { data: result.rows, ticker, sessionDate: date, source: 'provider-eod-archive', coverage: 'provider-session', providerAsOf: new Date(epoch(last)).toISOString(), firstSourceTimestamp: first, lastSourceTimestamp: last };
    requireThat(Buffer.byteLength(JSON.stringify(envelope)) <= 16_000_000, 'EOD_SESSION_OUTPUT_LIMIT');
    return envelope;
  }
  async function existing(path, ticker, date) {
    try { const stat = await lstat(path); requireThat(stat.isFile() && !stat.isSymbolicLink(), 'EOD_INVALID_CACHE'); return await parse(path, ticker, date); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function download(path, ticker, date, archiveOnly = false) {
    requireThat(typeof key === 'string' && key.trim(), 'EOD_KEY_REQUIRED', 503);
    await mkdir(dir, { recursive: true, mode: 0o750 });
    const used = await diskBytes(dir), space = await statfs(dir);
    requireThat(used < MAX_DISK && Number(space.bavail) * Number(space.bsize) >= MIN_FREE, 'EOD_STORAGE_LIMIT', 507);
    const partial = join(dir, `${ticker}-${randomUUID()}.partial`); let file = null, response = null;
    try {
      response = await fetchImpl(`https://api.gex.bot/v2/hist/eod/${ticker}`, { headers: { Authorization: `Bearer ${key.trim()}`, 'User-Agent': 'KwantDesk', Accept: 'application/zip' }, redirect: 'manual', signal: AbortSignal.timeout(35000) });
      const upstreamCodes = { 401: 'EOD_UPSTREAM_UNAUTHORIZED', 403: 'EOD_UPSTREAM_FORBIDDEN', 404: 'EOD_UPSTREAM_NOT_FOUND', 429: 'EOD_UPSTREAM_RATE_LIMITED' };
      requireThat(response.ok, upstreamCodes[response.status] || 'EOD_UPSTREAM_FAILED', [401, 403, 404, 429].includes(response.status) ? response.status : 502);
      requireThat(filenameDate(response.headers.get('content-disposition'), ticker) === date, 'EOD_SESSION_DATE_MISMATCH', 404);
      const declared = Number(response.headers.get('content-length'));
      requireThat(!Number.isFinite(declared) || (declared <= EOD_LIMITS.zipBytes && used + declared <= MAX_DISK), 'EOD_ZIP_SIZE_LIMIT');
      requireThat(response.body, 'EOD_EMPTY_DOWNLOAD');
      file = await open(partial, 'wx', 0o600); let length = 0;
      for await (const chunk of response.body) {
        length += chunk.byteLength; requireThat(length <= EOD_LIMITS.zipBytes && used + length <= MAX_DISK, 'EOD_ZIP_SIZE_LIMIT');
        let offset = 0;
        while (offset < chunk.byteLength) { const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset); requireThat(bytesWritten > 0, 'EOD_WRITE_FAILED'); offset += bytesWritten; }
      }
      requireThat(length >= 22 && (!declared || declared === length), 'EOD_INCOMPLETE_DOWNLOAD');
      await file.sync(); await file.close(); file = null;
      const result = archiveOnly ? await extractEodSession(partial,{ticker,date,package:'orderflow',category:'orderflow'}) : await parse(partial, ticker, date);
      // A second owner must never be overwritten. In-process downloads are serialized.
      try { await lstat(path); throw problem('EOD_CACHE_ALREADY_EXISTS', 409); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await rename(partial, path); return result;
    } finally {
      await file?.close().catch(() => {});
      await response?.body?.cancel().catch(() => {});
      await unlink(partial).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  async function read(ticker, date, archiveOnly = false) {
    validate(ticker, date, now());
    const path = join(dir, `eod_report_${ticker}_${date}.zip`);
    if(archiveOnly){try{const info=await lstat(path);requireThat(info.isFile()&&!info.isSymbolicLink(),'EOD_INVALID_CACHE');return path;}catch(error){if(error.code!=='ENOENT')throw error;}}
    const hit = archiveOnly ? null : await existing(path, ticker, date); if (hit) return hit;
    if (downloading) {
      requireThat(downloading.ticker === ticker && downloading.date === date, 'EOD_DOWNLOAD_BUSY', 503);
      await downloading.promise;return archiveOnly?path:parse(path,ticker,date);
    }
    const prior = attempts.get(ticker), at = now();
    if (prior && at - prior.at < HOUR) throw problem(prior.code || 'EOD_DOWNLOAD_COOLDOWN', prior.status || 429, Math.ceil((HOUR - (at - prior.at)) / 1000));
    if (attempts.size >= 128) attempts.delete(attempts.keys().next().value);
    attempts.set(ticker, { at, code: 'EOD_DOWNLOAD_COOLDOWN', status: 429 });
    const promise = download(path, ticker, date, archiveOnly).catch(error => { attempts.set(ticker, { at, code: error.code || 'EOD_DOWNLOAD_FAILED', status: error.status || 502 }); throw error; }).finally(() => { downloading = null; });
    downloading = { ticker, date, promise }; return promise;
  }
  return { read,async archivePath(ticker,date){await read(ticker,date,true);return join(dir,`eod_report_${ticker}_${date}.zip`);} };
}
