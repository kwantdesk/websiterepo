import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkedJsonBody } from '../src/lib/chunkedJsonBody.ts';
import { conditionalJson } from '../src/lib/conditionalJson.ts';

test('large finite JSON survives bounded chunks including split Unicode sequences', async () => {
  const payload = { label: '🟦'.repeat(1_250_000), bars: [1, 2, 3] };
  const expected = JSON.stringify(payload);
  const reader = chunkedJsonBody(expected).getReader();
  const chunks = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    assert.ok(next.value.byteLength <= 64 * 1024);
    chunks.push(next.value);
  }
  assert.ok(chunks.length > 1);
  const bytes = Buffer.concat(chunks);
  assert.ok(bytes.length > 4_500_000);
  assert.equal(bytes.toString('utf8'), expected);
});

test('streamed history retains private caching and parses as ordinary JSON', async () => {
  const payload = { label: '🟦'.repeat(1_000_001) };
  const response = conditionalJson(new Request('https://example.test/history'), payload,
    { identity: 'same-history', maxAgeMs: 1000, streamLargePayload: true });
  assert.match(response.headers.get('cache-control'), /^private,/);
  assert.deepEqual(await response.json(), payload);
  const unchanged = conditionalJson(new Request('https://example.test/history', {
    headers: { 'If-None-Match': response.headers.get('etag') },
  }), { toJSON() { throw Error('Unchanged history must not be serialized'); } },
  { identity: 'same-history', streamLargePayload: true });
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body, null);
});
