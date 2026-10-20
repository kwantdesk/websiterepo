import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {parseCboeCalendar} from '../src/lib/cboeExpirationPdf.server.ts';
import * as calendarHelpers from '../src/lib/optionsExpirationCalendar.ts';
import {CALENDAR_CHECK_MS,EXPIRATION_TYPES,MONTHS,calendarDateState,calendarMonthCells,exchangeDate,matchesCalendarDay} from '../src/lib/optionsExpirationCalendar.ts';
const root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8');
const seed=JSON.parse(read('src/data/cboe-options-2026.json'));
const dates=type=>seed.days.filter(day=>day.types.includes(type)).map(day=>day.date);
test('published standard expirations and last trade dates include the June holiday move',()=>{
 assert.deepEqual(dates('standard'),['01-16','02-20','03-20','04-17','05-15','06-18','07-17','08-21','09-18','10-16','11-20','12-18'].map(d=>'2026-'+d));
 assert.equal(dates('am-last-trade')[5],'2026-06-17');assert.ok(!dates('standard').includes('2026-06-19'));
});
test('VIX standard and all five published exceptions are source dates, not generated Wednesdays',()=>{
 assert.deepEqual(dates('vix-standard'),['01-21','02-18','03-18','04-15','05-19','06-17','07-22','08-19','09-16','10-21','11-18','12-16'].map(d=>'2026-'+d));
 assert.deepEqual(dates('vix-exception'),['03-03','05-19','06-02','11-24','12-01'].map(d=>'2026-'+d));assert.equal(dates('vix-last-trade')[4],'2026-05-18');
});
test('overlapping colours, quarter endings and LEAPS listing remain different events',()=>{
 const byDate=new Map(seed.days.map(day=>[day.date,day.types]));assert.deepEqual(byDate.get('2026-09-30'),['month-end','quarter-end','vix-weekly']);assert.ok(byDate.get('2026-06-17').includes('am-last-trade'));assert.ok(byDate.get('2026-06-17').includes('vix-standard'));
 assert.equal(seed.leapsYear,2029);assert.deepEqual(dates('leaps'),['2026-09-14']);assert.equal(seed.colors['quarter-end'],seed.colors['month-end']);assert.equal(seed.colors.holiday,'#ffd200');assert.equal(seed.colors.standard,'#1b2953');assert.equal(dates('spx-weekly').length,227);assert.equal(dates('vix-weekly').length,40);assert.equal(dates('holiday').length,10);
 for(const day of seed.days)if(day.types.includes('holiday'))assert.deepEqual(day.types,['holiday']);
});
test('exchange-date timezone never moves an expiry into a Brisbane calendar date',()=>{
 assert.equal(exchangeDate(new Date('2026-10-18T02:00:00Z')),'2026-10-17');assert.equal(exchangeDate(new Date('2026-12-25T04:30:00Z')),'2026-12-24');
 for(let month=0;month<12;month++){const cells=calendarMonthCells(2026,month);assert.equal(cells.length,42);assert.equal(cells.filter(Boolean).length,new Date(Date.UTC(2026,month+1,0)).getUTCDate());}
 assert.equal(calendarMonthCells(2028,1).filter(Boolean).length,29);
});

test('past/today/future styling follows the exchange date across month/year and midnight boundaries',()=>{
 const today=exchangeDate(new Date('2026-10-18T02:00:00Z'));
 assert.equal(today,'2026-10-17');
 assert.deepEqual(calendarDateState('2026-10-16',today,'2026-10-16'),{past:true,today:false,selected:true});
 assert.deepEqual(calendarDateState('2026-10-17',today,'2026-10-16'),{past:false,today:true,selected:false});
 assert.deepEqual(calendarDateState('2026-10-18',today,'2026-10-16'),{past:false,today:false,selected:false});
 assert.equal(calendarDateState('2025-12-31','2026-01-01','2026-01-01').past,true);
});

