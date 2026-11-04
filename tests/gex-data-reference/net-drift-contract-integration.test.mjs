import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { additionalToolRequest } from '../../public/gex-data-app/additional-tool-requests.js';
import {toolControlDefault} from '../../public/gex-data-app/tool-control-defaults.js';

const source = readFileSync(new URL('../../public/gex-data-app/app.js', import.meta.url), 'utf8');
function actual(name) {
  const match = new RegExp(`^  (?:async )?function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Actual app function ${name} must exist`);
  const tail = source.slice(match.index + match[0].length), next = /^  (?:async )?function /m.exec(tail);
  assert.ok(next, `Function boundary after ${name}`);
  return source.slice(match.index, match.index + match[0].length + next.index);
}
// The historical bug is browser input[type=number] value sanitation. This
// focused DOM harness models that rule (including changing the input type),
// rather than using an unconstrained object.value that hides the regression.
class Element {
  constructor(tag) { this.tagName = tag; this.dataset = {}; this.children = []; this._value = ''; this._type = ''; this.className = ''; }
  get type() { return this._type; }
  set type(value) { this._type = value; this.value = this._value; }
  get value() { return this._value; }
  set value(value) { const text = String(value); this._value = this._type === 'number' && text !== '' && (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(Number(text))) ? '' : text; }
  append(...items) { this.children.push(...items); }
  replaceChildren() { this.children = []; }
  add(option) { this.children.push(option); }
}
const descend = node => [node, ...node.children.flatMap(descend)];
const plain = value => JSON.parse(JSON.stringify(value));
function harness({ toolId = 'net-drift', saved, copied } = {}) {
  const holder = new Element('div'), storage = new Map(), controls = toolId === 'exposure-by-expiration' ? ['ticker', 'strike'] : toolId==='option-price-over-time'?['ticker','expiry','strike','contractType','osi']:['contract-statistics','contract-trade-side-statistics'].includes(toolId)?['tickerOptional','expiry','strike']:['ticker', 'expiry', 'strike'];
  const choiceCalls=[];
  const env = { console, structuredClone, toolControlDefault, activeTool: { id: toolId, endpoint:toolId, view: toolId === 'exposure-by-expiration' ? 'exposureExpiration' : 'netDrift', controls }, CONTROL_OPTIONS: Object.fromEntries(['moneyType','tradeSide'].map(id=>[id,JSON.parse(source.match(new RegExp(`^\\s*${id}:\\s*(\\[\\[.*\\]\\]),$`,'m'))[1])])),
    multiChoiceDropdown:options=>{choiceCalls.push(plain(options));return new Element('input');},
    instrumentChoices: () => [['SPY', 'SPY'], ['QQQ', 'QQQ']], document: { createElement: tag => new Element(tag) },
    Option: function (text, value) { this.text = text; this.value = value; this.children = []; },
    element: (tag, cls) => { const node = new Element(tag); node.className = cls; return node; },
    q: selector => selector === '#toolControls' ? holder : descend(holder).find(node => node.dataset?.control === /data-control="([^"]+)"/.exec(selector)?.[1]),
    qa: () => descend(holder).filter(node => node.dataset?.control), todayOffset: () => '2026-10-16',
    savedToolControls: saved ? { [toolId]: { ...saved } } : {}, VIEW_PARAMETERS: new URLSearchParams(copied ? { instance: 'copied', ...copied } : {}),
    commonSessionDateControls:null, netDriftContractControls:null, getFilterOverrides: () => ({ page: {}, global: {} }), resolveFilterOverride: () => ({ type: 'NONE' }),
    setChoiceValue: (node, value) => { node.value = value; }, masterReplay: null, apiStatus: { market: { sessionDate: '2026-10-16' } },
    toolCursor: null, FILTER_GROUP_TOOLS: new Set(), additionalToolRequest,
    toolSeriesOptions: () => [], EMBEDDED: false, toolPayload: null, clearTimeout() {}, setTimeout: () => 1, loadActiveTool() {},
    syncNetDriftDisplayButtons() {}, controlsStorageKey: 'controls', gexStorage: { setItem: (key, value) => storage.set(key, value) },
    snapshotSelections: new Map(),
  };
  env.snapshotKey = tool => `${tool.id}|${env.api.getControl('mode')}|${env.api.getControl('date')}|${env.api.getControl('ticker')}`;
  const metadataStart = source.indexOf('  const CONTROL_META = {'), metadataEnd = source.indexOf('\n  const q =', metadataStart);
  assert.ok(metadataStart >= 0 && metadataEnd > metadataStart);
  // Execute the actual creation + saved/copied restoration order, stopping
  // before unrelated menus/chart rendering and remote metadata integration.
  const render = actual('renderControls'), restorationEnd = render.indexOf('    const surfaceSelections=');
  assert.ok(restorationEnd > 0);
  vm.createContext(env);
  vm.runInContext(source.slice(metadataStart, metadataEnd) + '\nthis.CONTROL_META=CONTROL_META;\n' +
    ['makeControl', 'getControl', 'setControl', 'saveToolControls', 'requestBase', 'maybeFilter', 'buildRequest', 'onControlsChanged'].map(actual).join('\n') +
    '\n' + render.slice(0, restorationEnd) + '\n}\nthis.api={renderControls,makeControl,getControl,setControl,saveToolControls,buildRequest,onControlsChanged};', env);
  env.api.renderControls(env.activeTool);
  return { env, storage, holder, choiceCalls,...env.api, input: id => descend(holder).find(node => node.dataset?.control === id),
    request: () => plain(env.api.buildRequest(env.activeTool)), change: control => env.api.onControlsChanged({ target: { dataset: { control }, value: env.api.getControl(control) } }) };
}

