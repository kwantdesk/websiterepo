import type {
  GexDeskBehaviour,
  GexDeskHistoryPayload,
  GexDeskPayload,
  GexDeskZoneState,
} from "@/lib/gexDesk";

export type HeatmapSource = "COMBINED" | "NDX" | "QQQ";
export type HeatmapExpiry = "ALL" | "0DTE" | "1DTE";
export type HeatmapNormalization = "GLOBAL" | "VISIBLE" | "PERCENTILE";

export type HeatmapCell = {
  timestamp: number;
  price: number;
  call: number;
  put: number;
  net: number;
  gross: number;
  change: number;
  confidence: number;
};

export type HeatmapPricePoint = {
  timestamp: number;
  price: number;
};

export type HeatmapZone = {
  id: string;
  low: number;
  center: number;
  high: number;
  net: number;
  gross: number;
  strength: number;
  confidence: number;
  state: GexDeskZoneState;
  behaviour: GexDeskBehaviour;
  sourceAgreement: number;
  zeroDteShare: number;
  callShare: number;
  ndxStrikes: number[];
  qqqStrikes: number[];
};

export type OptionsHeatmapModel = {
  instrument: "NQ";
  sessionDate: string;
  asOf: string;
  status: GexDeskHistoryPayload["status"] | "SNAPSHOT";
  source: HeatmapSource;
  expiry: HeatmapExpiry;
  timestamps: number[];
  cells: HeatmapCell[];
  flowCells: HeatmapCell[];
  pricePath: HeatmapPricePoint[];
  zones: HeatmapZone[];
  priceLow: number;
  priceHigh: number;
  currentPrice: number | null;
  zeroGamma: number | null;
  heatCeiling: number;
  pressureScore: number;
  pressureConfidence: number;
  regime: GexDeskPayload["regime"];
  agreement: GexDeskPayload["agreement"];
  mappingCoverage: number;
  errors: string[];
};

export function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

