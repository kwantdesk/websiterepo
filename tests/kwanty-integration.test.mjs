import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativePositioningEdge} from '../services/rithmic_gateway/src/native-positioning-edge.mjs';
import {trimSnapshotRows,RetainedSnapshots} from '../public/kwanty-app/retention.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('KWANTY is separate from GEX BOX, GEX DATA and the preserved assistant',()=>{
 const nav=read('src/components/AppSidebar.tsx'),shell=read('src/components/KwantifyWorkspace.tsx');assert.match(nav,/key: "kwanty", href: "\/kwanty", label: "KWANTY"/);assert.match(shell,/has\("kwanty"\)/);assert.match(shell,/KwantBotIntelligenceWorkspace interpreter=/);assert.doesNotMatch(shell,/GexBotWorkspace/);assert.match(shell,/GexDataWorkspace/);assert.match(read('src/lib/userPreferences.ts'),/kwantdesk:kwanty:workspace:v1/);
});
test('gateway edge rejects unknown operations, methods, duplicate or unsafe query keys',async()=>{
 const edge=await createNativePositioningEdge({});
 for(const[path,method,status]of [['status','POST',405],['negotiate','GET',404],['status?token=bad','GET',400],['snapshot?ticker=SPX&ticker=QQQ','GET',400]]){let actual,body;await edge.handle({method},{writeHead:value=>actual=value,end:value=>body=JSON.parse(value)},new URL('https://example.test/v1/native-positioning/'+path));assert.equal(actual,status);assert.ok(body.error);}
 let result;await edge.handle({method:'GET'},{writeHead(){},end:value=>result=JSON.parse(value)},new URL('https://example.test/v1/native-positioning/status'));assert.equal(result.keyConfigured,false);assert.equal(result.authenticated,false);
});
test('chart snapshot retention is bounded by bytes, row count and selector count',()=>{
 const rows=Array.from({length:30},(_,i)=>({timestamp:i,ticker:'SPX',large:'x'.repeat(1000)}));trimSnapshotRows(rows,5000,10);assert.ok(rows.length<3);assert.equal(rows.at(-1).timestamp,29);
 const store=new RetainedSnapshots();for(let i=0;i<30;i++)store.set(String(i),[{timestamp:i,ticker:'SPX'}]);assert.equal(store.size,8);assert.ok(!store.has('0'));assert.throws(()=>trimSnapshotRows([{large:'x'.repeat(5000)}],20));
});
test('site-only credential-free bridge, lifecycle, theme and real template files',()=>{
 const host=read('src/components/kwanty/KwantyWorkspace.tsx'),app=read('public/kwanty-app/app.js'),route=read('src/app/api/kwanty/[operation]/route.ts');assert.match(host,/accountKey/);assert.match(host,/__kwantyHost/);assert.match(host,/#orderflow/);assert.match(host,/controllers\.forEach/);assert.match(route,/getRouteActor/);assert.match(route,/fetchInstitutionalMarketData/);assert.doesNotMatch(route,/GEXBOT_API_KEY|api\.gex/);assert.match(app,/__kwantyActive/);assert.match(app,/clearInterval\(healthTimer\)/);assert.match(app,/state\.sourceError\?60000:30000/);assert.match(app,/function syncTheme/);
 const templates=read('public/kwanty-app/templates.js');assert.match(templates,/input\.type='file'/);assert.match(templates,/kwantdesk-kwanty/);assert.match(templates,/createObjectURL/);
});
