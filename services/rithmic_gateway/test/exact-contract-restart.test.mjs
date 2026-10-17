import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("history contract routing remains exact with a root-only or old-contract live book", () => {
  const source = readFileSync(new URL("../src/server.mjs", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("function requestedInstrument("), source.indexOf("function tickSize("));
  const contractRoot = symbol => symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
  for (const rows of [[], [{ symbol: "NQ", exchange: "CME" }], [{ symbol: "NQU6", exchange: "CME" }]]) {
    const resolve = new Function("client", "contractRoot", "parentRoot", "compareInstrumentCandidates", "exchangeForRoot", "instrumentKey",
      `${body}; return requestedInstrument;`)(
      { book: { list: () => rows }, frontMonthCache: new Map() }, contractRoot,
      root => root, () => 0, () => "CME", (exchange, root) => `${exchange}:${root}`);
    assert.deepEqual(resolve(new URL("http://local/?symbol=NQZ6&exchange=CME"), {}, { exactRoot: true }),
      { exchange: "CME", symbol: "NQZ6" });
    assert.deepEqual(resolve(new URL("http://local/?symbol=MNQZ6&exchange=CME"), {}, { exactRoot: true }),
      { exchange: "CME", symbol: "MNQZ6" });
  }
});
