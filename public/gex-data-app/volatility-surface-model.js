// Pure presentation models for the licensed public REST responses. No requests,
// invented observations, implicit unit detection or mutation of source payloads.
// Public docs: https://quantdata.us/api/docs/endpoints/{net-flow,volatility-skew,
// volatility-drift,term-structure,open-interest-by-strike}.
// IV documentation says fractions, but the actual licensed responses captured
// 2026-11-03 (SPY/2026-10-16) use percentage points. The unit is explicit below;
// tiny IVs and far wings (including >1000%) must never trigger guessed scaling.
// Reference behavior: 26k4mykzwgrj-.js SHA256
// 8a14cd7926b1681311ebbecf59cec8881677320871c350d90987fef33f62656e,
// modules732868/481754/478432; Net Flow714865 in3aqw9_t8yu-uk.js SHA256
// 8f9052d3ba617756b68d86c1a44437df3786047d6637847b62556d87268b8a8a.

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};
const nonnegative = value => { const result = finite(value); return result !== null && result >= 0 ? result : null; };
const positive = value => { const result = finite(value); return result !== null && result > 0 ? result : null; };
const dataOf = payload => isRecord(payload) && isRecord(payload.data) ? payload.data : {};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const dateOrdinal = value => Date.parse(`${value}T00:00:00Z`) / 86_400_000;
const timeOf = key => /^\d+$/.test(key) && Number.isSafeInteger(Number(key)) && Number(key) <= 8_640_000_000_000_000 ? Number(key) : null;
const averageAvailable = values => {
  const present = values.filter(value => value !== null);
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
};
const moneyTypeOf = value => ({ ATM: 'AT_THE_MONEY', ITM: 'IN_THE_MONEY', OTM: 'OUT_OF_THE_MONEY' }[value] ?? value);

function ivConverter(unit) {
  if (!['percentage-points', 'fraction'].includes(unit)) throw new TypeError('Choose an explicit volatility unit.');
  return value => {
    const result = nonnegative(value);
    return result === null ? null : result * (unit === 'fraction' ? 100 : 1);
  };
}

function contractSelection(values) {
  if (!Array.isArray(values) || values.some(value => !['CALL', 'PUT'].includes(value))) throw new TypeError('Choose calls, puts or both.');
  return new Set(values.length ? values : ['CALL', 'PUT']);
}

/** Per-bucket magnitudes, not Net Drift and not cumulative line values. */
export function netFlowRows(payload, { dataMode = 'NET_PREMIUM', underlyingRequired = false } = {}) {
  if (!['NET_PREMIUM', 'PREMIUM', 'NET_VOLUME', 'VOLUME'].includes(dataMode)) throw new TypeError('Choose premium or contract volume.');
  const premium = ['NET_PREMIUM', 'PREMIUM'].includes(dataMode), rows = [];
  const entries = Object.entries(dataOf(payload)).flatMap(([key, cell]) => {
    const time = timeOf(key);
    return time === null || !isRecord(cell) ? [] : [[time, cell]];
  }).sort(([a], [b]) => a - b);
  let previousSpot = null;
  for (const [time, cell] of entries) {
    const observedSpot = positive(cell.stockPrice);
    if (observedSpot !== null) previousSpot = observedSpot;
    if (underlyingRequired && previousSpot === null) continue;
    const call = nonnegative(cell.callSum), put = nonnegative(cell.putSum);
    rows.push({ time, call: call === null ? null : call / (premium ? 100 : 1), put: put === null ? null : put / (premium ? 100 : 1), spot: underlyingRequired ? previousSpot : observedSpot });
  }
  return rows;
}

/**
 * Source732868/845384: IV and ARV are levels, with no Skew >=1 eligibility
 * filter. Retain real zero/sub-one values; missing warm-up stays null.
 */
