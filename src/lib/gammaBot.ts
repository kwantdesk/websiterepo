import type {
  GammaRegime,
  OptionsFlowPayload,
  OptionsKeyLevel,
} from "@/lib/optionsFlow";

export type GammaBotInstrument = "NQ" | "ES";

export type GammaBotLevel = {
  id: string;
  kind: OptionsKeyLevel["kind"];
  label: string;
  price: number;
  value: number | null;
  explanation: string;
};

export type GammaBotMessage = {
  key: string;
  category: "REGIME" | "LEVEL" | "FLOW" | "POSITIONING" | "VOLATILITY";
  headline: string;
  body: string;
  importance: "STANDARD" | "IMPORTANT";
};

export type GammaBotPayload = {
  instrument: GammaBotInstrument;
  sourceSymbol: "QQQ" | "SPY";
  asOf: string;
  refreshAfterMs: number;
  marketOpen: boolean;
  price: number | null;
  priceStatus: OptionsFlowPayload["marketData"]["status"];
  priceDetail: string;
  regime: {
    value: GammaRegime;
    strength: OptionsFlowPayload["environment"]["gammaStrength"];
    score: number;
    label: string;
    plainEnglish: string;
  };
  metrics: {
    netGex: number | null;
    grossGex: number | null;
    netDex: number | null;
    netVanna: number | null;
    netCharm: number | null;
    bullishShare: number | null;
    netPremium: number;
    putCallRatio: number | null;
    frontExpiryGexChange1h: number | null;
    frontExpiryDexChange1h: number | null;
  };
  levels: GammaBotLevel[];
  messages: GammaBotMessage[];
  errors: string[];
  disclosure: string;
};

const SOURCE_BY_INSTRUMENT = {
  NQ: "QQQ",
  ES: "SPY",
} as const;

function signedDirection(value: number | null, positive: string, negative: string, balanced: string) {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 1e-9) return balanced;
  return value > 0 ? positive : negative;
}

function sentenceCase(value: string) {
  const normalized = value.trim();
  return normalized.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
}

function regimeExplanation(regime: GammaRegime) {
  if (regime === "POSITIVE") {
    return "Dealer hedging is more likely to lean against price movement. Expect more two-way trade and respect for nearby magnets until price proves acceptance beyond them.";
  }
  if (regime === "NEGATIVE") {
    return "Dealer hedging can reinforce price movement. Clean breaks can travel further, so failed reactions and accepted moves through levels matter more than the first touch.";
  }
  return "Gamma is balanced enough that neither dampening nor acceleration clearly dominates. Let price reaction and live options flow decide the next read.";
}

function mapLevel(level: OptionsKeyLevel, scale: number): GammaBotLevel | null {
  const price = level.price * scale;
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    id: level.id,
    kind: level.kind,
    label: level.label,
    price,
    value: level.value,
    explanation: level.explanation,
  };
}

