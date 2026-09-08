import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url),
  "utf8",
);

test("the initial GEX model exists before React can execute its cache updater", () => {
  const loadStart = source.indexOf("const load = async () => {");
  const modelDeclaration = source.indexOf("const expectedModel =", loadStart);
  const cacheUpdater = source.indexOf("setPanelData((current) => {", loadStart);

  assert.ok(loadStart >= 0 && modelDeclaration > loadStart);
  assert.ok(modelDeclaration < cacheUpdater, "expectedModel is in the updater's temporal dead zone");
});

test("every thrown initial GEX load clears the loaders and exposes the error", () => {
  const loadStart = source.indexOf("const load = async () => {");
  const loadEnd = source.indexOf("const syncWhenVisible", loadStart);
  const load = source.slice(loadStart, loadEnd);

  assert.match(load, /catch \(error\) \{/);
  assert.match(load, /setPanelErrors\(/);
  assert.match(
    load,
    /setLoading\(Object\.fromEntries\(panels\.map\(\(panel\) => \[panel\.id, false\]\)\)\)/,
  );
  assert.match(load, /nextRefreshDelay = 5_000/);
});
