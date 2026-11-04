import { abbreviate, currencyAbbreviated, currencyAuto } from './number-format.js?v=2';
import { niceValueDomain } from './exposure-models.js?v=1';

// Inert shipped evidence26k4mykzwgrj-.js SHA256
//8a14cd7926b1681311ebbecf59cec8881677320871c350d90987fef33f62656e:
// tooltip786050 byte3028589; RTH928216 byte1273133; volume502083 byte1842520.
// Formatter886167/percentageChange635219/date195863 are in2zz6w3ti8kt-y.js.
// Inputs are normalized REAL rows: premium/spot dollars and volume contracts.
// No requests, cumulative flow reconstruction, missing quotes or interpolation.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;
const validTime = value => finite(value) && Math.abs(value) <= 8_640_000_000_000_000;
const measured = value => finite(value) ? value : null;
const signedAbbreviation = value => !finite(value) ? '—' : value < 0 ? '-' + abbreviate(-value, 2) : abbreviate(value, 2);
const percentAlways = value => {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
};
const direction = value => value === null ? null : value > 0 ? 'up' : value < 0 ? 'down' : 'flat';

/**
 * Source971668 eR: a resolved single ticker AND global ticker count below2.
 * Eligibility controls underlying-required preprocessing even if every source
 * quote is missing. Never determine the filter's scope from payload contents.
 * The caller passes the already-resolved request; globals are only the source
 * count gate, not a second inferred ticker override.
 */
export function netDriftUnderlyingScope(request, globalTickers = []) {
  const absent = { ticker: null, eligible: false };
  if (!request || typeof request !== 'object' || !request.filter || typeof request.filter !== 'object'
    || Array.isArray(request.filter) || !Array.isArray(globalTickers)) return absent;
  const filter = request.filter;
  const normalize = value => typeof value === 'string' && /^[A-Z0-9./^_-]{1,16}$/i.test(value.trim()) ? value.trim().toUpperCase() : null;
  const single = filter.ticker === undefined ? null : normalize(filter.ticker);
  if (filter.ticker !== undefined && single === null) return absent;
  let listed = null;
  if (filter.tickers !== undefined) {
    if (!Array.isArray(filter.tickers) || filter.tickers.length !== 1) return absent;
    listed = normalize(filter.tickers[0]);
    if (listed === null) return absent;
  }
  if (single !== null && listed !== null && single !== listed) return absent;
  const ticker = single ?? listed;
  return { ticker, eligible: ticker !== null && globalTickers.length < 2 };
}

function timeOnDate(time, timeZone) {
  if (!validTime(time)) return '—';
  // Source195863 Formats.timeOnDate: h:mm a 'on' DDD; shipped Luxon DDD
  // expands DATE_FULL (long month/day/year), never the machine's local zone.
  const clock = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(time).replace(/[\u00a0\u202f]/g, ' ');
  const date = new Intl.DateTimeFormat('en-US', { timeZone, month: 'long', day: 'numeric', year: 'numeric' }).format(time);
  return `${clock} on ${date}`;
}

/** A semantic tooltip retains every observed value even if its line is hidden. */
export function netDriftTooltipModel(row, rows = [], { showBands = false, timeZone = 'America/New_York' } = {}) {
  if (!row || typeof row !== 'object' || !Array.isArray(rows)) return null;
  const call = measured(row.call), put = measured(row.put), difference = call !== null && put !== null ? call - put : null;
  const entry = (key, label, value, format = currencyAbbreviated) => ({ key, label, value, formatted: format(value, 2) });
  const entries = [entry('call', 'Net Call Premium:', call), entry('put', 'Net Put Premium:', put),
    { ...entry('net', 'Net Premium Difference:', difference), direction: direction(difference) }];
  if (showBands) entries.push(entry('callBand', 'Midpoint Call Premium:', measured(row.callBand)), entry('putBand', 'Midpoint Put Premium:', measured(row.putBand)));
  const volume = measured(row.netVolume);
  entries.push({ ...entry('netVolume', 'Net Volume:', volume, signedAbbreviation), direction: direction(volume) });
  let firstSpot = null, changePoints = null;
  if (positive(row.spot)) {
    // Earliest proven quote at/before the hovered bucket; never use a quote
    // from a later bucket to construct the hovered point's percent change.
    const first = rows.filter(value => value && validTime(value.time) && validTime(row.time) && value.time <= row.time && positive(value.spot)).sort((a, b) => a.time - b.time)[0];
    firstSpot = first?.spot ?? null;
    if (firstSpot !== null) changePoints = (row.spot - firstSpot) / Math.abs(firstSpot) * 100;
    entries.push({ key: 'spot', label: 'Underlying Price:', value: row.spot, firstSpot, changePoints,
      direction: direction(changePoints), formatted: currencyAuto(row.spot) + (changePoints === null ? '' : ` (${percentAlways(changePoints)})`) });
  }
  return { title: timeOnDate(row.time, timeZone), entries, hint: 'Click for more information', firstSpot, changePoints };
}

/** Plain rows for the existing quantCanvas tooltip; model also exposes tones. */
export function netDriftTooltipRows(row, rows = [], options = {}) {
  const model = netDriftTooltipModel(row, rows, options);
  return model ? [model.title, ...model.entries.map(entry => `${entry.label} ${entry.formatted}`), model.hint] : [];
}

/** Source928216 resets to the first category at/after09:30 New York. */
export function netDriftInitialRthIndex(rows = []) {
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const index = rows.findIndex(row => {
    if (!row || !validTime(row.time)) return false;
    const parts = Object.fromEntries(clock.formatToParts(row.time).map(part => [part.type, part.value]));
    return Number(parts.hour) * 60 + Number(parts.minute) >= 570;
  });
  return index < 0 ? null : index;
}

/** Raw finite volume extents, anchored at zero, target4; no added2% padding. */
export function netDriftVolumeDomain(rows = []) {
  let min = 0, max = 0, count = 0;
  for (const row of rows) if (finite(row?.netVolume)) { min = Math.min(min, row.netVolume); max = Math.max(max, row.netVolume); count++; }
  return count ? niceValueDomain(min, max, 4) : niceValueDomain(0, 1, 4);
}
