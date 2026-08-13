import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const workspaceSource = await fs.readFile(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

test("charts do not render the floating instrument and live-status badge", () => {
  assert.doesNotMatch(workspaceSource, /const marketStatusLabel =/);
  assert.doesNotMatch(workspaceSource, /marketStatusClasses/);
  assert.doesNotMatch(workspaceSource, /History · reconnecting/);
});
