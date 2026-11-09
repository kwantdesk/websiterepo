const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const{chromium}=require(path.resolve('tmp/chart-lock-browser/node_modules/playwright-core'));
(async()=>{
const output=path.resolve('tmp/emoji-rotation-bundle');
const aliases={};
if(process.env.EMOJI_BASELINE)aliases['@/components/ChartDrawLayer$']=path.resolve('tmp/emoji-viewport-baseline.tsx');
aliases['@']=path.resolve('src');
await new Promise((resolve,reject)=>{const c=webpack({mode:'development',devtool:false,entry:path.resolve('scripts/audits/emoji-rotation-fixture.tsx'),output:{path:output,filename:'main.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:aliases},module:{rules:[{test:/\.(tsx?|css)$/,exclude:/node_modules/,use:path.resolve('scripts/audits/phone-fixture-loader.cjs')}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})]});c.run((e,s)=>c.close(()=>e||s.hasErrors()?reject(e||s.toString({all:false,errors:true})):resolve()));});
const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/main.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/main.js'?fs.readFileSync(path.join(output,'main.js')):'<html><body style="margin:0;background:#111;color:white"><div id="root"></div><script src="/main.js"></script></body></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const p=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin);await p.locator('[data-chart-drawing-id] text').first().waitFor();await p.waitForTimeout(100);

 const state=()=>p.evaluate(()=>window.readEmoji());
 const handle=()=>p.locator('[data-emoji-transform-handle] circle').last().boundingBox();
 const center={x:200,y:200},radius=Math.hypot(24,24);
 let box=await handle();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();
 const checks=[];
 for(let degrees=0;degrees<=360;degrees+=30){const angle=(45+degrees)*Math.PI/180;await p.mouse.move(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius);const d=await state();assert.ok(Math.abs(d.style.fontSize-48)<=1);const delta=((d.style.emojiRotation-degrees)%360+360)%360;assert.ok(Math.min(delta,360-delta)<2);assert.deepEqual(d.points,[{time:200,price:200}]);}
 await p.mouse.move(200-36,200+36);await p.mouse.up();let d=await state();assert.equal(d.style.fontSize,72);assert.ok(Math.abs(d.style.emojiRotation-90)<2);checks.push('Mouse handle completes a full revolution and combined rotate/resize without moving anchor');
 await p.reload();await p.locator('[data-emoji-transform-handle]').waitFor();d=await state();assert.equal(d.style.fontSize,72);assert.ok(Math.abs(d.style.emojiRotation-90)<2);checks.push('Angle and size survive reload');
 const geometry=()=>p.evaluate(()=>{const e=document.querySelector('[data-chart-drawing-id] text'),m=e.getScreenCTM(),a=new DOMPoint(Number(e.getAttribute('x')),Number(e.getAttribute('y'))).matrixTransform(m);return{x:a.x,y:a.y,sx:Math.hypot(m.a,m.b),sy:Math.hypot(m.c,m.d),rotation:Math.atan2(m.b,m.a)*180/Math.PI}});
 await p.evaluate(()=>window.gestureEmoji({sx:1.5,sy:.7,dx:30,dy:90}));let g=await geometry();assert.ok(Math.abs(g.x-330)<.02&&Math.abs(g.y-230)<.02);assert.ok(Math.abs(g.sx-1)<.001&&Math.abs(g.sy-1)<.001);assert.ok(Math.abs(g.rotation-90)<2);await p.waitForTimeout(130);assert.ok(Math.abs((await geometry()).rotation-90)<2);checks.push('Rotated emoji stays at fixed size and angle during anisotropic native zoom and settle');
 await p.evaluate(()=>window.gestureEmoji({sx:1,sy:1,dx:0,dy:0}));await p.waitForTimeout(130);
 const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});box=await handle();let x=box.x+box.width/2,y=box.y+box.height/2;const touchRadius=Math.hypot(x-200,y-200),startAngle=Math.atan2(y-200,x-200);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++){const a=startAngle+i*Math.PI/16;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200+Math.cos(a)*touchRadius,y:200+Math.sin(a)*touchRadius}]});}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});d=await state();assert.ok(Math.abs(d.style.fontSize-72)<=1);assert.ok(Math.abs(d.style.emojiRotation-180)<2,JSON.stringify(d.style));checks.push('Touch handle rotates 90 degrees without resizing or moving anchor');
 await p.evaluate(()=>window.lockEmoji(true));await p.locator('[data-emoji-transform-handle]').waitFor({state:'detached'});assert.equal(await p.locator('[data-emoji-transform-handle]').count(),0);await p.evaluate(()=>window.lockEmoji(false));await p.locator('[data-emoji-transform-handle]').waitFor();checks.push('Drawing lock disables transformation handles');
 await p.mouse.dblclick(200,200);const rotationSlider=p.getByRole('slider',{name:'Emoji rotation',exact:true});await rotationSlider.waitFor();await rotationSlider.press('Home');await rotationSlider.press('ArrowRight');assert.equal((await state()).style.emojiRotation,1);await p.getByRole('button',{name:'Close',exact:true}).click();checks.push('Settings angle control updates the rendered drawing');
 await p.screenshot({path:'tmp/emoji-rotation.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});


