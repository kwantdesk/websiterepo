import assert from "node:assert/strict";
import test from "node:test";
import source from "emojibase-data/en/compact.json" with { type: "json" };
import { CHART_EMOJI_CATALOG, CHART_EMOJI_CATEGORIES, CHART_EMOJI_PAGE_SIZE, CHART_QUICK_EMOJIS, chartEmojiIdentity, chartEmojiPage, filterChartEmojis } from "../src/lib/chartEmojiCatalog.ts";
import { CHAT_EMOJIS } from "../src/lib/emojis.ts";
import { createDrawing, normalizeDrawings } from "../src/lib/chartDrawTools.ts";

test("catalogue contains every source emoji and exact skin-tone sequence without duplicates", () => {
  const expected = source.flatMap((entry) => [entry, ...(entry.skins ?? [])]).map((entry) => entry.unicode);
  assert.deepEqual(CHART_EMOJI_CATALOG.map((entry) => entry.emoji), expected);
  assert.ok(expected.length > 3900);
  assert.equal(new Set(expected).size, expected.length);
  assert.equal(CHART_EMOJI_CATEGORIES.length, 10);
  const identities = new Set(expected.map(chartEmojiIdentity));
  for (const emoji of [...CHAT_EMOJIS, ...CHART_QUICK_EMOJIS]) assert.ok(identities.has(chartEmojiIdentity(emoji)), emoji);
});

test("search matches names, keywords, multiple terms and pasted sequences", () => {
  assert.ok(filterChartEmojis(" MAGNET ").some((entry) => entry.emoji === "🧲"));
  assert.ok(filterChartEmojis("bull").some((entry) => entry.emoji === "🐂"));
  assert.ok(filterChartEmojis("flag australia").some((entry) => entry.emoji === "🇦🇺"));
  assert.ok(filterChartEmojis("👋🏽").some((entry) => entry.emoji === "👋🏽"));
  assert.equal(filterChartEmojis("no-such-emoji-12345").length, 0);
});

test("categories and skin-tone filtering preserve the complete selectable set", () => {
  for (let group = 0; group < CHART_EMOJI_CATEGORIES.length; group++) {
    const entries = filterChartEmojis("", group);
    assert.ok(entries.length > 0);
    assert.ok(entries.every((entry) => entry.group === group));
  }
  assert.equal(filterChartEmojis("", -1, false).length, source.length);
  assert.ok(filterChartEmojis("", -1, false).every((entry) => !entry.variant));
});

test("bounded pages expose every emoji including the final partial page", () => {
  const { pages } = chartEmojiPage(CHART_EMOJI_CATALOG, 0);
  const all = [];
  for (let page = 0; page < pages; page++) {
    const result = chartEmojiPage(CHART_EMOJI_CATALOG, page);
    assert.ok(result.entries.length <= CHART_EMOJI_PAGE_SIZE);
    all.push(...result.entries);
  }
  assert.deepEqual(all, CHART_EMOJI_CATALOG);
  assert.equal(chartEmojiPage([], 100).page, 0);
  assert.equal(chartEmojiPage(CHART_EMOJI_CATALOG, -1).page, 0);
  assert.equal(chartEmojiPage(CHART_EMOJI_CATALOG, 999).page, pages - 1);
});

test("every complete emoji sequence survives the existing drawing persistence", () => {
  const drawings = CHART_EMOJI_CATALOG.map((entry) => createDrawing("emoji", [{ time: 1725000000, price: 29150 }], entry.emoji));
  // Persistence has a separate per-chart drawing limit, so verify one at a time.
  for (const drawing of drawings) {
    const restored = normalizeDrawings(JSON.parse(JSON.stringify([drawing])))[0];
    assert.equal(restored.text, drawing.text);
  }
});
