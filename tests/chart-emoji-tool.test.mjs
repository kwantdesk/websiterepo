import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DRAW_TOOL_GROUPS,
  DRAW_TOOL_SPECS,
  createDrawing,
  normalizeDrawings,
} from "../src/lib/chartDrawTools.ts";

const toolbar = readFileSync(new URL("../src/components/ChartDrawToolbar.tsx", import.meta.url), "utf8");
const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/ChartDrawSettings.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

test("emoji is directly below Measure and places with one chart anchor", () => {
  assert.equal(DRAW_TOOL_SPECS.emoji.points, 1);
  assert.equal(DRAW_TOOL_SPECS.emoji.group, "emoji");
  const measure = DRAW_TOOL_GROUPS.findIndex((group) => group.id === "measure");
  assert.equal(DRAW_TOOL_GROUPS[measure + 1]?.id, "emoji");
});

test("emoji value and size survive drawing persistence", () => {
  const placed = createDrawing("emoji", [{ time: 1_725_000_000, price: 29_150 }], "🧲");
  placed.style.fontSize = 72;
  const restored = normalizeDrawings(JSON.parse(JSON.stringify([placed])))[0];
  assert.equal(restored.tool, "emoji");
  assert.equal(restored.text, "🧲");
  assert.equal(restored.style.fontSize, 72);
  assert.equal(restored.points[0].time, placed.points[0].time);
  assert.equal(restored.points[0].price, placed.points[0].price);
});

test("toolbar exposes a scrollable picker including the magnet", () => {
  assert.match(toolbar, /CHAT_EMOJIS/);
  assert.match(toolbar, /"🧲"/);
  assert.match(toolbar, /openGroup === "emoji"/);
  assert.match(toolbar, /overflow-y-auto/);
  assert.match(toolbar, /onSelectEmoji\(value\); selectTool\("emoji"\)/);
});

test("emoji paints at chart coordinates and has a bounded resize handle", () => {
  assert.match(layer, /case "emoji"/);
  assert.match(layer, /x=\{a\.x\}/);
  assert.match(layer, /y=\{a\.y\}/);
  assert.match(layer, /textAnchor="middle"/);
  assert.match(layer, /dominantBaseline="central"/);
  assert.match(layer, /const beginEmojiResize/);
  assert.match(layer, /Math\.max\(16, Math\.min\(160/);
  assert.match(layer, /"emoji-size"/);
  assert.match(layer, /const handles = !selected\s*\? null/);
});

test("chart owns the selected emoji and passes it to the persisted drawing layer", () => {
  assert.match(chart, /kwantdesk:chart-emoji:v1/);
  assert.match(chart, /emoji=\{drawEmoji\}/g);
  assert.match(chart, /onSelectEmoji=\{selectDrawEmoji\}/);
  assert.match(layer, /tool === "emoji" \? emoji : undefined/);
});

test("emoji settings only expose real emoji and size controls", () => {
  assert.match(settings, /const isEmoji = drawing\.tool === "emoji"/);
  assert.match(settings, /min=\{16\} max=\{160\}/);
  assert.match(settings, /isEmoji \? "Emoji" : "Text"/);
  assert.match(settings, /!isEmoji \? <Row label="Show labels"/);
});
