import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspace = await readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("a retired overlay cannot start its old chart request or refresh loop", () => {
  assert.doesNotMatch(workspace, /enabledKwantRootKey|refreshKwantLevelsForInstrument|missingRequestedOverlay/);
});
