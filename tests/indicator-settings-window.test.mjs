import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url),
  "utf8",
);

test("indicator settings keep the chart visible behind the dialog", () => {
  const overlayStart = source.indexOf("data-indicator-settings-overlay");
  const dialogStart = source.indexOf("data-indicator-settings-dialog", overlayStart);
  assert.ok(overlayStart >= 0, "settings overlay should be identifiable");
  assert.ok(dialogStart > overlayStart, "settings dialog should render inside its overlay");

  const overlayMarkup = source.slice(overlayStart, dialogStart);
  assert.match(overlayMarkup, /bg-transparent/);
  assert.doesNotMatch(overlayMarkup, /backdrop-blur|bg-black\//);
});

test("indicator settings dialog can be dragged from its header", () => {
  assert.match(source, /ref=\{settingsDialogRef\}/);
  assert.match(source, /title="Drag settings window"/);
  assert.match(source, /onPointerDown=\{beginSettingsDialogDrag\}/);
  assert.match(source, /onPointerMove=\{moveSettingsDialog\}/);
  assert.match(source, /translate3d\(\$\{next\.x\}px, \$\{next\.y\}px, 0\)/);
});

test("clicking outside closes the live settings dialog", () => {
  assert.match(source, /settingsDialogRef\.current\?\.contains\(target\)/);
  assert.match(source, /document\.addEventListener\("pointerdown", closeOnOutsidePointer, true\)/);
  assert.match(source, /document\.removeEventListener\("pointerdown", closeOnOutsidePointer, true\)/);
  assert.match(source, /if \(event\.key === "Escape"\) closeSettingsDialog\(\)/);
  assert.match(source, /saveFootprintSettings\(settingsInstance\.instanceId, validated\)/);
});
