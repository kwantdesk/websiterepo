import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const workspace = await fs.readFile(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

test("workspace timezone remains interactive for every selected panel type", () => {
  const start = workspace.indexOf("<TimeZoneSelect\n            value={chartSettings.timezone}");
  assert.notEqual(start, -1);
  const control = workspace.slice(start, workspace.indexOf("/>", start) + 2);

  assert.match(control, /onChange=\{changeChartTimeZone\}/);
  assert.doesNotMatch(control, /activePaneIsChart|pointer-events-none|opacity-30|aria-disabled/);
});
