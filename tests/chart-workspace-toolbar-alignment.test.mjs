import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const navigation = await fs.readFile(new URL("../src/components/AppSidebar.tsx", import.meta.url), "utf8");
const styles = await fs.readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("workspace controls remain centred in their command row", () => {
  assert.match(source, /kwant-chart-layout-controls kwant-chart-toolbar-scrollport/);
  assert.match(styles, /\.kwant-chart-layout-controls > \.kwant-chart-toolbar-track\s*\{\s*margin-inline:\s*auto;/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) max-content minmax\(0, 1fr\);/);
});

test("all chart shell rows share the CHARTS workspace-header height", () => {
  assert.match(styles, /--kwant-shell-bar-height:\s*36px;/);
  assert.match(styles, /header\.kwant-command-rail\s*\{[\s\S]*?height:\s*var\(--kwant-shell-bar-height\);/);
  assert.match(styles, /\.kwant-chart-command-deck\s*\{[\s\S]*?grid-template-rows:\s*var\(--kwant-shell-bar-height\);/);
  assert.match(styles, /@container chart-toolbar \(max-width: 1279px\)[\s\S]*?grid-template-rows:\s*repeat\(2, var\(--kwant-shell-bar-height\)\);/);
  assert.match(styles, /\.kwant-workspace-pane-header\s*\{[\s\S]*?height:\s*var\(--kwant-shell-bar-height\);/);
  assert.ok((source.match(/kwant-workspace-pane-header/g) ?? []).length >= 3);
});

test("primary navigation is centered wide and left-aligned on narrow or portrait screens", () => {
  assert.match(navigation, /kwant-primary-workspace-nav/);
  assert.match(navigation, /kwant-primary-workspace-nav-track/);
  assert.match(navigation, /kwant-primary-workspace-utilities/);
  assert.match(navigation, /absolute inset-y-0 flex items-center overflow-x-auto overflow-y-clip/);
  assert.match(styles, /\.kwant-primary-workspace-nav\s*\{[\s\S]*?left:\s*50%;[\s\S]*?height:\s*var\(--kwant-shell-bar-height\);[\s\S]*?transform:\s*translateX\(-50%\);/);
  assert.match(styles, /\.kwant-primary-workspace-nav::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none;[\s\S]*?height:\s*0;/);
  assert.match(styles, /@media \(max-width:\s*1279px\), \(orientation:\s*portrait\)[\s\S]*?\.kwant-primary-workspace-nav\s*\{[\s\S]*?position:\s*relative;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;[\s\S]*?transform:\s*none;/);
  assert.match(styles, /@media \(max-width:\s*1279px\), \(orientation:\s*portrait\)[\s\S]*?\.kwant-primary-workspace-nav-track\s*\{[\s\S]*?margin-inline:\s*0;/);
  assert.match(styles, /@media \(max-width:\s*1279px\), \(orientation:\s*portrait\)[\s\S]*?\.kwant-primary-workspace-nav::-webkit-scrollbar\s*\{[\s\S]*?display:\s*block;[\s\S]*?height:\s*3px;/);
});
