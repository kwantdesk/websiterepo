import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIndicatorNumericValue, indicatorSliderModel, indicatorValueFromRail } from '../src/lib/indicatorNumericSlider.ts';
test('absolute price inputs preserve eight-decimal edits across billion-point bounds', () => { for (const value of [1e-8, -1e-8, 0.00000013, -.00000013, 7650.25])
    assert.equal(normalizeIndicatorNumericValue(value, 0, -1e9, 1e9, 1e-8), value); });
test('ordinary sliders retain their minimum-based step grid and clamp bounds', () => { assert.equal(normalizeIndicatorNumericValue(.35, 0, .1, 1, .2), .3); assert.equal(normalizeIndicatorNumericValue(-100, 0, .1, 1, .2), .1); assert.equal(normalizeIndicatorNumericValue(100, 0, .1, 1, .2), 1); assert.equal(normalizeIndicatorNumericValue(NaN, .5, .1, 1, .2), .5); });
test('wide absolute slider rails remain finite and return their zero centre exactly', () => { const model = indicatorSliderModel(0, -1e9, 1e9, 1e-8); assert.ok(Number.isFinite(model.railValue)); assert.equal(indicatorValueFromRail(500, model), 0); assert.equal(indicatorValueFromRail(model.railMin, model), -1e9); assert.equal(indicatorValueFromRail(model.railMax, model), 1e9); });
