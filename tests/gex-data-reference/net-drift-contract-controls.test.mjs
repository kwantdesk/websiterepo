import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import { netDriftCalendarMonth, netDriftContractAvailability, mountNetDriftContractControls, mountObservedStrikeControl, mountObservedExpiryControl } from '../../public/gex-data-app/net-drift-contract-controls.js';
import {resolveFilterOverride} from '../../public/gex-data-app/preferences-model.js';

const choices = { expirationDates: ['2026-11-20', '2026-10-23', '2026-10-16'], strikePricesByExpiration: { '2026-10-23': [710, 700, 705.5] } };
test('only observed expiries and selected-expiry strikes are available; inventory is immutable', () => {
  const raw = { expirationDates: [...choices.expirationDates, '2026-02-30', '2026-10-16'], strikePricesByExpiration: { ...choices.strikePricesByExpiration, '2026-10-23': [710, '700', 710, 705.5, '', null, -1, Infinity] } };
  const before = structuredClone(raw);
  assert.deepEqual(netDriftContractAvailability(raw, '2026-10-23'), { expirationDates: ['2026-10-16', '2026-10-23', '2026-11-20'], strikes: [700, 705.5, 710] });
  assert.deepEqual(netDriftContractAvailability(raw, '').strikes, []);
  assert.deepEqual(netDriftContractAvailability(raw, '2026-10-30').strikes, []);
  assert.deepEqual(raw, before);
});
test('calendar anchors selected expiry, otherwise first observed date on/after session', () => {
  assert.equal(netDriftCalendarMonth({ expirationDates: choices.expirationDates, sessionDate: '2026-10-24' }).month, '2026-11');
  assert.equal(netDriftCalendarMonth({ expirationDates: choices.expirationDates, sessionDate: '2026-10-24', expiry: '2026-10-23' }).month, '2026-10');
  assert.equal(netDriftCalendarMonth({ expirationDates: [], sessionDate: '2026-10-16' }).month, '2026-10');
});
test('calendar handles leap days and only enables actual dates without generating contracts', () => {
  const result = netDriftCalendarMonth({ month: '2028-02', expirationDates: ['2028-02-29', '2028-02-30'], expiry: '2028-02-29' });
  assert.equal(result.cells.filter(Boolean).length, 29);
  assert.deepEqual(result.cells.filter(cell => cell?.available).map(cell => cell.date), ['2028-02-29']);
  assert.equal(result.cells.find(cell => cell?.date === '2028-02-29').selected, true);
  assert.equal(result.cells[0], null); // February 1, 2028 is Tuesday.
});

