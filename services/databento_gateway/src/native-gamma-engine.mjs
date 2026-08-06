const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1_000;

export const NATIVE_GAMMA_SIGN_CONVENTION = "ASSUMED_DEALER_CONVENTION";
export const NQ_OPTION_MULTIPLIER = 20;

export function timeToExpiryYears(expiry, nowMs, floorMinutes = 15) {
  const expiryTimestamp = typeof expiry === "number" ? expiry : Date.parse(String(expiry));
  if (!Number.isFinite(expiryTimestamp) || !Number.isFinite(nowMs) || expiryTimestamp <= nowMs) return 0;
  return Math.max((expiryTimestamp - nowMs) / YEAR_MS, floorMinutes / (365.25 * 24 * 60));
}

function normalPdf(value) {
  return Math.exp(-0.5 * value * value) / SQRT_TWO_PI;
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(value) {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

export function black76Price({ futures, strike, years, volatility, rate = 0.045, type }) {
  if (![futures, strike, years, volatility, rate].every(Number.isFinite) || futures <= 0 || strike <= 0) return null;
  const call = String(type).toUpperCase() === "CALL";
  const discount = Math.exp(-rate * Math.max(0, years));
  if (years <= 0 || volatility <= 0) {
    return discount * Math.max(0, call ? futures - strike : strike - futures);
  }
  const rootT = Math.sqrt(years);
  const d1 = (Math.log(futures / strike) + 0.5 * volatility * volatility * years) / (volatility * rootT);
  const d2 = d1 - volatility * rootT;
  return call
    ? discount * (futures * normalCdf(d1) - strike * normalCdf(d2))
    : discount * (strike * normalCdf(-d2) - futures * normalCdf(-d1));
}

export function black76Gamma({ futures, strike, years, volatility, rate = 0.045 }) {
  if (![futures, strike, years, volatility, rate].every(Number.isFinite)
    || futures <= 0 || strike <= 0 || years <= 0 || volatility <= 0) return 0;
  const rootT = Math.sqrt(years);
  const d1 = (Math.log(futures / strike) + 0.5 * volatility * volatility * years) / (volatility * rootT);
  return Math.exp(-rate * years) * normalPdf(d1) / (futures * volatility * rootT);
}

export function invertBlack76Volatility({ price, futures, strike, years, rate = 0.045, type, tolerance = 1e-6 }) {
  if (![price, futures, strike, years, rate].every(Number.isFinite)
    || price < 0 || futures <= 0 || strike <= 0 || years <= 0) {
    return { volatility: null, reason: "invalid_input" };
  }
  const intrinsic = black76Price({ futures, strike, years, volatility: 0, rate, type });
  if (intrinsic == null || price + tolerance < intrinsic) {
    return { volatility: null, reason: "below_intrinsic" };
  }
  if (Math.abs(price - intrinsic) <= tolerance) {
    return { volatility: null, reason: "at_intrinsic" };
  }
  let low = 1e-6;
  let high = 5;
  const highPrice = black76Price({ futures, strike, years, volatility: high, rate, type });
  if (highPrice == null || highPrice < price) return { volatility: null, reason: "outside_solver_range" };
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const mid = (low + high) / 2;
    const candidate = black76Price({ futures, strike, years, volatility: mid, rate, type });
    if (candidate == null) return { volatility: null, reason: "pricing_failed" };
    if (Math.abs(candidate - price) <= tolerance) return { volatility: mid, reason: null };
    if (candidate > price) high = mid;
    else low = mid;
  }
  return { volatility: (low + high) / 2, reason: null };
}

function expiryMs(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric > 1e17) return numeric / 1e6;
    if (numeric > 1e14) return numeric / 1e3;
    if (numeric > 1e11) return numeric;
    return numeric * 1_000;
  }
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function scaledPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.abs(numeric) > 1e7 ? numeric / 1e9 : numeric;
}

function optionType(row) {
  const value = String(row.optionType ?? row.instrument_class ?? row.instrumentClass ?? "").toUpperCase();
  if (value === "C" || value === "CALL") return "CALL";
  if (value === "P" || value === "PUT") return "PUT";
  return null;
}

function instrumentId(row) {
  return Number(row.instrumentId ?? row.instrument_id ?? row.hd?.instrument_id ?? 0);
}

function underlyingId(row) {
  return Number(row.underlyingInstrumentId ?? row.underlying_id ?? row.underlyingId ?? 0);
}

