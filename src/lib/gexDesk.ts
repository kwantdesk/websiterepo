import type { ExposureSummary } from "@/lib/optionsFlow";

export type GexDeskSourceSymbol = "NDX" | "QQQ";
export type GexDeskBehaviour = "STABILISING" | "AMPLIFYING" | "TRANSITION";
export type GexDeskSourceStatus = "LIVE" | "LAST_GOOD" | "UNAVAILABLE";
export type GexDeskZoneState = "BUILDING" | "WEAKENING" | "STABLE";

export type GexDeskSourceSnapshot = {
  symbol: GexDeskSourceSymbol;
  spot: number | null;
  status: GexDeskSourceStatus;
  asOf: string;
  exposure: ExposureSummary | null;
  zeroDteExposure: ExposureSummary | null;
  oneDteExposure: ExposureSummary | null;
  error: string | null;
};

export type GexDeskPressureSource = {
  symbol: GexDeskSourceSymbol;
  score: number;
  confidence: number;
  tradeCount: number;
  callShare: number;
  asOf: string | null;
  series: GexDeskPressurePoint[];
};

export type GexDeskPressurePoint = {
  timestamp: number;
  score: number;
  confidence: number;
  tradeCount: number;
};

export type GexDeskPressure = {
  score: number;
  state: "CALL_PRESSURE" | "PUT_PRESSURE" | "BALANCED";
  persistence: "BUILDING" | "FADING" | "STEADY";
  confidence: number;
  tradeCount: number;
  method: string;
  sources: GexDeskPressureSource[];
  series: GexDeskPressurePoint[];
};

export type GexDeskOptionPrint = {
  id: string;
  source: GexDeskSourceSymbol;
  timestamp: number;
  expiration: string | null;
  contractType: "CALL" | "PUT";
  side: "BOUGHT" | "SOLD" | "MID";
  strike: number;
  mappedPrice: number;
  premium: number;
  size: number;
  volume: number;
  openInterest: number;
  confidence: number;
  underlyingPrice?: number | null;
  optionPrice?: number | null;
  impliedVolatility?: number | null;
  dte?: number | null;
  optionGamma?: number | null;
  optionDelta?: number | null;
  optionVannaPerVolPoint?: number | null;
  optionCharmPerDay?: number | null;
  greekMethod?: "PROVIDER_IV_BLACK_SCHOLES" | "PRICE_IMPLIED_BLACK_SCHOLES" | null;
  complexTrade?: boolean;
};

export type GexDeskRailPoint = {
  price: number;
  call: number;
  put: number;
  net: number;
  gross: number;
  zeroDteGross: number;
  ndxNet: number;
  ndxGross: number;
  qqqNet: number;
  qqqGross: number;
  sourceAgreement: number;
  ndxStrikes: number[];
  qqqStrikes: number[];
};

export type GexDeskZone = {
  id: string;
  low: number;
  center: number;
  high: number;
  behaviour: GexDeskBehaviour;
  strength: number;
  priority: number;
  distancePoints: number;
  zeroDteShare: number;
  callShare: number;
  ndxShare: number;
  qqqShare: number;
  sourceAgreement: number;
  state: GexDeskZoneState;
  gross: number;
  ndxStrikes: number[];
  qqqStrikes: number[];
  explanation: string;
  tapeWatch: string;
  invalidation: string;
};

export type GexDeskExpiryRow = {
  expiration: string;
  source: GexDeskSourceSymbol;
  call: number;
  put: number;
  net: number;
  gross: number;
};

export type GexDeskHistoryRow = {
  price: number;
  call: number[];
  put: number[];
  net: number[];
  gross: number[];
  change: number[];
};

export type GexDeskHistoryPayload = {
  instrument: "NQ";
  source: "COMBINED" | GexDeskSourceSymbol;
  sessionDate: string;
  expiration: string | null;
  asOf: string;
  status: "LIVE" | "LAST_SESSION" | "DELAYED" | "PARTIAL";
  bucketSize: number;
  priceLow: number;
  priceHigh: number;
  timestamps: number[];
  nqPrices: number[];
  rows: GexDeskHistoryRow[];
  mappingCoverage: number;
  errors: string[];
  disclosure: string;
};

