import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chart = await readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("value-area profile-window retries do not display a chart warning", () => {
  assert.doesNotMatch(chart, /Value Area · \$\{valueAreaLevelsError\}/);
  assert.match(workspace, /schedule\(nextDelay\)/);
  assert.match(workspace, /Math\.min\(60_000, 2_000 \* \(2 \*\* Math\.min\(5, failureStreak - 1\)\)\)/);
});
