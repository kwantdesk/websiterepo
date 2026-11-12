import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { calculateDeepEffortAverage } from '../src/lib/deepEffort.ts';
import { mergeLiveIndicatorCandle, LIVE_CHART_CANDLE_EVENT } from '../src/lib/chartLiveEvents.ts';
const chart = fs.readFileSync('src/components/Chart.tsx', 'utf8').replace(/\r\n/g, '\n');
const start = chart.indexOf('  useEffect(() => {\n    const instance = deepEffortIndicator;');
const end = chart.indexOf('\n  const imbalanceTracker = useMemo', start);
assert.ok(start > 0 && end > start);
function fixture(settings = { enableAlertSound: true, enableMessage: true, alertMessage: 'Bias change' }) {
    const window = new EventTarget(), messages = [], now = Date.now(), base = { timestamp: now - 60000, open: 100, high: 101, low: 99, close: 100, volume: 20 }, replay = { current: false };
    let cleanup;
    const context = { LIVE_CHART_CANDLE_EVENT, useEffect: effect => { cleanup = effect(); }, deepEffortIndicator: { instanceId: 'blocks', indicatorId: 'deep-effort', settings }, deepEffortOptions: { averageLength: 3 }, sampledIndicatorCandlesRef: { current: [{ ...base, timestamp: now - 180000 }, { ...base, timestamp: now - 120000 }, base] }, liveCandleEventKey: 'NQ:1m', liveReplayActiveRef: replay, calculateDeepEffortAverage, mergeLiveIndicatorCandle, window, Event, CustomEvent: class extends Event {
            constructor(type, args) { super(type); this.detail = args.detail; }
        }, instrument: 'NQ' };
    window.addEventListener('kwantdesk:chart-indicator-alert', event => messages.push(event.detail));
    vm.runInNewContext(ts.transpile(chart.slice(start, end), { target: ts.ScriptTarget.ES2022 }), context);
    const send = (close, overrides = {}) => window.dispatchEvent(new context.CustomEvent(LIVE_CHART_CANDLE_EVENT, { detail: { key: 'NQ:1m', sourceTimestampMs: Date.now(), candle: { ...base, timestamp: now, low: Math.min(99, close), high: Math.max(101, close), close }, ...overrides } }));
    return { messages, send, replay, cleanup: () => cleanup?.(), now };
}
test('Big Blocks alerts use fresh live bias transitions, with one alert per direction per bar', () => { const f = fixture(); f.send(80); assert.equal(f.messages.length, 1); assert.equal(f.messages[0].title, 'Bias change'); assert.equal(f.messages[0].popup, true); f.send(79); assert.equal(f.messages.length, 1); f.send(120); assert.equal(f.messages.length, 2); f.send(80); assert.equal(f.messages.length, 2); f.cleanup(); f.send(120); assert.equal(f.messages.length, 2); });
test('Big Blocks ignores replay, old observations, wrong instruments and older bars', () => { const f = fixture(); f.replay.current = true; f.send(80); f.replay.current = false; f.send(80, { sourceTimestampMs: Date.now() - 20000 }); f.send(80, { key: 'ES:1m' }); f.send(80, { candle: { timestamp: f.now - 120000, open: 100, high: 100, low: 80, close: 80, volume: 20 } }); assert.equal(f.messages.length, 0); f.send(80); assert.equal(f.messages.length, 1); f.cleanup(); });
test('Big Blocks keeps independently disabled message and sound choices', () => { const f = fixture({ enableAlertSound: false, enableMessage: true, alertMessage: 'Text only' }); f.send(80); assert.equal(f.messages[0]?.sound, null); assert.equal(f.messages[0]?.popup, true); f.cleanup(); const off = fixture({ enableAlertSound: false, enableMessage: false }); off.send(80); assert.equal(off.messages.length, 0); });
