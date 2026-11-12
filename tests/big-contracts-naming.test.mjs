import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const catalogSource = await fs.readFile(
  new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url),
  "utf8",
);

test("Big Contracts has one library entry and preserves the Big Trades ID", () => {
  assert.match(
    catalogSource,
    /indicator\("Big Contracts",[^\n]+"Big Trades"\)/,
  );
  assert.equal(catalogSource.match(/indicator\("Big Contracts"/g)?.length, 1);
  assert.doesNotMatch(catalogSource, /indicator\("Big \/ Deep Trades"/);
  assert.doesNotMatch(catalogSource, /indicator\("KWANT Trades"/);
});