// Small event/DOM harness: no browser, network, provider, globals or live page.
class Element {
  constructor(tag, document) { this.tagName = tag; this.ownerDocument = document; this.children = []; this.events = new Map(); this.attributes = {}; this.textContent = ''; this.value = ''; this.className = ''; this.parent = null; this.classList = { add: (...classes) => { this.className += ' ' + classes.join(' '); } }; }
  get isConnected() { return this === this.ownerDocument.body || !!this.parent?.isConnected; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parent = null; this.children = []; this.append(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, action) { const list = this.events.get(type) ?? []; list.push(action); this.events.set(type, list); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  fire(type) { if (this.disabled) return; for (const action of this.events.get(type) ?? []) action({ target: this, currentTarget: this }); }
}
const descendants = element => [element, ...element.children.flatMap(descendants)];
const find = (element, predicate) => descendants(element).find(predicate);
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({ initial = {}, loader = async () => choices, standalone = false, expiryOnly=false, singleStrike=false,clearable=true } = {}) {
  const document = { createElement: tag => new Element(tag, document) }; document.body = new Element('body', document);
  const host = document.createElement('div'); document.body.append(host);
  let scope = { ticker: 'SPY', sessionDate: '2026-10-16', expiry: '', strikes: [], ...initial }, menu, api;
  const expiryChanges = [], strikeChanges = [];
  const popup = (anchor, title, build) => { menu?.remove(); menu = document.createElement('section'); menu.title = title; document.body.append(menu); build(menu); return menu; };
  api = (expiryOnly?mountObservedExpiryControl:standalone ? mountObservedStrikeControl : mountNetDriftContractControls)({ host, popup, singleStrike,clearable,getScope: () => scope, loadChoices: loader,
    onExpiryChange: expiry => { expiryChanges.push(expiry); scope = { ...scope, expiry }; api.sync(); },
    onStrikesChange: strikes => { strikeChanges.push(strikes); scope = { ...scope, strikes }; api.sync(); } });
  return { api, host, document, expiryChanges, strikeChanges, get menu() { return menu; }, get scope() { return scope; }, setScope: next => { scope = { ...scope, ...next }; api.sync(); },
    open: label => find(host, node => node.attributes['aria-label'] === label).fire('click') };
}

test('expiry-only required picker waits for a ticker, has no strike UI, and selects only observed expiration',async()=>{
  let loads=0;const h=harness({expiryOnly:true,clearable:false,initial:{ticker:''},loader:async()=>{loads++;return choices;}});
  const trigger=find(h.host,node=>node.attributes['aria-label']==='Expiration');
  assert.equal(trigger.disabled,true);assert.equal(trigger.title,'Select an instrument first');
  assert.equal(find(h.host,node=>node.attributes['aria-label']==='Strike Price'),undefined);
  h.open('Expiration');await flush();assert.equal(loads,0);assert.deepEqual(h.expiryChanges,[]);
  h.setScope({ticker:'SPY',sessionDate:'2026-10-17'});h.open('Expiration');await flush();
  assert.equal(loads,1);assert.equal(find(h.menu,node=>node.textContent==='Clear expiration'),undefined);
  assert.equal(find(h.menu,node=>node.attributes['aria-label']==='Oct 16, 2026').disabled,true);
  assert.equal(find(h.menu,node=>node.attributes['aria-label']==='Oct 24, 2026').disabled,true);
  find(h.menu,node=>node.attributes['aria-label']==='Oct 23, 2026').fire('click');
  assert.deepEqual(h.expiryChanges,['2026-10-23']);assert.equal(h.menu.isConnected,false);
  assert.equal(trigger.textContent,'Oct 23, 2026');assert.deepEqual(h.strikeChanges,[]);h.api.destroy();
});

test('expiry-only override disables acquisition, clearability is explicit, and empty inventory never selects a date',async()=>{
  let loads=0;const h=harness({expiryOnly:true,initial:{expiryDisabled:true},loader:async()=>{loads++;return {expirationDates:[]};}});
  h.open('Expiration');await flush();assert.equal(loads,0);
  const trigger=find(h.host,node=>node.attributes['aria-label']==='Expiration');assert.equal(trigger.disabled,true);
  assert.equal(trigger.title,'Expiration controlled by a filter override');
  h.setScope({expiryDisabled:false});h.open('Expiration');await flush();
  assert.ok(find(h.menu,node=>node.textContent==='No expirations are available in this snapshot.'));
  assert.equal(descendants(h.menu).some(node=>node.attributes['aria-label']?.match(/^Oct /)&&!node.disabled),false);
  assert.deepEqual(h.expiryChanges,[]);assert.ok(find(h.menu,node=>node.textContent==='Clear expiration'));
  find(h.menu,node=>node.textContent==='Clear expiration').fire('click');assert.deepEqual(h.expiryChanges,['']);h.api.destroy();
});

test('expiry-only generation ignores old ticker/session choices and destruction blocks pending results',async()=>{
  const pending=[],h=harness({expiryOnly:true,loader:scope=>new Promise(resolve=>pending.push({scope,resolve}))});
  h.open('Expiration');await flush();const old=h.menu;
  h.setScope({ticker:'QQQ',sessionDate:'2026-11-01'});h.open('Expiration');await flush();
  pending[0].resolve(choices);await flush();assert.equal(old.isConnected,false);
  assert.ok(find(h.menu,node=>node.textContent==='Loading choices…'));assert.deepEqual(h.expiryChanges,[]);
  pending[1].resolve({expirationDates:['2026-11-20','2026-02-30']});await flush();
  assert.ok(find(h.menu,node=>node.attributes['aria-label']==='Nov 20, 2026'&&!node.disabled));
  assert.equal(find(h.menu,node=>node.attributes['aria-label']==='Strike Price'),undefined);
  h.open('Expiration');await flush();const last=h.menu;h.api.destroy();pending[2].resolve(choices);await flush();
  assert.equal(last.isConnected,false);assert.equal(h.host.children.length,0);assert.deepEqual(h.expiryChanges,[]);
});

test('actual Max Pain picker preserves restored selection and override ownership without loading strike inventory',async()=>{
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),start=app.indexOf("    if(tool.id==='max-pain'){",app.indexOf('  function renderControls(')),end=app.indexOf("    if(tool.id==='net-drift'){",start);
  const document={createElement:tag=>new Element(tag,document)};document.body=new Element('body',document);
  const holder=document.createElement('div');holder.insertBefore=node=>holder.append(node);document.body.append(holder);
  const nodes=new Map(),values={ticker:'SPY',mode:'historical',date:'2026-10-16',expiry:'2026-10-23'},loads=[],changes=[];
  for(const id of ['ticker','expiry','painCalls','painPuts']){const wrapper=document.createElement('div'),input=document.createElement('input');input.dataset={control:id};input.closest=()=>wrapper;wrapper.append(input);holder.append(wrapper);nodes.set(id,input);}
  let menu;const env={holder,tool:{id:'max-pain'},netDriftContractControls:null,mountObservedExpiryControl,
    element:tag=>{const el=document.createElement(tag);el.style={};return el;},q:selector=>nodes.get(/data-control="([^"]+)"/.exec(selector)?.[1]),
    getControl:id=>values[id]??'',setControl:(id,value)=>{values[id]=value;},onControlsChanged:event=>changes.push(event.target.dataset.control),apiStatus:{market:{}},
    loadNetDriftContractChoices:async scope=>{loads.push(scope);return choices;},popup:(anchor,title,build)=>{menu?.remove();menu=document.createElement('section');document.body.append(menu);build(menu);return menu;}};
  vm.runInNewContext(app.slice(start,end),env);
  const trigger=find(holder,node=>node.attributes['aria-label']==='Expiration');
  assert.equal(trigger.textContent,'Oct 23, 2026');assert.deepEqual(changes,[]);assert.equal(values.expiry,'2026-10-23');
  assert.equal(nodes.get('ticker').dataset.maxPainTicker,'SPY');assert.equal(nodes.get('expiry').closest().hidden,true);
  assert.equal(nodes.get('painCalls').closest().hidden,true);assert.equal(nodes.get('painPuts').closest().hidden,true);
  assert.equal(find(holder,node=>node.attributes['aria-label']==='Strike Price'),undefined);
  nodes.get('expiry').disabled=true;env.netDriftContractControls.sync();trigger.fire('click');await flush();assert.equal(loads.length,0);
  nodes.get('expiry').disabled=false;env.netDriftContractControls.sync();trigger.fire('click');await flush();
  assert.equal(loads.length,1);assert.equal(loads[0].ticker,'SPY');assert.equal(loads[0].sessionDate,'2026-10-16');assert.equal(loads[0].expiry,'');
  assert.equal(find(menu,node=>node.textContent==='Clear expiration'),undefined);
  find(menu,node=>node.attributes['aria-label']==='Oct 16, 2026').fire('click');assert.equal(values.expiry,'2026-10-16');assert.deepEqual(changes,['expiry']);
  env.netDriftContractControls.destroy();
});

