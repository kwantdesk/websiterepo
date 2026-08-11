import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath = new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url);

test("daily outcomes use a shared zero baseline with proportional profit and loss bars", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.match(source, /function DailyBars\([\s\S]*?const maximum = Math\.max\(1, \.\.\.days\.map\(\(\[, value\]\) => Math\.abs\(value\)\)\)/);
  assert.match(source, /bottom-1\/2 left-12 right-0 border-t/);
  assert.match(source, /const magnitude = Math\.abs\(value\) \/ maximum \* 50/);
  assert.match(source, /isPositive \? "bottom-1\/2 rounded-t-md bg-primary" : "top-1\/2 rounded-b-md bg-danger"/);
  assert.match(source, /Hover a traded day/);
  assert.match(source, /aria-label="Daily profit and loss around a zero-dollar baseline"/);
});
