import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../../public/gex-data-app/styles.css', import.meta.url), 'utf8');
const table = readFileSync(new URL('../../public/gex-data-app/table-view.js', import.meta.url), 'utf8');
const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `Missing ${selector} rule`);
  return match[1];
};
const rgb = hex => hex.replace('#', '').match(/../g).map(value => parseInt(value, 16));
const luminance = channels => channels.map(value => {
  const channel = value / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

test('table progress tints its existing semantic colour without fading text or changing data width', () => {
  const progress = rule('.qtable-cell-progress');
  assert.match(progress, /opacity:\s*\.16\s*;/);
  assert.match(progress, /z-index:\s*0\s*;/);
  assert.match(progress, /pointer-events:\s*none\s*;/);
  assert.doesNotMatch(rule('.qtable-cell-value'), /opacity:/);
  assert.match(rule('.qtable-cell-value'), /z-index:\s*1\s*;/);
  assert.match(rule('.qtable-cell-hint'), /z-index:\s*1\s*;/);
  assert.match(table, /progress\.style\.width = `\$\{fraction \* 100\}%`/);
  assert.match(table, /progress\.style\.background = column\.bar === 'primary'\?themePaint\("#700FEC"\)/);
});

test('numeric text stays readable over full-width theme fills in dark, light and saturated palettes', () => {
  const opacity = Number(rule('.qtable-cell-progress').match(/opacity:\s*([\d.]+)/)[1]);
  const fixtures = [
    { name: 'white-on-black mono', background: '#000000', foreground: '#FFFFFF' },
    { name: 'black-on-white inverted mono', background: '#FFFFFF', foreground: '#000000' },
    { name: 'dark purple', background: '#10041F', foreground: '#F4EFFF' },
    { name: 'deep sea', background: '#00171F', foreground: '#E8FCFF' },
    { name: 'warm paper', background: '#F4EBDD', foreground: '#241B17' },
  ];
  for (const fixture of fixtures) {
    for (const fill of ['#FFFFFF', '#000000', '#FF0055', '#00FF00', '#0088FF', '#700FEC']) {
      const background = rgb(fixture.background), ink = rgb(fixture.foreground), color = rgb(fill);
      const painted = background.map((channel, index) => channel * (1 - opacity) + color[index] * opacity);
      assert.ok(contrast(ink, painted) >= 4.5, `${fixture.name} / ${fill} text contrast`);
    }
  }
  // The observed previous solid white fill made white labels disappear.
  assert.equal(contrast(rgb('#FFFFFF'), rgb('#FFFFFF')), 1);
});

test('Refresh uses the website surface and foreground instead of a mapped solid-primary gradient', () => {
  const refresh = rule('.tool-actions button:first-child');
  assert.match(refresh, /background:\s*var\(--site-surface\)/);
  assert.match(refresh, /color:\s*var\(--site-foreground\)/);
  assert.match(refresh, /border-color:\s*var\(--site-border\)/);
  assert.doesNotMatch(refresh, /gradient|--gex-/);
});