export type GexDeskZeroGammaCurvePoint = {
  price: number;
  netGex: number;
};

export type GexDeskZeroGammaPayload = {
  instrument: "NQ";
  sessionDate: string;
  asOf: string;
  marketOpen: boolean;
  status: "LIVE" | "EOD";
  spot: number;
  trueGammaFlip: number | null;
  netGex: number;
  grossGex: number;
  curve: GexDeskZeroGammaCurvePoint[];
  method: "TRUE_OI_SCENARIO";
  disclosure: string;
};

export type GexDeskPayload = {
  instrument: "NQ";
  sessionDate: string;
  asOf: string;
  refreshAfterMs: number;
  marketOpen: boolean;
  nqPrice: number | null;
  regime: {
    behaviour: GexDeskBehaviour;
    ratio: number;
    net: number;
    gross: number;
    zeroDteShare: number;
  };
  agreement: {
    score: number;
    label: "HIGH" | "MIXED" | "LOW";
    profileCorrelation: number;
    regimeAligned: boolean;
  };
  sources: GexDeskSourceSnapshot[];
  rail: GexDeskRailPoint[];
  zones: GexDeskZone[];
  expiries: GexDeskExpiryRow[];
  pressure: GexDeskPressure;
  optionsTape: GexDeskOptionPrint[];
  errors: string[];
  disclosure: string;
};

type BuildGexDeskPayloadArgs = {
  sessionDate: string;
  marketOpen: boolean;
  nqPrice: number | null;
  sources: GexDeskSourceSnapshot[];
  pressure: GexDeskPressure;
  optionsTape?: GexDeskOptionPrint[];
  upstreamErrors?: string[];
  refreshAfterMs?: number;
};

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function behaviourFor(net: number, gross: number): GexDeskBehaviour {
  const ratio = gross > 0 ? net / gross : 0;
  if (ratio > 0.1) return "STABILISING";
  if (ratio < -0.1) return "AMPLIFYING";
  return "TRANSITION";
}

function pearson(left: number[], right: number[]) {
  if (left.length < 3 || left.length !== right.length) return 0;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < left.length; index += 1) {
    const x = left[index] - leftMean;
    const y = right[index] - rightMean;
    numerator += x * y;
    leftSquare += x * x;
    rightSquare += y * y;
  }
  const denominator = Math.sqrt(leftSquare * rightSquare);
  return denominator > 0 ? clamp(numerator / denominator, -1, 1) : 0;
}

function zoneCopy(behaviour: GexDeskBehaviour) {
  if (behaviour === "STABILISING") {
    return {
      explanation: "Positive mapped gamma concentration can dampen movement and encourage two-way trade around this zone.",
      tapeWatch: "Watch for slowing velocity, opposing trade delta and repeated rotation back through the zone.",
      invalidation: "Acceptance beyond the zone with persistent same-direction NQ delta weakens the stabilising expectation.",
    };
  }
  if (behaviour === "AMPLIFYING") {
    return {
      explanation: "Negative mapped gamma concentration can amplify movement once price accepts through this zone.",
      tapeWatch: "Watch for expanding velocity and same-direction trade delta as price leaves the zone.",
      invalidation: "A fast rejection followed by balanced delta weakens the continuation expectation.",
    };
  }
  return {
    explanation: "Positive and negative contributions are closely balanced, so this zone is a decision area rather than a directional claim.",
    tapeWatch: "Wait for a clean price response and sustained NQ delta before treating the zone as active.",
    invalidation: "Conflicting or low-velocity tape keeps this zone neutral.",
  };
}

export function emptyGexDeskPressure(sources: GexDeskPressureSource[] = []): GexDeskPressure {
  return {
    score: 0,
    state: "BALANCED",
    persistence: "STEADY",
    confidence: 0,
    tradeCount: sources.reduce((sum, source) => sum + source.tradeCount, 0),
    method: "Estimated confidence-weighted directional options activity",
    sources,
    series: [],
  };
}