export function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeEpoch(value: unknown) {
  const parsed = finiteNumber(value, Number.NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (parsed >= 1e18) return Math.floor(parsed / 1e6);
  if (parsed >= 1e15) return Math.floor(parsed / 1e3);
  if (parsed >= 1e12) return Math.floor(parsed);
  if (parsed >= 1e9) return Math.floor(parsed * 1e3);
  return null;
}

export function mapStrikeToFutures(
  strike: number,
  underlierSpot: number,
  futuresPrice: number,
) {
  if (!(strike > 0) || !(underlierSpot > 0) || !(futuresPrice > 0)) return null;
  const mapped = strike * futuresPrice / underlierSpot;
  return Number.isFinite(mapped) && mapped > 0 ? mapped : null;
}

export function quantile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const position = clamp(fraction, 0, 1) * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

export function adaptiveIntensity(value: number, ceiling: number) {
  if (!(value > 0) || !(ceiling > 0)) return 0;
  return clamp(Math.pow(value / ceiling, 0.48), 0, 1);
}

export function classifyZoneState(current: number, previous: number) {
  if (!(current > 0) || !(previous > 0)) return "STABLE" as const;
  const change = current / previous - 1;
  if (change >= 0.04) return "BUILDING" as const;
  if (change <= -0.04) return "WEAKENING" as const;
  return "STABLE" as const;
}

export function interpolateZeroCrossing(
  rows: Array<{ price: number; net: number }>,
  currentPrice?: number | null,
) {
  const ordered = rows
    .filter((row) => Number.isFinite(row.price) && Number.isFinite(row.net))
    .sort((left, right) => left.price - right.price);
  const crossings: number[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const left = ordered[index - 1];
    const right = ordered[index];
    if (left.net === 0) crossings.push(left.price);
    if (Math.sign(left.net) === Math.sign(right.net) || left.net === right.net) continue;
    const fraction = -left.net / (right.net - left.net);
    crossings.push(left.price + (right.price - left.price) * fraction);
  }
  if (!crossings.length) return null;
  const reference = currentPrice && currentPrice > 0 ? currentPrice : crossings[0];
  return crossings.sort((left, right) => Math.abs(left - reference) - Math.abs(right - reference))[0];
}

function sourceValues(
  row: GexDeskPayload["rail"][number],
  source: HeatmapSource,
) {
  if (source === "NDX") return { net: row.ndxNet, gross: row.ndxGross };
  if (source === "QQQ") return { net: row.qqqNet, gross: row.qqqGross };
  return { net: row.net, gross: row.gross };
}

function behaviourFrom(net: number, gross: number): GexDeskBehaviour {
  const ratio = gross > 0 ? net / gross : 0;
  if (ratio > 0.1) return "STABILISING";
  if (ratio < -0.1) return "AMPLIFYING";
  return "TRANSITION";
}

function expiryRail(
  payload: GexDeskPayload,
  source: HeatmapSource,
  expiry: HeatmapExpiry,
) {
  if (expiry === "ALL") return payload.rail;
  const buckets = new Map<number, GexDeskPayload["rail"][number]>();
  for (const snapshot of payload.sources) {
    if (source !== "COMBINED" && snapshot.symbol !== source) continue;
    const exposure = expiry === "0DTE" ? snapshot.zeroDteExposure : snapshot.oneDteExposure;
    if (!exposure || !(snapshot.spot && snapshot.spot > 0) || !(payload.nqPrice && payload.nqPrice > 0)) continue;
    for (const strikeRow of exposure.strikes) {
      const mapped = mapStrikeToFutures(strikeRow.strike, snapshot.spot, payload.nqPrice);
      if (mapped === null) continue;
      const price = Math.round(mapped / 10) * 10;
      const call = finiteNumber(strikeRow.call);
      const put = finiteNumber(strikeRow.put);
      const net = finiteNumber(strikeRow.net, call + put);
      const gross = Math.abs(call) + Math.abs(put);
      const row = buckets.get(price) ?? {
        price,
        call: 0,
        put: 0,
        net: 0,
        gross: 0,
        zeroDteGross: 0,
        ndxNet: 0,
        ndxGross: 0,
        qqqNet: 0,
        qqqGross: 0,
        sourceAgreement: 50,
        ndxStrikes: [],
        qqqStrikes: [],
      };
      row.call += call;
      row.put += put;
      row.net += net;
      row.gross += gross;
      if (expiry === "0DTE") row.zeroDteGross += gross;
      if (snapshot.symbol === "NDX") {
        row.ndxNet += net;
        row.ndxGross += gross;
        if (!row.ndxStrikes.includes(strikeRow.strike)) row.ndxStrikes.push(strikeRow.strike);
      } else {
        row.qqqNet += net;
        row.qqqGross += gross;
        if (!row.qqqStrikes.includes(strikeRow.strike)) row.qqqStrikes.push(strikeRow.strike);
      }
      buckets.set(price, row);
    }
  }
  return [...buckets.values()].map((row) => ({
    ...row,
    sourceAgreement: row.ndxGross > 0 && row.qqqGross > 0
      ? Math.sign(row.ndxNet) === Math.sign(row.qqqNet) ? 100 : 0
      : 50,
  }));
}

export function buildStructuralZones(
  payload: GexDeskPayload,
  source: HeatmapSource,
  expiry: HeatmapExpiry,
  clusterDistance: number,
  maximumZones = 16,
) {
  const activeRows = expiryRail(payload, source, expiry)
    .map((row) => {
      const selected = sourceValues(row, source);
      return {
        ...row,
        net: selected.net,
        gross: selected.gross,
      };
    })
    .filter((row) => row.gross > 0)
    .sort((left, right) => left.price - right.price);
  const maximumGross = Math.max(1, ...activeRows.map((row) => row.gross));
  const groups: typeof activeRows[] = [];
  for (const row of activeRows) {
    const current = groups.at(-1);
    if (!current || row.price - current.at(-1)!.price > clusterDistance) groups.push([row]);
    else current.push(row);
  }
  return groups
    .map((group, index): HeatmapZone => {
      const gross = group.reduce((sum, row) => sum + row.gross, 0);
      const net = group.reduce((sum, row) => sum + row.net, 0);
      const center = group.reduce((sum, row) => sum + row.price * row.gross, 0) / Math.max(1, gross);
      const sourceAgreement = group.reduce((sum, row) => sum + row.sourceAgreement * row.gross, 0) / Math.max(1, gross);
      const zeroDteGross = group.reduce((sum, row) => sum + row.zeroDteGross, 0);
      const call = group.reduce((sum, row) => sum + Math.abs(row.call), 0);
      const put = group.reduce((sum, row) => sum + Math.abs(row.put), 0);
      const recentGross = gross / group.length;
      const previousGross = group.reduce((sum, row) => sum + Math.max(0, row.gross - Math.abs(row.net) * 0.05), 0) / group.length;
      return {
        id: `heat-zone-${source}-${expiry}-${Math.round(center)}-${index}`,
        low: group[0].price - clusterDistance * 0.45,
        center,
        high: group.at(-1)!.price + clusterDistance * 0.45,
        net,
        gross,
        strength: Math.round(clamp(gross / maximumGross * 100, 0, 100)),
        confidence: clamp(sourceAgreement / 100 * 0.65 + payload.agreement.score / 100 * 0.35, 0, 1),
        state: classifyZoneState(recentGross, previousGross),
        behaviour: behaviourFrom(net, gross),
        sourceAgreement,
        zeroDteShare: gross > 0 ? clamp(zeroDteGross / gross, 0, 1) : 0,
        callShare: call + put > 0 ? call / (call + put) : 0.5,
        ndxStrikes: [...new Set(group.flatMap((row) => row.ndxStrikes))],
        qqqStrikes: [...new Set(group.flatMap((row) => row.qqqStrikes))],
      };
    })
    .sort((left, right) => right.gross - left.gross)
    .slice(0, maximumZones)
    .sort((left, right) => left.center - right.center);
}

function selectHistoryValue(
  row: GexDeskHistoryPayload["rows"][number],
  index: number,
  expiry: HeatmapExpiry,
) {
  const weight = expiry === "ALL" ? 1 : 0;
  const call = Math.abs(finiteNumber(row.call[index])) * weight;
  const put = Math.abs(finiteNumber(row.put[index])) * weight;
  return {
    call,
    put,
    net: finiteNumber(row.net[index]) * weight,
    gross: Math.max(call + put, Math.abs(finiteNumber(row.gross[index])) * weight),
    change: finiteNumber(row.change[index]) * weight,
  };
}

export function buildOptionsHeatmapModel({
  payload,
  history,
  source,
  expiry,
  normalization,
  clusterDistance,
  currentPrice,
  livePricePath = [],
}: {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  source: HeatmapSource;
  expiry: HeatmapExpiry;
  normalization: HeatmapNormalization;
  clusterDistance: number;
  currentPrice: number | null;
  livePricePath?: HeatmapPricePoint[];
}): OptionsHeatmapModel {
  const safeCurrent = currentPrice && Number.isFinite(currentPrice)
    ? currentPrice
    : payload.nqPrice && Number.isFinite(payload.nqPrice)
      ? payload.nqPrice
      : null;
  const zones = buildStructuralZones(payload, source, expiry, clusterDistance);
  const timestamps = history?.timestamps
    .map(normalizeEpoch)
    .filter((timestamp): timestamp is number => timestamp !== null) ?? [];
  const cells: HeatmapCell[] = [];
  if (history?.rows.length && timestamps.length) {
    const maxColumns = 240;
    const startIndex = Math.max(0, timestamps.length - maxColumns);
    for (const row of history.rows) {
      if (!Number.isFinite(row.price)) continue;
      for (let index = startIndex; index < timestamps.length; index += 1) {
        const values = selectHistoryValue(row, index, expiry);
        if (!(values.gross > 0)) continue;
        cells.push({
          timestamp: timestamps[index],
          price: row.price,
          ...values,
          confidence: clamp(history.mappingCoverage, 0, 1),
        });
      }
    }
  }
  const flowByBucket = new Map<string, HeatmapCell>();
  const structuralStart = timestamps[0] ?? Date.now() - 2 * 60 * 60_000;
  for (const print of payload.optionsTape) {
    const timestamp = normalizeEpoch(print.timestamp);
    if (timestamp === null || timestamp < structuralStart || !(print.mappedPrice > 0)) continue;
    if (source !== "COMBINED" && print.source !== source) continue;
    const dte = print.dte;
    if (expiry === "0DTE" && dte !== 0) continue;
    if (expiry === "1DTE" && dte !== 1) continue;
    const timeBucket = Math.floor(timestamp / 60_000) * 60_000;
    const priceBucketSize = Math.max(5, Math.round((safeCurrent ?? payload.nqPrice ?? 28_000) * 0.0005 / 5) * 5);
    const price = Math.round(print.mappedPrice / priceBucketSize) * priceBucketSize;
    const key = `${timeBucket}:${price}`;
    const current = flowByBucket.get(key) ?? {
      timestamp: timeBucket,
      price,
      call: 0,
      put: 0,
      net: 0,
      gross: 0,
      change: 0,
      confidence: 0,
    };
    const gammaExposure = print.optionGamma && print.underlyingPrice
      ? Math.abs(print.optionGamma * print.size * 100 * print.underlyingPrice * print.underlyingPrice * 0.01)
      : Math.max(1, print.premium);
    const signed = print.side === "BOUGHT" ? gammaExposure : print.side === "SOLD" ? -gammaExposure : 0;
    if (print.contractType === "CALL") current.call += gammaExposure;
    else current.put += gammaExposure;
    current.net += print.contractType === "CALL" ? signed : -signed;
    current.gross += gammaExposure;
    current.change += signed;
    current.confidence = Math.max(current.confidence, clamp(print.confidence, 0, 1));
    flowByBucket.set(key, current);
  }
  const flowCells = [...flowByBucket.values()].sort((left, right) => left.timestamp - right.timestamp);
  const structuralValues = zones.map((zone) => zone.gross);
  const cellValues = cells.map((cell) => cell.gross);
  const ceilingValues = normalization === "GLOBAL"
    ? [...structuralValues, ...cellValues]
    : normalization === "VISIBLE"
      ? cellValues.slice(-4_000)
      : [...structuralValues, ...cellValues];
  const heatCeiling = Math.max(
    1,
    normalization === "PERCENTILE" ? quantile(ceilingValues, 0.96) : Math.max(...ceilingValues, 1),
  );
  const historicalPath: HeatmapPricePoint[] = history
    ? timestamps.map((timestamp, index) => ({
        timestamp,
        price: finiteNumber(history.futuresPrices[index] ?? history.nqPrices[index], Number.NaN),
      })).filter((point) => Number.isFinite(point.price) && point.price > 0)
    : [];
  const pricePathBySecond = new Map<number, HeatmapPricePoint>();
  for (const point of [...historicalPath, ...livePricePath]) {
    if (!(point.timestamp > 0) || !(point.price > 0)) continue;
    pricePathBySecond.set(Math.floor(point.timestamp / 1_000), point);
  }
  const pricePath = [...pricePathBySecond.values()].sort((left, right) => left.timestamp - right.timestamp);
  const allPrices = [
    ...cells.map((cell) => cell.price),
    ...zones.flatMap((zone) => [zone.low, zone.high]),
    ...pricePath.map((point) => point.price),
    ...(safeCurrent ? [safeCurrent] : []),
  ].filter((price) => Number.isFinite(price) && price > 0);
  const reference = safeCurrent ?? allPrices[Math.floor(allPrices.length / 2)] ?? 28_000;
  const minimumSpan = Math.max(600, reference * 0.024);
  const rawLow = allPrices.length ? Math.min(...allPrices) : reference - minimumSpan / 2;
  const rawHigh = allPrices.length ? Math.max(...allPrices) : reference + minimumSpan / 2;
  const priceLow = Math.min(rawLow, reference - minimumSpan / 2);
  const priceHigh = Math.max(rawHigh, reference + minimumSpan / 2);
  const zeroGamma = interpolateZeroCrossing(
    expiryRail(payload, source, expiry).map((row) => ({ price: row.price, net: sourceValues(row, source).net })),
    safeCurrent,
  );
  return {
    instrument: "NQ",
    sessionDate: payload.sessionDate,
    asOf: history?.asOf ?? payload.asOf,
    status: history?.status ?? "SNAPSHOT",
    source,
    expiry,
    timestamps,
    cells,
    flowCells,
    pricePath,
    zones,
    priceLow,
    priceHigh,
    currentPrice: safeCurrent,
    zeroGamma,
    heatCeiling,
    pressureScore: payload.pressure.score,
    pressureConfidence: payload.pressure.confidence,
    regime: payload.regime,
    agreement: payload.agreement,
    mappingCoverage: history?.mappingCoverage ?? payload.agreement.score / 100,
    errors: [...payload.errors, ...(history?.errors ?? [])],
  };
}

export function validateOptionsHeatmapInputs(
  payload: unknown,
  history: unknown,
) {
  const payloadValid = Boolean(
    payload
    && typeof payload === "object"
    && Array.isArray((payload as GexDeskPayload).rail)
    && Array.isArray((payload as GexDeskPayload).zones)
    && (payload as GexDeskPayload).regime,
  );
  const historyValid = history === null || Boolean(
    history
    && typeof history === "object"
    && Array.isArray((history as GexDeskHistoryPayload).timestamps)
    && Array.isArray((history as GexDeskHistoryPayload).rows)
    && Array.isArray((history as GexDeskHistoryPayload).futuresPrices),
  );
  return { payloadValid, historyValid, valid: payloadValid && historyValid };
}
