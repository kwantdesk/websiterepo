import test from 'node:test';
import assert from 'node:assert/strict';
import { projectionFixture } from './fixtures/bounceProjection.ts';
import { buildGexMapSnapshots, gexMapPriceAt } from '../src/lib/gexMapSnapshots.ts';
import { prepareBounceGexMirror, selectBounceGexMirror } from '../src/lib/bounceGexMapMirror.ts';
import { DEFAULT_LINKED_GEX_MAP_SETTINGS } from '../src/lib/gexMapLinkedSettings.ts';
import { replayCandlesAtClock } from '../src/lib/replayChartHistory.ts';
import { replayCausalTrades } from '../src/lib/replayIndicatorSafety.ts';
import { replayProfileJobs, replayProfileWithinClock } from '../src/lib/replayVolumeProfiles.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { defaultIndicatorSettings } from '../src/lib/chartIndicatorConfig.ts';
import { buildFootprintBars } from '../src/lib/footprint.ts';
import { workspaceReplayClockParts, selectWorkspaceReplaySession } from '../src/lib/workspaceReplay.ts';
import { createGexVueReplayState } from '../src/lib/gexVueReplay.ts';

const theme = { primary: '#fff', secondary: '#aaa', positive: '#0f0', negative: '#f00', muted: '#888' };
const fixture = projectionFixture();
const prints = fixture.payload.candles.flatMap((bar, i) => [1000, 20000, 45000].map((offset, j) => {
  const price = 20000 + i + j * .25, volume = j + 1, bidVolume = j === 1 ? volume : 0, askVolume = j === 1 ? 0 : volume;
  return { timestamp: bar.timestamp + offset, recordIndex: i * 3 + j, eventId: `recorded-${i}-${j}`,
    open: price, high: price, low: price, close: price, volume, trades: 1,
    bidVolume, askVolume, delta: askVolume - bidVolume, aggressor: j === 1 ? 'SELL' : 'BUY', sideSemanticsVersion: 2 };
}));
const bars = fixture.payload.candles.map((bar, i) => ({ ...bar, open: 20000 + i, high: 20000 + i + .5,
  low: 20000 + i, close: 20000 + i + .5, volume: 6, trades: 3, bidVolume: 2, askVolume: 4, delta: 2 }));

test('every display zone selects the same shared exchange instant across US DST', () => {
  const state = createGexVueReplayState(Date.parse('2026-11-08T00:00Z'));
  for (const [date, instant] of [['2026-10-30', '2026-10-30T13:45Z'], ['2026-11-03', '2026-11-03T14:45Z']]) {
    const clock = Date.parse(instant);
    for (const zone of ['UTC', 'America/New_York', 'Australia/Brisbane', 'Pacific/Auckland', 'Europe/London']) {
      const parts = workspaceReplayClockParts(clock, zone);
      const replay = selectWorkspaceReplaySession(state, date, 'charts', parts.hour + ':' + parts.minute, zone);
      assert.equal(replay.timestampMs, clock, zone + ':' + date);
      assert.equal(replay.sessionDate, date);
    }
  }
});

test('GEX Map spot cannot see the final close of its forming minute', () => {
  const { payload, start } = fixture;
  assert.equal(gexMapPriceAt(payload, start - 1), null);
  assert.equal(gexMapPriceAt(payload, start), payload.candles[0].open);
  assert.equal(gexMapPriceAt(payload, start + 59999), payload.candles[0].open);
  const gap = { ...payload, candles: payload.candles.slice(0, 1) };
  assert.equal(gexMapPriceAt(gap, start + 60000), payload.candles[0].close);
  assert.equal(gexMapPriceAt(payload, null), payload.stockPrice, 'live spot stays unchanged');
});