test('negative control: number inputs discard comma selections, hidden inputs preserve them', () => {
  const input = new Element('input'); input.type = 'number'; input.value = '760,765'; assert.equal(input.value, '');
  input.type = 'hidden'; input.value = '760,765'; assert.equal(input.value, '760,765');
});

test('actual Moneyness factory sends source ordered full labels and searchable multiselect, keeping API values',()=>{
  const h=harness({toolId:'contract-statistics'});h.makeControl('moneyType');
  assert.deepEqual(h.choiceCalls[0],{choices:[['ATM','At the Money'],['ITM','In the Money'],['OTM','Out of the Money']],label:'Moneyness',emptyLabel:'All moneyness',searchable:true,compactSummary:true,summaryLabels:{}});
  h.makeControl('tradeSide');assert.equal(h.choiceCalls[1].searchable,true);assert.equal(h.choiceCalls[1].compactSummary,false);assert.deepEqual(h.choiceCalls[1].summaryLabels,{ABOVE_ASK:'AA',ASK:'A',MID_MARKET:'M',BID:'B',BELOW_BID:'BB'});
  assert.deepEqual(h.choiceCalls[1].choices.map(([value])=>[value,h.choiceCalls[1].summaryLabels[value]]),[['ABOVE_ASK','AA'],['ASK','A'],['MID_MARKET','M'],['BID','B'],['BELOW_BID','BB']]);
  h.makeControl('tradeType');assert.equal(h.choiceCalls[2].searchable,false);
});
for (const toolId of ['net-drift', 'exposure-by-expiration','contract-statistics','contract-trade-side-statistics']) {
test(`actual ${toolId} factory is hidden before multi-strike assignment; request retains distinct numeric selections`, () => {
  const h = harness({ toolId }); assert.equal(h.input('strike').type, 'hidden');
  h.setControl('strike', '760,765  760, 770.5');
  assert.equal(h.getControl('strike'), '760,765  760, 770.5');
  assert.deepEqual(h.request().filter.strikePrices, [760, 765, 770.5]);
});
test(`actual ${toolId} saved-control restoration and saving round-trip multiple strikes without sanitation`, () => {
  const tickerKey=toolId.startsWith('contract-')?'tickerOptional':'ticker';
  const h = harness({ toolId, saved: { [tickerKey]: 'SPY', ...(toolId !== 'exposure-by-expiration' ? { expiry: '2026-10-23' } : {}), strike: '760,765' } });
  assert.equal(h.getControl('strike'), '760,765'); assert.deepEqual(h.request().filter.strikePrices, [760, 765]);
  h.saveToolControls(); const persisted = JSON.parse(h.storage.get('controls'));
  assert.equal(persisted[toolId].strike, '760,765');
  assert.deepEqual(harness({ toolId, saved: persisted[toolId] }).request().filter.strikePrices, [760, 765]);
});
test(`actual ${toolId} copied URL restoration retains multiple strikes; existing saved controls win over copy parameters`, () => {
  const copied = { [toolId.startsWith('contract-')?'c_tickerOptional':'c_ticker']: 'SPY', ...(toolId !== 'exposure-by-expiration' ? { c_expiry: '2026-10-23' } : {}), c_strike: '760,765' };
  const h = harness({ toolId, copied }); assert.equal(h.getControl('strike'), '760,765'); assert.deepEqual(h.request().filter.strikePrices, [760, 765]);
  const saved = harness({ toolId, copied, saved: { strike: '770,775' } }); assert.deepEqual(saved.request().filter.strikePrices, [770, 775]);
});
}

