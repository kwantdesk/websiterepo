import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const styles = await fs.readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("workspace controls remain centered in their command row", () => {
  const toolbar = source.match(/<div className="([^"]*col-span-2 col-start-1 row-start-1[^"]*)">/);
  assert.ok(toolbar, "workspace toolbar row should exist");
  assert.match(toolbar[1], /grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(source, /<div className="col-start-2 flex h-7 shrink-0 items-center gap-1">/);
});

test("all chart shell rows share the CHARTS workspace-header height", () => {
  assert.match(styles, /--kwant-shell-bar-height:\s*36px;/);
  assert.match(styles, /header\.kwant-command-rail\s*\{[\s\S]*?height:\s*var\(--kwant-shell-bar-height\);/);
  assert.match(styles, /\.kwant-chart-command-deck\s*\{[\s\S]*?grid-template-rows:\s*repeat\(2, var\(--kwant-shell-bar-height\)\);/);
  assert.match(styles, /\.kwant-workspace-pane-header\s*\{[\s\S]*?height:\s*var\(--kwant-shell-bar-height\);/);
  assert.equal((source.match(/kwant-workspace-pane-header/g) ?? []).length, 3);
});
