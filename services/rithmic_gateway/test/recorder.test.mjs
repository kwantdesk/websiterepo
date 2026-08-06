import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { MarketDataRecorder } from "../src/recorder.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

function newRecorder() {
  const dir = mkdtempSync(join(tmpdir(), "kwantify-rec-"));
  return { dir, recorder: new MarketDataRecorder({ dir, enabled: true }) };
}

function readSession(dir, timestampMs, file) {
  return readFileSync(join(dir, chicagoTradingDate(timestampMs), file), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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
  await delay(40);

  const rows = readSession(dir, receivedAt, "CME-NQU6.ndjson");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price, 29581.25, "raw fields are preserved, not reduced to bars");
  assert.equal(rows[1].type, "bbo");
  await recorder.close();
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
  await delay(40);

  const rows = readSession(dir, receivedAt, "CME-NQU6.ndjson");
  const gap = rows.find((row) => row.type === "GAP");
  assert.ok(gap, "the discontinuity must be recorded");
  assert.equal(gap.reason, "socket closed");
  assert.match(gap.note, /not observed/);
  await recorder.close();
});

test("separate instruments get separate files", async () => {
  const { dir, recorder } = newRecorder();
  const client = new EventEmitter();
  recorder.attach(client);
  const receivedAt = Date.parse("2026-08-07T14:00:00Z");

  for (const symbol of ["NQU6", "ESU6", "MNQU6", "MESU6"]) {
    client.emit("marketData", { exchange: "CME", symbol, type: "trade", receivedAt });
  }
  await delay(40);

  const day = chicagoTradingDate(receivedAt);
  for (const symbol of ["NQU6", "ESU6", "MNQU6", "MESU6"]) {
    assert.ok(existsSync(join(dir, day, `CME-${symbol}.ndjson`)), `${symbol} file exists`);
  }
  assert.equal(recorder.status().recorded["CME:NQU6"], 1);
  await recorder.close();
});

test("close writes a manifest so completeness is checkable", async () => {
  const { dir, recorder } = newRecorder();
  const client = new EventEmitter();
  recorder.attach(client);
  const receivedAt = Date.parse("2026-08-07T14:00:00Z");
  client.emit("marketData", { exchange: "CME", symbol: "NQU6", type: "trade", receivedAt });
  await delay(40);
  await recorder.close();

  const manifest = JSON.parse(
    readFileSync(join(dir, chicagoTradingDate(receivedAt), "manifest.json"), "utf8"),
  );
  assert.equal(manifest.recorded["CME:NQU6"], 1);
  assert.equal(manifest.provider, "Rithmic");
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
