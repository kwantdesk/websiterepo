import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeAuctionGapSettings, AUCTION_GAP_NUMERIC_SETTINGS, auctionGapSettingsSection } from '../src/lib/auctionGapSettings.ts';
import { defaultIndicatorSettings, LIVE_CHART_INDICATOR_IDS } from '../src/lib/chartIndicatorConfig.ts';
import { exportIndicatorTemplate, importIndicatorTemplate } from '../src/lib/indicatorTemplates.ts';
import { buildAuctionGapPlotModels } from '../src/lib/auctionGapPlot.ts';
const theme = { upColor: '#00ff00', downColor: '#ff00ff', borderUpColor: '#aaffaa', borderDownColor: '#ffaaff', gridColor: '#333333', backgroundColor: '#000000' };
const candles = [{ timestamp: 1000, open: 100, close: 102, high: 103, low: 99 }, { timestamp: 1001, open: 102, close: 101, high: 104, low: 100 }];
const zone = (patch = {}) => ({ id: 'a', sourceBarId: 'bar', sourceIndex: 0, endIndex: 1,
  startTime: 1000, endTime: 1000, side: 'buy', lowTick: 400, highTick: 402, levelCount: 3,
  dominantVolume: 30, oppositeVolume: 0, provisional: false, state: 'fresh',
  triggeredAtBarId: null, triggeredAtIndex: null, stoppedBy: null, ...patch });
const plot = (zones = [zone()], settings = {}) => buildAuctionGapPlotModels(zones, candles, settings, .25, theme, 10);

test('numeric boundaries, booleans, enums and colour/string inputs normalize without coercing garbage', () => {
  const s = normalizeAuctionGapSettings({ minimumTickVolume: true, maximumOppositeVolume: ' ',
    extendedBars: 999999, markerSize: -4, opacity: '52.6', showTriggered: 'false',
    plotMode: 'bad', resetMode: 'session-open', customStartMinutes: 9999, buyColor: 'url(evil)', alertName: ' x ' });
  assert.equal(s.minimumTickVolume, 0); assert.equal(s.maximumOppositeVolume, 0);
  assert.equal(s.extendedBars, 10000); assert.equal(s.markerSize, 2); assert.equal(s.opacity, 53);
  assert.equal(s.showTriggered, true); assert.equal(s.plotMode, 'zones'); assert.equal(s.resetMode, 'session-open');
  assert.equal(s.customStartMinutes, 1439); assert.equal(s.buyColor, '#22c55e'); assert.equal(s.alertName, 'x');
  for (const field of AUCTION_GAP_NUMERIC_SETTINGS) assert.ok(field.max >= field.defaultValue && field.min <= field.defaultValue && field.step === 1);
});

test('all saved settings survive the real template export/import; release gate is on', () => {
  const settings = { ...defaultIndicatorSettings('auction-gap-tracker'), includeMode: 'wick-only', plotMode: 'marker-and-zones',
    markerPlacement: 'high', resetMode: 'eth-and-rth-open', filterTime: 'custom', customStartMinutes: 1020, customEndMinutes: 510,
    onlyTriggered: true, useThemeColors: false, buyColor: '#123456', alertMessage: 'My gap', alertSoundEnabled: true };
  const imported = importIndicatorTemplate('auction-gap-tracker', exportIndicatorTemplate({ indicatorId: 'auction-gap-tracker', name: 'All fields', settings }));
  assert.equal(imported.ok, true); assert.deepEqual(imported.settings, settings);
  assert.equal(LIVE_CHART_INDICATOR_IDS.has('auction-gap-tracker'), true);
  assert.equal(auctionGapSettingsSection('alertSoundEnabled'), 'Alerts'); assert.equal(auctionGapSettingsSection('extendedBars'), 'Style');
});

