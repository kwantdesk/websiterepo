import '../scripts/alias-hook.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/bounceLevelsPrimitive.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source + '\nexport { traceRibbon, ribbonGradient };', {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replaceAll('"@/lib/gexMapFormat"', JSON.stringify(new URL('../src/lib/gexMapFormat.ts', import.meta.url).href));
const { bounceRibbonExtensionRight, traceRibbon, ribbonGradient } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('only the last available observation projects, including when panned beyond the close', () => {
  assert.equal(bounceRibbonExtensionRight(true, 2000, 2000, 100, 800), 800);
  assert.equal(bounceRibbonExtensionRight(true, 2000, 2000, -500, 800), 800);
  assert.equal(bounceRibbonExtensionRight(false, 2000, 2000, 100, 800), undefined);
  assert.equal(bounceRibbonExtensionRight(true, 1000, 2000, 100, 800), undefined, 'a retired run must not return');
  assert.equal(bounceRibbonExtensionRight(true, 2000, 2000, 900, 800), undefined, 'never pull a future endpoint back into view');
});

test('projection keeps the closing height and price rather than widening or tapering it', () => {
  for (const momentum of ['stable', 'building', 'weakening', 'dumped']) {
    const points = [{ sliceIndex: 0, x: 90, left: 80, right: 100, y: 200, height: 12,
      heightScale: 1, color: '#ff00ff', opacity: .7, momentum }];
    const before = JSON.stringify(points);
    const segments = [];
    const context = { beginPath() {}, moveTo: (...xy) => segments.push(xy), lineTo: (...xy) => segments.push(xy),
      quadraticCurveTo() { throw Error('The extended closing edge must remain square'); }, closePath() {} };
    const edge = traceRibbon(context, points, 1, 0, undefined, 800);
    assert.deepEqual(edge, { edgeX: 800, edgeY: 200, edgeHalfHeight: 6 });
    assert.ok(segments.some(([x,y]) => x === 800 && y === 194));
    assert.ok(segments.some(([x,y]) => x === 800 && y === 206));
    const stops = [];
    ribbonGradient({ createLinearGradient: () => ({ addColorStop: (...stop) => stops.push(stop) }) }, points, 800, 1, 48, true, 800);
    assert.deepEqual(stops.at(-1), [1, 'rgba(255,0,255,0.7)']);
    assert.equal(JSON.stringify(points), before, 'projection must not mutate recorded exposure');
  }
});

test('the existing saved flag defaults off and is connected to both the settings and chart', () => {
  const settings = readFileSync(new URL('../src/components/gex-map/BounceGexMapSettings.tsx', import.meta.url), 'utf8');
  const chart = readFileSync(new URL('../src/components/Chart.tsx', import.meta.url), 'utf8');
  const defaults = readFileSync(new URL('../src/lib/chartIndicatorConfig.ts', import.meta.url), 'utf8');
  assert.match(settings, /checked=\{settings.extendRight === true\}/);
  assert.match(settings, /onChange\(\{ extendRight: event.target.checked \}\)/);
  assert.match(chart, /extendRight: indicatorSettings.extendRight === true/);
  assert.match(defaults, /extendRight: false/);
  assert.match(source, /slices\[last.sliceIndex\]\.timestamp, finalTimestamp/);
});