function usefulLevels(data: OptionsFlowPayload) {
  const scale = data.marketData.mode === "FUTURES" ? data.marketData.levelPriceScale : 1;
  const price = data.marketData.lastPrice;
  const seen = new Set<string>();
  return data.levels.keyLevels
    .map((level) => mapLevel(level, scale))
    .filter((level): level is GammaBotLevel => Boolean(level))
    .filter((level) => {
      const key = `${level.kind}:${level.price.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return price === null || Math.abs(level.price - price) / price <= 0.12;
    })
    .sort((a, b) => a.price - b.price);
}

function nearestLevel(levels: GammaBotLevel[], price: number | null) {
  if (price === null || !levels.length) return null;
  return levels.reduce((nearest, level) => (
    Math.abs(level.price - price) < Math.abs(nearest.price - price) ? level : nearest
  ));
}

function buildMessages(data: OptionsFlowPayload, levels: GammaBotLevel[]): GammaBotMessage[] {
  const regime = data.environment.gammaRegime;
  const price = data.marketData.lastPrice;
  const nearest = nearestLevel(levels, price);
  const netDex = data.exposures.DELTA?.net ?? null;
  const gexChange = data.marketMap.dealerPositioning.frontExpiryGexChange1h;
  const dexChange = data.marketMap.dealerPositioning.frontExpiryDexChange1h;
  const bullishShare = data.environment.bullishShare;
  const ratio = data.marketMap.putCallVolume?.putCallRatio ?? null;
  const messages: GammaBotMessage[] = [
    {
      key: `regime:${regime}:${data.environment.gammaStrength}`,
      category: "REGIME",
      headline: `${data.environment.gammaStrength.toLowerCase()} ${regime.toLowerCase()} gamma regime`,
      body: regimeExplanation(regime),
      importance: regime === "NEGATIVE" ? "IMPORTANT" : "STANDARD",
    },
  ];

  if (nearest && price !== null) {
    const distance = nearest.price - price;
    const side = distance > 0 ? "above" : distance < 0 ? "below" : "at price";
    messages.push({
      key: `level:${nearest.id}:${side}`,
      category: "LEVEL",
      headline: `${nearest.label} is the closest mapped level`,
      body: `${nearest.label} sits ${Math.abs(distance).toFixed(2)} points ${side}. ${nearest.explanation}`,
      importance: Math.abs(distance) / price <= 0.0015 ? "IMPORTANT" : "STANDARD",
    });
  }

  messages.push({
    key: `dex:${netDex === null ? "na" : Math.sign(netDex)}`,
    category: "POSITIONING",
    headline: signedDirection(netDex, "Net DEX is positive", "Net DEX is negative", "Net DEX is balanced"),
    body: signedDirection(
      netDex,
      "The options complex carries net positive directional delta. That is supportive context, but it is not a standalone long signal.",
      "The options complex carries net negative directional delta. That is defensive context, but it is not a standalone short signal.",
      "Directional delta is not giving a strong lean, so the nearest levels and live flow deserve more weight.",
    ),
    importance: "STANDARD",
  });

  if (gexChange !== null || dexChange !== null) {
    messages.push({
      key: `change:${gexChange === null ? "na" : Math.sign(gexChange)}:${dexChange === null ? "na" : Math.sign(dexChange)}`,
      category: "POSITIONING",
      headline: "The front-expiry structure is changing",
      body: `${signedDirection(gexChange, "Gamma has built over the last hour", "Gamma has weakened over the last hour", "Gamma is broadly unchanged over the last hour")}. ${signedDirection(dexChange, "Directional delta has also strengthened", "Directional delta has softened", "Directional delta is broadly unchanged")}.`,
      importance: "STANDARD",
    });
  }

  if (bullishShare !== null || ratio !== null) {
    const flowLean = bullishShare === null
      ? "Flow classification is incomplete"
      : bullishShare >= 0.55
        ? "Classified premium is leaning bullish"
        : bullishShare <= 0.45
          ? "Classified premium is leaning bearish"
          : "Classified premium is balanced";
    const ratioText = ratio === null ? "" : ` Put/call volume is ${ratio.toFixed(2)}.`;
    messages.push({
      key: `flow:${bullishShare === null ? "na" : Math.round(bullishShare * 20)}:${ratio === null ? "na" : Math.round(ratio * 10)}`,
      category: "FLOW",
      headline: flowLean,
      body: `${flowLean} at ${bullishShare === null ? "an unavailable" : `${Math.round(bullishShare * 100)}% bullish`} share.${ratioText} Read this as context alongside price response, not as a prediction.`,
      importance: bullishShare !== null && (bullishShare >= 0.65 || bullishShare <= 0.35) ? "IMPORTANT" : "STANDARD",
    });
  }

  messages.push({
    key: `volatility:${data.environment.volatilityState}`,
    category: "VOLATILITY",
    headline: data.environment.volatilityState.toLowerCase().replaceAll("_", " "),
    body: data.environment.volatilityState === "COMPRESSION"
      ? "The current gamma and volatility mix favours contained movement unless price accepts beyond a major level."
      : data.environment.volatilityState === "EXPANSION RISK"
        ? "The current structure can support larger moves. Treat failed holds and level breaks with more urgency."
        : "Volatility conditions are balanced. Confirmation at the mapped levels matters more than anticipating a large move.",
    importance: data.environment.volatilityState === "EXPANSION RISK" ? "IMPORTANT" : "STANDARD",
  });

  return messages.map((message) => ({
    ...message,
    headline: sentenceCase(message.headline),
    body: sentenceCase(message.body),
  }));
}

export function buildGammaBotPayload(
  instrument: GammaBotInstrument,
  data: OptionsFlowPayload,
): GammaBotPayload {
  const levels = usefulLevels(data);
  return {
    instrument,
    sourceSymbol: SOURCE_BY_INSTRUMENT[instrument],
    asOf: data.asOf,
    refreshAfterMs: Math.max(5_000, Math.min(30_000, data.refreshAfterMs)),
    marketOpen: data.session.marketOpen,
    price: data.marketData.lastPrice,
    priceStatus: data.marketData.status,
    priceDetail: data.marketData.detail,
    regime: {
      value: data.environment.gammaRegime,
      strength: data.environment.gammaStrength,
      score: data.environment.regimeStrength,
      label: data.environment.gammaStateLabel,
      plainEnglish: regimeExplanation(data.environment.gammaRegime),
    },
    metrics: {
      netGex: data.exposures.GAMMA?.net ?? null,
      grossGex: data.exposures.GAMMA?.gross ?? null,
      netDex: data.exposures.DELTA?.net ?? null,
      netVanna: data.exposures.VANNA?.net ?? null,
      netCharm: data.exposures.CHARM?.net ?? null,
      bullishShare: data.environment.bullishShare,
      netPremium: data.environment.netPremium,
      putCallRatio: data.marketMap.putCallVolume?.putCallRatio ?? null,
      frontExpiryGexChange1h: data.marketMap.dealerPositioning.frontExpiryGexChange1h,
      frontExpiryDexChange1h: data.marketMap.dealerPositioning.frontExpiryDexChange1h,
    },
    levels,
    messages: buildMessages(data, levels),
    errors: data.errors,
    disclosure: "Gamma Bot translates measured options positioning and price response into plain language. It describes conditions; it does not predict outcomes or provide financial advice.",
  };
}

export function gammaBotSource(instrument: GammaBotInstrument) {
  return SOURCE_BY_INSTRUMENT[instrument];
}
