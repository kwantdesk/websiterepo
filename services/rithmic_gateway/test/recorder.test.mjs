import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { gunzipSync } from "node:zlib";

import { MarketDataRecorder } from "../src/recorder.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

function newRecorder(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kwantify-rec-"));
  return { dir, recorder: new MarketDataRecorder({ dir, enabled: true, ...options }) };
}

// Writes are batched on a timer for throughput, so tests settle the recorder
// before reading. close() flushes, writes the manifest and closes the files.
async function settle(recorder) {
  await recorder.close();
  await delay(30);
}

// Files are gzip by default; appending yields a multi-member archive, which
// gunzipSync handles the same way gunzip/zcat do.
function readSession(dir, timestampMs, file) {
  const path = join(dir, chicagoTradingDate(timestampMs), `${file}.gz`);
  const text = gunzipSync(readFileSync(path)).toString("utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("captures the raw stream into a CME-session file", async () => {
  const { dir, recorder } = newRecorder();
  const client = new EventEmitter();
  recorder.attach(client);
  const receivedAt = Date.parse("2026-08-07T14:00:00Z");

  client.emit("marketData", {
    exchange: "CME", symbol: "NQU6", type: "trade", price: 29581.25, size: 3, receivedAt,
  });
  client.emit("marketData", {
    exchange: "CME", symbol: "NQU6", type: "bbo", bid: 29581, ask: 29581.5, receivedAt: receivedAt + 10,
  });
  await settle(recorder);

  const rows = readSession(dir, receivedAt, "CME-NQU6.ndjson");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price, 29581.25, "raw fields are preserved, not reduced to bars");
  assert.equal(rows[1].type, "bbo");
});

// This is the shape the collector actually emits: a combined instrument key
// and an ISO receivedAt. Getting either wrong files everything under
// UNKNOWN-UNKNOWN or the wrong trading date.
test("handles the real collector event shape: instrument key + ISO timestamp", async () => {
  const { dir, recorder } = newRecorder();
  const client = new EventEmitter();
  recorder.attach(client);
  const iso = "2026-08-07T14:00:00.000Z";

  client.emit("marketData", {
    type: "trade", instrument: "CME:NQU6", trade: { price: 29591.25, size: 2 }, receivedAt: iso,
  });
  client.emit("marketData", { type: "depth", instrument: "CME:ESU6", receivedAt: iso });
  await settle(recorder);

  const rows = readSession(dir, Date.parse(iso), "CME-NQU6.ndjson");
  assert.equal(rows.length, 1, "must not land in UNKNOWN-UNKNOWN");
  assert.equal(rows[0].trade.price, 29591.25);
  assert.ok(
    existsSync(join(dir, chicagoTradingDate(Date.parse(iso)), "CME-ESU6.ndjson.gz")),
    "the second instrument is split out by its own key",
  );
});

// The whole point of archiving: the file must contain the depth values, not
// merely a note that a depth update occurred.
test("archives the decoded payload, not just an event notification", async () => {
  const { dir, recorder } = newRecorder();
  const client = new EventEmitter();
  recorder.attach(client);
  const iso = "2026-08-07T14:00:00.000Z";

  client.emit("rawMessage", {
    templateId: 160,
    exchange: "CME",
    symbol: "NQU6",
    payload: {
      exchange: "CME", symbol: "NQU6",
      price: [29591.25, 29591.5], size: [4, 11],
      orderId: ["a1", "b2"], updateType: 2,
    },
    receivedAt: iso,
  });
  // The thin book-store event for the same tick must not duplicate it.
  client.emit("marketData", { type: "depth", instrument: "CME:NQU6", receivedAt: iso });
  await settle(recorder);

  const rows = readSession(dir, Date.parse(iso), "CME-NQU6.ndjson");
  assert.equal(rows.length, 1, "the thin event must not be written alongside the raw payload");
  assert.deepEqual(rows[0].payload.price, [29591.25, 29591.5], "depth prices are archived");
  assert.deepEqual(rows[0].payload.orderId, ["a1", "b2"], "order ids are archived");
  assert.equal(rows[0].templateId, 160);
});

