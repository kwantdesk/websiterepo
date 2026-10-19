import test from 'node:test';
import assert from 'node:assert/strict';
import { navigatorPreviewDomain } from '../../public/gex-data-app/navigator-ui.js';

test('price navigator preserves intraday movement rather than flattening against zero', () => {
  const values = [743.25, 744.5, 742.75, 743.5];
  const domain = navigatorPreviewDomain(values), height = 36;
  const y = value => height - (value - domain.min) / (domain.max - domain.min) * height;
  assert.ok(domain.min > 742);
  assert.ok(Math.abs(y(744.5) - y(742.75)) > height * .85);
  assert.deepEqual(values, [743.25, 744.5, 742.75, 743.5]);
});

test('preview domains respect sub-dollar contracts, negative Greeks and optional volume zero', () => {
  const micro = navigatorPreviewDomain([.0021, .0023, .0022]);
  assert.ok(micro.min > .002 && micro.max < .0024);
  const signed = navigatorPreviewDomain([-4, 3, -1]);
  assert.ok(signed.min < -4 && signed.max > 3);
  const volume = navigatorPreviewDomain([2500, 6000], { includeZero: true, padding: 0 });
  assert.deepEqual(volume, { min: 0, max: 6000 });
});

test('missing values do not invent zero observations and constant paths remain visible', () => {
  assert.equal(navigatorPreviewDomain([null, undefined, NaN, Infinity]), null);
  const domain = navigatorPreviewDomain([null, 8, undefined, 8, NaN]);
  assert.ok(domain.min < 8 && domain.max > 8);
  const zero = navigatorPreviewDomain([0, 0]);
  assert.ok(zero.min < 0 && zero.max > 0);
});

test('large preview sources avoid argument-limit overflow', () => {
  const values = Array.from({ length: 200_000 }, (_, index) => index % 7);
  const domain = navigatorPreviewDomain(values);
  assert.ok(Number.isFinite(domain.min) && Number.isFinite(domain.max));
  assert.ok(domain.min <= 0 && domain.max >= 6);
});
