const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
const { chromium } = require(path.resolve('tmp/chart-lock-browser/node_modules/playwright-core'));
const output = path.resolve('tmp/polyline-completion-bundle');
const alias = {};
if (process.env.PATH_BASELINE) {
  fs.mkdirSync(output, { recursive: true });
  const source = require('node:child_process').execFileSync('git', ['show', 'HEAD:src/components/ChartDrawLayer.tsx'], { encoding: 'utf8' });
  const baseline = path.join(output, 'ChartDrawLayer-before.tsx');
  fs.writeFileSync(baseline, source.replace("from './useChartDrawingClipboard'", "from '@/components/useChartDrawingClipboard'"));
  alias['@/components/ChartDrawLayer$'] = baseline;
}
alias['@'] = path.resolve('src');
const config = { mode: 'development', devtool: false, entry: path.resolve('scripts/audits/polyline-completion-fixture.tsx'), output: { path: output, filename: 'main.js' }, resolve: { extensions: ['.tsx', '.ts', '.js'], alias }, module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.resolve('scripts/audits/phone-fixture-loader.cjs') }] }, plugins: [new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('development') })] };
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

    for(const tool of ['path','polyline']) {
      await page.getByRole('button',{name:'New '+tool,exact:true}).click();
      await click(100,120);await click(210,250);await click(340,140);
      await page.getByRole('button',{name:'Cursor',exact:true}).hover();
      assert.equal(await points(),'100,120 210,250 340,140',tool+' remains visible away from plot');
      await page.getByRole('button',{name:'Cursor',exact:true}).click();
      await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).length===1);
      let saved=JSON.parse(await page.locator('output').textContent());
      assert.equal(saved.length,1);assert.equal(saved[0].tool,tool);assert.equal(saved[0].points.length,3);
      assert.equal(await points(),'100,120 210,250 340,140',tool+' retains exact vertices');
      await page.getByRole('button',{name:'New '+tool,exact:true}).click();await click(100,120);
      await page.getByRole('button',{name:'Cursor',exact:true}).click();
      assert.equal(JSON.parse(await page.locator('output').textContent()).length,0,'single unfinished anchor discarded');
      await page.getByRole('button',{name:'New '+tool,exact:true}).click();await click(100,120);await click(210,250);
      await page.mouse.dblclick(box.x+340,box.y+140);
      await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).length===1);
      saved=JSON.parse(await page.locator('output').textContent());assert.equal(saved.length,1);assert.equal(saved[0].points.length,3,'double click adds only one last vertex');
      console.log('PASS',tool,'leave/Cursor/exact vertices/double-click/unfinished anchor');
    }
    for(const tool of ['trendLine','rectangle','brush','highlighter']) {
      await page.getByRole('button',{name:'New '+tool,exact:true}).click();
      if(['brush','highlighter'].includes(tool)){await page.mouse.move(box.x+100,box.y+120);await page.mouse.down();await page.mouse.move(box.x+250,box.y+220,{steps:8});await page.mouse.up();}
      else{await click(100,120);await click(250,220);}
      const before=await page.locator('output').textContent();assert.equal(JSON.parse(before).length,1,tool+' committed');
      await page.getByRole('button',{name:'Cursor',exact:true}).click();assert.equal(await page.locator('output').textContent(),before,tool+' preserved');
      console.log('PASS',tool,'completed drawing survives Cursor');
    }
    await page.getByRole('button',{name:'New trendLine',exact:true}).click();await click(100,120);
    await page.getByRole('button',{name:'New rectangle',exact:true}).click();await click(200,180);await click(350,300);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).length===1);
    assert.equal(JSON.parse(await page.locator('output').textContent())[0].tool,'rectangle','incomplete old tool does not leak into new tool');
    console.log('PASS incomplete fixed-point tool does not corrupt next tool');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, pageErrors: errors }));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
