import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readdir, writeFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createEodStore } from '../src/gexbot-eod-store.mjs';
import { eodEntryName, eodCrc32 } from '../src/gexbot-eod-session.mjs';

const day = '2026-10-21', at = Date.parse('2026-10-22T00:00:00Z');
const row = { ticker: 'QQQ', timestamp: Date.parse('2026-10-21T19:59:59Z') / 1000, agg_dex: 1234, cvroflow: 0, one_agg_dex: null };
function zip(rows = [row]) {
  const name = Buffer.from(eodEntryName({ ticker: 'QQQ', package: 'orderflow', category: 'orderflow', date: day })), data = gzipSync(JSON.stringify(rows)), crc = eodCrc32(data), local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}
function response(bytes = zip(), date = day, extra = {}) { return new Response(bytes, { headers: { 'content-disposition': `attachment; filename="eod_report_QQQ_${date}.zip"`, 'content-length': String(bytes.length), ...extra } }); }
async function temporary(action) { const dir = await mkdtemp(join(tmpdir(), 'kwantdesk-eod-store-')); try { return await action(dir); } finally { await rm(dir, { recursive: true, force: true }); } }

test('downloads fixed origin once with bounded authenticated settings and reads persisted exact session', () => temporary(async dir => {
  let calls = 0;
  const store = createEodStore({ dir, key: 'test-private-key', now: () => at, fetchImpl: async (url, options) => {
    calls++; assert.equal(url, 'https://api.gex.bot/v2/hist/eod/QQQ'); assert.equal(options.redirect, 'manual'); assert.equal(options.headers.Authorization, 'Bearer test-private-key'); assert.equal(options.headers.Accept, 'application/zip'); assert.ok(options.signal); return response();
  } });
  const result = await store.read('QQQ', day); assert.deepEqual(result.data, [row]); assert.equal(result.sessionDate, day); assert.equal(result.providerAsOf, '2026-10-21T19:59:59.000Z'); assert.equal(result.coverage, 'provider-session');
  assert.deepEqual((await store.read('QQQ', day)).data, [row]); assert.equal(calls, 1); assert.deepEqual(await readdir(dir), [`eod_report_QQQ_${day}.zip`]);
}));
test('existing exact cache works without credentials or provider requests', () => temporary(async dir => {
  await writeFile(join(dir, `eod_report_QQQ_${day}.zip`), zip());
  const store = createEodStore({ dir, now: () => at, fetchImpl: () => assert.fail('network must not be used') }); assert.deepEqual((await store.read('QQQ', day)).data, [row]);
}));
test('never relabels another date and removes only its partial file', () => temporary(async dir => {
  const store = createEodStore({ dir, key: 'test', now: () => at, fetchImpl: async () => response(zip(), '2026-10-20') });
  await assert.rejects(store.read('QQQ', day), { code: 'EOD_SESSION_DATE_MISMATCH' }); assert.deepEqual(await readdir(dir), []);
}));
test('invalid/future/too-old/current-before-close selection never fetches', () => temporary(async dir => {
  const store = createEodStore({ dir, key: 'test', now: () => at, fetchImpl: () => assert.fail('network must not be used') });
  for (const [ticker, date] of [['../QQQ', day], ['QQQ', '2026-10-22'], ['QQQ', '2026-01-01'], ['QQQ', '2026-02-30']]) await assert.rejects(store.read(ticker, date));
  const early = createEodStore({ dir, key: 'test', now: () => Date.parse('2026-10-21T20:00:00Z'), fetchImpl: () => assert.fail('network must not be used') }); await assert.rejects(early.read('QQQ', day), { code: 'EOD_SESSION_NOT_CLOSED' });
}));
test('coalesces one global download and rejects competing ticker without starting another', () => temporary(async dir => {
  let release, started, count = 0; const fetched = new Promise(resolve => { started = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const store = createEodStore({ dir, key: 'test', now: () => at, fetchImpl: async () => { count++; started(); await hold; return response(); } });
  const first = store.read('QQQ', day), second = store.read('QQQ', day); await fetched;
  await assert.rejects(store.read('SPY', day), { code: 'EOD_DOWNLOAD_BUSY' }); release(); assert.deepEqual(await first, await second); assert.equal(count, 1);
}));
test('failed downloads are held at least one hour per ticker without timer retries', () => temporary(async dir => {
  let clock = at, calls = 0; const store = createEodStore({ dir, key: 'test', now: () => clock, fetchImpl: async () => { calls++; return new Response('no', { status: 403 }); } });
  await assert.rejects(store.read('QQQ', day), { code: 'EOD_UPSTREAM_FORBIDDEN', status: 403 }); clock += 45 * 60000;
  await assert.rejects(store.read('QQQ', day), { code: 'EOD_UPSTREAM_FORBIDDEN', status: 403 }); assert.equal(calls, 1); clock += 16 * 60000;
  await assert.rejects(store.read('QQQ', day), { code: 'EOD_UPSTREAM_FORBIDDEN', status: 403 }); assert.equal(calls, 2);
}));
test('rejects declared download overflow before cache publication', () => temporary(async dir => {
  const store = createEodStore({ dir, key: 'test', now: () => at, fetchImpl: async () => response(zip(), day, { 'content-length': String(129 * 1024 * 1024) }) });
  await assert.rejects(store.read('QQQ', day), { code: 'EOD_ZIP_SIZE_LIMIT' }); assert.deepEqual(await readdir(dir), []);
}));
test('streamed bytes cannot exceed remaining directory budget and partial output is removed', () => temporary(async dir => {
  const file = await open(join(dir, 'preserved.zip'), 'wx'); await file.truncate(1024 * 1024 * 1024 - 1024); await file.close();
  const store = createEodStore({ dir, key: 'test', now: () => at, fetchImpl: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2048)); controller.close(); } }), { headers: { 'content-disposition': `attachment; filename="eod_report_QQQ_${day}.zip"` } }) });
  await assert.rejects(store.read('QQQ', day), { code: 'EOD_ZIP_SIZE_LIMIT' }); assert.deepEqual(await readdir(dir), ['preserved.zip']);
}));
test('refuses a full dedicated cache without deleting stored files or fetching', () => temporary(async dir => {
  const old = join(dir, 'preserved.zip'), file = await open(old, 'wx'); await file.truncate(1024 * 1024 * 1024); await file.close();
  const store = createEodStore({ dir, key: 'test', now: () => at, fetchImpl: () => assert.fail('network must not be used') }); await assert.rejects(store.read('QQQ', day), { code: 'EOD_STORAGE_LIMIT' }); assert.deepEqual(await readdir(dir), ['preserved.zip']);
}));
test('corrupt JSON/ZIP and over-30000 row output never become durable cache', () => temporary(async dir => {
  for (const [bytes, code] of [[Buffer.alloc(30), 'EOD_INVALID_ZIP'], [zip(Array.from({ length: 30001 }, () => row)), 'EOD_SESSION_OUTPUT_LIMIT']]) {
    const store = createEodStore({ dir, key: 'test', now: () => at, fetchImpl: async () => response(bytes) }); await assert.rejects(store.read('QQQ', day), { code }); assert.deepEqual(await readdir(dir), []);
  }
}));
test('rejects redirect responses and ambiguous or path-bearing filenames', () => temporary(async dir => {
  for (const factory of [() => new Response(null, { status: 302, headers: { location: 'https://other.invalid' } }), () => response(zip(), day, { 'content-disposition': 'attachment; filename="../eod_report_QQQ_2026-10-21.zip"' }), () => response(zip(), day, { 'content-disposition': 'attachment; filename="eod_report_QQQ_2026-10-21.zip"; filename="other.zip"' })]) {
    const store = createEodStore({ dir, key: 'test', now: () => at, fetchImpl: async () => factory() }); await assert.rejects(store.read('QQQ', day)); assert.deepEqual(await readdir(dir), []);
  }
}));