test('rendered month/year/agenda identify today and dim past dates without disabling selection',()=>{
 const require=createRequire(import.meta.url);
 const selectModule={exports:{},require};
 vm.runInNewContext(ts.transpileModule(read('src/components/ui/KwantSelect.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,selectModule);
 for(const view of ['year','month','agenda']){
  const context={exports:{},localStorage:{getItem:()=>JSON.stringify({accountKey:'qa',preferences:{year:2026,month:9,view,product:'All',enabled:Object.keys(EXPIRATION_TYPES)}})},Date};
  context.require=name=>name.includes('ui/KwantSelect')?selectModule.exports:name.includes('cboe-options-2026')?{default:seed}:name.includes('optionsExpirationCalendar')?{...calendarHelpers,exchangeDate:()=> '2026-10-16'}:name.includes('browserStorageQuota')?{writeProtectedItem:()=>({ok:true})}:name.includes('userPreferences')?{PREFERENCES_HYDRATED_EVENT:'qa-hydrated'}:require(name);
  vm.runInNewContext(ts.transpileModule(read('src/components/news/OptionsExpirationCalendar.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
  const html=renderToStaticMarkup(createElement(context.exports.default,{accountKey:'qa'}));
  assert.match(html,/Current and selected calendar dates/);assert.match(html,/Friday, October 16, 2026/);assert.match(html,/Today outlined/);
  assert.match(html,/aria-current="date"/);assert.match(html,/Selected date/);
  if(view!=='agenda'){
   const past=html.match(/<button[^>]*aria-label="Thursday, October 15, 2026\.[^>]*>/)?.[0];
   assert.ok(past);assert.match(past,/data-past="true"/);assert.match(past,/opacity-45/);assert.doesNotMatch(past,/disabled/);
   const current=html.match(/<button[^>]*aria-label="Friday, October 16, 2026\.[^>]*>/)?.[0];
   assert.match(current,/aria-current="date"/);assert.match(current,/ring-2/);assert.doesNotMatch(current,/opacity-45/);
   assert.match(html,/>Sun<\/span>/);assert.match(html,/>Thu<\/span>/);
  }
 }
});
test('product/colour/search filters are coherent and do not imply ETF daily expirations',()=>{
 const daily=seed.days.find(day=>day.date==='2026-10-19'),monthly=seed.days.find(day=>day.date==='2026-10-16');assert.equal(matchesCalendarDay(daily,Object.keys(EXPIRATION_TYPES),'ETF / ETN',''),false);assert.equal(matchesCalendarDay(monthly,Object.keys(EXPIRATION_TYPES),'SPX / XSP','monthly'),true);assert.equal(matchesCalendarDay(monthly,[],'All',''),false);assert.equal(matchesCalendarDay(daily,Object.keys(EXPIRATION_TYPES),'All','2026-10-19'),true);
});
// A small PDF authored for this test, not a redistributed copy of Cboe's artwork.
function syntheticPdf({unknown=false,reorder=false}={}){
 const colors=seed.colors,content=[],put=(x,y,text,size=9)=>content.push(`BT /F1 ${size} Tf ${x} ${y} Td (${text}) Tj ET`),paint=(color,x,y,w,h)=>{const rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16)/255);content.push(`${rgb.join(' ')} rg ${x} ${y} ${w} ${h} re f`);};
 put(220,555,'2026 OPTIONS EXPIRATION CALENDAR',20);
 for(let month=0;month<12;month++){const x=30+(month%4)*135,y=460-Math.floor(month/4)*140;put(x+20,y,MONTHS[month],16);const first=new Date(Date.UTC(2026,month,1)).getUTCDay();for(const day of seed.days.filter(day=>Number(day.date.slice(5,7))===month+1)){const d=Number(day.date.slice(-2)),cx=x+((first+d-1)%7)*16,cy=y-30-Math.floor((first+d-1)/7)*19,types=day.types.filter(t=>t!=='quarter-end');for(let i=0;i<types.length;i++)paint(unknown&&day.date==='2026-10-19'?'#112233':colors[types[i]],cx-7+i*14/types.length,cy-5,14/types.length,15);content.push('0 0 0 rg');put(cx-9*.556*String(d).length/2,cy,String(d));}}
 let labels=[['standard','Equity Equity Index ETF ETN Options Standard Expiration'],['am-last-trade','Last day Standard AM-Settled Equity Index Options'],['vix-last-trade','Last day to trade Expiring VIX Options'],['vix-standard','VIX Options Standard Expiration'],['vix-exception','VIX Exception'],['vix-weekly','VIX Weeklys Expiration'],['spx-weekly','SPX and XSP Weeklys Expiration'],['month-end','End-of-Month End-of-Quarter Options'],['holiday','Exchange Holiday'],['leaps','2029 Equity and ETP LEAPS added']];if(reorder)labels=[...labels.slice(0,2),labels[3],labels[2],...labels.slice(4)];
 labels.forEach(([type,label],i)=>{const y=430-i*37;paint(colors[type],583,y-5,14,14);content.push('0 0 0 rg');put(605,y,label,7);});
 const stream=content.join('\n'),objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];let output='%PDF-1.7\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(output));output+=`${i+1} 0 obj\n${object}\nendobj\n`;});const start=Buffer.byteLength(output);output+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return new Uint8Array(Buffer.from(output));
}
const source={url:seed.source.url,retrievedAt:'2026-10-18T00:00:00Z',lastModified:null,etag:null};
test('PDF colour vectors and label positions decode the complete grid even if legend order changes',async()=>{
 for(const reorder of [false,true]){const parsed=await parseCboeCalendar(syntheticPdf({reorder}),2026,source);assert.deepEqual(parsed.days,seed.days);assert.deepEqual(parsed.colors,seed.colors);}
});
test('invalid PDF/year and an unknown visible marker fail closed, never publish guessed dates',async()=>{
 await assert.rejects(parseCboeCalendar(new Uint8Array([1,2]),2026,source));await assert.rejects(parseCboeCalendar(syntheticPdf(),2027,source));await assert.rejects(parseCboeCalendar(syntheticPdf({unknown:true}),2026,source));
});
if(process.env.CBOE_CALENDAR_PDF)test('downloaded official PDF exactly matches the independently checked snapshot',async()=>{
 const bytes=new Uint8Array(fs.readFileSync(process.env.CBOE_CALENDAR_PDF)),parsed=await parseCboeCalendar(bytes,2026,source);assert.deepEqual(parsed.days,seed.days);assert.deepEqual(parsed.colors,seed.colors);assert.equal(parsed.source.sha256,seed.source.sha256);
});
function loadServer({fetchImpl,now=Date.parse('2026-10-18T10:00:00Z'),parse=async(bytes,year,meta)=>({...seed,year,source:{...meta,sha256:createHash('sha256').update(bytes).digest('hex')}})}={}){
 let clock=now;const context={exports:{},fetch:fetchImpl??(async()=>{throw Error('offline');}),Date:class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}},Uint8Array,TextDecoder,AbortSignal,Map,Promise,Error,globalThis:{}};
 context.require=name=>name==='node:crypto'?{createHash}:name==='next/cache'?{unstable_cache:fn=>fn}:name.includes('cboe-options-2026')?{default:seed}:name.includes('cboeExpirationPdf')?{parseCboeCalendar:parse}:name.includes('optionsExpirationCalendar')?{CALENDAR_CHECK_MS,CBOE_CALENDAR_URL:'https://www.cboe.com/about/hours/us-options/'}:(()=>{throw Error(name);})();
 vm.runInNewContext(ts.transpileModule(read('src/lib/cboeExpirationCalendar.server.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {...context.exports,advance:ms=>clock+=ms};
}
test('only official published year links can become source requests',()=>{
 const server=loadServer(),sources=server.discoverCalendarSources('<a href="https://cdn.cboe.com/resources/options/Cboe2026OPTIONSCalendar.pdf">2026</a><a href="https://evil.test/Cboe2027OPTIONSCalendar.pdf">bad</a>');assert.equal(sources.size,1);assert.equal(sources.get(2026),seed.source.url);
});
test('source calls coalesce and six-hour refresh incorporates changed data, without market gateway traffic',async()=>{
 let calls=0,version=1;const server=loadServer({fetchImpl:async url=>{calls++;return new Response(String(url).endsWith('.pdf')?'PDF'+version:`<a href="${seed.source.url}">calendar</a>`);}});
 const values=await Promise.all(Array.from({length:12},()=>server.getCboeExpirationCalendar(2026)));assert.equal(calls,2);assert.ok(values.every(v=>v.status==='current'));const hash=values[0].calendar.source.sha256;await server.getCboeExpirationCalendar(2026);assert.equal(calls,2);version++;server.advance(CALENDAR_CHECK_MS+1);const updated=await server.getCboeExpirationCalendar(2026);assert.equal(calls,4);assert.notEqual(updated.calendar.source.sha256,hash);
});
test('source outage or unverified revision retains last verified data with explicit stale state',async()=>{
 const server=loadServer();const unavailable=await server.getCboeExpirationCalendar(2026);assert.equal(unavailable.status,'stale');assert.equal(unavailable.calendar.source.sha256,seed.source.sha256);assert.match(unavailable.message,/last verified/);
 const next=await server.getCboeExpirationCalendar(2027);assert.equal(next.status,'unavailable');assert.equal(next.calendar,null);
 const changed=loadServer({fetchImpl:async url=>new Response(String(url).endsWith('.pdf')?'changed':seed.source.url),parse:async()=>{throw Error('Unknown colour');}});assert.equal((await changed.getCboeExpirationCalendar(2026)).status,'stale');
});
test('authenticated route rejects unsafe years/query parameters and production dev bypass',async()=>{
 let actor={mode:'session'},production=false,calls=0;const exports={};
 const context={exports,Request,Response,URL,Date,process:{env:{}},require:name=>name==='next/server'?{NextResponse:{json:(data,init)=>Response.json(data,init)}}:name.includes('serverAuth')?{getRouteActor:async()=>actor}:name.includes('cboeExpirationCalendar')?{getCboeExpirationCalendar:async()=>{calls++;return {status:'current'};}}:name.includes('conditionalJson')?{conditionalJson:(_r,data)=>Response.json(data)}:(()=>{throw Error(name);})()};
 vm.runInNewContext(ts.transpileModule(read('src/app/api/options-expiration-calendar/route.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 for(const query of ['year=2025','year=2099','year=2026&year=2027','url=https://evil.test','year=2026.0'])assert.equal((await exports.GET(new Request('https://example.test/api/options-expiration-calendar?'+query))).status,400);
 assert.equal(calls,0);actor=null;assert.equal((await exports.GET(new Request('https://example.test/api/options-expiration-calendar?year=2026'))).status,401);
 actor={mode:'local-dev'};production=true;context.process.env.VERCEL=production?'1':undefined;assert.equal((await exports.GET(new Request('https://example.test/api/options-expiration-calendar?year=2026'))).status,401);
 actor={mode:'session'};assert.equal((await exports.GET(new Request('https://example.test/api/options-expiration-calendar?year=2026'))).status,200);assert.equal(calls,1);
});
test('calendar moved to News, preserves preferences and redirects old KWANTY bookmarks',()=>{
 const host=read('src/components/kwanty/KwantyWorkspace.tsx'),news=read('src/components/news/NewsWorkspace.tsx'),ui=read('src/components/news/OptionsExpirationCalendar.tsx'),route=read('src/app/api/options-expiration-calendar/route.ts');assert.doesNotMatch(host,/Options Expiration Calendar|OptionsExpirationCalendar/);assert.match(host,/router\.replace\('\/news\?view=options-expirations'\)/);assert.match(news,/Options Expiration Calendar/);assert.match(news,/accountKey=\{accountKey\} active=\{active\}/);assert.match(route,/getRouteActor/);assert.match(route,/Invalid calendar year/);assert.match(ui,/America\/New_York/);assert.match(ui,/controller\.abort/);assert.match(ui,/clearInterval/);assert.doesNotMatch(ui,/EventSource|WebSocket|setInterval\([^,]+,1000\)/);assert.match(read('src/lib/userPreferences.ts'),/kwantdesk:options-expiration-calendar:v1/);
});
