import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("default watchlist labels use Futures and Options", () => {
  assert.match(workspace, /id: "default",\s+name: "Futures"/);
  assert.match(workspace, /id: "options-underlyings",\s+name: "Options"/);
});

test("saved default watchlist groups migrate to the new labels", () => {
  assert.match(workspace, /section\.id === "default"\s+\? \{ \.\.\.section, name: "Futures" \}/);
  assert.match(workspace, /section\.id === "options-underlyings"\s+\? \{ \.\.\.section, name: "Options" \}/);
  assert.doesNotMatch(workspace, /Move symbols to Main\?/);
});
