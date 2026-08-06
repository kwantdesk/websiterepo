export const GEXBOT_FLOW_TICKER = "NQ_NDX";
export const GEXBOT_FLOW_FRESH_MS = 180_000;
export const GEXBOT_FLOW_POLL_MS = 60_000;
export const GEXBOT_FLOW_WINDOW_SIZE = 20;
export const GEXBOT_FLOW_SIGN_CONVENTION =
  "GEX Bot labels describe the customer side; dealer hedge implications are inferred from the opposite side.";

export type GexBotFlowFreshness = "LIVE" | "STALE" | "FROZEN" | "UNAVAILABLE";
export type GexBotSponsorshipState = "SPONSORED" | "HOLLOW" | "WARMING_UP" | "QUIET";

export type GexBotFlowSample = {
  ticker: string;
  timestamp: number;
  spot: number;
  zcvr: number;
  zgr: number;
  aggDex: number;
  aggCallDex: number;
  aggPutDex: number;
  zcharm: number;
  zvanna: number;
  magnet: number | null;
  accelerator: number | null;
  majorCall: number | null;
  majorPut: number | null;
};

export type GexBotSponsorshipVerdict = {
  id: string;
  state: Exclude<GexBotSponsorshipState, "WARMING_UP" | "QUIET">;
  label: string;
  timestamp: number;
  priceChange: number;
  priceChangePercent: number;
  dexChange: number;
  thresholdPercent: number;
  dexFloor: number;
};

export type GexBotRestrikeObject = "magnet" | "accelerator" | "major call" | "major put";

export type GexBotRestrikeNotice = {
  id: string;
  object: GexBotRestrikeObject;
  from: number;
  to: number;
  interval: number;
  timestamp: number;
  label: string;
};

export type GexBotFlowPayload = {
  ok: boolean;
  ticker: typeof GEXBOT_FLOW_TICKER;
  status: GexBotFlowFreshness;
  marketOpen: boolean;
  generatedAt: string;
  checkedAt: string;
  sample: GexBotFlowSample | null;
  dataAgeMs: number | null;
  freezeTime: string | null;
  cadenceMs: number;
  windowSamples: number;
  convexity: {
    label: string;
    value: number | null;
  };
  dexLean: {
    label: string;
    call: number | null;
    put: number | null;
    net: number | null;
  };
  clock: {
    label: string;
    charm: number | null;
    vanna: number | null;
    dominant: boolean;
  };
  sponsorship: {
    state: GexBotSponsorshipState;
    active: GexBotSponsorshipVerdict | null;
    recent: GexBotSponsorshipVerdict[];
  };
  restrikes: GexBotRestrikeNotice[];
  matchingBand: number;
  signConvention: typeof GEXBOT_FLOW_SIGN_CONVENTION;
  error?: string;
};

export type SponsorshipConfig = {
  thresholdPercent?: number;
  dexFloor?: number;
};

export type FlowComparableLevel = {
  id: string;
  kind: string;
  price: number;
  label: string;
  crossConfirmed?: boolean;
  contested?: boolean;
  confidenceBoost?: number;
  flowComparison?: {
    object: string;
    kwantPrice: number;
    gexBotPrice: number;
    distance: number;
    matchingBand: number;
    sources: ["Kwant", "GEX Bot"];
  };
};

export type FlowPositioningObject = {
  key: "magnet" | "accelerator" | "majorCall" | "majorPut";
  name: GexBotRestrikeObject;
  kind: "GAMMA_MAGNET" | "GAMMA_ACCELERATOR" | "CALL_WALL" | "PUT_WALL";
  price: number;
};

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function timestampMs(value: unknown, fallback = Date.now()) {
  const parsed = finite(value);
  if (parsed === null || parsed <= 0) return fallback;
  return parsed < 10_000_000_000 ? parsed * 1_000 : parsed;
}

