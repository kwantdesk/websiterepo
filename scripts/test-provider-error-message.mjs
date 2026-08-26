import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { providerErrorMessage } from "../src/lib/providerErrorMessage.ts";

/**
 * A provider's billing state must never reach the chart.
 *
 * Routes were forwarding the provider's own message to the browser, renaming
 * the vendor and nothing else, so a trading surface displayed:
 *
 *   STRUCTURE · CME REQUEST FAILED (402): {"DETAIL":{"CASE":"ACCOUNT_INSUFFICIENT_FUNDS", ...
 *
 * A billing state and a raw JSON body, on screen, during a session - useless to
 * the trader and carried out of the room by any screenshot or screen-share.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const FUNDS = new Error(
  'Databento request failed (402): {"detail":{"case":"account_insufficient_funds",'
  + '"message":"Your account balance is insufficient."}}',
);

check("the billing state never survives", () => {
  const message = providerErrorMessage(FUNDS, "CME history");
  assert.equal(message, "CME history is unavailable right now.");
  for (const leak of ["402", "insufficient", "account", "detail", "{", "Databento"]) {
    assert.ok(!message.toLowerCase().includes(leak.toLowerCase()), `leaked "${leak}"`);
  }
});

check("credential and quota states collapse to the same line", () => {
  // Distinguishing them on screen would leak the thing this exists to hide, so
  // they must be indistinguishable to the reader.
  const cases = [
    "auth_required", "authentication_failed", "permission_denied",
    "forbidden", "unauthorized", "invalid_api_key", "quota exceeded", "rate_limit hit",
  ];
  const messages = new Set(cases.map((token) => providerErrorMessage(new Error(`failed: ${token}`), "History")));
  assert.deepEqual([...messages], ["History is unavailable right now."]);
});

check("a named availability window IS passed on", () => {
  // The one detail worth keeping: it says WHICH bars exist, which is
  // actionable, and names no account state.
  const licence = new Error(
    'Databento request failed (422): {"detail":{"case":"dataset_unavailable_range",'
    + '"message":"Try again with an end time before 2026-08-25T20:50:07Z."}}',
  );
  assert.equal(providerErrorMessage(licence, "CME history"), "CME history is only available up to 2026-08-25.");
  // "end date of at most" is the provider's other phrasing.
  const other = new Error("Try again with an end date of at most 2026-08-19.");
  assert.equal(providerErrorMessage(other, "CME history"), "CME history is only available up to 2026-08-19.");
});

check("a window named alongside a billing failure is still suppressed", () => {
  // Otherwise a 402 that happens to mention a date would leak through the one
  // branch that passes text on.
  const mixed = new Error(
    'Databento request failed (402): {"case":"account_insufficient_funds",'
    + '"message":"Try again with an end time before 2026-08-25T20:50:07Z."}',
  );
  assert.equal(providerErrorMessage(mixed, "CME history"), "CME history is unavailable right now.");
});

check("configuration and timeouts read as themselves", () => {
  assert.equal(providerErrorMessage(new Error("CME market data is not configured."), "CME history"),
    "CME history is not configured.");
  assert.equal(providerErrorMessage(new Error("The operation was aborted"), "CME history"),
    "CME history timed out. Try again in a moment.");
});

check("anything unrecognised is still safe", () => {
  for (const input of [null, undefined, "", new Error(""), { toString: () => "weird" }, 42]) {
    const message = providerErrorMessage(input, "History");
    assert.equal(message, "History is unavailable right now.");
  }
});

check("the routes use it, and still log the real words", () => {
  // The full text has to survive somewhere or an outage is undiagnosable from
  // outside the box.
  for (const route of [
    "../src/app/api/databento/market/route.ts",
    "../src/app/api/databento/options/route.ts",
    "../src/app/api/databento/tpo-levels/route.ts",
  ]) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    assert.match(source, /providerErrorMessage\(error, "/, `${route} must sanitise`);
    assert.match(source, /logProviderError\("/, `${route} must still log`);
    assert.doesNotMatch(source, /error\.message\.replaceAll\("Databento", "CME"\)/,
      `${route} must not forward the provider's words`);
  }
  // The auth branch keeps its 401 so a client can tell a session problem from
  // an outage, but not its own text.
  const tpo = readFileSync(new URL("../src/app/api/databento/tpo-levels/route.ts", import.meta.url), "utf8");
  assert.match(tpo, /status: authFailure \? 401 : 502/);
  assert.doesNotMatch(tpo, /authFailure \? error\.message/);
});

console.log(`\nprovider error message: ${passed}/${passed} checks passed`);
