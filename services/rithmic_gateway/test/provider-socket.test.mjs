import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { openProviderSocket } from "../src/provider-socket.mjs";

function factory(codes, seen) {
  return (url, options) => {
    assert.equal(options.rejectUnauthorized, true);
    assert.ok(options.handshakeTimeout <= 3000);
    options.lookup("test", {}, (_, address) => seen.push({ url, address }));
    const socket = new EventEmitter();
    socket.terminate = () => { socket.terminated = true; };
    const code = codes.shift();
    queueMicrotask(() => code ? socket.emit("error", Object.assign(new Error(code), { code })) : socket.emit("open"));
    return socket;
  };
}
const resolveAddresses = async () => [1, 2, 3].map(n => ({ address: `192.0.2.${n}`, family: 4 }));

test("transport reset tries another DNS address, preserving configured TLS hostname", async () => {
  const seen = [];
  await openProviderSocket("wss://failover.example", 1000, { resolveAddresses, createSocket: factory(["ECONNRESET", null], seen) });
  assert.deepEqual(seen.map(row => row.address), ["192.0.2.1", "192.0.2.2"]);
  assert.ok(seen.every(row => row.url === "wss://failover.example"));
  const again = [];
  await openProviderSocket("wss://failover.example", 1000, { resolveAddresses, createSocket: factory([null], again) });
  assert.equal(again[0].address, "192.0.2.2");
});

test("certificate failures are never bypassed or retried", async () => {
  const seen = [];
  await assert.rejects(openProviderSocket("wss://cert.example", 1000, { resolveAddresses,
    createSocket: factory(["CERT_HAS_EXPIRED"], seen) }), /CERT_HAS_EXPIRED/);
  assert.equal(seen.length, 1);
});

test("address attempts remain bounded and exhausted failures reject", async () => {
  const seen = [];
  await assert.rejects(openProviderSocket("wss://bounded.example", 1000, {
    resolveAddresses: async () => Array.from({ length: 50 }, (_, n) => ({ address: `192.0.2.${n}`, family: 4 })),
    createSocket: factory(Array(50).fill("ECONNRESET"), seen),
  }), /ECONNRESET/);
  assert.equal(seen.length, 8);
});
