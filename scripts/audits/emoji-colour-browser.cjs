const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const {chromium}=require(path.resolve('tmp/chart-lock-browser/node_modules/playwright-core'));
const output=path.resolve('tmp/emoji-colour-bundle');
const config={mode:'development',devtool:false,entry:path.resolve('scripts/audits/emoji-colour-fixture.tsx'),output:{path:output,filename:'main.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':path.resolve('src')}},module:{rules:[{test:/\.(tsx?|css)$/,exclude:/node_modules/,use:path.resolve('scripts/audits/phone-fixture-loader.cjs')}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})]};
(async()=>{
 await new Promise((resolve,reject)=>{const c=webpack(config);c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||s.toString({all:false,errors:true})):resolve()));});
 const css=fs.readdirSync('../kwantdesk-position-viewport-release/.next/static/css').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('../kwantdesk-position-viewport-release/.next/static/css/'+f)).join('\n');
 const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/main.js'?'text/javascript; charset=utf-8':req.url==='/style.css'?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/main.js'?fs.readFileSync(path.join(output,'main.js')):req.url==='/style.css'?css:'<html><head><link rel="stylesheet" href="/style.css"><style>:root{--background:#000;--foreground:#fff;--primary:#fff;--on-primary:#000;--muted:#aaa;--border:#444;--panel:#111;--surface:#222}body{margin:0}</style></head><div id="root"></div><script src="/main.js"></script></html>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1000,height:750}});page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin);
  const glyph=page.locator('[data-chart-drawing-id] text').first();await glyph.waitFor();assert.equal(await glyph.getAttribute('fill'),'#FFFFFF','new monochrome emoji follows theme, not black SVG default');
  await page.locator('[data-painted-hit]').first().dblclick();await page.getByRole('button',{name:'Emoji colour',exact:true}).click();
  const hex=page.getByRole('textbox',{name:'Emoji colour hex code'});await hex.fill('FF3B5C');await page.getByRole('button',{name:'Emoji colour',exact:true}).click();
  assert.equal(await glyph.getAttribute('fill'),'#FF3B5C');assert.ok(await glyph.getAttribute('filter'),'custom tint is connected');
  let saved=JSON.parse(await page.locator('output').textContent());assert.equal(saved.style.emojiOriginalColors,false);assert.equal(saved.style.useThemeColor,false);
  await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Restore',exact:true}).click();assert.equal(await glyph.getAttribute('fill'),'#FF3B5C','colour survives persistence');
  await page.getByRole('button',{name:'Face',exact:true}).click();
  // Rasterise the actual SVG to verify full-colour glyph pixels respond,
  // rather than accepting a connected-but-ineffective fill property.
  const raster=()=>page.locator('section>svg').evaluate(async svg=>{const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');const image=new Image(),url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));try{image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=800;canvas.height=500;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(170,170,60,60).data;let red=0,blue=0,green=0,alpha=0;for(let i=0;i<data.length;i+=4){red+=data[i]*data[i+3];green+=data[i+1]*data[i+3];blue+=data[i+2]*data[i+3];alpha+=data[i+3]}return{red,green,blue,alpha}}finally{URL.revokeObjectURL(url)}});
  const red=await raster();assert.ok(red.alpha>0);
  await page.locator('[data-painted-hit]').first().dblclick();await page.getByRole('button',{name:'Emoji colour',exact:true}).click();await hex.fill('00AFFF');await page.getByRole('button',{name:'Emoji colour',exact:true}).click();const blue=await raster();assert.ok(blue.blue>red.blue&&red.red>blue.red,'native colour emoji really changes tint');
  const original=page.locator('input[type=checkbox]').first();await original.check();assert.equal(await glyph.getAttribute('filter'),null,'original colours are restored');
  saved=JSON.parse(await page.locator('output').textContent());assert.equal(saved.style.emojiOriginalColors,true);assert.deepEqual(saved.points,[{time:200,price:200}]);assert.equal(saved.style.fontSize,36);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,nativeGlyphRaster:{red,blue},pageErrors:errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

