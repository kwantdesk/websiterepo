import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMarketSharePieLabels, drawMarketSharePie } from '../../public/gex-data-app/options-models.js';

function descriptors(angles) { return angles.map((angle, index) => ({ midAngle: angle, halfHeight: 14, textWidth: index % 2 ? 42 : 56, lines: [`EX${index}`, '12.34%'] })); }
function verify(layout, width, height) {
  for (const label of layout.labels) {
    assert.ok(label.bounds.left >= 0 && label.bounds.right <= width);
    assert.ok(label.bounds.top >= -1e-8 && label.bounds.bottom <= height);
  }
  for (let a = 0; a < layout.labels.length; a++) for (let b = a + 1; b < layout.labels.length; b++) {
    const x = layout.labels[a].bounds, y = layout.labels[b].bounds;
    assert.ok(!(x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom), `overlap ${a}/${b}`);
  }
}

test('adjacent bottom labels separate deterministically at narrow and wide canvas sizes', () => {
  const labels = descriptors([1.48, 1.5, 1.52, 1.54, 1.56, 1.58, 1.60, 1.62, 1.64, 1.66, 1.68]);
  for (const width of [320, 640, 1280]) {
    const layout = layoutMarketSharePieLabels(labels, width, 320, 99.2);
    verify(layout, width, 320);
    assert.equal(layout.labels.length, labels.length);
    assert.deepEqual(labels.map(row => row.midAngle), [1.48, 1.5, 1.52, 1.54, 1.56, 1.58, 1.60, 1.62, 1.64, 1.66, 1.68]);
  }
});

test('nineteen crowded sectors fit 320px using spare opposite-side space without changing angles', () => {
  const labels = descriptors(Array.from({ length: 19 }, (_, index) => 1.1 + index * .015));
  const layout = layoutMarketSharePieLabels(labels, 320, 320, 99.2);
  verify(layout, 320, 320);
  assert.equal(layout.labels.length, 19);
  assert.deepEqual(layout.labels.map(row => row.midAngle).sort(), labels.map(row => row.midAngle).sort());
});

test('pie slice angles, original percentages, ordering and colors remain unchanged', () => {
  const arcs = [], texts = [], ctx = { beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, arc(...args) { arcs.push(args); }, fillText(...args) { texts.push(args); }, measureText(text) { return { width: text.length * 7 }; } };
  const entries = [{ name: 'SPHR', value: 20, color: '#123456' }, { name: 'GEMX', value: 30, color: '#654321' }, { name: 'NOM', value: 50, color: '#abcdef' }];
  const result = drawMarketSharePie(ctx, 640, 640, entries, { formatPercent: fraction => `${fraction * 100}%` });
  assert.deepEqual(result.cumulativeAngles, [.2, .5, 1]);
  assert.equal(result.radius, 640 / 2 * .62);
  assert.equal(arcs.length, 3);
  assert.equal(arcs[0][3], -Math.PI / 2);
  assert.equal(arcs[2][4], Math.PI * 2 - Math.PI / 2);
  assert.deepEqual(texts.filter(([text]) => text.endsWith('%')).map(([text]) => text).sort(), ['20%', '30%', '50%']);
  verify(result, 640, 640);
});

test('label layout is bounded across deterministic sector distributions', () => {
  const started = performance.now();
  for (let pass = 0; pass < 1000; pass++) {
    const labels = descriptors(Array.from({ length: 19 }, (_, index) => ((index * 37 + pass * 13) % 360) * Math.PI / 180 - Math.PI / 2));
    verify(layoutMarketSharePieLabels(labels, 320, 320, 99.2), 320, 320);
  }
  const elapsed = performance.now() - started;
  console.log(`1000 x19-label layouts plus pairwise verification: ${elapsed.toFixed(1)}ms`);
  assert.ok(elapsed < 3000);
});
