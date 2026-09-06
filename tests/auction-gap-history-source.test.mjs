import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AuctionGapHistorySource } from '../src/lib/auctionGapHistorySource.ts';
const request = { symbol: 'NQ', contractSymbol: 'NQU6', timeframe: '1m', fromMs: 1000, toMs: 2000 };

test('raw envelopes reach only explicit requested symbol/contract subscribers without completeness promotion', () => {
  const source = new AuctionGapHistorySource(), received = [];
  const off = source.subscribe('NQ', 'NQU6', event => received.push(event));
  const payload = { contractSymbol: 'WRONG', records: [{ sideSemanticsVersion: 1, flowOnly: true }], truncated: false };
  source.publish({ ...request, contractSymbol: 'NQZ6' }, payload); assert.equal(received.length, 0);
  source.publish(request, payload);
  assert.equal(received[0].payload, payload); assert.equal(received[0].payload.contractSymbol, 'WRONG');
  assert.equal(received[0].payload.records[0].flowOnly, true);
  assert.equal(received[0].coverage, undefined);
  assert.ok(Object.isFrozen(received[0].request)); off(); assert.equal(source.subscriberCount, 0);
});

test('delivery failures cannot abort sibling consumers or the shared request', () => {
  const source = new AuctionGapHistorySource(), events = [];
  source.subscribe('NQ', 'NQU6', () => { throw Error('study failed'); });
  source.subscribe('NQ', 'NQU6', event => events.push(event));
  assert.doesNotThrow(() => source.publish(request, {})); source.publish(request, {});
  assert.deepEqual(events.map(e => e.revision), [1, 2]);
});

test('unsubscribe releases listeners and subscription does not replay a retained response', () => {
  const source = new AuctionGapHistorySource(), events = [];
  const off = source.subscribe('NQ', 'NQU6', event => events.push(event));
  source.publish(request, {}); off(); off(); source.publish(request, {});
  assert.equal(source.subscriberCount, 0);
  source.subscribe('NQ', 'NQU6', event => events.push(event)); assert.equal(events.length, 1);
});

test('actual existing history fetch publishes original response before persistent merging', () => {
  const text = fs.readFileSync(new URL('../src/lib/institutionalMarketData.ts', import.meta.url), 'utf8');
  const method = text.slice(text.indexOf('export async function fetchInstitutionalOrderFlowLevels'), text.indexOf('export async function fetchInstitutionalOrderFlowLevels') + 4200);
  assert.ok(method.indexOf('auctionGapHistorySource.publish(args, payload)') > method.indexOf('const result: InstitutionalOrderFlowResult'));
  assert.ok(method.indexOf('auctionGapHistorySource.publish(args, payload)') < method.indexOf('await persistMergedInstitutionalOrderFlowResult'));
});

test('chart history opts into compact rows only for an active Auction Gap pane and keeps request identities separate', () => {
  const workspace = fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(workspace, /instance\.enabled && instance\.indicatorId === "auction-gap-tracker"/);
  assert.match(workspace, /auctionGapExpectedContract \? "&auctionGap=1" : ""/);
  assert.match(workspace, /::auction-gap:\$\{auctionGapExpectedContract\.toUpperCase\(\)\}/);
  assert.match(workspace, /acceptAuctionGapCompactRows\([\s\S]*?payload\.auctionGap,[\s\S]*?providerCandles,[\s\S]*?auctionGapExpectedContract/);
});