export function volatilityDriftRows(payload, { ivUnit = 'percentage-points', sessionTimeZone = 'America/New_York', regularSessionOnly = true } = {}) {
  const iv = ivConverter(ivUnit);
  const clock = regularSessionOnly ? new Intl.DateTimeFormat('en-US', { timeZone: sessionTimeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
  return Object.entries(dataOf(payload)).flatMap(([key, cell]) => {
    const time = timeOf(key);
    if (time === null || !isRecord(cell)) return [];
    if (clock) {
      const parts = Object.fromEntries(clock.formatToParts(new Date(time)).map(part => [part.type, part.value]));
      if (Number(parts.hour) * 60 + Number(parts.minute) < 570) return [];
    }
    return [{ time, iv: iv(cell.iv), arv: iv(cell.arv), spot: positive(cell.stockPrice) }];
  }).sort((a, b) => a.time - b.time);
}

/**
 * Reference478432/786570/656428 only plot legs with IV >=1 percentage point.
 * Solver-floor values remain in callIv/putIv for inspection, but cannot halve
 * a valid opposite leg in BOTH or create false zero-volatility curve spikes.
 * Render each expiry's finite IV points independently, as source369505 does;
 * missing strikes in another expiry must not create gaps in this one's line.
 */
export function volatilitySkewSeries(payload, { ivUnit = 'percentage-points', contractType = 'BOTH', contractTypes, expirations = [] } = {}) {
  if (!['CALL', 'PUT', 'BOTH'].includes(contractType)) throw new TypeError('Choose calls, puts or both.');
  if (!Array.isArray(expirations) || expirations.some(value => !validDate(value))) throw new TypeError('Choose valid expiration dates.');
  const selected = contractSelection(contractTypes ?? (contractType === 'BOTH' ? [] : [contractType]));
  const type = selected.size === 1 ? [...selected][0] : 'BOTH', iv = ivConverter(ivUnit);
  return Object.entries(dataOf(payload)).filter(([expiration, strikes]) => validDate(expiration) && isRecord(strikes) && (!expirations.length || expirations.includes(expiration)))
    .sort(([a], [b]) => a.localeCompare(b)).map(([expiration, strikes]) => ({
      expiration, contractType: type,
      rows: Object.entries(strikes).flatMap(([key, cell]) => {
        const strike = nonnegative(key);
        if (strike === null || !isRecord(cell)) return [];
        const callIv = iv(cell.CALL), putIv = iv(cell.PUT);
        const plottedLegs = [...(selected.has('CALL') ? [callIv] : []), ...(selected.has('PUT') ? [putIv] : [])]
          .filter(value => value !== null && value >= 1);
        return [{ strike, callIv, putIv, iv: averageAvailable(plottedLegs) }];
      }).sort((a, b) => a.strike - b.strike),
    }));
}

/**
 * Source481754: mean of every selected contract's IV in each expiry, not an
 * interpolated/nearest-50-delta point. Keep all raw cells for later re-filtering.
 * Unlike Skew656428 this source applies NO >=1 eligibility threshold: actual
 * solver-floor IVs participate when their delta/moneyness satisfy the filter.
 */
export function termStructureRows(payload, { sessionDate, ivUnit = 'percentage-points', deltaMin = 0, deltaMax = 1, moneyTypes = ['AT_THE_MONEY'], contractTypes = [], expirations = [], strikePrices = [] } = {}) {
  if (!validDate(sessionDate)) throw new TypeError('Choose a valid session date.');
  if (!Array.isArray(moneyTypes) || moneyTypes.some(value => typeof value !== 'string')) throw new TypeError('Choose valid moneyness values.');
  if (!Array.isArray(expirations) || expirations.some(value => !validDate(value))) throw new TypeError('Choose valid expiration dates.');
  if (!Array.isArray(strikePrices) || strikePrices.some(value => nonnegative(value) === null)) throw new TypeError('Choose valid strike prices in dollars.');
  const low = finite(deltaMin), high = finite(deltaMax);
  if (low === null || high === null || low < 0 || high > 1 || low > high) throw new RangeError('Choose a delta band between zero and one.');
  const selected = contractSelection(contractTypes), money = new Set(moneyTypes.map(moneyTypeOf)), selectedStrikes = new Set(strikePrices.map(Number)), iv = ivConverter(ivUnit);
  return Object.entries(dataOf(payload)).filter(([expiration, strikes]) => validDate(expiration) && isRecord(strikes) && (!expirations.length || expirations.includes(expiration)))
    .sort(([a], [b]) => a.localeCompare(b)).map(([expiration, strikes]) => {
      const contracts = Object.entries(strikes).flatMap(([key, cell]) => {
        const strike = nonnegative(key);
        if (strike === null || !isRecord(cell)) return [];
        return ['CALL', 'PUT'].flatMap(contractType => {
          const source = cell[contractType];
          if (!isRecord(source)) return [];
          const delta = finite(source.delta), value = iv(source.iv), moneyType = moneyTypeOf(source.moneyType);
          const magnitude = delta === null ? null : contractType === 'PUT' ? -delta : delta;
          const included = (!selectedStrikes.size || selectedStrikes.has(strike)) && selected.has(contractType) && magnitude !== null && magnitude >= low && magnitude <= high
            && (!money.size || money.has(moneyType)) && value !== null;
          return [{ strike, contractType, delta, iv: value, moneyType: moneyType ?? null, included, source: structuredClone(source) }];
        });
      }).sort((a, b) => a.strike - b.strike || (a.contractType === b.contractType ? 0 : a.contractType === 'CALL' ? -1 : 1));
      const values = contracts.filter(contract => contract.included).map(contract => contract.iv);
      return { expiration, daysUntilExpiration: Math.max(0, dateOrdinal(expiration) - dateOrdinal(sessionDate)), iv: averageAvailable(values), count: values.length, contracts };
    });
}

/** Absolute official OI contracts, never signed Greek exposure or trade volume. */
export function openInterestStrikeRows(payload) {
  return Object.entries(dataOf(payload)).flatMap(([key, cell]) => {
    const strike = nonnegative(key);
    if (strike === null || !isRecord(cell)) return [];
    const call = nonnegative(cell.callOpenInterest), put = nonnegative(cell.putOpenInterest);
    return [{ strike, call, put, total: call === null || put === null ? null : call + put }];
  }).sort((a, b) => a.strike - b.strike);
}
