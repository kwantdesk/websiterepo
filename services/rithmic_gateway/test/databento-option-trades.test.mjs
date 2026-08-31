import assert from "node:assert/strict";
import test from "node:test";

import { DatabentoOptionTradeStream } from "../src/databento-option-trades.mjs";

test("duplicate native panes share one bounded option symbol lease", () => {
  const stream = new DatabentoOptionTradeStream({ maxSymbols: 2 });
  const releaseFirst = stream.subscribe(" nqu6 c25000 ");
  const releaseSecond = stream.subscribe("NQU6 C25000");

  assert.deepEqual(stream.status().activeSymbols, ["NQU6 C25000"]);
  assert.equal(stream.status().vendorConnections, 0);
  releaseFirst();
  assert.deepEqual(stream.status().activeSymbols, ["NQU6 C25000"]);
  releaseSecond();
  assert.deepEqual(stream.status().activeSymbols, []);
  stream.stop();
});

test("the shared option stream enforces its active-contract ceiling", () => {
  const stream = new DatabentoOptionTradeStream({ maxSymbols: 2 });
  const releases = [stream.subscribe("NQU6 C25000"), stream.subscribe("NQU6 P25000")];
  assert.throws(() => stream.subscribe("ESU6 C6500"), /At most 2/);
  releases.forEach((release) => release());
  stream.stop();
});
