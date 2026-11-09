const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const{chromium}=require(path.resolve('tmp/chart-lock-browser/node_modules/playwright-core'));
(async()=>{
const output=path.resolve('tmp/emoji-viewport-bundle');
const aliases={};
if(process.env.EMOJI_BASELINE)aliases['@/components/ChartDrawLayer$']=path.resolve('tmp/emoji-viewport-baseline.tsx');
aliases['@']=path.resolve('src');
await new Promise((resolve,reject)=>{const c=webpack({mode:'development',devtool:false,entry:path.resolve('scripts/audits/emoji-viewport-fixture.tsx'),output:{path:output,filename:'main.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.(tsx?|css)$/,exclude:/node_modules/,use:path.resolve('scripts/audits/phone-fixture-loader.cjs')}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})]});c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||s.toString({all:false,errors:true})):resolve()));});
const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/main.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/main.js'?fs.readFileSync(path.join(output,'main.js')):'<html><body style="margin:0;background:#111;color:white"><div id="root"></div><script src="/main.js"></script></body></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const p=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin);await p.locator('[data-chart-drawing-id] text').first().waitFor();await p.waitForTimeout(100);
 const read=()=>p.evaluate(()=>{const e=document.querySelector('[data-chart-drawing-id] text'),m=e.getScreenCTM(),box=e.getBoundingClientRect(),a=new DOMPoint(Number(e.getAttribute('x')),Number(e.getAttribute('y'))).matrixTransform(m);return{x:a.x,y:a.y,width:box.width,height:box.height,font:e.getAttribute('font-size')}});
 const initial=await read(),checks=[];
 for(const view of [{sx:1,sy:1,dx:65,dy:45},{sx:1.7,sy:.6,dx:30,dy:100},{sx:.6,sy:2,dx:200,dy:10},{sx:1.2,sy:1.2,dx:5,dy:20},{sx:1,sy:1,dx:0,dy:0}]){
  const immediate=await p.evaluate(v=>{window.gestureEmoji(v);const e=document.querySelector('[data-chart-drawing-id] text'),m=e.getScreenCTM(),r=e.getBoundingClientRect(),a=new DOMPoint(Number(e.getAttribute('x')),Number(e.getAttribute('y'))).matrixTransform(m);return{x:a.x,y:a.y,width:r.width,height:r.height}},view);
  const verify=(value,phase)=>{assert.ok(Math.abs(value.x-(200*view.sx+view.dx))<.02,phase+' x anchor');assert.ok(Math.abs(value.y-(200*view.sy+view.dy))<.02,phase+' y anchor');assert.ok(Math.abs(value.width-initial.width)<.02,phase+' glyph width');assert.ok(Math.abs(value.height-initial.height)<.02,phase+' glyph height');};
  verify(immediate,'before settle');await p.evaluate(()=>window.repaintEmoji());verify(await read(),'React commit');await p.waitForTimeout(130);verify(await read(),'after settle');checks.push({view,immediate,settled:await read()});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,initial,checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
