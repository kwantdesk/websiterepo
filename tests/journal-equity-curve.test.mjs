import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath = new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url);

test("journal equity curve exposes responsive axes and trade-by-trade hover detail", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.match(source, /function EquityCurve\([\s\S]*?const \[hoveredIndex, setHoveredIndex\] = useState/);
  assert.match(source, /const yTicks = Array\.from\(\{ length: 5 \}/);
  assert.match(source, /const xTicks = xTickIndexes\.map/);
  assert.match(source, /onPointerMove=\{onPointerMove\}/);
  assert.match(source, /Trade sequence \/ close date/);
  assert.match(source, /Account equity/);
  assert.match(source, /Trade #\{hovered\.index\}/);
  assert.match(source, /hovered\.trade\.entryPrice[\s\S]*?hovered\.trade\.exitPrice/);
});