function rawSymbol(row) {
  return String(row.symbol ?? row.raw_symbol ?? row.rawSymbol ?? "").trim().toUpperCase();
}

function isSpread(row) {
  const kind = String(row.securityType ?? row.security_type ?? row.instrument_class ?? row.instrumentClass ?? "").toUpperCase();
  const symbol = rawSymbol(row);
  return row.isSpread === true
    || kind === "S" || kind.includes("SPREAD") || kind.includes("COMBO")
    || symbol.includes(":") || symbol.includes("/");
}

export function selectFrontMonthChain(definitions, futuresDefinitions, nowMs) {
  const futureById = new Map();
  for (const future of futuresDefinitions) {
    const id = instrumentId(future);
    const expiration = expiryMs(future.expiration ?? future.expiry ?? future.expirationMs);
    if (!id || !expiration || expiration <= nowMs || isSpread(future)) continue;
    futureById.set(id, {
      id,
      symbol: rawSymbol(future),
      expiration,
    });
  }
  const front = [...futureById.values()].sort((left, right) => left.expiration - right.expiration || left.id - right.id)[0] ?? null;
  if (!front) return { underlying: null, definitions: [] };
  const horizon = nowMs + 7 * 24 * 60 * 60 * 1_000;
  const selected = definitions
    .filter((row) => !isSpread(row)
      && optionType(row) !== null
      && underlyingId(row) === front.id
      && (expiryMs(row.expiration ?? row.expiry ?? row.expirationMs) ?? 0) > nowMs
      && (expiryMs(row.expiration ?? row.expiry ?? row.expirationMs) ?? Infinity) <= horizon)
    .sort((left, right) => {
      const expiryDifference = (expiryMs(left.expiration ?? left.expiry ?? left.expirationMs) ?? 0)
        - (expiryMs(right.expiration ?? right.expiry ?? right.expirationMs) ?? 0);
      if (expiryDifference) return expiryDifference;
      const strikeDifference = (scaledPrice(left.strike ?? left.strike_price) ?? 0)
        - (scaledPrice(right.strike ?? right.strike_price) ?? 0);
      if (strikeDifference) return strikeDifference;
      return instrumentId(left) - instrumentId(right);
    });
  return { underlying: front, definitions: selected };
}

export function buildPositioningMap({ definitions, futuresDefinitions, statistics, futuresStatistics, nowMs, oiAsOf, rate = 0.045, logger = () => {} }) {
  const selection = selectFrontMonthChain(definitions, futuresDefinitions, nowMs);
  if (!selection.underlying || !selection.definitions.length) throw new Error("No front-month NQ options inside the 0–7 day horizon.");
  const latest = (rows, statType) => {
    const result = new Map();
    for (const row of rows) {
      const type = Number(row.statType ?? row.stat_type);
      if (type !== statType) continue;
      const id = instrumentId(row);
      if (!id) continue;
      result.set(id, row);
    }
    return result;
  };
  const openInterestRows = latest(statistics, 9);
  const settlementRows = latest(statistics, 3);
  const futureSettles = latest(futuresStatistics, 3);
  const futureSettleRow = futureSettles.get(selection.underlying.id);
  const futuresSettle = scaledPrice(futureSettleRow?.price ?? futureSettleRow?.value);
  if (!futuresSettle || futuresSettle <= 0) throw new Error("Front-month NQ futures settlement is unavailable.");
  const records = [];
  for (const definition of selection.definitions) {
    const id = instrumentId(definition);
    const expiry = expiryMs(definition.expiration ?? definition.expiry ?? definition.expirationMs);
    const strike = scaledPrice(definition.strike ?? definition.strike_price);
    const type = optionType(definition);
    const oiRow = openInterestRows.get(id);
    const settlementRow = settlementRows.get(id);
    const oi = Number(oiRow?.quantity ?? oiRow?.value ?? 0);
    const settle = scaledPrice(settlementRow?.price ?? settlementRow?.value);
    if (!expiry || !strike || !type || !Number.isFinite(oi) || oi <= 0 || !settle || settle <= 0) continue;
    const years = timeToExpiryYears(expiry, nowMs, 360);
    const solved = invertBlack76Volatility({ price: settle, futures: futuresSettle, strike, years, rate, type });
    if (!solved.volatility) {
      logger({ level: "warn", code: "IV_REJECTED", instrumentId: id, symbol: rawSymbol(definition), reason: solved.reason });
      continue;
    }
    records.push({
      instrumentId: id,
      symbol: rawSymbol(definition),
      strike,
      expiry: new Date(expiry).toISOString(),
      type,
      openInterest: oi,
      settlement: settle,
      impliedVolatility: solved.volatility,
    });
  }
  if (!records.length) throw new Error("No valid NQ option records survived IV inversion.");
  return {
    schemaVersion: "kwantdesk-native-oi-v1",
    root: "NQ",
    underlyingContract: selection.underlying.symbol,
    underlyingInstrumentId: selection.underlying.id,
    futuresSettle,
    oiAsOf,
    generatedAt: new Date(nowMs).toISOString(),
    rate,
    multiplier: NQ_OPTION_MULTIPLIER,
    signConvention: NATIVE_GAMMA_SIGN_CONVENTION,
    records,
  };
}