export function buildGexDeskPayload({
  sessionDate,
  marketOpen,
  nqPrice,
  sources,
  pressure,
  optionsTape = [],
  upstreamErrors = [],
  refreshAfterMs = marketOpen ? 15_000 : 60_000,
}: BuildGexDeskPayloadArgs): GexDeskPayload {
  const usableSources = sources.filter((source) => source.exposure && source.spot && source.spot > 0);
  const gross = usableSources.reduce((sum, source) => sum + (source.exposure?.gross ?? 0), 0);
  const net = usableSources.reduce((sum, source) => sum + (source.exposure?.net ?? 0), 0);
  const zeroDteGross = usableSources.reduce((sum, source) => sum + (source.zeroDteExposure?.gross ?? 0), 0);
  const ratio = gross > 0 ? net / gross : 0;
  const regimeBehaviour = behaviourFor(net, gross);
  const bucketSize = nqPrice
    ? Math.max(10, Math.round((nqPrice * 0.0007) / 5) * 5)
    : 20;
  const buckets = new Map<number, GexDeskRailPoint>();

  for (const source of usableSources) {
    const exposure = source.exposure;
    const spot = source.spot;
    if (!exposure || !spot || !nqPrice) continue;
    const zeroByStrike = new Map((source.zeroDteExposure?.strikes ?? []).map((row) => [row.strike, Math.abs(row.call) + Math.abs(row.put)]));
    for (const row of exposure.strikes) {
      const mapped = nqPrice * row.strike / spot;
      if (!Number.isFinite(mapped) || Math.abs(mapped / nqPrice - 1) > 0.09) continue;
      const price = Math.round(mapped / bucketSize) * bucketSize;
      const current = buckets.get(price) ?? {
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
        sourceAgreement: 0,
        ndxStrikes: [],
        qqqStrikes: [],
      };
      const rowGross = Math.abs(row.call) + Math.abs(row.put);
      current.call += row.call;
      current.put += row.put;
      current.net += row.net;
      current.gross += rowGross;
      current.zeroDteGross += zeroByStrike.get(row.strike) ?? 0;
      if (source.symbol === "NDX") {
        current.ndxNet += row.net;
        current.ndxGross += rowGross;
        if (!current.ndxStrikes.includes(row.strike)) current.ndxStrikes.push(row.strike);
      } else {
        current.qqqNet += row.net;
        current.qqqGross += rowGross;
        if (!current.qqqStrikes.includes(row.strike)) current.qqqStrikes.push(row.strike);
      }
      buckets.set(price, current);
    }
  }

  const rail = [...buckets.values()]
    .sort((left, right) => left.price - right.price)
    .map((row) => ({
      ...row,
      sourceAgreement: row.ndxGross > 0 && row.qqqGross > 0
        ? Math.sign(row.ndxNet) === Math.sign(row.qqqNet)
          ? 100
          : 0
        : 50,
    }));
  const ndxProfile = rail.map((row) => row.ndxGross > 0 ? row.ndxNet / row.ndxGross : 0);
  const qqqProfile = rail.map((row) => row.qqqGross > 0 ? row.qqqNet / row.qqqGross : 0);
  const profileCorrelation = pearson(ndxProfile, qqqProfile);
  const ndxSource = usableSources.find((source) => source.symbol === "NDX");
  const qqqSource = usableSources.find((source) => source.symbol === "QQQ");
  const ndxBehaviour = behaviourFor(ndxSource?.exposure?.net ?? 0, ndxSource?.exposure?.gross ?? 0);
  const qqqBehaviour = behaviourFor(qqqSource?.exposure?.net ?? 0, qqqSource?.exposure?.gross ?? 0);
  const regimeAligned = Boolean(ndxSource && qqqSource && ndxBehaviour === qqqBehaviour);
  const agreementScore = usableSources.length < 2
    ? 50
    : Math.round(clamp((profileCorrelation + 1) * 32.5 + (regimeAligned ? 35 : 0), 0, 100));

  const maximumGross = Math.max(...rail.map((row) => row.gross), 1);
  const nearby = rail
    .filter((row) => !nqPrice || Math.abs(row.price / nqPrice - 1) <= 0.055)
    .sort((left, right) => right.gross - left.gross);
  const chosen: GexDeskRailPoint[] = [];
  for (const candidate of nearby) {
    if (chosen.some((row) => Math.abs(row.price - candidate.price) < bucketSize * 1.5)) continue;
    chosen.push(candidate);
    if (chosen.length === 5) break;
  }
  const zones = chosen
    .map((row) => {
      const behaviour = behaviourFor(row.net, row.gross);
      const strength = Math.round(clamp(row.gross / maximumGross * 100, 0, 100));
      const distancePoints = nqPrice ? row.price - nqPrice : 0;
      const proximity = nqPrice ? clamp(1 - Math.abs(distancePoints) / (nqPrice * 0.035), 0, 1) : 0;
      const localZeroDteShare = row.gross > 0 ? clamp(row.zeroDteGross / row.gross, 0, 1) : 0;
      const priority = Math.round(clamp(
        strength * 0.55 + proximity * 25 + localZeroDteShare * 10 + row.sourceAgreement * 0.1,
        0,
        100,
      ));
      const copy = zoneCopy(behaviour);
      const ndxShare = row.gross > 0 ? row.ndxGross / row.gross : 0;
      const qqqShare = row.gross > 0 ? row.qqqGross / row.gross : 0;
      return {
        id: `nq-${row.price}`,
        low: row.price - bucketSize / 2,
        center: row.price,
        high: row.price + bucketSize / 2,
        behaviour,
        strength,
        priority,
        distancePoints,
        zeroDteShare: localZeroDteShare,
        callShare: row.gross > 0 ? Math.abs(row.call) / row.gross : 0.5,
        ndxShare,
        qqqShare,
        sourceAgreement: row.sourceAgreement,
        state: "STABLE" as const,
        gross: row.gross,
        ndxStrikes: row.ndxStrikes,
        qqqStrikes: row.qqqStrikes,
        ...copy,
      };
    })
    .sort((left, right) => right.priority - left.priority);

  const expiries = usableSources.flatMap((source) =>
    (source.exposure?.expiries ?? []).map((row) => ({
      expiration: row.expiration,
      source: source.symbol,
      call: row.call,
      put: row.put,
      net: row.net,
      gross: Math.abs(row.call) + Math.abs(row.put),
    })));
  const errors = [
    ...sources.flatMap((source) => source.error ? [`${source.symbol}: ${source.error}`] : []),
    ...upstreamErrors,
  ];

  return {
    instrument: "NQ",
    sessionDate,
    asOf: new Date().toISOString(),
    refreshAfterMs,
    marketOpen,
    nqPrice,
    regime: {
      behaviour: regimeBehaviour,
      ratio,
      net,
      gross,
      zeroDteShare: gross > 0 ? clamp(zeroDteGross / gross, 0, 1) : 0,
    },
    agreement: {
      score: agreementScore,
      label: agreementScore >= 70 ? "HIGH" : agreementScore >= 40 ? "MIXED" : "LOW",
      profileCorrelation,
      regimeAligned,
    },
    sources,
    rail,
    zones,
    expiries: expiries.sort((left, right) => left.expiration.localeCompare(right.expiration)),
    pressure,
    optionsTape: [...optionsTape].sort((left, right) => left.timestamp - right.timestamp),
    errors,
    disclosure: "Estimated options positioning and pressure. Not resting liquidity, exact dealer inventory, or a guaranteed trading signal.",
  };
}

