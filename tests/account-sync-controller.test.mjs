import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {defaultChartSettings} from '../src/lib/chartSettings.ts';
import {serializeThemeChoice,THEME_CHOICE_KEY} from '../src/lib/themeChoice.ts';
import {accountPreferenceFingerprint,mergeAccountPreferenceChanges,mergePaperTradingLedgerUpdate,paperValuationFingerprint} from '../src/lib/accountPreferenceMerge.ts';
import {createPaperTradingAccount} from '../src/lib/paperAccounts.ts';
import {emptyPaperTradingLedger,placePaperOrder,updatePaperProtection,closePaperPosition,normalizePaperTradingLedger,processPaperQuote} from '../src/lib/paperTrading.ts';

const snapshot=values=>({version:1,complete:true,updatedAt:'2026-10-27T00:00:00Z',values});
function controller(acknowledged = true, account = { cloud: snapshot({'olisa-theme':'desktop'}) }){
 let state=structuredClone(account.cloud),effect;
 const listeners=new Map(),timeouts=new Map(),intervals=new Map();let sequence=0,calls=0,writes=0,applied=0,removed=0,captures=0,revisions=0;
 const events={addEventListener(key,fn){if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn)},removeEventListener(key,fn){listeners.get(key)?.delete(fn)},dispatchEvent(event){for(const fn of listeners.get(event.type)??[])fn(event)}};
 const window={...events,localStorage:{getItem:()=> 'owner'},setTimeout(fn){const id=++sequence;timeouts.set(id,fn);return id},clearTimeout(id){timeouts.delete(id)},setInterval(fn){const id=++sequence;intervals.set(id,fn);return id},clearInterval(id){intervals.delete(id)}};
 const document={...events,visibilityState:'visible'};
 const notifications={};const channel={on(type,filter,fn){notifications[type]=fn;return channel},subscribe(fn){fn('SUBSCRIBED');return channel},async send(){}};
 const client={channel:()=>channel,removeChannel(){removed++;}};
 const exports={};
 const code=ts.transpileModule(fs.readFileSync('src/hooks/useAccountPreferenceSync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const require=id=>{
  if(id==='react')return {useEffect:fn=>{effect=fn}};
  if(id.includes('userPreferences'))return {isTrackedStorageKey:key=>key==='olisa-theme',captureBrowserPreferences:()=>{captures++;return structuredClone(state)},readScopedPreferences:()=>acknowledged ? structuredClone(account.cloud) : null,receiveAccountPreferences(_owner,next){state=next;applied++;}};
  if(id.includes('accountPreferenceMerge'))return {accountPreferenceFingerprint,mergeAccountPreferenceChanges,mergePaperTradingLedgerUpdate,paperValuationFingerprint};
  if(id.includes('paperTrading'))return {normalizePaperTradingLedger};
  if(id.includes('accountPreferenceCloud'))return {async readAccountPreferenceRevision(){revisions++;return accountPreferenceFingerprint(account.cloud)},async exchangeAccountPreferences(_client,owner,base,local,write){assert.equal(owner,'owner');calls++;const merged=mergeAccountPreferenceChanges(base,local,account.cloud);if(write){writes++;account.cloud=merged;}return {remote:structuredClone(account.cloud),snapshot:merged,revision:accountPreferenceFingerprint(account.cloud)};}};
  throw Error(id);
 };
 vm.runInNewContext(code,{exports,require,window,document,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},Date,console});
 exports.useAccountPreferenceSync({supabase:client,userId:'owner',enabled:true});const cleanup=effect();
 return {get revisions(){return revisions},async heartbeat(){for(const fn of intervals.values())await fn();await new Promise(resolve=>setImmediate(resolve));},get captures(){return captures},get state(){return state},get calls(){return calls},get writes(){return writes},get applied(){return applied},get removed(){return removed},get timers(){return timeouts.size+intervals.size},get scheduled(){return [...timeouts.keys()]},
  setState(next){state=next},setCloud(next){account.cloud=next},emit:(type,key)=>window.dispatchEvent({type,key}),notify:(payload)=>notifications.broadcast({payload}),cleanup,
  async flush(){const queued=[...timeouts.values()];timeouts.clear();for(const fn of queued)fn();await new Promise(resolve=>setImmediate(resolve));},
 };
}
test('live account receiver applies peer revisions and edits made locally do not echo forever',async()=>{
 const c=controller();await c.flush();assert.equal(c.calls,1);assert.equal(c.writes,0);
 c.setCloud(snapshot({'olisa-theme':'phone'}));c.notify();await c.flush();
 assert.equal(c.state.values['olisa-theme'],'phone');assert.equal(c.writes,0);
 c.setState(snapshot({'olisa-theme':'new desktop'}));c.emit('kwantdesk:preferences-changed');await c.flush();
 assert.equal(c.writes,1);const count=c.calls;
 c.emit('kwantdesk:preferences-changed');await c.flush();assert.equal(c.calls,count);
 c.cleanup();assert.equal(c.removed,1);assert.equal(c.timers,0);
});

