import test from 'node:test';
import assert from 'node:assert/strict';
import { CHART_INDICATOR_CATALOG } from '../src/lib/chartIndicatorCatalog.ts';
import { defaultIndicatorSettings, normalizeStoredIndicator } from '../src/lib/chartIndicatorConfig.ts';
import { paletteRolesFor, settingsWithPalette } from '../src/lib/indicatorPaletteRegistry.ts';
import { VOLUME_PROFILE_GRADIENTS } from '../src/lib/volumeProfileGradients.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
const theme = { primary: '#111111', secondary: '#222222', positive: '#22CC55', negative: '#DD3344', muted: '#555555' };
test('every selectable indicator gradient survives save, JSON storage and restore', () => { for (const d of CHART_INDICATOR_CATALOG) {
    for (const gradient of VOLUME_PROFILE_GRADIENTS) {
        const saved = normalizeStoredIndicator({ instanceId: 'audit', indicatorId: d.id, enabled: true, settings: { ...defaultIndicatorSettings(d.id), gradientPreset: gradient.id } });
        const restored = normalizeStoredIndicator(JSON.parse(JSON.stringify(saved)));
        assert.equal(restored.settings.gradientPreset, gradient.id, d.id + ' ' + gradient.id);
        const rendered = settingsWithPalette(restored, theme);
        if (paletteRolesFor(d.id).length)
            assert.notEqual(rendered, restored, d.id + ' scheme did not resolve');
    }
} });
test('every actual colour picker survives normalization', () => { for (const d of CHART_INDICATOR_CATALOG) {
    for (const role of paletteRolesFor(d.id)) {
        const saved = normalizeStoredIndicator({ instanceId: 'audit', indicatorId: d.id, enabled: true, settings: { ...defaultIndicatorSettings(d.id), useThemeColors: false, [role.key]: '#12AB34' } });
        assert.equal(String(saved.settings[role.key]).toUpperCase(), '#12AB34', d.id + '.' + role.key);
    }
} });
test('auto-colour modes are never exposed or rewritten as hex colour pickers', () => { for (const id of ['stop-spotter', 'inverse-cyber-cycle']) {
    assert.ok(paletteRolesFor(id).every(role => !role.key.endsWith('AutoColor') && role.key !== 'autoColor'));
    const instance = { indicatorId: id, settings: { ...defaultIndicatorSettings(id), gradientPreset: 'pink-blue' } };
    const rendered = settingsWithPalette(instance, theme);
    for (const key of Object.keys(instance.settings).filter(key => /autoColor$/i.test(key)))
        assert.equal(rendered.settings[key], instance.settings[key]);
} });
test('Deep Delta saved range colours reach the actual histogram output', () => { const candles = Array.from({ length: 12 }, (_, i) => ({ timestamp: 1700000000000 + i * 60000, open: 100, high: 101, low: 99, close: 100, volume: 10, askVolume: 6, bidVolume: 4, delta: 2, deltaClose: 2, deltaHigh: 2, deltaLow: 0 })); const saved = normalizeStoredIndicator({ instanceId: 'audit', indicatorId: 'deep-delta', enabled: true, settings: { ...defaultIndicatorSettings('deep-delta'), useThemeColors: false, range1AskColor: '#12AB34' } }); const series = calculateIndicatorSeries(saved, candles, theme, { instrument: 'NQ', tickSize: .25 }); assert.ok(series.some(s => s.data.length > 0 && s.color?.toUpperCase() === '#12AB34')); });
