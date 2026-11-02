import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../src/components/ChartCornerBadges.tsx', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText, { module, exports: module.exports, require: createRequire(import.meta.url) });
const CornerBadges = module.exports.default;
const render = (patch = {}) => renderToStaticMarkup(React.createElement(CornerBadges, {
  bottomInset: 364, topInset: 80, leftInset: 48, priceScaleWidth: 60,
  badges: [
    { id: 'gamma', position: 'bottom-right', content: React.createElement('div', { style: { zoom: 2 } }, 'Gamma') },
    { id: 'vix', position: 'bottom-right', content: React.createElement('div', null, 'VIX') },
    { id: 'timer', position: 'bottom-right', flushToEdge: true, content: '00:42' },
  ], ...patch,
}));

test('bottom-right badges use the price-pane boundary and countdown is last', () => {
  const html = render();
  assert.match(html, /data-chart-corner="bottom-right"[^>]*bottom:364px;right:0/);
  assert.ok(html.indexOf('data-chart-corner-badge="gamma"') < html.indexOf('data-chart-corner-badge="vix"'));
  assert.ok(html.indexOf('data-chart-corner-badge="vix"') < html.indexOf('data-chart-corner-badge="timer"'));
  assert.match(html, /data-chart-corner-badge="timer"[^>]*margin-right:0/);
  assert.match(html, /zoom:2/);
  assert.match(render({ bottomInset: 504 }), /bottom:504px/);
});

test('all other corners clear the docked panes, and absent badges add no item', () => {
  for (const position of ['top-left', 'top-middle', 'top-right', 'bottom-left', 'bottom-middle']) {
    const html = render({ badges: [{ id: 'gamma', position, content: 'Gamma' }, { id: 'empty', position, content: null }] });
    assert.ok(html.includes(`data-chart-corner="${position}"`));
    assert.doesNotMatch(html, /data-chart-corner-badge="empty"/);
    assert.ok(html.includes(position.startsWith('top') ? 'top:92px' : 'bottom:372px'));
  }
});

test('the actual chart supplies both pane offsets and leaves countdown positioning to the stack', () => {
  const chart = readFileSync(new URL('../src/components/Chart.tsx', import.meta.url), 'utf8');
  assert.match(chart, /<ChartCornerBadges\s+bottomInset=\{indicatorPaneHeight \+ CHART_TIME_AXIS_HEIGHT\}\s+topInset=\{topIndicatorPaneHeight\}/);
  const start = chart.indexOf('function CandleCountdownBadge('), end = chart.indexOf('function formatPriceDistance', start);
  assert.doesNotMatch(chart.slice(start, end), /absolute|bottom-0|right-0/);
  assert.ok(chart.indexOf('id: "gamma-environment", position: gammaEnvironmentPosition') < chart.indexOf('id: "candle-countdown", position: "bottom-right"'));
});
