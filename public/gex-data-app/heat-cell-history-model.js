import { heatMetricFor } from './exposure-models.js?v=1';
import { optionTradeDetailRequest } from './option-trade-detail-model.js?v=1';
import { sessionMinuteTimestamp } from './snapshot-model.js?v=1';
import {optionTapeField} from './option-tape-interaction-model.js';

// Reference235525/285529: Heat Map Details is a cell-metric series PLUS raw
// Cell Trades. Private645657/610516 routes are not public API integrations.
// Public contracts: /api/docs/endpoints/{heat-map,order-flow-unconsolidated}.
// This module issues no requests and reconstructs no missing observations.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const nyDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const epoch = value => {
  const time = typeof value === 'number' ? finite(value) : typeof value === 'string' && value.trim() ? finite(Date.parse(value)) : null;
  return time !== null && Math.abs(time) <= 8_640_000_000_000_000 ? time : null;
};
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!record(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
}
function fingerprint(request) {
  const source = structuredClone(request);
  delete source.sessionDate; delete source.snapshotTime;
  return JSON.stringify(canonical(source));
}
function cellFilter(selection) {
  return { ...structuredClone(selection.request.filter), ticker: selection.ticker,
    expirationDates: [selection.expirationDate], strikePrices: [selection.strikePrice] };
}

/** Freeze a cell identity to the exact request which produced the clicked map. */
export function heatCellSelection({ request, sessionDate, expirationDate, strikePrice, sourceUnit = 'provider-native' } = {}) {
  if (!record(request) || !record(request.filter)) throw Error('An exact Heat Map request is required.');
  const ticker = request.filter.ticker, metric = heatMetricFor(request.dataMode);
  if (typeof ticker !== 'string' || !/^[A-Z0-9./^_-]{1,16}$/.test(ticker)) throw Error('Choose one exact Heat Map ticker.');
  if (!metric) throw Error('Choose a supported Heat Map metric.');
  const snapshotTime = request.snapshotTime === undefined ? null : epoch(request.snapshotTime);
  if (request.snapshotTime !== undefined && snapshotTime === null) throw Error('Choose a valid Heat Map snapshot.');
  const selectedDate = sessionDate ?? request.sessionDate ?? (snapshotTime === null ? null : nyDate(snapshotTime));
  if (!validDate(selectedDate) || !validDate(expirationDate)) throw Error('Choose valid session and expiration dates.');
  if (request.sessionDate && request.sessionDate !== selectedDate || snapshotTime !== null && nyDate(snapshotTime) !== selectedDate) throw Error('The clicked cell and Heat Map session differ.');
  if (request.sessionDate && request.snapshotTime !== undefined || request.timeRange !== undefined) throw Error('Heat Map accepts one snapshot selector.');
  if (finite(strikePrice) === null || strikePrice < 0) throw Error('Choose the cell strike in dollars.');
  if (typeof sourceUnit !== 'string' || !sourceUnit.trim()) throw Error('Preserve an explicit cell source unit.');
  const source = structuredClone(request);
  source.dataMode = metric.apiName;
  return { ticker, sessionDate: selectedDate, expirationDate, strikePrice, dataMode: metric.apiName,
    sourceUnit, request: source, sourceFingerprint: fingerprint(source) };
}

/** One requested instant, never a loop synthesizing a whole session of reads. */
export function heatCellSnapshotRequest(selection, { snapshotTime } = {}) {
  const request = { ...structuredClone(selection.request), filter: cellFilter(selection) };
  delete request.sessionDate; delete request.snapshotTime;
  if (snapshotTime !== undefined) {
    const time = epoch(snapshotTime);
    if (time === null || nyDate(time) !== selection.sessionDate) throw Error('Choose a snapshot within this cell session.');
    request.snapshotTime = new Date(time).toISOString();
  } else request.sessionDate = selection.sessionDate;
  return request;
}

// Source381567 metadata and489583 detail paging: every cell ranks descending by
// its filterField. Net exposure/volume use execution size, not signed exposure;
// Net Trade Count uses trade time. Public fields retain provider-dollar units.
export function heatCellTradeSort(dataMode){
  const metric=heatMetricFor(dataMode);if(!metric)throw Error('Choose a supported Heat Map trade sort.');
  let key;
  if(metric.group==='Net')key=metric.exposure||metric.sourceName==='VOLUME'?'size':{OPEN_INTEREST:'openInterest',PREMIUM:'premium',TRADE_COUNT:'tradeTime'}[metric.sourceName];
  else{const name=metric.sourceName.replace(/^(?:CALL|PUT)_/,'');key={ASK_PRICE:'askPrice',BID_PRICE:'bidPrice',OPTION_PRICE:'optionPrice',IMPLIED_VOLATILITY:'impliedVolatility'}[name]??`greeks.${name.toLowerCase()}`;}
  const field=optionTapeField(key);if(!field||field.consolidatedOnly)throw Error('This Heat Map mode has no supported individual-print sort.');
  return {field:field.field,direction:'DESCENDING'};
}