test('plots use exact chart indices/tick cells and respect reset ends instead of timestamp guessing', () => {
  const live = plot()[0];
  assert.equal(live.startLogical, 10); assert.equal(live.endLogical, 210);
  assert.equal(live.low, 99.875); assert.equal(live.high, 100.625);
  assert.equal(plot([zone({ stoppedBy: 'reset' })])[0].endLogical, 11);
  assert.equal(live.markerPrice, 99);
  assert.equal(plot([zone({ sourceIndex: 1 })])[0].markerPrice, 104);
});

test('plot modes, custom colours, theme changes and triggered visibility affect actual models', () => {
  assert.equal(plot()[0].color, '#00ff00');
  const settings = { plotMode: 'marker', markerPlacement: 'high', useThemeColors: false, buyColor: '#123456', opacity: 40 };
  const marker = plot(undefined, settings)[0];
  assert.equal(marker.showZone, false); assert.equal(marker.showMarker, true); assert.equal(marker.markerPrice, 103);
  assert.equal(marker.color, '#123456'); assert.equal(marker.opacity, .4);
  assert.equal(plot([zone({ state: 'triggered' })], { showTriggered: false }).length, 0);
  assert.equal(plot(undefined, { onlyTriggered: true }).length, 0);
  const changed = buildAuctionGapPlotModels([zone()], candles, {}, .25, { ...theme, upColor: '#ffff00' });
  assert.equal(changed[0].color, '#ffff00');
});

test('primitive reprojects during pan without a model update and detaches cleanly', () => {
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/auctionGapPrimitive.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; new Function('exports', code)(exports);
  const primitive = new exports.AuctionGapPrimitive(), calls = []; let pan = 0, redraws = 0;
  const context = new Proxy({}, { get(target, key) { return target[key] ?? ((...args) => calls.push([key, ...args])); },
    set(target, key, value) { target[key] = value; return true; } });
  primitive.attached({ chart: { timeScale: () => ({ logicalToCoordinate: index => index * 10 + pan }) },
    series: { priceToCoordinate: price => 200 - price }, requestUpdate: () => redraws++ });
  primitive.update(plot(undefined, { plotMode: 'marker-and-zones' })); assert.equal(redraws, 1);
  const target = { useMediaCoordinateSpace: draw => draw({ context, mediaSize: { width: 3000, height: 300 } }) };
  primitive.paneViews().forEach(view => view.renderer().draw(target));
  assert.equal(calls.find(c => c[0] === 'fillRect')[1], 100);
  assert.deepEqual(primitive.paneViews().map(v => v.zOrder()), ['bottom', 'top']);
  calls.length = 0; pan = 17; primitive.paneViews()[0].renderer().draw(target);
  assert.equal(calls.find(c => c[0] === 'fillRect')[1], 117);
  calls.length = 0; primitive.detached(); primitive.paneViews()[0].renderer().draw(target); assert.equal(calls.length, 0);
});

test('real settings component renders all include modes, exchange clocks and alert fields', () => {
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/components/AuctionGapIndicatorSettings.tsx', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === '@/lib/auctionGapSettings') return { normalizeAuctionGapSettings };
    if (id === '@/components/ui/KwantSelect') return { default: ({ menuLabel, ...props }) => React.createElement('select', { ...props, 'aria-label': menuLabel }) };
    throw Error(`Unexpected import ${id}`);
  }, exports);
  const render = (section, settings = {}) => renderToStaticMarkup(React.createElement(exports.default, { section, settings, onChange() {} }));
  const inputs = render('Inputs', { filterTime: 'custom', customStartMinutes: 1020, customEndMinutes: 510 });
  for (const value of ['intrabar', 'all', 'extreme-only', 'high-only', 'low-only', 'wick-only']) assert.ok(inputs.includes(`value="${value}"`));
  assert.ok(inputs.includes('17:00')); assert.ok(inputs.includes('08:30'));
  assert.ok(render('Style', { plotMode: 'marker' }).includes('Marker location'));
  assert.ok(!render('Style', { plotMode: 'zones' }).includes('Marker location'));
  const alerts = render('Alerts', { alertMessage: '<unsafe>' });
  assert.ok(alerts.includes('&lt;unsafe&gt;')); assert.ok(alerts.includes('Alert name'));
});
