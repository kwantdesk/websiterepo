import assert from "node:assert/strict";
import test from "node:test";

import {
  DatabentoOptionsCatalog,
  OptionsCatalogError,
} from "../src/databento-options-catalog.mjs";

const NOW = Date.parse("2026-08-31T12:00:00Z");

test("builds the bounded August V1 CME option catalog on the VPS and caches it", async () => {
  const requests = [];
  const fetchImpl = async (_url, init) => {
    const form = init.body;
    requests.push(new URLSearchParams(form));
    if (form.get("schema") === "ohlcv-1m") {
      return response([{ close: "25000", ts_event: new Date(NOW - 60_000).toISOString() }]);
    }
    const root = form.get("symbols").split(".", 1)[0];
    const expiration = new Date(NOW + 24 * 60 * 60_000).toISOString();
    return response([
      { raw_symbol: `${root}U6 C25000`, instrument_class: "C", strike_price: "25000", expiration },
      { raw_symbol: `${root}U6 P25000`, instrument_class: "P", strike_price: "25000", expiration },
    ]);
  };
  const catalog = new DatabentoOptionsCatalog({ apiKey: "vps-secret", fetchImpl, now: () => NOW });

  const first = await catalog.load();
  const second = await catalog.load();

  assert.equal(first.schemaVersion, "kwantdesk-option-catalog-v1");
  assert.equal(first.provider, "Databento");
  assert.equal(first.dataset, "GLBX.MDP3");
  assert.equal(first.instruments.length, 10);
  assert.equal(first.instruments[0].venue, "CME");
  assert.equal(first.instruments[0].tickSize, 0.25);
  assert.equal(first.instruments[0].kind, "option");
  assert.equal(second.cached, true);
  assert.equal(requests.length, 10);
  assert.equal(requests.filter((form) => form.get("schema") === "definition").length, 5);
  assert.equal(requests.filter((form) => form.get("schema") === "ohlcv-1m").length, 5);
  assert.equal(catalog.status().cacheHits, 1);
});

test("fails closed when the VPS has no Databento option entitlement", async () => {
  const catalog = new DatabentoOptionsCatalog();
  await assert.rejects(
    catalog.load(),
    (error) => error instanceof OptionsCatalogError
      && error.code === "options_catalog_unconfigured"
      && error.status === 503,
  );
});

function response(rows, status = 200) {
  return new Response(rows.map((row) => JSON.stringify(row)).join("\n"), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
