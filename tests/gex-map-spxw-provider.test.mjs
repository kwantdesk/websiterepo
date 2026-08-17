import assert from "node:assert/strict";
import test from "node:test";

import { gexMapProviderTicker } from "../src/lib/gexMap.ts";

test("SPXW GEX panels read the provider's SPX underlying surface", () => {
  assert.equal(gexMapProviderTicker("SPXW"), "SPX");
  assert.equal(gexMapProviderTicker(" spxw "), "SPX");
});

test("other GEX Map symbols retain their own provider roots", () => {
  assert.equal(gexMapProviderTicker("SPX"), "SPX");
  assert.equal(gexMapProviderTicker("NDX"), "NDX");
  assert.equal(gexMapProviderTicker("QQQ"), "QQQ");
});
