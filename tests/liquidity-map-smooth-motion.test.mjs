import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const { writeHeatRgba } = await import('data:text/javascript;base64,' + Buffer.from(read('public/heatmap-app/src/heat-raster.js')).toString('base64'));
const renderer = read('public/heatmap-app/src/renderer.js');
const oracleSource = renderer.slice(renderer.indexOf('export function interpolateHeatIntensity'), renderer.indexOf('export function bidAskVolumePercentages'));
const { interpolateHeatIntensity } = await import('data:text/javascript;base64,' + Buffer.from(oracleSource).toString('base64'));

export function referenceRaster(heatmap, palette, sourceX, width, rows, pixels) {
  for (let row = 0; row < rows; row++) for (let x = 0; x < width; x++) {
    const color = interpolateHeatIntensity(heatmap.intensities, heatmap.width, heatmap.height, sourceX + x, row, rows) * 3;
    const target = (row * width + x) * 4;
    pixels[target] = palette[color]; pixels[target + 1] = palette[color + 1];
    pixels[target + 2] = palette[color + 2]; pixels[target + 3] = 255;
  }
}

test('optimized heat pixels exactly match the existing renderer across geometry, palette and incremental strips', () => {
  const palette = Uint8ClampedArray.from({ length: 768 }, (_, i) => (i * 73 + 17) % 256);
  for (const [columns, levels, rows] of [[1, 1, 1], [31, 7, 101], [79, 211, 43], [1800, 112, 1080]]) {
    const heatmap = { width: columns, height: levels, intensities: Uint8ClampedArray.from({ length: columns * levels }, (_, i) => (i * 37 + Math.floor(i / columns) * 11) % 256) };
    const original = heatmap.intensities.slice();
    for (const [sourceX, width] of [[0, columns], [columns - 1, 1], [Math.floor(columns / 2), Math.ceil(columns / 2)]]) {
      const expected = new Uint8ClampedArray(width * rows * 4);
      const actual = new Uint8ClampedArray(expected.length);
      referenceRaster(heatmap, palette, sourceX, width, rows, expected);
      writeHeatRgba(heatmap, palette, sourceX, width, rows, actual);
      assert.deepEqual(actual, expected);
    }
    assert.deepEqual(heatmap.intensities, original, 'market intensities must not change');
  }
});

test('camera easing continues between market packets, with idle and inactive-pane budgets retained', () => {
  const main = read('public/heatmap-app/src/main.js');
  assert.match(main, /if \(\(this\.renderRequested \|\| this\.renderer\.cameraInMotion\) && canvasPaintDue\)/);
  assert.match(main, /workspaceEmbedded && !this\.workspacePresentationActive \? 50 : 0/);
  assert.match(renderer, /Math\.abs\(distance\) <= 0\.025[\s\S]*?this\.cameraInMotion = false/);
  assert.match(renderer, /writeHeatRgba\(heatmap, palette, sourceX, width, rasterRows, image\.data\)/);
  assert.match(main, /Never translate the shared canvas/);
  assert.doesNotMatch(main, /#sampleRestingBook/);
});

test('camera settles on the real target without new packets, overshoot or perpetual animation', () => {
  const source = renderer.slice(renderer.indexOf('  #smoothCameraCenter('), renderer.indexOf('  beginInteraction('));
  let now = 0;
  const smooth = new Function('performance', 'return ' + source.trim().replace('#smoothCameraCenter', 'function'))({ now: () => now });
  const camera = { cameraCenterTick: null };
  assert.equal(smooth.call(camera, 100, true), 100);
  let previous = 100;
  for (let frame = 0; frame < 240; frame++) {
    now += 1000 / 60;
    const center = smooth.call(camera, 108, true);
    assert.ok(center >= previous && center <= 108);
    previous = center;
  }
  assert.equal(previous, 108);
  assert.equal(camera.cameraInMotion, false);
  assert.equal(smooth.call(camera, 97, false), 97, 'manual pan must remain immediate');
});