function interpolateCrossing(left, right) {
  if (left.cumulative === right.cumulative) return left.strike;
  const weight = Math.abs(left.cumulative) / (Math.abs(left.cumulative) + Math.abs(right.cumulative));
  return left.strike + (right.strike - left.strike) * weight;
}

function labelFor(kind, regime) {
  const positive = regime === "POSITIVE";
  if (kind === "CALL_WALL") return positive ? "Major call — cage ceiling" : "Major call — cage rail";
  if (kind === "PUT_WALL") return positive ? "Major put — cage floor" : "Major put — cage rail";
  if (kind === "GAMMA_MAGNET") return positive ? "Magnet — glue, exits only" : "Magnet — weak glue";
  if (kind === "GAMMA_ACCELERATOR") return "Accelerator — grease, no fades";
  return "Flip — cage switch";
}

export function deriveNativeGammaSnapshot(positioningMap, spot, nowMs) {
  if (!positioningMap?.records?.length || !Number.isFinite(spot) || spot <= 0) throw new Error("Positioning map and live NQ spot are required.");
  const byStrike = new Map();
  const expiryTotals = new Map();
  for (const record of positioningMap.records) {
    const expiry = Date.parse(record.expiry);
    const years = timeToExpiryYears(expiry, nowMs);
    if (years <= 0) continue;
    const gamma = black76Gamma({
      futures: spot,
      strike: record.strike,
      years,
      volatility: record.impliedVolatility,
      rate: positioningMap.rate ?? 0.045,
    });
    const unsigned = gamma * record.openInterest * (positioningMap.multiplier ?? NQ_OPTION_MULTIPLIER);
    const signed = record.type === "CALL" ? unsigned : -unsigned;
    const row = byStrike.get(record.strike) ?? { strike: record.strike, callExposure: 0, putExposure: 0, netExposure: 0 };
    if (record.type === "CALL") row.callExposure += signed;
    else row.putExposure += signed;
    row.netExposure += signed;
    byStrike.set(record.strike, row);
    const expiryKey = record.expiry.slice(0, 10);
    expiryTotals.set(expiryKey, (expiryTotals.get(expiryKey) ?? 0) + Math.abs(signed));
  }
  const strikes = [...byStrike.values()].sort((left, right) => left.strike - right.strike);
  if (!strikes.length) throw new Error("Native gamma repricing produced no strikes.");
  const near = strikes.filter((row) => Math.abs(row.strike - spot) / spot <= 0.03);
  const positive = near.filter((row) => row.netExposure > 0).sort((a, b) => b.netExposure - a.netExposure || Math.abs(a.strike - spot) - Math.abs(b.strike - spot));
  const negative = near.filter((row) => row.netExposure < 0).sort((a, b) => a.netExposure - b.netExposure || Math.abs(a.strike - spot) - Math.abs(b.strike - spot));
  const callWall = near.filter((row) => row.callExposure > 0).sort((a, b) => b.callExposure - a.callExposure)[0] ?? null;
  const putWall = near.filter((row) => row.putExposure < 0).sort((a, b) => a.putExposure - b.putExposure)[0] ?? null;
  let cumulative = 0;
  const cumulativeRows = strikes.map((row) => {
    cumulative += row.netExposure;
    return { strike: row.strike, cumulative };
  });
  const crossings = [];
  for (let index = 1; index < cumulativeRows.length; index += 1) {
    const left = cumulativeRows[index - 1];
    const right = cumulativeRows[index];
    if (left.cumulative === 0) crossings.push(left.strike);
    else if (right.cumulative === 0) crossings.push(right.strike);
    else if (Math.sign(left.cumulative) !== Math.sign(right.cumulative)) crossings.push(interpolateCrossing(left, right));
  }
  const flip = crossings.length
    ? crossings.reduce((best, value) => Math.abs(value - spot) < Math.abs(best - spot) ? value : best)
    : null;
  let cumulativeAtSpot = 0;
  for (const row of strikes) if (row.strike <= spot) cumulativeAtSpot += row.netExposure;
  const regime = cumulativeAtSpot >= 0 ? "POSITIVE" : "NEGATIVE";
  const dominantExpiry = [...expiryTotals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const makeLevel = (kind, row, price = row?.strike ?? null) => price == null ? null : ({
    id: `native-${kind.toLowerCase()}-${Math.round(price * 100)}`,
    kind,
    label: labelFor(kind, regime),
    price: Math.round(price * 100) / 100,
    value: row?.netExposure ?? null,
    rank: 1,
    expiryScope: "NEAR_TERM_7D",
    dominantExpiry,
    regime,
    signConvention: NATIVE_GAMMA_SIGN_CONVENTION,
    source: "NATIVE_NQ_OI",
  });
  const levels = [
    makeLevel("CALL_WALL", callWall),
    makeLevel("PUT_WALL", putWall),
    makeLevel("GAMMA_MAGNET", positive[0] ?? null),
    makeLevel("GAMMA_ACCELERATOR", negative[0] ?? null),
    flip == null ? null : makeLevel("ZERO_GAMMA", null, flip),
  ].filter(Boolean);
  const atmIv = positioningMap.records
    .slice()
    .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))[0]?.impliedVolatility ?? 0.25;
  const matchingBand = Math.max(0.5, Math.min(spot * 0.002, spot * atmIv * Math.sqrt(1 / 365.25) * 0.15));
  return {
    schemaVersion: "kwantdesk-native-gamma-v1",
    root: "NQ",
    underlyingContract: positioningMap.underlyingContract,
    spot: Math.round(spot * 100) / 100,
    generatedAt: new Date(nowMs).toISOString(),
    oiAsOf: positioningMap.oiAsOf,
    signConvention: NATIVE_GAMMA_SIGN_CONVENTION,
    signConventionDetail: "Calls are modeled positive and puts negative. Open interest does not reveal customer direction, so dealer-side positioning is an explicit assumption.",
    expiryScope: "0–7 calendar days",
    dominantExpiry,
    regime,
    cumulativeAtSpot,
    gammaFlip: flip == null ? null : Math.round(flip * 100) / 100,
    gammaFlipCrossings: crossings.map((value) => Math.round(value * 100) / 100),
    gammaFlipNote: crossings.length ? (crossings.length > 1 ? "Multiple cumulative crossings — contested book." : "Cumulative zero-cross located.") : "No gamma flip inside the tested range",
    matchingBand,
    levels,
    strikes,
  };
}