test('required single-contract calendar has no clear action, requires ticker and excludes observed dates before session',async()=>{
  const h=harness({singleStrike:true,clearable:false,initial:{ticker:''}});
  assert.equal(find(h.host,node=>node.attributes['aria-label']==='Expiration').disabled,true);
  h.setScope({ticker:'SPY',sessionDate:'2026-10-17'});h.open('Expiration');await flush();
  assert.equal(find(h.menu,node=>node.textContent==='Clear expiration'),undefined);
  assert.equal(find(h.menu,node=>node.attributes['aria-label']==='Oct 16, 2026').disabled,true);
  find(h.menu,node=>node.attributes['aria-label']==='Oct 23, 2026').fire('click');assert.deepEqual(h.expiryChanges,['2026-10-23']);
});

test('single-strike mode searches sorted real strikes, selects exactly one and closes without Clear all',async()=>{
  const h=harness({singleStrike:true,clearable:false,initial:{expiry:'2026-10-23',strikes:[700]}});
  h.open('Strike Price');await flush();assert.equal(find(h.menu,node=>node.textContent==='Clear all'),undefined);
  const radios=descendants(h.menu).filter(node=>node.type==='radio');assert.deepEqual(radios.map(node=>node.value),['700','705.5','710']);
  assert.deepEqual(radios.map(radio=>radio.parent.children[1].textContent),['$700','$705.50','$710']);
  assert.equal(descendants(h.menu).some(node=>node.type==='checkbox'),false);
  const search=find(h.menu,node=>node.type==='search');search.value='705';search.fire('input');
  const selected=find(h.menu,node=>node.type==='radio');selected.checked=true;selected.fire('change');
  assert.deepEqual(h.strikeChanges,[[705.5]]);assert.equal(h.menu.isConnected,false);
});

