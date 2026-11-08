import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawing, normalizeDrawings, resolveDrawColor } from '../src/lib/chartDrawTools.ts';
import { svgDrawingFixture } from './helpers/drawing-hit-harness.mjs';

test('new monochrome glyphs inherit the theme and paint an explicit fill', () => {
  const drawing = createDrawing('emoji', [{ time: 200, price: 200 }], '🇼');
  assert.equal(resolveDrawColor(drawing.style, '#FFFFFF'), '#FFFFFF');
  const { html } = svgDrawingFixture('emoji', { drawings: [drawing], themeColor: '#FFFFFF' });
  assert.match(html, /fill="#FFFFFF"/);
  assert.doesNotMatch(html, /<feFlood/);
});

for (const emoji of ['W', '🇼', '😊', '🚀', '❤️', '🧲']) test(emoji + ' preserves custom colour, native toggle and exact geometry in storage', () => {
  const drawing = createDrawing('emoji', [{ time: 200, price: 200 }], emoji);
  drawing.style = { ...drawing.style, color: '#00AFFF', useThemeColor: false, emojiOriginalColors: false, fontSize: 72 };
  const restored = normalizeDrawings(JSON.parse(JSON.stringify([drawing])))[0];
  assert.deepEqual(restored.points, drawing.points);
  assert.equal(restored.text, emoji);
  assert.equal(restored.style.emojiOriginalColors, false);
  assert.equal(restored.style.fontSize, 72);
  assert.equal(resolveDrawColor(restored.style, '#FFFFFF'), '#00AFFF');
  const { html } = svgDrawingFixture('emoji', { drawings: [restored] });
  assert.match(html, /flood-color="#00AFFF"/);
  assert.match(html, /<feBlend[^>]*mode="color"/);
  restored.style.emojiOriginalColors = true;
  assert.doesNotMatch(svgDrawingFixture('emoji', { drawings: [restored] }).html, /<feFlood/);
});
