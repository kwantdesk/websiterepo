import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ALL_UPDATE_BITS } from "../src/rithmic-client.mjs";

const client = readFileSync(new URL("../src/rithmic-client.mjs", import.meta.url), "utf8");
const proto = readFileSync(
  new URL("../vendor/proto/request_market_data_update.proto", import.meta.url), "utf8",
);

/**
 * The collector takes everything Rithmic will send, because none of it can be
 * bought back.
 *
 * The subscription asked for update_bits 7 - LAST_TRADE | BBO | ORDER_BOOK -
 * three of the seventeen types the protocol defines. Settlement, open
 * interest, market mode (the halts), the official open and close, the price
 * limits and the opening/closing indicators were never requested. Rithmic
 * sells no history for any of it, so for every session recorded before this
 * they simply do not exist.
 *
 * The archive gate was also an allowlist of six template ids, which drops
 * anything it has not been told about - including the types the widened
 * subscription now brings in, whose ids are not published in the .proto files.
 */

test("every update bit the protocol defines is requested", () => {
  // Read the bits out of Rithmic's own proto rather than trusting our copy of
  // the list: if they add one, this fails instead of silently not asking.
  const enumBody = proto.slice(proto.indexOf("enum UpdateBits"), proto.indexOf("enum Request"));
  const declared = [...enumBody.matchAll(/^\s*([A-Z_]+)\s*=\s*(\d+);/gm)]
    .map(([, name, value]) => ({ name, value: Number(value) }));

  assert.ok(declared.length >= 17, `expected 17+ update bits, proto declares ${declared.length}`);
  const expected = declared.reduce((all, bit) => all | bit.value, 0);
  assert.equal(
    ALL_UPDATE_BITS,
    expected,
    `not every update bit is requested: missing ${declared
      .filter((bit) => (ALL_UPDATE_BITS & bit.value) === 0)
      .map((bit) => bit.name)
      .join(", ") || "none"}`,
  );
  // The specific ones that were absent, named so a regression is legible.
  for (const name of [
    "SETTLEMENT", "OPEN_INTEREST", "MARKET_MODE", "OPEN", "CLOSE",
    "HIGH_LOW", "HIGH_PRICE_LIMIT", "LOW_PRICE_LIMIT", "PROJECTED_SETTLEMENT",
  ]) {
    const bit = declared.find((entry) => entry.name === name);
    assert.ok(bit, `${name} is no longer declared by the protocol`);
    assert.ok((ALL_UPDATE_BITS & bit.value) !== 0, `${name} is not being requested`);
  }
});

test("both the subscribe and unsubscribe paths use the full set", () => {
  /*
   * They have to agree: unsubscribing with a narrower mask than we subscribed
   * with leaves a partial subscription running that nobody is reading.
   */
  const uses = client.match(/updateBits: ALL_UPDATE_BITS,/g) ?? [];
  assert.equal(uses.length, 2, `expected subscribe and unsubscribe, found ${uses.length}`);
  assert.ok(!/updateBits: 7,/.test(client), "a hardcoded three-bit subscription is back");
});

test("the archive keeps what it cannot name", () => {
  // A denylist, not an allowlist. An unanticipated message is exactly the one
  // worth keeping.
  assert.match(
    client,
    /if \(!NON_MARKET_TEMPLATE_IDS\.has\(decoded\.templateId\)\) \{/,
    "the archive gate is an allowlist again",
  );
  assert.ok(
    !/const MARKET_DATA_TEMPLATE_IDS = new Set/.test(client),
    "the six-id allowlist is back",
  );
});

test("no known market-data template is excluded", () => {
  /*
   * The ids the old allowlist named as market data: last trade, BBO, order
   * book, depth-by-order snapshot, depth-by-order and its end event. Excluding
   * any of them would silently stop archiving the tape itself.
   */
  const listed = client.slice(
    client.indexOf("const NON_MARKET_TEMPLATE_IDS = new Set(["),
    client.indexOf("]);", client.indexOf("const NON_MARKET_TEMPLATE_IDS = new Set([")),
  );
  const excluded = new Set(
    [...listed.matchAll(/\b(\d+)\b/g)].map(([, value]) => Number(value)),
  );
  for (const templateId of [150, 151, 156, 116, 160, 161]) {
    assert.ok(!excluded.has(templateId), `template ${templateId} carries market data and is excluded`);
  }
  // And it stays small: a growing denylist is an allowlist wearing a disguise.
  assert.ok(excluded.size <= 16, `denylist has grown to ${excluded.size} ids`);
});

test("the raw wire payload is what gets archived", () => {
  /*
   * The book-store events carry only {type, instrument} for depth and BBO
   * because the values land in the book itself - archiving those would record
   * that an update happened without what it contained.
   */
  assert.match(client, /this\.emit\("rawMessage", \{[\s\S]{0,200}?payload: decoded\.payload,/);
});