export function classifyGatewayFreshness({ generatedAt, lastTradeAt, nowMs, marketClosed, oiAsOf, settleDate }) {
  const spotAge = lastTradeAt ? Math.max(0, (nowMs - lastTradeAt) / 1_000) : null;
  const oiStale = Boolean(oiAsOf && settleDate && oiAsOf < settleDate);
  if (marketClosed) return { state: "MARKET_CLOSED", stale: false, spotAge, oiStale };
  return {
    state: spotAge !== null && spotAge <= 120 ? "LIVE" : "STALE",
    stale: spotAge === null || spotAge > 120,
    spotAge,
    oiStale,
  };
}

export function mergeNativeWithConverted({ nativeLevels, convertedLevels, nativeState, matchingBand }) {
  if (nativeState === "STALE" || !nativeLevels?.length) return convertedLevels.slice();
  const kinds = new Set(["CALL_WALL", "PUT_WALL", "GAMMA_MAGNET", "GAMMA_ACCELERATOR", "ZERO_GAMMA"]);
  const survivors = convertedLevels.filter((converted) => {
    if (!kinds.has(converted.kind)) return true;
    return !nativeLevels.some((native) => native.kind === converted.kind && Math.abs(native.price - converted.price) <= matchingBand);
  });
  return [...survivors, ...nativeLevels].sort((a, b) => a.price - b.price || a.kind.localeCompare(b.kind));
}