test('Map and direct/futures Bounce reconstruct the same ladder through forward, rewind and repeated seeks', () => {
  for (const displayInstrument of ['QQQ', 'NQ', 'MNQ']) {
    const prepared = prepareBounceGexMirror({ payload: fixture.payload, settings: DEFAULT_LINKED_GEX_MAP_SETTINGS,
      displayInstrument, displayPriceAt: fixture.displayPriceAt, liveDisplayPrice: 99999, colorScale: ['#0ff', '#fff', '#f0f'] });
    for (const offset of [-1, 0, 30000, 61000, 180000, 45000, 120000, 0]) {
      const clock = fixture.start + offset, map = buildGexMapSnapshots(fixture.payload, clock, 1), bounce = selectBounceGexMirror(prepared, clock);
      if (offset < 0) { assert.equal(bounce, null); assert.equal(map.current.size, 0); continue; }
      assert.ok(bounce, displayInstrument + ':' + offset);
      assert.deepEqual(bounce.levels.map(n => [n.sourceStrike, n.signedExposure]).sort(), [...map.current.values()].map(n => [n.strike, n.net]).sort());
      assert.ok(bounce.exposureField.every(slice => slice.timestamp <= clock));
      assert.equal(bounce.mapping.sourceSpotPrice, fixture.payload.candles[Math.floor(offset / 60000)].open);
    }
  }
});

test('price, footprint, volume, CVD and delta advance and rewind on one exact execution cutoff', () => {
  for (const offset of [1000, 20000, 45000, 61000, 105000, 20000, 45000]) {
    const clock = fixture.start + offset;
    const tape = replayCausalTrades(prints, clock);
    const visible = replayCandlesAtClock(bars.filter(bar => bar.timestamp <= clock), tape, clock, 60000, false);
    const volume = visible.reduce((sum, bar) => sum + bar.volume, 0), delta = visible.reduce((sum, bar) => sum + bar.delta, 0);
    assert.equal(volume, tape.reduce((sum, trade) => sum + trade.volume, 0));
    assert.equal(delta, tape.reduce((sum, trade) => sum + trade.delta, 0));
    for (const id of ['volume', 'delta-bar', 'cumulative-volume-delta']) {
      const series = calculateIndicatorSeries({ instanceId: id, indicatorId: id, enabled: true, settings: defaultIndicatorSettings(id) }, visible, theme, { instrument: 'NQ', tickSize: .25, replayTimestampMs: clock });
      assert.ok(series.some(s => s.data.length), id);
      assert.ok(series.every(s => s.data.every(point => point.time <= clock / 1000)));
    }
    const footprint = buildFootprintBars(visible, tape, { tickSize: .25, groupTicks: 1, minimumTradeVolume: 0, maximumTradeVolume: 0,
      imbalanceMode: 'diagonal', minimumImbalancePercent: 300, minimumDelta: 0, includeZero: true, instrument: 'NQ' });
    assert.equal(footprint.reduce((sum, bar) => sum + bar.volume, 0), volume);
    for (const job of replayProfileJobs(visible, clock)) {
      assert.ok(job.endMs <= clock);
      assert.equal(replayProfileWithinClock({ coverageEndMs: job.endMs }, clock), true);
      assert.equal(replayProfileWithinClock({ coverageEndMs: clock + 1 }, clock), false);
    }
  }
});

test('whole-bar footprint summaries never create forming price/volume/wicks', () => {
  const clock = fixture.start + 20000;
  const poison = { ...prints[0], close: 99999, high: 99999, volume: 999999, footprintSummary: {} };
  const selected = bars.filter(bar => bar.timestamp <= clock);
  assert.deepEqual(replayCandlesAtClock(selected, [poison, ...prints], clock, 60000, false), replayCandlesAtClock(selected, prints, clock, 60000, false));
  assert.deepEqual(replayCandlesAtClock(selected, [poison], clock, 60000, false), [], 'no fake forming bar without real prints');
});

test('event bars stay hidden until their recorded closing execution', () => {
  const candle = { ...bars[0], sourceEndTimestamp: fixture.start + 45000 };
  assert.deepEqual(replayCandlesAtClock([candle], prints, fixture.start + 44999, 0, true), []);
  assert.deepEqual(replayCandlesAtClock([candle], prints, fixture.start + 45000, 0, true), [candle]);
});
