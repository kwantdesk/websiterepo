import assert from 'node:assert/strict';
import test from 'node:test';
import { DAILY_TPO_SESSION_PRESETS, selectedTpoQuickSessions, toggleTpoQuickSession } from '../src/lib/tpo/quickSessions.ts';
import { defaultTpoSettings, validateTpoSettings, tpoSettingsToRecord, tpoCalculationSettingsKey } from '../src/lib/tpo/settings.ts';
import { buildTpoProfiles } from '../src/lib/tpo/engine.ts';

test('quick sessions toggle independently, migrate old presets, and survive saved settings', () => {
  let selection = toggleTpoQuickSession({}, 'globex');
  selection = toggleTpoQuickSession({ quickSessions: selection }, 'rth');
  assert.equal(selection, 'rth,globex');
  selection = toggleTpoQuickSession({ quickSessions: selection }, 'rth');
  assert.equal(selection, 'globex');
  assert.equal(toggleTpoQuickSession({ quickSessions: selection }, 'globex'), '');
  assert.deepEqual(selectedTpoQuickSessions(DAILY_TPO_SESSION_PRESETS[0].settings), ['rth']);
  const base = defaultTpoSettings('daily-tpo', undefined, 'NQ');
  const restored = validateTpoSettings(tpoSettingsToRecord({ ...base, quickSessions: 'london,rth,london,invalid' }), 'daily-tpo', undefined, 'NQ');
  assert.equal(restored.quickSessions, 'rth,london');
  assert.notEqual(tpoCalculationSettingsKey(base), tpoCalculationSettingsKey(restored));
  assert.equal(validateTpoSettings(tpoSettingsToRecord(restored), 'daily-tpo', undefined, 'NQ').quickSessions, restored.quickSessions);
  assert.equal(validateTpoSettings({ ...tpoSettingsToRecord(restored), quickSessions: '' }, 'daily-tpo', undefined, 'NQ').quickSessions, '');
});

// Covers the New York DST change while London/Tokyo/Sydney use their own clocks.
const start = Date.UTC(2026, 9, 30), nowMs = Date.UTC(2026, 10, 4);
const bars = Array.from({ length: (nowMs - start) / 1_800_000 }, (_, index) => ({
  instrumentId: 'NQ', startTimeMs: start + index * 1_800_000,
  endTimeMs: start + (index + 1) * 1_800_000,
  open: 20000, high: 20001, low: 19999, close: 20000.25, volume: index + 1, tickSize: .25,
}));
const base = { ...defaultTpoSettings('daily-tpo', undefined, 'NQ'), visitSource: 'bar-range', profileCount: 0 };

test('all six selected sessions retain their exact standalone boundaries, rows and totals', () => {
  const profiles = buildTpoProfiles({ bars, trades: [], nowMs, settings: { ...base, quickSessions: DAILY_TPO_SESSION_PRESETS.map(p => p.id).join(',') } });
  assert.equal(new Set(profiles.map(p => p.id)).size, profiles.length);
  for (const preset of DAILY_TPO_SESSION_PRESETS) {
    const expected = buildTpoProfiles({ bars, trades: [], nowMs, settings: {
      ...base, ...preset.settings, quickSessions: '', enabledWeekdays: preset.settings.enabledWeekdays.split(',').map(Number),
    } });
    assert.ok(expected.length > 0, preset.id);
    assert.deepEqual(profiles.filter(p => p.id.startsWith(`quick:${preset.id}:`)), expected.map(p => ({ ...p, id: `quick:${preset.id}:${p.id}` })));
  }
});

test('deselecting one session removes only its profiles and default/custom ranges still work', () => {
  const both = buildTpoProfiles({ bars, trades: [], nowMs, settings: { ...base, quickSessions: 'rth,globex' } });
  const remaining = buildTpoProfiles({ bars, trades: [], nowMs, settings: { ...base, quickSessions: 'globex' } });
  assert.deepEqual(remaining, both.filter(p => p.id.startsWith('quick:globex:')));
  const custom = { ...base, scheduleKind: 'custom-range', periodMode: 'custom-range', customStartMs: start, customEndMs: start + 3_600_000 };
  assert.deepEqual(buildTpoProfiles({ bars, trades: [], nowMs, settings: { ...custom, quickSessions: 'rth,globex' } }), buildTpoProfiles({ bars, trades: [], nowMs, settings: { ...custom, quickSessions: '' } }));
  assert.ok(buildTpoProfiles({ bars, trades: [], nowMs, settings: base }).length > 0);
});
