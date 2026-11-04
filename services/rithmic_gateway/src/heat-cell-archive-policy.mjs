import { createHash } from 'node:crypto';

export const heatRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const heatFinite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
export const heatDateOf = value => { const p = Object.fromEntries(clock.formatToParts(value).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const net = ['CHARM_EXPOSURE','DELTA_EXPOSURE','GAMMA_EXPOSURE','VANNA_EXPOSURE','OPEN_INTEREST','PREMIUM','TRADE_COUNT','VOLUME'];
const leg = ['ASK_PRICE','BID_PRICE','CHARM','COLOR','DELTA','GAMMA','IMPLIED_VOLATILITY','OMEGA','OPTION_PRICE','RHO','SIGMA','SPEED','THETA','ULTIMA','VANNA','VEGA','VETA','VOMMA','ZOMMA'];
const modes = new Set([...net.map(x => `NET_${x}`), ...['CALL','PUT'].flatMap(side => leg.map(x => `${side}_${x}`))]);
export function heatProblem(code, status = 400) { return Object.assign(new Error(code), { code, status }); }
export function heatEnsure(value, code = 'heat_cell_invalid_request', status = 400) { if (!value) throw heatProblem(code, status); }
function canonical(value, depth = 0) {
  heatEnsure(depth <= 12);
  if (Array.isArray(value)) { heatEnsure(value.length <= 500); return value.map(x => canonical(x, depth + 1)); }
  if (!heatRecord(value)) return value;
  heatEnsure(!Object.keys(value).some(key => ['__proto__','prototype','constructor'].includes(key)));
  return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key], depth + 1)]));
}
export function heatFingerprint(request) { const copy = { ...request }; delete copy.sessionDate; delete copy.snapshotTime; return JSON.stringify(canonical(copy)); }
export function validateHeatCellArchiveQuery(input, now = Date.now()) {
  heatEnsure(heatRecord(input) && Object.keys(input).every(key => ['request','sessionDate','expirationDate','strikePrice','throughMs','cursor','limit'].includes(key)));
  const { request, sessionDate, expirationDate, strikePrice } = input;
  heatEnsure(heatRecord(request) && heatRecord(request.filter)); canonical(request);
  heatEnsure(validDate(sessionDate) && sessionDate <= heatDateOf(now) && validDate(expirationDate));
  const ticker = request.filter.ticker, dataMode = request.dataMode;
  heatEnsure(typeof ticker === 'string' && /^[A-Z0-9.^_-]{1,16}$/.test(ticker) && modes.has(dataMode));
  heatEnsure(heatFinite(strikePrice) !== null && strikePrice >= 0);
  heatEnsure(request.timeRange === undefined && !(request.sessionDate && request.snapshotTime !== undefined));
  heatEnsure(!request.sessionDate || request.sessionDate === sessionDate);
  const pin = request.snapshotTime === undefined ? null : Date.parse(request.snapshotTime);
  heatEnsure(pin === null || Number.isFinite(pin) && heatDateOf(pin) === sessionDate);
  const throughMs = input.throughMs ?? Math.min(now, pin ?? now);
  heatEnsure(heatFinite(throughMs) !== null && throughMs > 0 && throughMs <= now);
  heatEnsure(pin === null || throughMs <= pin);
  const limit = input.limit ?? 256;
  heatEnsure(Number.isInteger(limit) && limit >= 1 && limit <= 256);
  heatEnsure(input.cursor === undefined || typeof input.cursor === 'string' && input.cursor.length <= 2048);
  const sourceFingerprint = heatFingerprint(request), scope = createHash('sha256').update(JSON.stringify({ sourceFingerprint, sessionDate, expirationDate, strikePrice, throughMs })).digest('hex');
  return { request: structuredClone(request), ticker, dataMode, sessionDate, expirationDate, strikePrice, throughMs, limit, cursor: input.cursor, sourceFingerprint, scope };
}
