import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url),
  "utf8",
);

test("chart indicators menu escapes workspace stacking contexts", () => {
  assert.match(source, /open && menuPosition[\s\S]*?createPortal\(/);
  assert.match(source, /className="fixed z-\[10000\]/);
  assert.match(source, /document\.body/);
  assert.doesNotMatch(source, /absolute right-0 top-\[38px\] z-\[180\]/);
});

test("chart indicators menu remains interactive and closes outside", () => {
  assert.match(source, /menuRef\.current\?\.contains\(target\)/);
  assert.match(source, /document\.addEventListener\("pointerdown", close, true\)/);
  assert.match(source, /window\.addEventListener\("resize", positionMenu\)/);
  assert.match(source, /window\.addEventListener\("scroll", positionMenu, true\)/);
});