test('Actual Contract Price picker wiring keeps strikes selectable under an expiration override; exact OSI disables both',async()=>{
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
  const start=app.indexOf("    if(tool.id==='option-price-over-time'){",app.indexOf('  function renderControls(')),end=app.indexOf("    if(tool.id==='exposure-by-expiration'){",start);
  assert.ok(start>0&&end>start);
  const document={createElement:tag=>new Element(tag,document)};document.body=new Element('body',document);
  const holder=document.createElement('div');holder.insertBefore=node=>holder.append(node);document.body.append(holder);
  const nodes=new Map(),values={ticker:'SPY',mode:'historical',date:'2026-10-16',expiry:'2026-10-23',strike:'',osi:''};
  for(const id of ['expiry','strike','date','contractType']){const wrapper=document.createElement('div'),input=document.createElement('input');input.dataset={control:id};input.closest=()=>wrapper;wrapper.append(input);holder.append(wrapper);nodes.set(id,input);}
  nodes.get('expiry').disabled=true;let menu,loads=0;const changes=[];
  const env={tool:{id:'option-price-over-time'},holder,commonSessionDateControls:null, netDriftContractControls:null,mountNetDriftContractControls,
    element:tag=>{const node=document.createElement(tag);node.style={};return node;},q:selector=>nodes.get(/data-control="([^"]+)"/.exec(selector)?.[1]),
    getControl:id=>values[id]??'',setControl:(id,value)=>{values[id]=value;},onControlsChanged:event=>changes.push(event.target.dataset.control),apiStatus:{market:{}},
    loadNetDriftContractChoices:async()=>{loads++;return choices;},popup:(anchor,title,build)=>{menu?.remove();menu=document.createElement('section');document.body.append(menu);build(menu);return menu;},
  };
  vm.runInNewContext(app.slice(start,end),env);
  const expiry=find(holder,node=>node.attributes['aria-label']==='Expiration'),strike=find(holder,node=>node.attributes['aria-label']==='Strike Price');
  assert.equal(expiry.disabled,true);assert.equal(strike.disabled,false);expiry.fire('click');assert.equal(loads,0);
  strike.fire('click');await flush();assert.equal(loads,1);const radio=find(menu,node=>node.type==='radio'&&node.value==='705.5');radio.checked=true;radio.fire('change');assert.equal(values.strike,705.5);assert.deepEqual(changes,['strike']);
  values.osi='SPY261023C00705500';env.netDriftContractControls.sync();assert.equal(expiry.disabled,true);assert.equal(strike.disabled,true);strike.fire('click');assert.equal(loads,1);
});