test("a disconnect is written down as a GAP, never smoothed over", async () => {
  const { dir, recorder } = newRecorder();
  const client = new EventEmitter();
  recorder.attach(client);
  const receivedAt = Date.parse("2026-08-07T14:00:00Z");

  client.emit("marketData", { exchange: "CME", symbol: "NQU6", type: "trade", receivedAt });
  client.emit("status", { connected: true });
  client.emit("status", { connected: false, lastError: "socket closed" });
  client.emit("marketData", { exchange: "CME", symbol: "NQU6", type: "trade", receivedAt: receivedAt + 5_000 });
  await settle(recorder);

  const rows = readSession(dir, receivedAt, "CME-NQU6.ndjson");
  const gap = rows.find((row) => row.type === "GAP");
  assert.ok(gap, "the discontinuity must be recorded");
  assert.equal(gap.reason, "socket closed");
  assert.match(gap.note, /not observed/);
});

test("separate instruments get separate files", async () => {
  const { dir, recorder } = newRecorder();
  const client = new EventEmitter();
  recorder.attach(client);
  const receivedAt = Date.parse("2026-08-07T14:00:00Z");

  for (const symbol of ["NQU6", "ESU6", "MNQU6", "MESU6"]) {
    client.emit("marketData", { exchange: "CME", symbol, type: "trade", receivedAt });
  }
  const counted = recorder.status().recorded["CME:NQU6"];
  await settle(recorder);

  const day = chicagoTradingDate(receivedAt);
  for (const symbol of ["NQU6", "ESU6", "MNQU6", "MESU6"]) {
    assert.ok(existsSync(join(dir, day, `CME-${symbol}.ndjson.gz`)), `${symbol} file exists`);
  }
  assert.equal(counted, 1);
});

test("close writes a manifest so completeness is checkable", async () => {
  const { dir, recorder } = newRecorder();
  const client = new EventEmitter();
  recorder.attach(client);
  const receivedAt = Date.parse("2026-08-07T14:00:00Z");
  client.emit("marketData", { exchange: "CME", symbol: "NQU6", type: "trade", receivedAt });
  await settle(recorder);

  const manifest = JSON.parse(
    readFileSync(join(dir, chicagoTradingDate(receivedAt), "manifest.json"), "utf8"),
  );
  assert.equal(manifest.recorded["CME:NQU6"], 1);
  assert.equal(manifest.provider, "Rithmic");
  assert.deepEqual(manifest.dropped, {}, "a healthy run drops nothing");
});

// Backpressure: a saturated writer must lose data loudly and countably rather
// than buffering until the process dies. This is what killed the first run.
test("writer saturation is counted and marked, never silent", async () => {
  const { dir, recorder } = newRecorder({ maxPendingBytes: 1 });
  const client = new EventEmitter();
  recorder.attach(client);
  const iso = "2026-08-07T14:00:00.000Z";

  // Prime the stream so writableLength grows past the 1-byte cap.
  client.emit("rawMessage", { exchange: "CME", symbol: "NQU6", payload: { a: 1 }, receivedAt: iso });
  recorder.flush();
  for (let i = 0; i < 20; i += 1) {
    client.emit("rawMessage", { exchange: "CME", symbol: "NQU6", payload: { i }, receivedAt: iso });
  }
  const dropped = recorder.status().dropped["CME:NQU6"] ?? 0;
  await settle(recorder);

  assert.ok(dropped > 0, "drops must be counted");
  const manifest = JSON.parse(
    readFileSync(join(dir, chicagoTradingDate(Date.parse(iso)), "manifest.json"), "utf8"),
  );
  assert.ok(manifest.dropped["CME:NQU6"] > 0, "the manifest records the loss");
});

test("disabled recorder writes nothing and says so", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kwantify-rec-off-"));
  const recorder = new MarketDataRecorder({ dir, enabled: false });
  const client = new EventEmitter();
  recorder.attach(client);
  client.emit("marketData", {
    exchange: "CME", symbol: "NQU6", type: "trade", receivedAt: Date.now(),
  });
  await delay(20);
  assert.equal(recorder.status().enabled, false);
  assert.deepEqual(recorder.status().recorded, {});
});
