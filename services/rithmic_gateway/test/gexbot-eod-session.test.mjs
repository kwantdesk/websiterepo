import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, deflateRawSync } from 'node:zlib';
import { extractEodSession, eodEntryName, eodCrc32, EOD_LIMITS } from '../src/gexbot-eod-session.mjs';

const selection = { ticker: 'QQQ', package: 'orderflow', category: 'orderflow', date: '2026-10-21' };
// Synthetic values use the verified EOD row schema; no production data is bundled.
const sample = [{ ticker: 'QQQ', timestamp: Date.parse('2026-10-21T13:30:00Z') / 1000, spot: 712.5, agg_dex: 125.5, one_agg_dex: -20, cvroflow: 45, zcharm: -32 }, { ticker: 'QQQ', timestamp: Date.parse('2026-10-21T19:59:59Z') / 1000, spot: 713, agg_dex: null, one_agg_dex: -10, cvroflow: 0, zcharm: 0 }];
function fixture(entries) {
  const chunks = [], central = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name || eodEntryName(selection)), data = entry.bytes || gzipSync(JSON.stringify(entry.rows || sample)), method = entry.method || 0, payload = method === 8 ? deflateRawSync(data) : data, flags = entry.flags || 0;
    const crc = entry.badCrc ? 0 : eodCrc32(data), local = Buffer.alloc(30), directory = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(flags, 8); directory.writeUInt16LE(method, 10); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(payload.length, 20); directory.writeUInt32LE(entry.declaredSize ?? data.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
    chunks.push(local, name, payload); central.push(directory, name); offset += local.length + name.length + payload.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}
async function withZip(bytes, action) { const dir = await mkdtemp(join(tmpdir(), 'kwantdesk-eod-test-')); try { const path = join(dir, 'session.zip'); await writeFile(path, bytes); return await action(path); } finally { await rm(dir, { recursive: true, force: true }); } }
const rejects = (bytes, code, selected = selection) => withZip(bytes, path => assert.rejects(extractEodSession(path, selected), { code }));

test('known CRC32 vector', () => assert.equal(eodCrc32(Buffer.from('123456789')), 0xcbf43926));
for (const method of [0, 8]) test(`reads exact nested gzip member with ZIP method ${method}, preserving actual fields`, () => withZip(fixture([{ name: 'QQQ/other.json.gz', bytes: Buffer.from('unrelated garbage') }, { method }]), async path => {
  const result = await extractEodSession(path, selection); assert.deepEqual(result.rows, sample); assert.equal(result.entryName, eodEntryName(selection)); assert.equal(result.source, 'provider-eod-archive');
}));
test('supports data-descriptor flag with central directory sizes', () => withZip(fixture([{ flags: 8 }]), async path => assert.deepEqual((await extractEodSession(path, selection)).rows, sample)));
test('missing exact session fails rather than using another date', () => rejects(fixture([{ name: 'QQQ/orderflow/orderflow/2026-10-20_QQQ_orderflow_orderflow.json.gz' }]), 'EOD_SESSION_NOT_FOUND'));
test('rejects duplicate paths even if one is unrelated', () => rejects(fixture([{}, {}]), 'EOD_DUPLICATE_ENTRY'));
test('rejects traversal', () => rejects(fixture([{ name: '../QQQ/session.gz' }]), 'EOD_UNSAFE_ENTRY'));
test('rejects encryption flags', () => rejects(fixture([{ flags: 1 }]), 'EOD_UNSUPPORTED_FLAGS'));
test('rejects unsupported compression', () => rejects(fixture([{ method: 12 }]), 'EOD_UNSUPPORTED_COMPRESSION'));
test('rejects corrupt CRC', () => rejects(fixture([{ badCrc: true }]), 'EOD_CRC_MISMATCH'));
test('rejects unbounded declared member output before inflate', () => rejects(fixture([{ declaredSize: EOD_LIMITS.entryBytes + 1 }]), 'EOD_ENTRY_SIZE_LIMIT'));
test('rejects invalid inner gzip', () => rejects(fixture([{ bytes: Buffer.from('{}') }]), 'EOD_INVALID_GZIP'));
test('bounds inner gzip expansion independently of ZIP compressed sizes', () => rejects(fixture([{ bytes: gzipSync(Buffer.alloc(EOD_LIMITS.jsonBytes + 1, 32)) }]), 'EOD_INVALID_GZIP'));
test('rejects invalid JSON', () => rejects(fixture([{ bytes: gzipSync('{') }]), 'EOD_INVALID_JSON'));
test('rejects wrong ticker', () => rejects(fixture([{ rows: [{ ...sample[0], ticker: 'SPY' }] }]), 'EOD_INVALID_ROW'));
test('rejects wrong New York date', () => rejects(fixture([{ rows: [{ ...sample[0], timestamp: Date.parse('2026-10-22T13:30:00Z') / 1000 }] }]), 'EOD_INVALID_TIMESTAMP'));
test('rejects nonnumeric timestamp and backwards order', async () => {
  await rejects(fixture([{ rows: [{ ...sample[0], timestamp: 'bad' }] }]), 'EOD_INVALID_TIMESTAMP');
  await rejects(fixture([{ rows: [...sample].reverse() }]), 'EOD_INVALID_TIMESTAMP');
});
test('rejects malformed central directory and ZIP64 sentinel', async () => {
  const zip = fixture([{}]); zip.writeUInt32LE(0xffffffff, zip.length - 10); await rejects(zip, 'EOD_ZIP64_UNSUPPORTED');
  const truncated = fixture([{}]).subarray(0, 30); await rejects(truncated, 'EOD_INVALID_ZIP');
});
test('rejects mismatching local header filename', () => { const zip = fixture([{}]); zip[30] = 88; return rejects(zip, 'EOD_INVALID_ZIP'); });
test('validates safe exact selection and calendar date', async () => {
  for (const change of [{ ticker: '../QQQ' }, { package: '__proto__' }, { category: 'garbage' }, { date: '2026-02-30' }]) await rejects(fixture([{}]), 'EOD_INVALID_SELECTION', { ...selection, ...change });
});
