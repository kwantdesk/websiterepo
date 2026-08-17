import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const marketIndices = await readFile(new URL("../src/lib/marketIndices.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("SPXW follows SPX in the options-underlying catalogue", () => {
  assert.ok(marketIndices.indexOf('symbol: "SPXW"') > marketIndices.indexOf('symbol: "SPX"'));
});

test("saved Options watchlists insert SPXW directly beneath SPX", () => {
  assert.match(workspace, /const spxKey = makeWatchlistKey\("SPX", "Market Index"\)/);
  assert.match(workspace, /const spxwKey = makeWatchlistKey\("SPXW", "Market Index"\)/);
  assert.match(workspace, /symbols\.splice\(spxIndex >= 0 \? spxIndex \+ 1 : 0, 0, spxwKey\)/);
});