for(const toolId of ['contract-statistics','contract-trade-side-statistics']){
test(`${toolId}: ticker changes retain expiry/strikes, expiry changes clear every strike, empty filters mean All`,()=>{
  const h=harness({toolId,saved:{tickerOptional:'SPY',expiry:'2026-10-23',strike:'760,765'}});
  h.setControl('tickerOptional','QQQ');h.change('tickerOptional');assert.equal(h.getControl('expiry'),'2026-10-23');assert.equal(h.getControl('strike'),'760,765');
  assert.deepEqual(h.request().filter.strikePrices,[760,765]);
  h.setControl('expiry','2026-10-30');h.change('expiry');assert.equal(h.getControl('strike'),'');assert.deepEqual(h.request().filter.expirationDates,['2026-10-30']);assert.equal(Object.hasOwn(h.request().filter,'strikePrices'),false);
  h.setControl('expiry','');h.change('expiry');h.setControl('tickerOptional','');h.change('tickerOptional');assert.equal(Object.hasOwn(h.request().filter??{},'expirationDates'),false);assert.equal(Object.hasOwn(h.request().filter??{},'ticker'),false);
});
}
test('other tools keep their original numeric input and scalar/exact-contract request shape', () => {
  const scalar = harness({ toolId: 'exposure-by-strike', saved: { strike: '760' } });
  assert.equal(scalar.input('strike').type, 'number'); assert.deepEqual(scalar.request().filter.strikePrices, [760]);
  const contract = harness({ toolId: 'option-price-over-time', saved: { ticker: 'SPY', expiry: '2026-10-23', strike: '760',contractType:'CALL' } });
  assert.equal(contract.input('strike').type, 'number'); assert.equal(contract.request().filter.strikePrice, 760);
  assert.equal(Object.hasOwn(contract.request().filter, 'strikePrices'), false);
});

test('new normal Contract Price controls start unset and prompt locally rather than silently discover a contract',async()=>{
  const h=harness({toolId:'option-price-over-time'});
  assert.equal(h.getControl('ticker'),'');assert.equal(h.getControl('expiry'),'');assert.equal(h.getControl('strike'),'');assert.equal(h.getControl('contractType'),'');
  let requests=0;h.env.toolFetch=async()=>{requests++;return {data:{}};};
  vm.runInContext(actual('loadToolPayload')+'\nthis.load=loadToolPayload;',h.env);
  await assert.rejects(()=>h.env.load(h.env.activeTool),/Please select a ticker/);assert.equal(requests,0);
  h.setControl('ticker','SPY');await assert.rejects(()=>h.env.load(h.env.activeTool),/expiration date/);
  h.setControl('expiry','2026-10-16');await assert.rejects(()=>h.env.load(h.env.activeTool),/strike price/);
  h.setControl('strike','760');await assert.rejects(()=>h.env.load(h.env.activeTool),/contract type/);assert.equal(requests,0);
});

test('saved and copied exact OSI contracts remain exclusive and never request trade discovery',async()=>{
  const osi='SPY261016C00760000';
  for(const setup of [{saved:{osi}},{copied:{c_osi:osi}}]){
    const h=harness({toolId:'option-price-over-time',...setup});assert.deepEqual(h.request().filter,{osi});
    const requests=[];h.env.toolFetch=async(endpoint,body)=>{requests.push({endpoint,body});return {data:{}};};
    vm.runInContext(actual('loadToolPayload')+'\nthis.load=loadToolPayload;',h.env);
    await h.env.load(h.env.activeTool);
    assert.deepEqual(requests.map(request=>request.endpoint),['option-price-over-time','stock-price-over-time']);
    assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body.filter)),{osi});assert.equal(requests[1].body.filter.ticker,'SPY');
  }
});