export function newYorkSessionKey(now: Date | number = Date.now()) {
  const date = typeof now === "number" ? new Date(now) : now;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isGexBotFlowRth(now: Date | number = Date.now()) {
  const date = typeof now === "number" ? new Date(now) : now;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (values.weekday === "Sat" || values.weekday === "Sun") return false;
  const minutes = Number(values.hour) * 60 + Number(values.minute);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function normalizeGexBotFlowSample(payload: unknown, fallbackNow = Date.now()): GexBotFlowSample {
  const unwrap = (value: unknown): Record<string, unknown> => {
    if (Array.isArray(value)) {
      const row = [...value].reverse().find((item) => item && typeof item === "object");
      return row && typeof row === "object" ? row as Record<string, unknown> : {};
    }
    if (!value || typeof value !== "object") return {};
    const source = value as Record<string, unknown>;
    for (const key of ["data", "result", "frame"]) {
      if (source[key] && typeof source[key] === "object") return unwrap(source[key]);
    }
    return source;
  };
  const source = unwrap(payload);
  const required = (key: string) => {
    const value = finite(source[key]);
    if (value === null) throw new Error(`GEX Bot flow frame is missing ${key}.`);
    return value;
  };
  const optional = (key: string) => finite(source[key]);
  const spot = required("spot");
  if (spot <= 0) throw new Error("GEX Bot flow frame has an invalid spot.");
  return {
    ticker: typeof source.ticker === "string" && source.ticker.trim() ? source.ticker.trim() : GEXBOT_FLOW_TICKER,
    timestamp: timestampMs(source.timestamp, fallbackNow),
    spot,
    zcvr: required("zcvr"),
    zgr: required("zgr"),
    aggDex: required("agg_dex"),
    aggCallDex: required("agg_call_dex"),
    aggPutDex: required("agg_put_dex"),
    zcharm: required("zcharm"),
    zvanna: required("zvanna"),
    magnet: optional("z_msgamma"),
    accelerator: optional("z_mlgamma"),
    majorCall: optional("zero_mcall"),
    majorPut: optional("zero_mput"),
  };
}

export function flowDexLean(sample: GexBotFlowSample | null) {
  if (!sample) return "Waiting for session dex";
  if (sample.aggCallDex < 0 && sample.aggPutDex > 0) return "broad vol-shorting";
  const net = sample.aggCallDex + sample.aggPutDex;
  if (sample.aggCallDex > 0 && net > 0) return "call-buying tilt";
  if (sample.aggPutDex < 0 && net < 0) return "put-buying tilt";
  return "mixed";
}

export function sponsorshipVerdict(
  window: GexBotFlowSample[],
  config: SponsorshipConfig = {},
): { state: GexBotSponsorshipState; active: GexBotSponsorshipVerdict | null } {
  if (window.length < 5) return { state: "WARMING_UP", active: null };
  const rows = window.slice(-5);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const thresholdPercent = Math.max(0.0001, config.thresholdPercent ?? 0.0015);
  const dexFloor = Math.max(0, config.dexFloor ?? 1_000_000);
  const priceChange = last.spot - first.spot;
  const priceChangePercent = first.spot ? priceChange / first.spot : 0;
  const dexChange = last.aggDex - first.aggDex;
  if (Math.abs(priceChangePercent) < thresholdPercent) return { state: "QUIET", active: null };
  const sameSign = Math.sign(priceChange) !== 0 && Math.sign(priceChange) === Math.sign(dexChange);
  const state = sameSign && Math.abs(dexChange) >= dexFloor ? "SPONSORED" : "HOLLOW";
  return {
    state,
    active: {
      id: `${last.timestamp}:${state}:${Math.round(first.spot * 100)}:${Math.round(last.spot * 100)}`,
      state,
      label: state === "SPONSORED" ? "sponsored push" : "hollow push — trap watch",
      timestamp: last.timestamp,
      priceChange,
      priceChangePercent,
      dexChange,
      thresholdPercent,
      dexFloor,
    },
  };
}

export function detectRestrikes(
  previous: GexBotFlowSample | null,
  current: GexBotFlowSample,
  strikeInterval: number,
  emitted = new Set<string>(),
) {
  if (!previous || !Number.isFinite(strikeInterval) || strikeInterval <= 0) return [];
  const objects: Array<[GexBotRestrikeObject, keyof Pick<GexBotFlowSample, "magnet" | "accelerator" | "majorCall" | "majorPut">]> = [
    ["magnet", "magnet"],
    ["accelerator", "accelerator"],
    ["major call", "majorCall"],
    ["major put", "majorPut"],
  ];
  return objects.flatMap(([name, key]) => {
    const from = previous[key];
    const to = current[key];
    if (from === null || to === null || Math.abs(to - from) <= strikeInterval) return [];
    const id = `${name}:${from}:${to}:${current.timestamp}`;
    if (emitted.has(id)) return [];
    return [{
      id,
      object: name,
      from,
      to,
      interval: strikeInterval,
      timestamp: current.timestamp,
      label: `map being redrawn — ${name} moved ${from} -> ${to}`,
    } satisfies GexBotRestrikeNotice];
  });
}

export function flowPositioningObjects(sample: GexBotFlowSample | null): FlowPositioningObject[] {
  if (!sample) return [];
  const rows = [
    { key: "magnet", name: "magnet", kind: "GAMMA_MAGNET", price: sample.magnet },
    { key: "accelerator", name: "accelerator", kind: "GAMMA_ACCELERATOR", price: sample.accelerator },
    { key: "majorCall", name: "major call", kind: "CALL_WALL", price: sample.majorCall },
    { key: "majorPut", name: "major put", kind: "PUT_WALL", price: sample.majorPut },
  ] as const;
  return rows.flatMap((row) => row.price !== null && Number.isFinite(row.price) && row.price > 0
    ? [{ ...row, price: row.price } as FlowPositioningObject]
    : []);
}

export function mergeOneFamilyPositioning<T extends FlowComparableLevel>(
  levels: T[],
  sample: GexBotFlowSample | null,
  matchingBand: number,
  makeContestedReference: (object: FlowPositioningObject, nearest: T) => T,
) {
  const safeBand = Math.max(0.25, Number.isFinite(matchingBand) ? matchingBand : 0.25);
  let next = levels.map((level) => ({ ...level }));
  for (const object of flowPositioningObjects(sample)) {
    const candidates = next.filter((level) => level.kind === object.kind && !level.id.startsWith("gexbot-flow-"));
    if (!candidates.length) continue;
    const nearest = candidates.reduce((best, level) =>
      Math.abs(level.price - object.price) < Math.abs(best.price - object.price) ? level : best,
    );
    const distance = Math.abs(nearest.price - object.price);
    const comparison = {
      object: object.name,
      kwantPrice: nearest.price,
      gexBotPrice: object.price,
      distance,
      matchingBand: safeBand,
      sources: ["Kwant", "GEX Bot"] as ["Kwant", "GEX Bot"],
    };
    if (distance <= safeBand) {
      next = next.map((level) => level.id === nearest.id ? {
        ...level,
        label: level.label.includes("cross-confirmed") ? level.label : `${level.label} · cross-confirmed`,
        crossConfirmed: true,
        confidenceBoost: Math.max(level.confidenceBoost ?? 0, 0.05),
        flowComparison: comparison,
      } : level);
      continue;
    }
    next = next.map((level) => level.id === nearest.id ? {
      ...level,
      label: level.label.includes("contested") ? level.label : `${level.label} · contested`,
      contested: true,
      flowComparison: comparison,
    } : level);
    const referenceId = `gexbot-flow-${object.kind.toLowerCase()}-${object.price}`;
    if (!next.some((level) => level.id === referenceId)) {
      next.push({
        ...makeContestedReference(object, nearest),
        id: referenceId,
        contested: true,
        flowComparison: comparison,
      });
    }
  }
  return next;
}

export function buildGexBotFlowPayload(args: {
  sample: GexBotFlowSample | null;
  window: GexBotFlowSample[];
  recentVerdicts?: GexBotSponsorshipVerdict[];
  restrikes?: GexBotRestrikeNotice[];
  now?: number;
  marketOpen: boolean;
  requestFailed?: boolean;
  error?: string;
  sponsorship?: SponsorshipConfig;
}): GexBotFlowPayload {
  const now = args.now ?? Date.now();
  const sample = args.sample;
  const dataAgeMs = sample ? Math.max(0, now - sample.timestamp) : null;
  const expired = dataAgeMs !== null && dataAgeMs > GEXBOT_FLOW_FRESH_MS;
  const status: GexBotFlowFreshness = !sample
    ? "UNAVAILABLE"
    : !args.marketOpen || expired
      ? "FROZEN"
      : args.requestFailed
        ? "STALE"
        : "LIVE";
  const verdict = status === "LIVE"
    ? sponsorshipVerdict(args.window, args.sponsorship)
    : { state: args.window.length < 5 ? "WARMING_UP" as const : "QUIET" as const, active: null };
  const recent = verdict.active
    ? [verdict.active, ...(args.recentVerdicts ?? []).filter((item) => item.id !== verdict.active?.id)].slice(0, 5)
    : (args.recentVerdicts ?? []).slice(0, 5);
  const charmDominant = Boolean(sample && Math.abs(sample.zcharm) > 2 * Math.abs(sample.zvanna));
  const generatedAt = new Date(sample?.timestamp ?? now).toISOString();
  return {
    ok: Boolean(sample),
    ticker: GEXBOT_FLOW_TICKER,
    status,
    marketOpen: args.marketOpen,
    generatedAt,
    checkedAt: new Date(now).toISOString(),
    sample,
    dataAgeMs,
    freezeTime: status === "FROZEN" && sample ? new Date(sample.timestamp).toISOString() : null,
    cadenceMs: GEXBOT_FLOW_POLL_MS,
    windowSamples: args.window.length,
    convexity: {
      label: sample ? sample.zcvr < 0 ? "vol selling — grind" : "vol demand — movement" : "waiting for convexity",
      value: sample?.zcvr ?? null,
    },
    dexLean: {
      label: flowDexLean(sample),
      call: sample?.aggCallDex ?? null,
      put: sample?.aggPutDex ?? null,
      net: sample?.aggDex ?? null,
    },
    clock: {
      label: charmDominant ? "charm dominant — close gravitates to the magnet" : "no dominant clock pressure",
      charm: sample?.zcharm ?? null,
      vanna: sample?.zvanna ?? null,
      dominant: charmDominant,
    },
    sponsorship: {
      state: verdict.state,
      active: verdict.active,
      recent,
    },
    restrikes: (args.restrikes ?? []).slice(0, 5),
    matchingBand: sample ? Math.max(0.25, sample.spot * 0.0005) : 0.25,
    signConvention: GEXBOT_FLOW_SIGN_CONVENTION,
    ...(args.error ? { error: args.error } : {}),
  };
}

export function nextGexBotFlowBackoffMs(failures: number) {
  return Math.min(5 * 60_000, GEXBOT_FLOW_POLL_MS * 2 ** Math.max(0, Math.min(3, failures - 1)));
}