test('a fresh phone recovering from failed hydration reads desktop state before uploading defaults',async()=>{
 const c=controller(false);
 c.setState(snapshot({'olisa-theme':'phone defaults','olisa-chart-workspace-layout':'single'}));
 c.setCloud(snapshot({'olisa-theme':'saved desktop','olisa-chart-workspace-layout':'quad'}));
 await c.flush();
 assert.equal(c.writes,0);
 assert.equal(c.state.values['olisa-theme'],'saved desktop');
 assert.equal(c.state.values['olisa-chart-workspace-layout'],'quad');
 c.setState(snapshot({...c.state.values,'olisa-theme':'intentional phone edit'}));
 c.emit('kwantdesk:preferences-changed');await c.flush();
 assert.equal(c.writes,1);assert.equal(c.state.values['olisa-theme'],'intentional phone edit');c.cleanup();
});
test('one hundred unchanged local preference events cause no account reads or writes',async()=>{
 const c=controller();await c.flush();const before=c.calls;
 for(let i=0;i<100;i++)c.emit('kwantdesk:preferences-changed');
 await c.flush();assert.equal(c.calls,before);assert.equal(c.writes,0);c.cleanup();
});
test('focus catches up after a missed realtime notification',async()=>{
 const c=controller();await c.flush();c.setCloud(snapshot({'olisa-theme':'mobile'}));
 c.emit('focus');await c.flush();assert.equal(c.state.values['olisa-theme'],'mobile');c.cleanup();
});

test('a visible phone recovers open trades, protection edits and exits without a broadcast or refocus',async()=>{
 const account=createPaperTradingAccount({name:'Live account',balance:50000,leverage:'1:30',instrument:'NQ'});
 const key='kwantify-paper-trading-ledger-v1',accounts='kwantify-paper-trading-accounts';
 const c=controller();await c.flush();
 const quote={last:20000,bid:20000,ask:20000,timestamp:Date.now()};
 const opened=placePaperOrder(emptyPaperTradingLedger(),[account],{accountId:account.id,symbol:'NQ',side:'buy',type:'market',quantity:1,price:null,stopLoss:19990,takeProfits:[{price:20020,quantity:1}]},quote).ledger;
 const position=opened.accounts[account.id].positions[0];
 const publish=ledger=>c.setCloud(snapshot({[accounts]:JSON.stringify([account]),[key]:JSON.stringify(ledger),'kwantify-selected-paper-account':account.id}));
 publish(opened);await c.heartbeat();await c.flush();
 assert.equal(JSON.parse(c.state.values[key]).accounts[account.id].positions[0].status,'open');
 assert.equal(c.state.values['kwantify-selected-paper-account'],account.id);
 const edited=updatePaperProtection(opened,account.id,position.id,{kind:'stop_loss',price:19995}).ledger;
 publish(edited);await c.heartbeat();await c.flush();
 assert.equal(JSON.parse(c.state.values[key]).accounts[account.id].positions[0].stopLoss,19995);
 publish(closePaperPosition(edited,account.id,position.id,{...quote,last:20001,bid:20001,ask:20001,timestamp:quote.timestamp+1000}).ledger);
 await c.heartbeat();await c.flush();
 assert.equal(JSON.parse(c.state.values[key]).accounts[account.id].positions[0].status,'closed');
 assert.equal(c.writes,0,'receiving devices must not submit synthetic executions');c.cleanup();
});

test('revision heartbeats do not download or apply unchanged account payloads',async()=>{
 const c=controller();await c.flush();const calls=c.calls,applied=c.applied;
 for(let i=0;i<10;i++){await c.heartbeat();await c.flush();}
 assert.equal(c.revisions,10);assert.equal(c.calls,calls);assert.equal(c.applied,applied);c.cleanup();
});

test('cache storage storms cause no preference scans and local bursts debounce before scanning',async()=>{const c=controller();await c.flush();const before=c.captures;for(let i=0;i<1000;i++)c.emit('storage','kwantdesk:renderer-health:active:v1');assert.equal(c.captures,before);for(let i=0;i<1000;i++)c.emit('kwantdesk:preferences-changed');assert.equal(c.captures,before);await c.flush();assert.equal(c.captures,before+1);assert.equal(c.writes,0);c.cleanup()});

