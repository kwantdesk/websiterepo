import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { additionalToolRequest } from '../../public/gex-data-app/additional-tool-requests.js';
import {equityPrintRequest} from '../../public/gex-data-app/equity-print-interaction-model.js';
import {notificationRequest,notificationReferenceSession} from '../../public/gex-data-app/exchange-notification-interaction-model.js';
import { resolveFilterOverride, expirationFilterForTool } from '../../public/gex-data-app/preferences-model.js';

const source = readFileSync(new URL('../../public/gex-data-app/app.js', import.meta.url), 'utf8');
function actual(name) {
  const match = new RegExp(`^  function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Actual app function ${name} must exist`);
  const tail = source.slice(match.index + match[0].length), next = /^  (?:async )?function /m.exec(tail);
  assert.ok(next, `Function boundary after ${name}`);
  return source.slice(match.index, match.index + match[0].length + next.index);
}
const definitionsStart = source.indexOf('  const TOOL_DEFINITIONS = ['), definitionsEnd = source.indexOf('  const FILTER_GROUP_TOOLS=', definitionsStart);
assert.ok(definitionsStart >= 0 && definitionsEnd > definitionsStart);
const definitions = vm.runInNewContext(source.slice(definitionsStart, definitionsEnd) + '\nTOOL_DEFINITIONS;');
const plain = value => JSON.parse(JSON.stringify(value));

// Only nodes declared by the actual tool metadata exist. In particular, an
// override must not manufacture a missing expiry/ticker DOM control.
function harness(toolId, overrides = { page: {}, global: {} }) {
  const activeTool = definitions.find(tool => tool.id === toolId);
  assert.ok(activeTool, `Actual tool ${toolId} exists`);
  const defaults = { mode: 'latest', date: '', ticker: 'QQQ', tickerOptional: '', period: '1m',
    rangeStart: '2026-10-16', rangeEnd: '2026-10-16', lookback: '365', maturity: '30',
    greek: 'GAMMA', representation: 'PER_ONE_PERCENT_MOVE' };
  const nodes = new Map(activeTool.controls.map(id => [id, { dataset: {}, value: defaults[id] ?? '' }]));
  const holder = {}, env = { activeTool, masterReplay: null, toolCursor: null,
    apiStatus: { market: { sessionDate: '2026-10-16', optionsSessionDate: '2026-10-16' } },
    q: selector => selector === '#toolControls' ? holder : nodes.get(/data-control="([^"]+)"/.exec(selector)?.[1]),
    getFilterOverrides: () => overrides, resolveFilterOverride, expirationFilterForTool, additionalToolRequest,equityPrintRequest,equityPrintHeaderFilters:()=>[],notificationRequest,notificationReferenceSession,notificationHeaderFilters:()=>[],
    FILTER_GROUP_TOOLS: new Set(),
  };
  vm.createContext(env);
  vm.runInContext(['getControl', 'requestBase', 'maybeFilter', 'buildRequest'].map(actual).join('\n') +
    '\nthis.api={getControl,buildRequest};', env);
  return { nodes, getControl: env.api.getControl, request: () => plain(env.api.buildRequest(activeTool)) };
}

const incompatibleExpiryTools = ['dark-flow', 'dark-pool-levels', 'equity-prints', 'exchange-notifications',
  'market-map', 'stock-price-over-time', 'iv-rank', 'max-pain-over-time'];
test('Market Map actual request retains multiple observed sectors/industries under page/global overrides',()=>{
  const h=harness('market-map',{page:{sessionDate:'2026-10-15'},global:{tickers:['SPY']}});
  h.nodes.get('sector').value='TECHNOLOGY, FINANCIAL_SERVICES';
  h.nodes.get('industry').value='SOFTWARE_INFRASTRUCTURE, BANKS_REGIONAL';
  assert.deepEqual(h.request().filter,{sectors:['TECHNOLOGY','FINANCIAL_SERVICES'],industries:['SOFTWARE_INFRASTRUCTURE','BANKS_REGIONAL']});
  assert.equal(h.request().sessionDate,'2026-10-15');
});
for (const scope of ['page', 'global']) {
  for (const toolId of incompatibleExpiryTools) {
    test(`${toolId}: ${scope} option expiry does not leak into an endpoint without that field`, () => {
      const overrides = { page: {}, global: {} }; overrides[scope] = { expirationDate: '2026-11-20' };
      const h = harness(toolId, overrides);
      assert.equal(h.nodes.has('expiry'), false);
      assert.equal(h.getControl('expiry'), '', 'A missing DOM control remains absent despite overrides');
      const filter = h.request().filter ?? {};
      assert.equal(Object.hasOwn(filter, 'expirationDates'), false);
      assert.equal(Object.hasOwn(filter, 'expirationDate'), false);
      assert.equal(Object.hasOwn(filter, 'expirationDateRange'), false);
    });
  }

  test(`Market Map: ${scope} ticker does not manufacture an unsupported convenience filter`, () => {
    const overrides = { page: {}, global: {} }; overrides[scope] = { tickers: ['SPY', 'QQQ'] };
    const h = harness('market-map', overrides);
    assert.equal(h.nodes.has('ticker'), false);
    assert.equal(h.nodes.has('tickerOptional'), false);
    assert.equal(h.getControl('ticker'), '');
    const filter = h.request().filter ?? {};
    assert.equal(Object.hasOwn(filter, 'ticker'), false);
    assert.equal(Object.hasOwn(filter, 'tickers'), false);
  });

  test(`Exposure by Expiration: legal ${scope} expiry survives via explicit endpoint override`, () => {
    const overrides = { page: {}, global: {} }; overrides[scope] = { expirationDate: '2026-11-20' };
    const h = harness('exposure-by-expiration', overrides);
    assert.equal(h.nodes.has('expiry'), false);
    assert.equal(h.getControl('expiry'), '');
    const body = h.request();
    assert.deepEqual(body.filter.expirationDates, ['2026-11-20']);
    assert.equal(body.filter.ticker, 'QQQ');
    assert.equal(body.greekMode, 'GAMMA');
    assert.equal(body.representationMode, 'PER_ONE_PERCENT_MOVE');
  });
}

test('Actual mode, date, ticker and expiry nodes still reflect page/global overrides with page precedence', () => {
  const h = harness('net-drift', { global: { tickers: ['QQQ'], sessionDate: '2026-10-15', expirationDate: '2026-10-23' },
    page: { tickers: ['SPY'], sessionDate: '2026-10-16', expirationDate: '2026-11-20' } });
  assert.equal(h.getControl('mode'), 'historical');
  assert.equal(h.getControl('date'), '2026-10-16');
  assert.equal(h.getControl('ticker'), 'SPY');
  assert.equal(h.getControl('expiry'), '2026-11-20');
  assert.deepEqual(h.request(), { sessionDate: '2026-10-16', filter: { tickers: ['SPY'], expirationDates: ['2026-11-20'] } });
  assert.equal(h.nodes.get('ticker').value, 'QQQ', 'Reading overrides does not mutate the underlying saved control');
});

test('No overrides preserve the tool defaults and Dark Pool Levels dedicated date range', () => {
  assert.deepEqual(harness('dark-pool-levels').request(), {
    filter: { ticker: 'QQQ' }, sessionDateRange: { startDate: '2026-10-16', endDate: '2026-10-16' },
  });
  assert.deepEqual(harness('iv-rank').request(), { filter: { ticker: 'QQQ' }, lookBackPeriod: 365, maturity: 30 });
});
