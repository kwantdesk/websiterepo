import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.mjs";
import { loadProtocol, TEMPLATE_IDS } from "../src/protocol.mjs";

test("licensed History Plant replay messages are loaded with their wire template ids", () => {
  const config = loadConfig({
    RITHMIC_SOURCE_MODE: "protocol",
    RITHMIC_USER: "test",
    RITHMIC_PASSWORD: "test",
  });
  const protocol = loadProtocol(config.protoDir);
  const request = protocol.encode("RequestTimeBarReplay", {
    templateId: TEMPLATE_IDS.TIME_BAR_REPLAY_REQUEST,
    userMsg: ["history-test"],
    exchange: "CME",
    symbol: "NQH5",
    barType: 2,
    barTypePeriod: 1,
    startIndex: 1_735_689_600,
    finishIndex: 1_735_776_000,
    direction: 1,
    timeOrder: 1,
    resumeBars: true,
  });
  assert.equal(protocol.templateId(request), 202);

  const responseType = protocol.root.lookupType("rti.ResponseTimeBarReplay");
  const response = Buffer.from(responseType.encode(responseType.create({
    templateId: TEMPLATE_IDS.TIME_BAR_REPLAY_RESPONSE,
    userMsg: ["history-test"],
    rqHandlerRpCode: ["0"],
    symbol: "NQH5",
    exchange: "CME",
    type: 2,
    period: "1",
    marker: 1_735_689_600,
    volume: 123,
    openPrice: 20_000,
    highPrice: 20_010,
    lowPrice: 19_995,
    closePrice: 20_005,
  })).finish());
  const decoded = protocol.decode(response);
  assert.equal(decoded.typeName, "ResponseTimeBarReplay");
  assert.equal(decoded.payload.marker, 1_735_689_600);
  assert.equal(decoded.payload.volume, "123");
});
