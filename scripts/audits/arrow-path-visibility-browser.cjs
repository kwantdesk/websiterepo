const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
const { chromium } = require(path.resolve('tmp/chart-lock-browser/node_modules/playwright-core'));
const output = path.resolve('tmp/arrow-path-visibility-bundle');
const alias = {};
if (process.env.PATH_BASELINE) {
  fs.mkdirSync(output, { recursive: true });
  const source = require('node:child_process').execFileSync('git', ['show', 'HEAD:src/components/ChartDrawLayer.tsx'], { encoding: 'utf8' });
  const baseline = path.join(output, 'ChartDrawLayer-before.tsx');
  fs.writeFileSync(baseline, source.replace("from './useChartDrawingClipboard'", "from '@/components/useChartDrawingClipboard'"));
  alias['@/components/ChartDrawLayer$'] = baseline;
}
alias['@'] = path.resolve('src');
const config = { mode: 'development', devtool: false, entry: path.resolve('scripts/audits/arrow-path-visibility-fixture.tsx'), output: { path: output, filename: 'main.js' }, resolve: { extensions: ['.tsx', '.ts', '.js'], alias }, module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.resolve('scripts/audits/phone-fixture-loader.cjs') }] }, plugins: [new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('development') })] };
(async () => {
  await new Promise((resolve, reject) => { const compiler = webpack(config); compiler.run((e, s) => compiler.close(() => e || s.hasErrors() ? reject(e || s.toString({ all: false, errors: true })) : resolve())); });
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/main.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/main.js' ? fs.readFileSync(path.join(output, 'main.js')) : '<html><style>body{margin:0}section>svg{position:absolute;inset:0}button{height:40px}</style><div id="root"></div><script src="/main.js"></script></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    const svg = page.locator('section>svg');
    await svg.waitFor();
    const box = await svg.boundingBox();
    const click = (x, y) => page.mouse.click(box.x + x, box.y + y);
    const points = () => svg.locator('polyline').first().getAttribute('points');
    await click(100, 120); await click(210, 250); await click(340, 140);
    await page.mouse.move(box.x + 420, box.y + 280);
    assert.match(await points(), /420,280$/, 'hover leg follows mouse');
    await page.getByRole('button', { name: 'Cursor', exact: true }).hover();
    assert.equal(await svg.locator('polyline').count(), 1, 'placed path stays visible outside plot');
    assert.equal(await points(), '100,120 210,250 340,140', 'leaving removes only hover leg');
    await page.mouse.move(box.x + 450, box.y + 320);
    assert.match(await points(), /450,320$/, 're-entry restores hover leg without losing anchors');
    await page.evaluate(() => {
      window.pathFrames = [];
      window.samplePath = true;
      const sample = () => { if (!window.samplePath) return; window.pathFrames.push(document.querySelectorAll('section svg polyline').length); requestAnimationFrame(sample); }; sample();
    });
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    await page.waitForTimeout(180);
    assert.equal(await points(), '100,120 210,250 340,140', 'cursor commits just clicked anchors');
    const committed = JSON.parse(await page.locator('output').textContent());
    assert.equal(committed.length, 1); assert.equal(committed[0].points.length, 3);
    const frames = await page.evaluate(() => { window.samplePath = false; return window.pathFrames; });
    assert.ok(frames.length > 2 && frames.every(n => n > 0), 'no blank frame while moving to/selecting Cursor');
    await page.getByRole('button', { name: 'New path', exact: true }).click();
    await click(120, 110); await click(230, 240);
    await page.mouse.dblclick(box.x + 350, box.y + 160);
    assert.equal(JSON.parse(await page.locator('output').textContent()).length, 1, 'double-click still finishes once');
    await page.getByRole('button', { name: 'New path', exact: true }).click();
    await click(120, 110);
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    assert.equal(JSON.parse(await page.locator('output').textContent()).length, 0, 'one anchor is still discarded');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, sampledFrames: frames.length, pageErrors: errors }));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