/** Real individual prints. Heat Map metric units never rescale trade premiums. */
export function heatCellTradeRequest(selection, { cursor, size = 100 } = {}) {
  const filter = cellFilter(selection);
  if (selection.dataMode.startsWith('CALL_')) filter.contractTypes = ['CALL'];
  if (selection.dataMode.startsWith('PUT_')) filter.contractTypes = ['PUT'];
  const request = optionTradeDetailRequest({ base: { sessionDate: selection.sessionDate,
    filter: selection.request.filter, filterExpression: selection.request.filterExpression },
    filter, cursor, size, sort:heatCellTradeSort(selection.dataMode) });
  const snapshotTime = epoch(selection.request.snapshotTime);
  if (snapshotTime !== null) {
    // Preserve the exact selected upper boundary, never request later trades.
    const start = sessionMinuteTimestamp(selection.sessionDate, 0, { openMinute: 0 });
    delete request.sessionDate;
    if (snapshotTime <= start) throw Error('No earlier trades exist in this selected session instant.');
    request.timeRange = { startTime: new Date(start).toISOString(), endTime: new Date(snapshotTime).toISOString() };
  }
  return request;
}

/**
 * Actual ExposureArchiver {ts,path,request,payload} frames only. SnapshotTime
 * carries provider time; a same-session live capture carries OBSERVATION time,
 * not a claimed exchange update timestamp. A past session fetched today cannot
 * be relabeled as today's intraday history. Missing cells/legs remain null.
 * Heat Map payloads are complete metric snapshots even for SUM modes: never
 * accumulate successive snapshot totals as the private incremental API does.
 */
export function heatCellSnapshotHistory(captures, selection, { throughMs = Infinity } = {}) {
  if (!Array.isArray(captures) || typeof throughMs !== 'number' || Number.isNaN(throughMs)) throw Error('Choose recorded cell frames and a valid replay boundary.');
  const metric = heatMetricFor(selection.dataMode), rows = new Map();
  for (const capture of captures) {
    if (!record(capture) || !/^\/(?:v\d+\/)?options\/(?:tool\/)?heat-map$/.test(capture.path ?? '')
      || !record(capture.request) || !record(capture.payload) || fingerprint(capture.request) !== selection.sourceFingerprint) continue;
    const receivedAtMs = typeof capture.ts === 'number' ? epoch(capture.ts) : null, pinned = capture.request.snapshotTime !== undefined;
    const time = pinned ? epoch(capture.request.snapshotTime) : receivedAtMs;
    if (time === null || time > throughMs || nyDate(time) !== selection.sessionDate) continue;
    if (!pinned && capture.request.sessionDate && capture.request.sessionDate !== selection.sessionDate) continue;
    const expiry = capture.payload.data?.[selection.expirationDate];
    const candidates = record(expiry) ? Object.entries(expiry).filter(([strike]) => strike.trim() && Number(strike) === selection.strikePrice) : [];
    // Ambiguous duplicate numeric strike aliases are not arbitrarily selected.
    const cell = candidates.length === 1 && record(candidates[0][1]) ? candidates[0][1] : null;
    const single = capture.payload.type === 'single', contract = capture.payload.type === 'contract';
    const call = contract ? finite(cell?.callValue) : null, put = contract ? finite(cell?.putValue) : null;
    const value = single ? finite(cell?.value) : call !== null && put !== null ? metric.exposure ? call + put : call - put : null;
    const row = { time, receivedAtMs, basis: pinned ? 'snapshot' : 'observation', call, put, value,
      ticker: selection.ticker, expirationDate: selection.expirationDate, strikePrice: selection.strikePrice,
      dataMode: selection.dataMode, sourceUnit: selection.sourceUnit };
    const previous = rows.get(time);
    if (!previous || (receivedAtMs ?? -Infinity) > (previous.receivedAtMs ?? -Infinity)) rows.set(time, row);
  }
  return [...rows.values()].sort((a, b) => a.time - b.time);
}