for(const toolId of ['contract-statistics','contract-trade-side-statistics']){
test(`Actual ${toolId} optional calendar and multi-strike wiring preserves filters and avoids invented all-market inventory`,async()=>{
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),start=app.indexOf("    if(['contract-statistics','contract-trade-side-statistics'].includes(tool.id)){",app.indexOf('  function renderControls(')),end=app.indexOf("    if(tool.id==='exposure-by-expiration'){",start);
  const scopeStart=app.indexOf('  function statisticsContractScope('),scopeEnd=app.indexOf('  async function loadNetDriftContractChoices(',scopeStart);
  assert.ok(start>0&&end>start&&scopeStart>0&&scopeEnd>scopeStart);
  const document={createElement:tag=>new Element(tag,document)};document.body=new Element('body',document);
  const holder=document.createElement('div');holder.insertBefore=node=>holder.append(node);document.body.append(holder);
  const nodes=new Map(),values={tickerOptional:'',mode:'historical',date:'2026-10-16',expiry:'2026-10-23',strike:'700,999'},overrides={page:{},global:{}};
  for(const id of ['expiry','strike','date']){const wrapper=document.createElement('div'),input=document.createElement('input');input.dataset={control:id};input.closest=()=>wrapper;wrapper.append(input);holder.append(wrapper);nodes.set(id,input);}
  let menu,loads=0;const changes=[];
  const env={tool:{id:toolId},holder,commonSessionDateControls:null, netDriftContractControls:null,mountNetDriftContractControls,resolveFilterOverride,getFilterOverrides:()=>overrides,
    element:tag=>{const node=document.createElement(tag);node.style={};return node;},q:selector=>selector==='#toolControls'?holder:nodes.get(/data-control="([^"]+)"/.exec(selector)?.[1]),
    getControl:id=>values[id]??'',setControl:(id,value)=>{values[id]=value;},onControlsChanged:event=>{changes.push(event.target.dataset.control);env.netDriftContractControls.sync();},apiStatus:{market:{}},
    loadNetDriftContractChoices:async scope=>{loads++;assert.equal(scope.ticker,'SPY');return choices;},popup:(anchor,title,build)=>{menu?.remove();menu=document.createElement('section');document.body.append(menu);build(menu);return menu;},
  };
  vm.runInNewContext(app.slice(scopeStart,scopeEnd)+app.slice(start,end),env);
  const expiry=find(holder,node=>node.attributes['aria-label']==='Expiration'),strike=find(holder,node=>node.attributes['aria-label']==='Strike Price');
  assert.equal(expiry.disabled,true);assert.equal(expiry.parent.parent.parent.hidden,true);assert.equal(nodes.get('strike').type,'text');assert.equal(nodes.get('strike').closest().hidden,false);
  expiry.fire('click');await flush();assert.equal(loads,0);assert.equal(values.strike,'700,999');
  values.tickerOptional='SPY';env.netDriftContractControls.sync();assert.equal(nodes.get('strike').type,'hidden');assert.equal(expiry.parent.parent.parent.hidden,false);assert.equal(expiry.disabled,false);
  nodes.get('expiry').disabled=true;env.netDriftContractControls.sync();assert.equal(expiry.disabled,true);assert.equal(strike.disabled,false);
  strike.fire('click');await flush();const boxes=descendants(menu).filter(node=>node.type==='checkbox');assert.deepEqual(boxes.map(node=>node.value),['700','705.5','710']);assert.equal(descendants(menu).some(node=>node.type==='radio'),false);
  assert.deepEqual(boxes.map(box=>box.parent.children[1].textContent),['$700','$705.50','$710']);assert.equal(strike.textContent,'$700 + 1');
  const search=find(menu,node=>node.type==='search');search.value='$705.50';search.fire('input');assert.deepEqual(descendants(menu).filter(node=>node.type==='checkbox').map(node=>node.value),['705.5']);
  const fractional=find(menu,node=>node.type==='checkbox'&&node.value==='705.5');fractional.checked=true;fractional.fire('change');assert.equal(values.strike,'700,705.5,999');assert.deepEqual(changes,['strike']);assert.equal(menu.isConnected,true);assert.equal(strike.textContent,'$700 + 2');assert.equal(strike.title,'$700, $705.50, $999');assert.equal(search.value,'');assert.deepEqual(descendants(menu).filter(node=>node.type==='checkbox').map(node=>[node.value,node.checked]),[['700',true],['705.5',true],['710',false]]);
  search.value='705';search.fire('input');const selected=find(menu,node=>node.type==='checkbox');selected.checked=false;selected.fire('change');assert.equal(search.value,'');assert.equal(values.strike,'700,999');assert.equal(strike.textContent,'$700 + 1');
  find(menu,node=>node.textContent==='Clear all').fire('click');assert.equal(values.strike,'');
  nodes.get('expiry').disabled=false;env.netDriftContractControls.sync();expiry.fire('click');await flush();assert.ok(find(menu,node=>node.textContent==='Clear expiration'));
  overrides.global.tickers=['SPY','QQQ'];env.netDriftContractControls.sync();assert.equal(expiry.disabled,true);assert.equal(expiry.parent.parent.parent.hidden,true);assert.equal(nodes.get('expiry').closest().hidden,false);assert.equal(nodes.get('strike').type,'text');const before=loads;expiry.fire('click');await flush();assert.equal(loads,before);
  overrides.page.tickers=['SPY'];env.netDriftContractControls.sync();assert.equal(expiry.disabled,false);assert.equal(expiry.parent.parent.parent.hidden,false);env.netDriftContractControls.destroy();
});
}
test('picker opens immediately, calendar chooses single actual expiry and is clearable', async () => {
  let resolve;
  const h = harness({ loader: () => new Promise(done => { resolve = done; }) });
  assert.equal(find(h.host, node => node.attributes['aria-label'] === 'Strike Price').parent.hidden, true);
  h.open('Expiration');
  assert.equal(find(h.menu, node => node.textContent === 'Loading choices…').isConnected, true);
  await flush(); resolve(choices); await flush();
  assert.equal(find(h.menu, node => node.attributes['aria-label'] === 'Oct 17, 2026').disabled, true);
  find(h.menu, node => node.attributes['aria-label'] === 'Oct 23, 2026').fire('click');
  assert.deepEqual(h.expiryChanges, ['2026-10-23']);
  assert.equal(find(h.host, node => node.attributes['aria-label'] === 'Strike Price').parent.hidden, false);
  h.open('Expiration'); await flush(); resolve(choices); await flush(); find(h.menu, node => node.textContent === 'Clear expiration').fire('click');
  assert.deepEqual(h.expiryChanges, ['2026-10-23', '']); h.api.destroy();
});
test('multi-strike selection stays open, numeric sorted, searchable and preserves saved selections', async () => {
  const h = harness({ initial: { expiry: '2026-10-23', strikes: [999] } });
  h.open('Strike Price'); await flush(); const menu = h.menu;
  const boxes = () => descendants(menu).filter(node => node.type === 'checkbox');
  assert.deepEqual(boxes().map(node => node.value), ['700', '705.5', '710']);
  assert.deepEqual(boxes().map(node=>node.parent.children[1].textContent),['700','705.5','710']);
  const first = boxes()[0]; first.checked = true; first.fire('change');
  assert.deepEqual(h.strikeChanges, [[700, 999]]); assert.equal(h.menu, menu); assert.equal(menu.isConnected, true);
  const search = find(menu, node => node.type === 'search'); search.value = '71'; search.fire('input');
  assert.deepEqual(boxes().map(node => node.value), ['710']);
  boxes()[0].checked = true; boxes()[0].fire('change');
  assert.deepEqual(h.scope.strikes, [700, 710, 999]); assert.equal(search.value, '71');
  find(menu, node => node.textContent === 'Clear all').fire('click'); assert.deepEqual(h.scope.strikes, []); h.api.destroy();
});
test('late choices from old ticker cannot overwrite current popup; destroy blocks pending work', async () => {
  const pending = [], h = harness({ loader: scope => new Promise(resolve => pending.push({ scope, resolve })) });
  h.open('Expiration'); await flush(); const oldMenu = h.menu;
  h.setScope({ ticker: 'QQQ' }); h.open('Expiration'); await flush();
  pending[0].resolve(choices); await flush(); assert.equal(oldMenu.isConnected, false);
  assert.ok(find(h.menu, node => node.textContent === 'Loading choices…'));
  pending[1].resolve({ expirationDates: ['2026-12-18'], strikePricesByExpiration: {} }); await flush();
  assert.ok(find(h.menu, node => node.textContent === 'December 2026'));
  h.open('Expiration'); await flush(); const lastMenu = h.menu; h.api.destroy();
  pending[2].resolve(choices); await flush(); assert.equal(lastMenu.isConnected, false); assert.equal(h.host.children.length, 0);
});
test('disabled controls do not call loader; failed loader remains an in-picker state', async () => {
  let calls = 0;
  const h = harness({ initial: { disabled: true }, loader: async () => { calls++; throw Error('offline'); } });
  h.open('Expiration'); await flush(); assert.equal(calls, 0);
  h.setScope({ disabled: false }); h.open('Expiration'); await flush();
  assert.equal(calls, 1); assert.ok(find(h.menu, node => node.textContent.includes('Contract choices are unavailable'))); h.api.destroy();
});

