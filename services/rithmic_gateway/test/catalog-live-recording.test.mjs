import test from 'node:test';
import assert from 'node:assert/strict';
import {RithmicMarketDataClient} from '../src/rithmic-client.mjs';
import {loadConfig} from '../src/config.mjs';
function client(){return new RithmicMarketDataClient(loadConfig({RITHMIC_SOURCE_MODE:'protocol',RITHMIC_PROTO_DIR:new URL('../vendor/proto',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),RITHMIC_SUBSCRIPTIONS:'CME:NQZ6',RITHMIC_ALLOWED_ROOTS:'CME:NQ,CME:6M,CBOT:UB',RITHMIC_ARCHIVE_CATALOG_TRADES_ENABLED:'true'}));}
test('catalogue recording uses trade and BBO only, while an opened chart upgrades once to full depth',()=>{
 const c=client(),sent=[];c.socket={readyState:1};c.status.authenticated=true;c.send=(name,payload)=>sent.push({name,payload});
 c.subscribe('CBOT','UBZ6',{archiveOnly:true});
 assert.equal(c.subscriptions.get('CBOT:UBZ6').archiveOnly,true);
 assert.equal(sent.find(r=>r.name==='RequestMarketDataUpdate').payload.updateBits,3);
 assert.equal(sent.filter(r=>r.name.includes('Depth')).length,0);
 const count=sent.length;c.subscribe('CBOT','UBZ6',{archiveOnly:true});assert.equal(sent.length,count);
 c.subscribe('CBOT','UBZ6');assert.equal(c.subscriptions.get('CBOT:UBZ6').archiveOnly,undefined);
 assert.ok(sent.filter(r=>r.name.includes('Depth')).length>0);
 const upgraded=sent.length;c.subscribe('CBOT','UBZ6');c.subscribe('CBOT','UBZ6',{archiveOnly:true});assert.equal(sent.length,upgraded);
 assert.equal(c.subscriptions.get('CBOT:UBZ6').archiveOnly,undefined);
});
test('catalogue startup includes every allowed root without downgrading core subscriptions at rollover',async()=>{
 const c=client(),roots=[];c.socket={readyState:1};c.status.authenticated=true;c.resolveFrontMonth=async(exchange,root)=>{roots.push(exchange+':'+root)};
 await c.reconcileSubscribedFrontMonths();assert.ok(roots.includes('CME:6M'));assert.ok(roots.includes('CBOT:UB'));
 c.socket=null;c.applyFrontMonthResolution({exchange:'CME',root:'NQ',contractSymbol:'NQH7'});
 assert.equal(c.subscriptions.get('CME:NQH7').archiveOnly,undefined);
 c.applyFrontMonthResolution({exchange:'CBOT',root:'UB',contractSymbol:'UBH7'});assert.equal(c.subscriptions.get('CBOT:UBH7').archiveOnly,true);
});
