import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("workspace controls align to the right above the chart timezone controls", () => {
  const toolbar = source.match(/<div className="([^"]*col-span-2 col-start-1 row-start-1[^"]*)">/);
  assert.ok(toolbar, "workspace toolbar row should exist");
  assert.match(toolbar[1], /justify-end/);
  assert.doesNotMatch(toolbar[1], /sm:justify-center/);
});
