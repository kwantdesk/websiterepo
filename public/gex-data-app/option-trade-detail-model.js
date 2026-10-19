import { CONSOLIDATED_COLUMNS } from './options-models.js?v=2';

// Public REST raw prints, not the reference dashboard's private cliff endpoint.
// https://quantdata.us/api/docs/endpoints/order-flow-unconsolidated
export const OPTION_TRADE_DETAIL_ENDPOINT = 'order-flow-unconsolidated';
export const UNCONSOLIDATED_COLUMNS = Object.freeze(CONSOLIDATED_COLUMNS.filter(column => column.key !== 'tradeConsolidationType'));

function rejectConsolidatedFields(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const field = key.replace(/[^a-z0-9]/gi, '').toUpperCase();
    const namedField = key === 'field' ? String(child).replace(/[^a-z0-9]/gi, '').toUpperCase() : field;
    if (['TRADECONSOLIDATIONTYPE', 'TRADECONSOLIDATIONTYPES', 'CONSOLIDATIONTYPE', 'ISGOLDENSWEEP'].includes(namedField)) throw Error('A consolidated-only filter cannot be applied to individual option prints.');
    rejectConsolidatedFields(child);
  }
}

export function optionTradeDetailRequest({ base = {}, filter = {}, timeRange, cursor, size = 100 } = {}) {
  if (!Number.isInteger(size) || size < 1 || size > 100) throw Error('Choose between 1 and 100 individual prints per page.');
  const combinedFilter = { ...(base.filter || {}), ...filter };
  rejectConsolidatedFields(combinedFilter);
  rejectConsolidatedFields(base.filterExpression);
  const request = {
    ...(base.sessionDate ? { sessionDate: base.sessionDate } : {}),
    ...(Object.keys(combinedFilter).length ? { filter: structuredClone(combinedFilter) } : {}),
    ...(base.filterExpression ? { filterExpression: structuredClone(base.filterExpression) } : {}),
    sort: { field: 'PREMIUM', direction: 'DESCENDING' }, size,
  };
  const range = timeRange ?? base.timeRange;
  if (range) {
    const start = Date.parse(String(range.startTime)), end = Date.parse(String(range.endTime));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw Error('Choose a valid option-print time window.');
    delete request.sessionDate;
    request.timeRange = { startTime: range.startTime, endTime: range.endTime };
  }
  if (cursor !== undefined && cursor !== null) request.searchAfter = structuredClone(cursor);
  return request;
}

export function unconsolidatedTradeRows(payload) {
  if (!payload || !Array.isArray(payload.data) || payload.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('The individual option-print response is invalid.');
  // Exact licensed prices, premiums, side codes, IDs and Greeks pass through.
  // Never invent a consolidation category or reconstruct dollars from prices.
  return payload.data.map(row => ({ ...row }));
}
