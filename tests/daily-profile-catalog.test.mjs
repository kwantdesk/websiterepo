import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync(
  new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url),
  "utf8",
);
const config = readFileSync(
  new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url),
  "utf8",
);

test("Daily Profile is the single catalog entry backed by the existing KWANT profile ID", () => {
  assert.match(
    catalog,
    /indicator\("Daily Profile",[\s\S]*?"KWANT Profile"\)/,
  );
  assert.doesNotMatch(catalog, /indicator\("Daily Volume Profile"/);
  assert.doesNotMatch(config, /"daily-volume-profile"/);
});