export function createGexDeskFixture(): GexDeskPayload {
  const nqPrice = 28_042.25;
  const sessionDate = new Date().toISOString().slice(0, 10);
  const expiration = sessionDate;
  const optionLevels = [27_760, 27_860, 27_940, 28_000, 28_060, 28_140, 28_220, 28_340];
  const optionsTape: GexDeskOptionPrint[] = Array.from({ length: 190 }, (_, index) => {
    const source: GexDeskSourceSymbol = index % 3 === 0 ? "NDX" : "QQQ";
    const contractType: GexDeskOptionPrint["contractType"] = index % 5 < 3 ? "CALL" : "PUT";
    const mappedPrice = optionLevels[(index * 5 + Math.floor(index / 9)) % optionLevels.length];
    const sourceSpot = source === "NDX" ? 20_450 : 505;
    const strike = sourceSpot * mappedPrice / nqPrice;
    const size = 8 + (index * 17) % 140;
    const premium = (18_000 + (index * 41_731) % 580_000) * (mappedPrice === 28_000 || mappedPrice === 28_140 ? 2.4 : 1);
    return {
      id: `fixture-${source}-${index}`,
      source,
      timestamp: Date.now() - (189 - index) * 20_000,
      expiration,
      contractType,
      side: index % 4 === 0 ? "SOLD" : index % 7 === 0 ? "MID" : "BOUGHT",
      strike,
      mappedPrice,
      premium,
      size,
      volume: size * (4 + index % 12),
      openInterest: size * (10 + index % 18),
      confidence: index % 7 === 0 ? 0.55 : 1,
    };
  });
  const sourceFixture = (
    symbol: GexDeskSourceSymbol,
    spot: number,
    spacing: number,
    scale: number,
  ): GexDeskSourceSnapshot => {
    const strikes = Array.from({ length: 25 }, (_, index) => {
      const offset = index - 12;
      const strike = Math.round((spot + offset * spacing) / spacing) * spacing;
      const distance = Math.abs(offset);
      const concentration = Math.exp(-(distance * distance) / 34) * scale;
      const sign = offset === -4 || offset === 3 || offset === 7 ? -1 : 1;
      const call = concentration * (offset >= 0 ? 0.72 : 0.36) * sign;
      const put = concentration * (offset <= 0 ? 0.78 : 0.28) * sign;
      return { strike, call, put, net: call + put };
    });
    const zeroDteStrikes = strikes.map((row, index) => ({
      ...row,
      call: row.call * (index % 4 === 0 ? 0.48 : 0.26),
      put: row.put * (index % 3 === 0 ? 0.44 : 0.23),
      net: row.net * 0.3,
    }));
    const summary = (rows: typeof strikes): ExposureSummary => ({
      mode: "GAMMA",
      representation: "PER_ONE_PERCENT_MOVE",
      net: rows.reduce((sum, row) => sum + row.net, 0),
      gross: rows.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
      strikes: rows,
      expiries: [{
        expiration,
        call: rows.reduce((sum, row) => sum + row.call, 0),
        put: rows.reduce((sum, row) => sum + row.put, 0),
        net: rows.reduce((sum, row) => sum + row.net, 0),
      }],
    });
    return {
      symbol,
      spot,
      status: "LIVE",
      asOf: new Date().toISOString(),
      exposure: summary(strikes),
      zeroDteExposure: summary(zeroDteStrikes),
      oneDteExposure: summary(strikes.map((row, index) => {
        const call = row.call * (index % 5 === 0 ? 0.36 : 0.18);
        const put = row.put * (index % 4 === 0 ? 0.34 : 0.17);
        return { ...row, call, put, net: call + put };
      })),
      error: null,
    };
  };
  return buildGexDeskPayload({
    sessionDate,
    marketOpen: true,
    nqPrice,
    sources: [
      sourceFixture("NDX", 20_450, 25, 1_100_000_000),
      sourceFixture("QQQ", 505, 2.5, 760_000_000),
    ],
    pressure: {
      score: 27,
      state: "CALL_PRESSURE",
      persistence: "STEADY",
      confidence: 0.81,
      tradeCount: 186,
      method: "Estimated confidence-weighted signed delta demand; directional premium proxy where option delta is unavailable",
      sources: [
        {
          symbol: "NDX",
          score: 18,
          confidence: 0.78,
          tradeCount: 72,
          callShare: 0.57,
          asOf: new Date().toISOString(),
          series: Array.from({ length: 18 }, (_, index) => ({
            timestamp: Date.now() - (17 - index) * 60_000,
            score: Math.sin(index * 0.75) * 25 + 14,
            confidence: 0.74,
            tradeCount: 4 + index % 5,
          })),
        },
        {
          symbol: "QQQ",
          score: 34,
          confidence: 0.84,
          tradeCount: 114,
          callShare: 0.64,
          asOf: new Date().toISOString(),
          series: Array.from({ length: 18 }, (_, index) => ({
            timestamp: Date.now() - (17 - index) * 60_000,
            score: Math.sin(index * 0.62 + 0.5) * 28 + 22,
            confidence: 0.82,
            tradeCount: 6 + index % 6,
          })),
        },
      ],
      series: Array.from({ length: 18 }, (_, index) => ({
        timestamp: Date.now() - (17 - index) * 60_000,
        score: Math.sin(index * 0.68 + 0.2) * 23 + 21,
        confidence: 0.8,
        tradeCount: 11 + index % 8,
      })),
    },
    optionsTape,
    refreshAfterMs: 60_000,
  });
}

