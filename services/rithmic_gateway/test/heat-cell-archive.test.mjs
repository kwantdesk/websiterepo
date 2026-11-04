import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { HeatCellArchiveReader, scanHeatCellArchive, validateHeatCellArchiveQuery, HEAT_CELL_ARCHIVE_LIMITS, heatCellArchiveRequest } from '../src/heat-cell-archive.mjs';

const now = Date.parse('2026-11-04T02:00:00Z'), day = '2026-11-03', expiry = '2026-11-06', key = 'test-cursor-signing-key';
const request = { sessionDate: day, dataMode: 'CALL_IMPLIED_VOLATILITY', filter: { ticker: 'QQQ', expirationDates: [expiry] } };
const query = { request, sessionDate: day, expirationDate: expiry, strikePrice: 712, throughMs: now };
const frame = (time, value, extra = {}) => ({ ts: Date.parse(time), path: '/v1/options/tool/heat-map', request, payload: { type: 'single', data: { [expiry]: { 712: { value } } } }, ...extra });
const first = frame('2026-11-03T15:00:00Z', 12.5), second = frame('2026-11-03T16:00:00Z', 14);
async function archive(dir, date, frames, compressed = true) { const folder = join(dir, 'exposure', date); await mkdir(folder, { recursive: true }); const bytes = frames.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join('\n') + '\n'; await writeFile(join(folder, `options-tool-heat-map.ndjson${compressed ? '.gz' : ''}`), compressed ? gzipSync(bytes) : bytes); }
async function temporary(action) { const dir = await mkdtemp(join(tmpdir(), 'kwantdesk-heat-history-')); try { await action(dir); } finally { await rm(dir, { recursive: true, force: true }); } }
const scan = (dir, input = query, limits) => scanHeatCellArchive({ dir, key, now, selection: validateHeatCellArchiveQuery(input, now), ...(limits ? { limits: { ...HEAT_CELL_ARCHIVE_LIMITS, ...limits } } : {}) });

