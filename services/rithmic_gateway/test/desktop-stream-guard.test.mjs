import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopStreamGuard } from "../src/desktop-stream-guard.mjs";

function scheduler() {
  const timeouts = [];
  const intervals = [];
  const clearedTimeouts = new Set();
  const clearedIntervals = new Set();
  return {
    timeouts,
    intervals,
    clearedTimeouts,
    clearedIntervals,
    setTimeoutImpl(callback, delay) {
      const handle = { callback, delay, unref() {} };
      timeouts.push(handle);
      return handle;
    },
    clearTimeoutImpl(handle) { clearedTimeouts.add(handle); },
    setIntervalImpl(callback, delay) {
      const handle = { callback, delay, unref() {} };
      intervals.push(handle);
      return handle;
    },
    clearIntervalImpl(handle) { clearedIntervals.add(handle); },
  };
}

function response() {
  return {
    writableEnded: false,
    destroyed: false,
    writes: [],
    write(value) { this.writes.push(value); },
    end() { this.writableEnded = true; },
  };
}

function desktopAuthorization(expiresAt = 1_800) {
  return {
    mode: "desktop-ticket",
    principal: { expiresAt, jti: "ticket-id", sid: "session-id" },
  };
}

test("static gateway streams receive no desktop lifecycle timers", () => {
  const clock = scheduler();
  const guard = createDesktopStreamGuard({
    authorization: { mode: "gateway-static" },
    response: response(),
    revocationCache: null,
    ...clock,
  });
  assert.equal(guard.active, false);
  assert.equal(clock.timeouts.length, 0);
  assert.equal(clock.intervals.length, 0);
});

test("a desktop stream closes at the ticket's exact expiry and disposes both timers", () => {
  const clock = scheduler();
  const output = response();
  const guard = createDesktopStreamGuard({
    authorization: desktopAuthorization(),
    response: output,
    revocationCache: { async isRevoked() { return false; } },
    now: () => 1_500_000,
    ...clock,
  });

  assert.equal(clock.timeouts[0].delay, 300_000);
  assert.equal(clock.intervals[0].delay, 5_000);
  clock.timeouts[0].callback();
  assert.equal(guard.active, false);
  assert.equal(output.writableEnded, true);
  assert.match(output.writes[0], /"reason":"ticket-expired"/);
  assert.equal(clock.clearedTimeouts.has(clock.timeouts[0]), true);
  assert.equal(clock.clearedIntervals.has(clock.intervals[0]), true);
});

test("revocation and revocation-state failure both cut off an active desktop stream", async () => {
  for (const [revocationCache, reason] of [
    [{ async isRevoked() { return true; } }, "ticket-revoked"],
    [{ async isRevoked() { throw new Error("offline"); } }, "revocation-unavailable"],
  ]) {
    const clock = scheduler();
    const output = response();
    const guard = createDesktopStreamGuard({
      authorization: desktopAuthorization(),
      response: output,
      revocationCache,
      now: () => 1_500_000,
      ...clock,
    });

    await clock.intervals[0].callback();
    assert.equal(guard.active, false);
    assert.equal(output.writableEnded, true);
    assert.match(output.writes[0], new RegExp(`"reason":"${reason}"`));
  }
});

test("missing revocation state fails closed and explicit disposal is idempotent", () => {
  const clock = scheduler();
  const output = response();
  const guard = createDesktopStreamGuard({
    authorization: desktopAuthorization(),
    response: output,
    revocationCache: null,
    now: () => 1_500_000,
    ...clock,
  });
  guard.dispose();
  guard.dispose();
  assert.equal(guard.active, false);
  assert.equal(output.writableEnded, true);
  assert.match(output.writes[0], /"reason":"revocation-unavailable"/);
});