test('standalone selector has no expiration requirement and uses only actual top-level strikePrices', async () => {
  const h = harness({ standalone: true, loader: async () => ({ strikePrices: [765, 760, 760, '762.5', null, ''], strikePricesByExpiration: { '2026-10-23': [999] } }) });
  assert.equal(find(h.host, node => node.attributes['aria-label'] === 'Expiration'), undefined);
  const trigger = find(h.host, node => node.attributes['aria-label'] === 'Strike Price');
  assert.equal(trigger.disabled, false); assert.equal(trigger.parent.hidden, false);
  h.open('Strike Price'); await flush();
  assert.deepEqual(descendants(h.menu).filter(node => node.type === 'checkbox').map(node => node.value), ['760', '762.5', '765']);
  h.api.destroy();
});

test('standalone multi-selection preserves previous choices/search and supports clear-all', async () => {
  const h = harness({ standalone: true, initial: { strikes: [755] }, loader: async () => ({ strikePrices: [760, 765, 770] }) });
  h.open('Strike Price'); await flush(); const menu = h.menu;
  const search = find(menu, node => node.type === 'search'); search.value = '76'; search.fire('input');
  const boxes = () => descendants(menu).filter(node => node.type === 'checkbox');
  boxes()[0].checked = true; boxes()[0].fire('change');
  boxes()[1].checked = true; boxes()[1].fire('change');
  assert.deepEqual(h.scope.strikes, [755, 760, 765]); assert.equal(h.menu, menu); assert.equal(search.value, '76');
  find(menu, node => node.textContent === 'Clear all').fire('click'); assert.deepEqual(h.scope.strikes, []);
  h.api.destroy();
});

test('standalone scope reset closes old popup and ignores its late inventory response', async () => {
  const pending = [], h = harness({ standalone: true, initial: { strikes: [760, 765] }, loader: scope => new Promise(resolve => pending.push({ scope, resolve })) });
  h.open('Strike Price'); await flush(); const oldMenu = h.menu;
  h.setScope({ ticker: 'QQQ', sessionDate: '2026-10-19', strikes: [] }); h.open('Strike Price'); await flush();
  pending[0].resolve({ strikePrices: [760, 765] }); await flush();
  assert.equal(oldMenu.isConnected, false); assert.ok(find(h.menu, node => node.textContent === 'Loading choices…'));
  pending[1].resolve({ strikePrices: [600, 605] }); await flush();
  assert.deepEqual(descendants(h.menu).filter(node => node.type === 'checkbox').map(node => node.value), ['600', '605']);
  assert.deepEqual(h.scope.strikes, []); h.api.destroy();
});