export function createGexDeskHistoryFixture(
  sourceInput: string = "COMBINED",
): GexDeskHistoryPayload {
  const source: GexDeskHistoryPayload["source"] = sourceInput === "NDX" || sourceInput === "QQQ"
    ? sourceInput
    : "COMBINED";
  const now = Date.now();
  const timestamps = Array.from({ length: 56 }, (_, index) => now - (55 - index) * 3 * 60_000);
  const bucketSize = 20;
  const priceLow = 27_420;
  const priceHigh = 28_640;
  const prices = Array.from(
    { length: Math.round((priceHigh - priceLow) / bucketSize) + 1 },
    (_, index) => priceLow + index * bucketSize,
  );
  const rows = prices.map((price) => {
    const net = timestamps.map((_, index) => {
      const movingCenter = 28_020 + Math.sin(index / 10) * 55;
      const primary = Math.exp(-((price - movingCenter) ** 2) / (2 * 95 ** 2)) * 0.86;
      const negativePocket = Math.exp(-((price - (27_770 + index * 1.2)) ** 2) / (2 * 70 ** 2)) * -0.68;
      const upper = Math.exp(-((price - 28_310) ** 2) / (2 * 55 ** 2)) * (0.28 + index / 120);
      return (primary + negativePocket + upper) * 1_000_000_000;
    });
    const gross = net.map((value, index) => Math.abs(value) * (1.18 + (index % 5) * 0.025));
    return {
      price,
      call: net.map((value) => Math.max(0, value) + Math.abs(value) * 0.22),
      put: net.map((value) => Math.min(0, value) - Math.abs(value) * 0.18),
      net,
      gross,
      change: net.map((value, index) => value - (net[index - 1] ?? value)),
    };
  });
  return {
    instrument: "NQ",
    source,
    sessionDate: new Date().toISOString().slice(0, 10),
    expiration: new Date().toISOString().slice(0, 10),
    asOf: new Date(now).toISOString(),
    status: "LIVE",
    bucketSize,
    priceLow,
    priceHigh,
    timestamps,
    nqPrices: timestamps.map((_, index) => 27_870 + index * 3.1 + Math.sin(index / 4.5) * 34),
    rows,
    mappingCoverage: 0.98,
    errors: [],
    disclosure: "Intraday gamma exposure mapped with timestamp-aligned source and NQ prices. Change shows each bucket versus its prior sampled frame.",
  };
}

export function createGexDeskZeroGammaFixture(): GexDeskZeroGammaPayload {
  const spot = 28_084;
  const trueGammaFlip = 28_020;
  const curve = Array.from({ length: 121 }, (_, index) => {
    const price = 27_500 + index * 10;
    const distance = price - trueGammaFlip;
    return {
      price,
      netGex: distance * 7_500_000 + Math.sin(index / 9) * 110_000_000,
    };
  });
  return {
    instrument: "NQ",
    sessionDate: new Date().toISOString().slice(0, 10),
    asOf: new Date().toISOString(),
    marketOpen: true,
    status: "LIVE",
    spot,
    trueGammaFlip,
    netGex: 1_420_000_000,
    grossGex: 8_760_000_000,
    curve,
    method: "TRUE_OI_SCENARIO",
    disclosure: "True open-interest gamma flip from the included native CME NQ structural and current-session 0DTE chains. Every included option is repriced across hypothetical NQ futures prices using Black-76 gamma; the crossing nearest live NQ is selected and linearly interpolated.",
  };
}
