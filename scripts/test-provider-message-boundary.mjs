import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { providerErrorMessage } from "../src/lib/providerErrorMessage.ts";

/**
 * The vendor's words stop at the server.
 *
 * The 0DTE gamma surface displayed the provider's own rate-limit wording,
 * because every options route funnels its catch through getQuantDataHttpError
 * and that helper returned the provider's `detail` verbatim. Measured against
 * the live provider on 2026-08-27: the allowance is roughly twenty requests per
 * short window and a cold multi-panel load drains it to zero, so this is a
 * message a trader will actually meet.
 *
 * What is wrong with it is not that it is ugly. It tells the trader nothing
 * they can act on, and it carries the desk's account standing onto a surface
 * that gets screenshotted and screen-shared.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const server = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");

check("the provider's own words never reach the browser", () => {
  for (const raw of [
    "You have exceeded your usage limits for this plan.",
    "rate_limit exceeded, retry after 60s",
    '{"detail":{"case":"account_insufficient_funds","message":"insufficient budget"}}',
    "Your subscription does not include this dataset.",
  ]) {
    const shown = providerErrorMessage(new Error(raw), "Options data");
    assert.equal(shown, "Options data is unavailable right now.");
    // Nothing recognisable from the original survives.
    for (const token of ["usage limit", "rate_limit", "insufficient", "subscription", "plan"]) {
      assert.ok(!shown.toLowerCase().includes(token), `"${token}" leaked`);
    }
  }
});

check("it is fixed at the one helper every options route shares", () => {
  // Twenty-four routes forward this. Sanitising them one by one would leave the
  // twenty-fifth to leak, so the boundary is the helper itself.
  assert.match(server, /export function getQuantDataHttpError\(error: unknown, subject = "Options data"\)/);
  assert.match(server, /message: providerErrorMessage\(error, subject\),/);
  // And the real text has to survive where it is useful, or an outage becomes
  // undiagnosable from the outside.
  assert.match(server, /logProviderError\(`quantdata:\$\{error\.status\}`, error\);/);
});

check("our own messages are passed through, not flattened", () => {
  /*
   * "The dealer book for SPX on 2026-08-21 holds no position at any listed
   * strike" is written for the trader and says something actionable. Collapsing
   * it into "unavailable right now" would trade one leak for a different lie -
   * that we do not know what happened, when we do.
   */
  assert.match(server, /readonly fromProvider = false,/);
  assert.match(server, /if \(!error\.fromProvider\) \{\s*\n\s*return \{ status: error\.status, message: error\.message, remaining: error\.remaining \};/);
  // Only the fetch path may mark a message as the provider's.
  assert.equal((server.match(/^\s{10}true,$/gm) ?? []).length, 1);
  assert.match(server, /detail \|\| `KwantData request failed \(\$\{response\.status\}\)\.`,\s*\n\s*response\.status,\s*\n\s*remaining,\s*\n\s*true,/);
});

check("the quota figure still reaches the client", () => {
  // It is a number, not the vendor's prose - safe to show, and it is what makes
  // "unavailable right now" diagnosable rather than mysterious.
  assert.match(server, /remaining: error\.remaining,/);
  assert.match(server, /const remaining = finiteNumber\(response\.headers\.get\("x-ratelimit-remaining"\)\);/);
});

console.log(`\nprovider message boundary: ${passed}/${passed} checks passed`);