test('opening-date archive and later same-NY-day folder produce exact metric observations, never accumulated', () => temporary(async dir => {
  await archive(dir, '2026-11-02', [first, second]); await archive(dir, day, [frame('2026-11-04T00:00:00Z', 16)]);
  const result = await scan(dir); assert.deepEqual(result.rows.map(row => row.value), [12.5, 14, 16]); assert.ok(result.rows.every(row => row.basis === 'observation' && row.sourceUnit === 'provider-native')); assert.equal(result.coverage.scanComplete, true); assert.equal(result.coverage.kind, 'observations-only'); assert.equal(result.coverage.partial, true); assert.equal(result.nextCursor, null);
}));
test('excludes stale historical-fetch receipt and future cutoff while preserving real pinned provider timestamps', () => temporary(async dir => {
  const pinned = { ...request, snapshotTime: '2026-11-03T15:30:00Z' }; delete pinned.sessionDate;
  await archive(dir, '2026-11-02', [first, second]); await archive(dir, day, [frame('2026-11-04T15:00:00Z', 999), frame('2026-11-04T15:00:00Z', 13, { request: pinned })]);
  const result = await scan(dir, { ...query, throughMs: Date.parse('2026-11-03T15:45:00Z') }); assert.deepEqual(result.rows.map(row => row.value), [12.5, 13]); assert.equal(result.rows[1].basis, 'snapshot'); assert.equal(result.rows[1].time, Date.parse(pinned.snapshotTime));
}));
test('exact mode, full filters, ticker, expiry and strike identity do not leak', () => temporary(async dir => {
  await archive(dir, '2026-11-02', [first, frame('2026-11-03T15:10:00Z', 999, { request: { ...request, filter: { ticker: 'SPY' } } }), frame('2026-11-03T15:11:00Z', 999, { request: { ...request, dataMode: 'PUT_IMPLIED_VOLATILITY' } }), frame('2026-11-03T15:12:00Z', 999, { request: { ...request, filter: { ...request.filter, strikePrices: [712] } } })]);
  assert.deepEqual((await scan(dir)).rows.map(row => row.value), [12.5]);
}));
test('missing or ambiguous cell data stays null and signed exposure legs are not converted to absolute values', () => temporary(async dir => {
  await archive(dir, '2026-11-02', [first, { ...second, payload: { type: 'single', data: {} } }, frame('2026-11-03T16:10:00Z', 0)]);
  assert.deepEqual((await scan(dir)).rows.map(row => row.value), [12.5, null, 0]);
  const exposureRequest = { ...request, dataMode: 'NET_GAMMA_EXPOSURE' }; await archive(dir, '2026-11-02', [{ ...first, request: exposureRequest, payload: { type: 'contract', data: { [expiry]: { 712: { callValue: 20, putValue: -25 } } } } }]);
  const result = await scan(dir, { ...query, request: exposureRequest }); assert.equal(result.rows[0].value, -5); assert.equal(result.rows[0].call, 20); assert.equal(result.rows[0].put, -25);
}));
test('HMAC cursor pages actual frames, binds scope, expires, and cannot be forged', () => temporary(async dir => {
  await archive(dir, '2026-11-02', [first, second]); const page = await scan(dir, { ...query, limit: 1 }); assert.equal(page.rows.length, 1); assert.equal(page.coverage.reason, 'page-limit'); assert.ok(page.nextCursor);
  const next = await scan(dir, { ...query, limit: 2, cursor: page.nextCursor }); assert.deepEqual(next.rows.map(row => row.value), [14]); assert.equal(next.nextCursor, null);
  await assert.rejects(scan(dir, { ...query, cursor: page.nextCursor + 'a' }), { code: 'heat_cell_invalid_cursor' });
  await assert.rejects(scan(dir, { ...query, strikePrice: 713, cursor: page.nextCursor }), { code: 'heat_cell_stale_cursor' });
  await assert.rejects(scanHeatCellArchive({ dir, key, now: now + 300001, selection: validateHeatCellArchiveQuery({ ...query, cursor: page.nextCursor }, now) }), { code: 'heat_cell_stale_cursor' });
}));
test('scan and frame byte/count limits return explicit partial receipt without unusable resume cursor', () => temporary(async dir => {
  await archive(dir, '2026-11-02', [first, second]);
  for (const [limits, expected] of [[{ scanBytes: 5 }, 'scan-byte-limit'], [{ lineBytes: 5 }, 'frame-byte-limit'], [{ frames: 1 }, 'frame-count-limit']]) { const result = await scan(dir, query, limits); assert.equal(result.coverage.reason, expected); assert.equal(result.coverage.scanComplete, false); assert.equal(result.nextCursor, null); }
}));
test('absent recordings, malformed recorded rows and damaged gzip remain distinguishable', () => temporary(async dir => {
  const absent = await scan(dir); assert.equal(absent.coverage.reason, 'not-recorded'); assert.equal(absent.selection.throughMs, query.throughMs); assert.equal(absent.selection.ticker, 'QQQ');
  await archive(dir, '2026-11-02', ['not-json', first]); const recovered = await scan(dir); assert.equal(recovered.coverage.invalidFrames, 1); assert.equal(recovered.coverage.reason, 'invalid-recorded-frames'); assert.equal(recovered.rows.length, 1);
  await writeFile(join(dir, 'exposure', '2026-11-02', 'options-tool-heat-map.ndjson.gz'), Buffer.from('broken gzip')); await assert.rejects(scan(dir), { code: 'heat_cell_archive_unreadable', status: 502 });
}));
test('invalid selectors, unknown fields and traversal never reach filesystem', async () => {
  for (const patch of [{ sessionDate: '../2026-11-03' }, { expirationDate: '2026-02-30' }, { strikePrice: NaN }, { limit: 257 }, { throughMs: now + 1 }, { path: '/etc/passwd' }, { request: { ...request, dataMode: 'PRIVATE_FAKE' } }]) assert.throws(() => validateHeatCellArchiveQuery({ ...query, ...patch }, now));
});
test('worker isolates scan and permits only one active archive read', () => temporary(async dir => {
  await archive(dir, '2026-11-02', [first]); const reader = new HeatCellArchiveReader({ dir, key, now: () => now }); const read = reader.read(query); await assert.rejects(reader.read(query), { code: 'heat_cell_archive_busy', status: 503 }); assert.equal((await read).rows[0].value, 12.5); assert.equal(reader.active, false);
}));
test('client cancellation terminates its worker and releases the one-reader budget', () => temporary(async dir => {
  await archive(dir, '2026-11-02', [first]); const reader = new HeatCellArchiveReader({ dir, key, now: () => now }), controller = new AbortController();
  const read = reader.read(query, { signal: controller.signal }); controller.abort(); await assert.rejects(read, { code: 'heat_cell_cancelled', status: 499 }); assert.equal(reader.active, false);
  assert.equal((await reader.read(query)).rows.length, 1);
}));
test('endpoint boundary accepts only exact POST JSON selection, rejects oversized/malformed bodies', async () => {
  const make = (body, method = 'POST', contentType = 'application/json') => Object.assign(Readable.from([Buffer.from(body)]), { method, headers: { 'content-type': contentType } });
  let calls = 0; const reader = { read: async value => { calls++; assert.deepEqual(value, query); return { rows: [] }; } }, url = new URL('http://localhost/v1/market-data/heat-map-history');
  assert.equal((await heatCellArchiveRequest(make(JSON.stringify(query)), url, reader)).status, 200);
  assert.equal((await heatCellArchiveRequest(make('{}', 'GET'), url, reader)).status, 405);
  assert.equal((await heatCellArchiveRequest(make('{}', 'POST', 'text/plain'), url, reader)).status, 415);
  assert.equal((await heatCellArchiveRequest(make('{'), url, reader)).status, 400);
  assert.equal((await heatCellArchiveRequest(make('x'.repeat(65537)), url, reader)).status, 413);
  assert.equal(calls, 1);
});
