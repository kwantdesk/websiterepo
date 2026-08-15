import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const catalogSource = await fs.readFile(
  new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url),
  "utf8",
);

test("large execution indicators share the Big Contracts display name without changing saved IDs", () => {
  assert.match(
    catalogSource,
    /indicator\("Big Contracts",[^\n]+"Big Trades"\)/,
  );
  assert.match(
    catalogSource,
    /indicator\("Big Contracts",[^\n]+"Deep Trades"\)/,
  );
  assert.doesNotMatch(catalogSource, /indicator\("Big \/ Deep Trades"/);
  assert.doesNotMatch(catalogSource, /indicator\("KWANT Trades"/);
});
