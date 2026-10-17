import assert from "node:assert/strict";
import { createServer, get } from "node:http";
import { once } from "node:events";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { sendBufferedResponse } from "../src/buffered-response.mjs";
import { quantDataResponseCacheMs } from "../src/vendor-data-edge.mjs";

test("large history is compressed once per shared buffer and decodes without changing candles", async () => {
  const body = Buffer.from(JSON.stringify(Array.from({ length: 6900 }, (_, i) => ({ timestamp: i * 60000, open: 100, high: 102, low: 98, close: 101, volume: 100 }))));
  const entry = { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "private" }, body };
  const server = createServer((req, res) => void sendBufferedResponse(req, res, entry));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const request = (encoding) => new Promise((resolve, reject) => {
    get(`http://127.0.0.1:${server.address().port}`, { headers: { "Accept-Encoding": encoding } }, (res) => {
      const parts = [];
      res.on("data", part => parts.push(part));
      res.on("end", () => resolve({ headers: res.headers, body: Buffer.concat(parts) }));
    }).on("error", reject);
  });
  try {
    const compressed = await Promise.all(Array.from({ length: 6 }, () => request("gzip, br")));
    for (const result of compressed) {
      assert.equal(result.headers["content-encoding"], "gzip");
      assert.equal(result.headers["cache-control"], "private");
      assert.match(result.headers.vary, /Accept-Encoding/);
      assert.deepEqual(gunzipSync(result.body), body);
      assert.ok(result.body.length < body.length / 5);
      assert.deepEqual(result.body, compressed[0].body);
    }
    for (const encoding of ["identity", "gzip;q=0", "gzip;q=0.0, identity"]) {
      const result = await request(encoding);
      assert.equal(result.headers["content-encoding"], undefined);
      assert.deepEqual(result.body, body);
    }
    const tiny = { ...entry, body: Buffer.from("{}") };
    let ended;
    await sendBufferedResponse({ headers: { "accept-encoding": "gzip" } }, {
      writeHead: (_, headers) => assert.equal(headers["Content-Encoding"], undefined),
      end: (bytes) => { ended = bytes; },
    }, tiny);
    assert.deepEqual(ended, tiny.body);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("only completed New York session responses receive a longer archive cache", () => {
  const now = Date.parse("2026-10-17T02:00:00Z"); // Still Friday in New York.
  const cache = sessionDate => quantDataResponseCacheMs(Buffer.from(JSON.stringify({ sessionDate })), 10000, now);
  assert.equal(cache("2026-10-15"), 300000);
  assert.equal(cache("2026-10-16"), 10000);
  assert.equal(cache("2026-10-17"), 10000);
  assert.equal(cache(undefined), 10000);
  assert.equal(cache("invalid"), 10000);
  assert.equal(quantDataResponseCacheMs(Buffer.from("invalid"), 10000, now), 10000);
});