test('explicit Contract Price ticker/expiry/strike/type edits clear stale OSI and preserve source reset coupling',()=>{
  const saved={ticker:'SPY',expiry:'2026-10-16',strike:'760',contractType:'PUT',osi:'SPY261016P00760000'};
  for(const [key,value]of [['ticker','QQQ'],['expiry','2026-10-23'],['strike','765'],['contractType','CALL']]){
    const h=harness({toolId:'option-price-over-time',saved});h.setControl(key,value);h.change(key);
    assert.equal(h.getControl('osi'),'');
    assert.equal(h.getControl('contractType'),key==='contractType'?'CALL':'PUT');
    if(key==='ticker'){assert.equal(h.getControl('expiry'),'');assert.equal(h.getControl('strike'),'');}
    else if(key==='expiry'){assert.equal(h.getControl('expiry'),value);assert.equal(h.getControl('strike'),'');}
    else{assert.equal(h.getControl('expiry'),'2026-10-16');assert.equal(h.request().filter.strikePrice,key==='strike'?765:760);}
  }
});
test('actual request rejects invalid multi-strikes instead of sending NaN, zero, negative or partial selections', () => {
  for (const toolId of ['net-drift', 'exposure-by-expiration']) {
  const h = harness({ toolId });
  for (const value of ['760,NaN', '760,Infinity', '760,nope', '760,0', '760,-5', ',', '   ']) {
    h.setControl('strike', value); assert.throws(() => h.request(), /Select valid strike prices/, value);
  }
  h.setControl('strike', ''); assert.equal(Object.hasOwn(h.request().filter, 'strikePrices'), false);
  }
});
test('actual change pipeline clears expiry+strikes on ticker and strikes only on expiry; unrelated changes retain them', () => {
  const h = harness({ saved: { ticker: 'SPY', expiry: '2026-10-23', strike: '760,765' } });
  h.change('strike'); assert.equal(h.getControl('strike'), '760,765');
  h.setControl('expiry', '2026-11-20'); h.change('expiry');
  assert.equal(h.getControl('expiry'), '2026-11-20'); assert.equal(h.getControl('strike'), '');
  h.setControl('strike', '770,775'); h.setControl('ticker', 'QQQ'); h.change('ticker');
  assert.equal(h.getControl('ticker'), 'QQQ'); assert.equal(h.getControl('expiry'), ''); assert.equal(h.getControl('strike'), '');
  assert.equal(h.env.savedToolControls['net-drift'].strike, '');
  const other = harness({ toolId: 'exposure-by-strike', saved: { expiry: '2026-10-23', strike: '760' } });
  other.change('ticker'); assert.equal(other.getControl('expiry'), '2026-10-23'); assert.equal(other.getControl('strike'), '760');
});

test('Exposure by Expiration ticker change clears its multiple strikes and pinned snapshot without Net Drift expiry behavior', () => {
  const h = harness({ toolId: 'exposure-by-expiration', saved: { ticker: 'SPY', strike: '760,765' } });
  assert.equal(h.input('expiry'), undefined, 'source expiration profile has no expiry selector');
  h.change('strike'); assert.equal(h.getControl('strike'), '760,765');
  h.change('greek'); assert.equal(h.getControl('strike'), '760,765', 'unrelated presentation/data changes retain chosen strikes');
  h.setControl('ticker', 'QQQ');
  const key = h.env.snapshotKey(h.env.activeTool); h.env.snapshotSelections.set(key, 1792157400000);
  h.change('ticker');
  assert.equal(h.getControl('ticker'), 'QQQ'); assert.equal(h.getControl('strike'), '');
  assert.equal(h.env.savedToolControls['exposure-by-expiration'].strike, '');
  assert.equal(h.env.snapshotSelections.has(key), false, 'source resets numberOfMinutesIntoMarketOpen to latest on ticker change');
});