test('continuous trading events retain the first bounded save deadline',async()=>{const c=controller();await c.flush();c.setState(snapshot({'olisa-theme':'edited while trading'}));c.emit('kwantdesk:preferences-changed');const scheduled=c.scheduled[0];for(let i=0;i<100;i++)c.emit('kwantdesk:preferences-changed');assert.equal(c.scheduled[0],scheduled);await c.flush();assert.equal(c.writes,1);assert.equal(c.state.values['olisa-theme'],'edited while trading');c.cleanup();});

test('foreground recovery replaces an already pending timer',async()=>{const c=controller();await c.flush();c.emit('kwantdesk:preferences-changed');const pending=c.scheduled[0];c.setCloud(snapshot({'olisa-theme':'resumed phone'}));c.emit('online');assert.notEqual(c.scheduled[0],pending);assert.equal(c.scheduled.length,1);await c.flush();assert.equal(c.state.values['olisa-theme'],'resumed phone');c.cleanup();});

test('an open phone changing chart settings cannot restore its stale desktop palette', async () => {
 const key='kwantdesk:chart-workspace-settings:v1';
 const old={...defaultChartSettings,themeLinked:false,backgroundColor:'#102030'};
 const selected={...defaultChartSettings,backgroundColor:'#123456',wickUpColor:'#FEDCBA'};
 const theme=JSON.stringify({chartBackground:selected.backgroundColor});
 const account={cloud:snapshot({[key]:JSON.stringify(old)})};
 const desktop=controller(true,account),phone=controller(true,account);
 try {
  await desktop.flush();
  await phone.flush();
  desktop.setState(snapshot({
   ...desktop.state.values,[key]:JSON.stringify(selected),'olisa-theme':theme,
   [THEME_CHOICE_KEY]:serializeThemeChoice(null,theme,selected),
  }));
  desktop.emit('kwantdesk:preferences-changed');
  await desktop.flush();

  // The phone had this workspace open before the desktop changed theme.
  phone.setState(snapshot({...phone.state.values,[key]:JSON.stringify({...old,timezone:'UTC'})}));
  phone.emit('focus');
  await phone.flush();
  desktop.notify();
  await desktop.flush();

  for(const device of [desktop,phone]){
   const settings=JSON.parse(device.state.values[key]);
   assert.equal(settings.themeLinked,true);
   assert.equal(settings.backgroundColor,selected.backgroundColor);
   assert.equal(settings.wickUpColor,selected.wickUpColor);
   assert.equal(settings.timezone,'UTC');
   assert.equal(device.state.values['olisa-theme'],theme);
  }
  assert.equal(phone.writes,1);
  assert.equal(desktop.writes,1);

  // An intentional phone colour edit remains shared with the open desktop.
  const custom={...JSON.parse(phone.state.values[key]),themeLinked:false,backgroundColor:'#445566'};
  phone.setState(snapshot({...phone.state.values,[key]:JSON.stringify(custom)}));
  phone.emit('kwantdesk:preferences-changed');
  await phone.flush();
  desktop.notify();
  await desktop.flush();
  assert.deepEqual(JSON.parse(desktop.state.values[key]),custom);
 } finally {
  desktop.cleanup();
  phone.cleanup();
 }
});

test('a second device requests the latest overnight valuation without enabling per-tick uploads',async()=>{
 const record=createPaperTradingAccount({name:'Overnight handoff',balance:50000,leverage:'1:30',instrument:'NQ'});
 const at=Date.parse('2026-11-09T20:00Z'),key='kwantify-paper-trading-ledger-v1';
 const q=price=>({bid:price,ask:price,timestamp:at});
 const opened=placePaperOrder(emptyPaperTradingLedger(),[record],{accountId:record.id,symbol:'NQ',side:'buy',type:'market',quantity:1,price:null,stopLoss:29990,takeProfits:[]},q(30000)).ledger;
 const shared={cloud:snapshot({[key]:JSON.stringify(opened)})};
 const desktop=controller(true,shared);await desktop.flush();
 const marked=processPaperQuote(opened,[record],'NQ',{...q(30010),timestamp:at+1000},{executionAuthorized:true});
 desktop.setState(snapshot({[key]:JSON.stringify(marked)}));desktop.emit('kwantdesk:preferences-changed');await desktop.flush();
 assert.equal(desktop.writes,0,'ordinary ticks remain local');
 const phone=controller(false,shared);await phone.flush();
 assert.equal(JSON.parse(phone.state.values[key]).accounts[record.id].positions.length,1);
 desktop.notify({requestMarks:true});await desktop.flush();assert.equal(desktop.writes,1);
 phone.notify();await phone.flush();
 const received=JSON.parse(phone.state.values[key]).accounts[record.id].positions[0];
 assert.equal(received.markPrice,30010);assert.equal(received.unrealizedPnl,200);
 desktop.emit('kwantdesk:preferences-changed');await desktop.flush();assert.equal(desktop.writes,1);
 desktop.cleanup();phone.cleanup();
});
