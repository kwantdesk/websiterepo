import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const navigation = await fs.readFile(new URL("../src/components/AppSidebar.tsx", import.meta.url), "utf8");
const styles = await fs.readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("workspace controls remain centred in their command row", () => {
  const toolbar = source.match(/<div className="([^"]*col-span-3 col-start-1 row-start-1[^"]*)">/);
  assert.ok(toolbar, "workspace toolbar row should exist");
  assert.match(toolbar[1], /grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(source, /<div className="col-start-2 flex h-7 shrink-0 items-center justify-self-center gap-1">/);
});

test("all chart shell rows share the CHARTS workspace-header height", () => {
  assert.match(styles, /--kwant-shell-bar-height:\s*36px;/);
  assert.match(styles, /header\.kwant-command-rail\s*\{[\s\S]*?height:\s*var\(--kwant-shell-bar-height\);/);
  assert.match(styles, /\.kwant-chart-command-deck\s*\{[\s\S]*?grid-template-rows:\s*repeat\(2, var\(--kwant-shell-bar-height\)\);/);
  assert.match(styles, /\.kwant-workspace-pane-header\s*\{[\s\S]*?height:\s*var\(--kwant-shell-bar-height\);/);
  assert.equal((source.match(/kwant-workspace-pane-header/g) ?? []).length, 3);
});

test("primary navigation is centered wide and left-aligned on narrow or portrait screens", () => {
  assert.match(navigation, /kwant-primary-workspace-nav/);
  assert.match(navigation, /kwant-primary-workspace-nav-track/);
  assert.match(navigation, /absolute inset-y-0 flex items-center overflow-x-auto overflow-y-clip/);
  assert.match(styles, /\.kwant-primary-workspace-nav\s*\{[\s\S]*?left:\s*50%;[\s\S]*?height:\s*var\(--kwant-shell-bar-height\);[\s\S]*?transform:\s*translateX\(-50%\);/);
  assert.match(styles, /\.kwant-primary-workspace-nav::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none;[\s\S]*?height:\s*0;/);
  assert.match(styles, /@media \(max-width:\s*1279px\), \(orientation:\s*portrait\)[\s\S]*?\.kwant-primary-workspace-nav\s*\{[\s\S]*?left:\s*8px;[\s\S]*?transform:\s*none;/);
  assert.match(styles, /@media \(max-width:\s*1279px\), \(orientation:\s*portrait\)[\s\S]*?\.kwant-primary-workspace-nav-track\s*\{[\s\S]*?margin-inline:\s*0;/);
});
