import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import protobuf from "protobufjs";

import { loadProtocol } from "../src/protocol.mjs";
import { RithmicMarketDataClient } from "../src/rithmic-client.mjs";

const PROTO_DIR = fileURLToPath(new URL("../vendor/proto", import.meta.url));
const protoFile = (name) => join(PROTO_DIR, name);

const source = readFileSync(new URL("../src/protocol.mjs", import.meta.url), "utf8");

/**
 * A message we cannot name yet is still recorded in full.
 *
 * Widening the subscription to every update bit brought in settlement, open
 * interest, market mode, the price limits and the official open and close.
 * Their template ids are not published in the .proto files, so the decoder had
 * no type for them and returned a null payload - the archive recorded THAT a
 * message arrived without what it contained, which is exactly the failure it
 * exists to prevent. Observed live: {"templateId":153,"payload":null}.
 *
 * Guessing the mapping would be worse than the gap, because a wrong message
 * type decodes into confident nonsense. The bytes are kept instead, so the
 * mapping can be established from evidence later and applied retroactively.
 */

test("an unmapped template keeps its wire bytes", async () => {
  const protocol = loadProtocol(PROTO_DIR);
  const root = await protobuf.load([protoFile("message_type.proto")]);
  const MessageType = root.lookupType("rti.MessageType");
  // 153 is one of the ids observed arriving live after the widening.
  const buffer = Buffer.from(MessageType.encode(MessageType.create({ templateId: 153 })).finish());

  const decoded = protocol.decode(buffer);
  assert.equal(decoded.templateId, 153);
  assert.equal(decoded.typeName, null, "153 is not expected to be mapped yet");
  assert.equal(decoded.payload, null);
  assert.ok(decoded.raw, "the wire bytes were discarded");
  assert.equal(
    Buffer.from(decoded.raw, "base64").toString("hex"),
    buffer.toString("hex"),
    "the retained bytes are not the message that arrived",
  );
});

test("the client forwards unmapped wire bytes to the recorder boundary", async () => {
  const root = await protobuf.load([protoFile("message_type.proto")]);
  const MessageType = root.lookupType("rti.MessageType");
  const buffer = Buffer.from(MessageType.encode(MessageType.create({ templateId: 153 })).finish());
  const client = new RithmicMarketDataClient({
    protoDir: PROTO_DIR,
    maxTrades: 10,
    subscriptions: [],
    allowedInstruments: [],
    allowedRoots: [],
  });

  const recorded = new Promise((resolve) => client.once("rawMessage", resolve));
  client.handleMessage(buffer);
  const event = await recorded;

  assert.equal(event.templateId, 153);
  assert.equal(event.payload, null);
  assert.equal(event.raw, buffer.toString("base64"), "the client dropped the preserved wire bytes");
});

test("a mapped template still decodes to a payload, not bytes", async () => {
  // The retention must not have replaced normal decoding.
  const protocol = loadProtocol(PROTO_DIR);
  const root = await protobuf.load([protoFile("message_type.proto"), protoFile("last_trade.proto")]);
  const LastTrade = root.lookupType("rti.LastTrade");
  const buffer = Buffer.from(LastTrade.encode(LastTrade.create({
    templateId: 150, symbol: "NQU6", exchange: "CME", tradePrice: 29000, tradeSize: 3,
  })).finish());

  const decoded = protocol.decode(buffer);
  assert.equal(decoded.templateId, 150);
  assert.equal(decoded.typeName, "LastTrade");
  assert.equal(decoded.payload?.symbol, "NQU6");
  assert.equal(decoded.payload?.tradePrice, 29000);
  assert.equal(decoded.raw, undefined, "a decodable message should not also carry raw bytes");
});

test("no guessed template mapping was added", () => {
  /*
   * The ids observed live after the widening - 152, 153, 154, 155, 157, 158,
   * 163 - are real market data whose meaning Rithmic does not publish here.
   * Mapping one on a hunch writes confident nonsense into the archive, which
   * is worse than a gap because nothing downstream can tell it is wrong.
   */
  const table = source.slice(source.indexOf("const RESPONSE_TYPES"), source.indexOf("function jsonValue"));
  for (const templateId of [152, 153, 154, 155, 157, 158, 163]) {
    assert.ok(
      !new RegExp(`\\[${templateId},`).test(table),
      `template ${templateId} has been given a name without evidence for it`,
    );
  }
});
