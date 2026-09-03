import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  contrastRatio,
  legibleOn,
  parseResolvedColor,
  readableTextOn,
} from "../src/lib/readableContrast.ts";
import { themePresets } from "../src/lib/themePresets.ts";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

function ratio(foreground, background) {
  const foregroundRgb = parseResolvedColor(foreground);
  const backgroundRgb = parseResolvedColor(background);
  assert.ok(foregroundRgb && backgroundRgb, `expected resolved colours: ${foreground} / ${background}`);
  return contrastRatio(foregroundRgb, backgroundRgb);
}

test("quick-measure ink remains readable on every chart theme", () => {
  for (const preset of themePresets) {
    const background = preset.colors.chartBackground;
    const accent = legibleOn(preset.colors.candleUp, background, 4.5);
    assert.ok(
      ratio(accent, background) >= 4.5,
      `${preset.name} quick-measure accent must contrast with its chart`,
    );
    assert.ok(
      ratio(readableTextOn(background), background) >= 4.5,
      `${preset.name} elapsed-time text must contrast with its chart`,
    );
  }
});

test("the transient ruler follows chart colours instead of hard-coded blue", () => {
  assert.match(chart, /drawing\.id === "__quick-measure__"/);
  assert.match(chart, /legibleOn\(settings\.upColor, settings\.backgroundColor, 4\.5\)/);
  assert.match(chart, /fill=\{measurement && isQuickMeasurement \? color/);
  assert.match(chart, /readableTextOn\(settings\.backgroundColor\)/);
});

test("post-drag contextmenu is consumed after mouseup clears the live gesture", () => {
  const menuStart = chart.indexOf("const handleContextMenu = (e: MouseEvent)");
  const menuEnd = chart.indexOf("const handleResize", menuStart);
  const menuHandler = chart.slice(menuStart, menuEnd);
  assert.match(menuHandler, /quickMeasureGesture\.contextMenuConsumed = true/);
  assert.match(menuHandler, /performance\.now\(\) <= quickMeasureContextMenuDeadlineRef\.current/);
  assert.ok(
    menuHandler.indexOf("quickMeasureContextMenuDeadlineRef.current") < menuHandler.indexOf("setContextMenu({"),
    "the release latch must be checked before opening the chart menu",
  );

  const releaseStart = chart.indexOf("const handleQuickMeasureUp = (event: MouseEvent)");
  const releaseEnd = chart.indexOf("container.addEventListener", releaseStart);
  const releaseHandler = chart.slice(releaseStart, releaseEnd);
  assert.match(releaseHandler, /quickMeasureRef\.current = null/);
  assert.match(releaseHandler, /if \(!state\.contextMenuConsumed\)/);
  assert.match(releaseHandler, /performance\.now\(\) \+ 500/);
});

test("a normal right-click still opens the menu", () => {
  assert.match(chart, /if \(!state\?\.active\) return/);
  assert.match(chart, /quickMeasureContextMenuDeadlineRef\.current = 0;[\s\S]*quickMeasureRef\.current = \{/);
});
