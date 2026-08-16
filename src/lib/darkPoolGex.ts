import type { BounceExposureSlice, BounceLevelsSnapshot } from "@/lib/bounceLevels";
import type { DarkPoolMapPayload, MappedDarkPoolPrint } from "@/lib/darkPoolMap";

export const DARK_POOL_GEX_INDICATOR_ID = "dark-pool-gex";
export const DARK_POOL_GEX_WORKSPACE_TOOL_ID = "tool-dark-pool-gex";
export const DARK_POOL_GEX_SCHEMA_VERSION = 1;

export type DarkPoolGexContextMode = "current" | "event-time" | "historical-and-current";
export type DarkPoolGexDisplayMode = "raw" | "clusters" | "raw-and-clusters";
export type DarkPoolGexToleranceMode = "percentage" | "absolute" | "ticks";
export type DarkPoolGexConfluenceMode = "off" | "nearest" | "major" | "king" | "king-and-major" | "all-qualified";
export type DarkPoolGexQuality = "ultra" | "high" | "medium" | "low" | "auto";

export type DarkPoolGexSettings = {
  lookbackDays: number;
  topN: number;
  minimumNotional: number;
  maximumNotional: number;
  minimumShares: number;
  maximumShares: number;
  minimumSharePrice: number;
  maximumSharePrice: number;
  contextMode: DarkPoolGexContextMode;
  confluenceMode: DarkPoolGexConfluenceMode;
  toleranceMode: DarkPoolGexToleranceMode;
  tolerance: number;
  displayMode: DarkPoolGexDisplayMode;
  clusterEnabled: boolean;
  clusterDistanceMode: "percentage" | "absolute" | "ticks";
  clusterDistance: number;
  minimumClusterPrints: number;
  minimumClusterNotional: number;
  proxyMode: boolean;
  showOriginMarker: boolean;
  showForwardMemory: boolean;
  showTooltip: boolean;
  showInspector: boolean;
  showFreshness: boolean;
  ageFade: boolean;
  ageFadeHalfLifeDays: number;
  proximityEmphasis: boolean;
  proximityDistance: number;
  bandThickness: number;
  bandOpacity: number;
  originMarkerSize: number;
  haloIntensity: number;
  kingBoost: number;
  performanceQuality: DarkPoolGexQuality;
};

export const DEFAULT_DARK_POOL_GEX_SETTINGS: DarkPoolGexSettings = {
  lookbackDays: 30,
  topN: 5,
  minimumNotional: 1_000_000,
  maximumNotional: 0,
  minimumShares: 0,
  maximumShares: 0,
  minimumSharePrice: 0,
  maximumSharePrice: 0,
  contextMode: "current",
  confluenceMode: "king-and-major",
  toleranceMode: "percentage",
  tolerance: 0.15,
  displayMode: "raw-and-clusters",
  clusterEnabled: true,
  clusterDistanceMode: "percentage",
  clusterDistance: 0.12,
  minimumClusterPrints: 2,
  minimumClusterNotional: 5_000_000,
  proxyMode: false,
  showOriginMarker: true,
  showForwardMemory: true,
  showTooltip: true,
  showInspector: false,
  showFreshness: true,
  ageFade: false,
  ageFadeHalfLifeDays: 30,
  proximityEmphasis: true,
  proximityDistance: 0.15,
  bandThickness: 6,
  bandOpacity: 24,
  originMarkerSize: 7,
  haloIntensity: 70,
  kingBoost: 30,
  performanceQuality: "auto",
};

export type DarkPoolGexNode = {
  sourceStrike: number;
  mappedPrice: number;
  signedExposure: number;
  absoluteExposure: number;
  percentOfKing: number;
  role: string;
  distance: number;
  distancePercent: number;
  gexStrength: number;
  distanceFactor: number;
  roleWeight: number;
  confluence: number;
  snapshotTimeMs: number;
};

export type DarkPoolGexEvent = {
  id: string;
  print: MappedDarkPoolPrint;
  price: number;
  sourcePrice: number;
  notional: number;
  shares: number;
  timestampMs: number;
  direction: "UNKNOWN";
  classification: "OFF_EXCHANGE";
  quality: "live" | "delayed" | "historical";
  rawStrength: number;
  visualStrength: number;
  currentConfluence: DarkPoolGexNode | null;
  eventTimeConfluence: DarkPoolGexNode | null;
  primaryConfluence: DarkPoolGexNode | null;
  combinedImportance: number;
  ageDays: number;
  ageFade: number;
};

export type DarkPoolGexCluster = {
  id: string;
  events: DarkPoolGexEvent[];
  weightedPrice: number;
  totalNotional: number;
  totalShares: number;
  firstTimestampMs: number;
  lastTimestampMs: number;
  visualStrength: number;
  primaryConfluence: DarkPoolGexNode | null;
};

export type DarkPoolGexFrame = {
  schemaVersion: 1;
  sourceTicker: string;
  displayInstrument: string;
  generatedAtMs: number;
  status: "LIVE" | "DELAYED" | "HISTORICAL" | "STALE" | "NO_OFF_EXCHANGE_DATA" | "NO_GEX_DATA" | "PROXY_MODE";
  rawEvents: DarkPoolGexEvent[];
  eligibleEventCount: number;
  clusters: DarkPoolGexCluster[];
  gexSnapshotTimeMs: number | null;
  limitations: string[];
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function roleWeight(role: string) {
  if (role === "KING") return 1;
  if (role === "GATEKEEPER") return 0.9;
  if (role === "FLOOR" || role === "CEILING") return 0.85;
  if (role === "MAJOR") return 0.75;
  return 0.6;
}

function toleranceAt(price: number, tickSize: number, settings: DarkPoolGexSettings) {
  if (settings.toleranceMode === "absolute") return Math.max(1e-9, settings.tolerance);
  if (settings.toleranceMode === "ticks") return Math.max(1e-9, settings.tolerance * tickSize);
  return Math.max(1e-9, price * settings.tolerance / 100);
}

function confluenceAllowed(node: { role: string }, mode: DarkPoolGexConfluenceMode) {
  if (mode === "off") return false;
  if (mode === "nearest" || mode === "all-qualified") return true;
  if (mode === "king") return node.role === "KING";
  if (mode === "major") return ["MAJOR", "GATEKEEPER", "FLOOR", "CEILING"].includes(node.role);
  return node.role === "KING" || ["MAJOR", "GATEKEEPER", "FLOOR", "CEILING"].includes(node.role);
}

type DarkPoolGexConfluenceCandidate = {
  sourceStrike: number;
  mappedPrice: number;
  signedExposure: number;
  absoluteExposure: number;
  role?: string;
  percentOfKing?: number;
  percentOfKingAbsolute?: number;
  snapshotTimeMs?: number;
  timestamp?: number;
};

function makeConfluence(
  price: number,
  nodes: DarkPoolGexConfluenceCandidate[],
  tickSize: number,
  settings: DarkPoolGexSettings,
) {
  if (settings.confluenceMode === "off" || !nodes.length) return null;
  const kingMagnitude = Math.max(...nodes.map((node) => Math.abs(node.signedExposure)), 0);
  const normalizedNodes = nodes.map((node) => ({
    ...node,
    // The restored Bounce exposure field predates per-slice role labels. Preserve
    // current-level roles and derive the historical KING/MAJOR role from raw size.
    role: node.role ?? (Math.abs(node.signedExposure) === kingMagnitude ? "KING" : "MAJOR"),
  }));
  const nearest = normalizedNodes
    .filter((node) => confluenceAllowed(node, settings.confluenceMode))
    .map((node) => ({ node, distance: Math.abs(node.mappedPrice - price) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) return null;
  const tolerance = toleranceAt(price, tickSize, settings);
  if (nearest.distance > tolerance) return null;
  const magnitude = Math.abs(nearest.node.signedExposure);
  const gexStrength = kingMagnitude > 0 ? clamp01(magnitude / kingMagnitude) : 0;
  const distanceFactor = clamp01(1 - nearest.distance / tolerance);
  const weight = roleWeight(nearest.node.role);
  return {
    sourceStrike: nearest.node.sourceStrike,
    mappedPrice: nearest.node.mappedPrice,
    signedExposure: nearest.node.signedExposure,
    absoluteExposure: magnitude,
    percentOfKing: (nearest.node.percentOfKing ?? ((nearest.node.percentOfKingAbsolute ?? gexStrength) * 100)),
    role: nearest.node.role,
    distance: nearest.distance,
    distancePercent: nearest.distance / Math.max(1e-9, price) * 100,
    gexStrength,
    distanceFactor,
    roleWeight: weight,
    confluence: clamp01(0.60 * gexStrength + 0.25 * distanceFactor + 0.15 * weight),
    snapshotTimeMs: nearest.node.snapshotTimeMs ?? nearest.node.timestamp ?? 0,
  } satisfies DarkPoolGexNode;
}

function latestSliceAt(slices: BounceExposureSlice[], timestampMs: number) {
  let match: BounceExposureSlice | null = null;
  for (const slice of slices) {
    if (slice.timestamp <= timestampMs && (!match || slice.timestamp > match.timestamp)) match = slice;
  }
  return match;
}

function clusterThreshold(price: number, tickSize: number, settings: DarkPoolGexSettings) {
  if (settings.clusterDistanceMode === "absolute") return Math.max(1e-9, settings.clusterDistance);
  if (settings.clusterDistanceMode === "ticks") return Math.max(1e-9, settings.clusterDistance * tickSize);
  return Math.max(1e-9, price * settings.clusterDistance / 100);
}

function buildClusters(events: DarkPoolGexEvent[], tickSize: number, settings: DarkPoolGexSettings) {
  if (!settings.clusterEnabled) return [];
  const sorted = [...events].sort((a, b) => a.price - b.price);
  const groups: DarkPoolGexEvent[][] = [];
  for (const event of sorted) {
    const group = groups.at(-1);
    const weighted = group
      ? group.reduce((sum, item) => sum + item.price * item.notional, 0) / Math.max(1, group.reduce((sum, item) => sum + item.notional, 0))
      : event.price;
    if (group && Math.abs(event.price - weighted) <= clusterThreshold(weighted, tickSize, settings)) group.push(event);
    else groups.push([event]);
  }
  const maximumNotional = Math.max(...groups.map((group) => group.reduce((sum, event) => sum + event.notional, 0)), 1);
  return groups.flatMap((group, index): DarkPoolGexCluster[] => {
    const totalNotional = group.reduce((sum, event) => sum + event.notional, 0);
    if (group.length < settings.minimumClusterPrints || totalNotional < settings.minimumClusterNotional) return [];
    return [{
      id: `dark-pool-gex-cluster:${index}:${group.map((event) => event.id).join("|")}`,
      events: group,
      weightedPrice: group.reduce((sum, event) => sum + event.price * event.notional, 0) / totalNotional,
      totalNotional,
      totalShares: group.reduce((sum, event) => sum + event.shares, 0),
      firstTimestampMs: Math.min(...group.map((event) => event.timestampMs)),
      lastTimestampMs: Math.max(...group.map((event) => event.timestampMs)),
      visualStrength: Math.sqrt(clamp01(totalNotional / maximumNotional)),
      primaryConfluence: [...group].sort((a, b) => b.combinedImportance - a.combinedImportance)[0]?.primaryConfluence ?? null,
    }];
  });
}

export function buildDarkPoolGexFrame(input: {
  darkPool: DarkPoolMapPayload;
  gex: BounceLevelsSnapshot | null;
  settings?: Partial<DarkPoolGexSettings>;
  asOfMs?: number;
  tickSize?: number;
}) {
  const settings = { ...DEFAULT_DARK_POOL_GEX_SETTINGS, ...(input.settings ?? {}) };
  const nowMs = input.asOfMs ?? Date.now();
  const tickSize = Math.max(1e-9, input.tickSize ?? 0.01);
  const lookbackStart = nowMs - Math.max(1, settings.lookbackDays) * 86_400_000;
  const eligible = input.darkPool.prints
    .filter((print) => print.tradeTimeMs <= nowMs && print.tradeTimeMs >= lookbackStart)
    .filter((print) => print.notionalValue >= settings.minimumNotional)
    .filter((print) => !settings.maximumNotional || print.notionalValue <= settings.maximumNotional)
    .filter((print) => print.size >= settings.minimumShares)
    .filter((print) => !settings.maximumShares || print.size <= settings.maximumShares)
    .filter((print) => print.price >= settings.minimumSharePrice)
    .filter((print) => !settings.maximumSharePrice || print.price <= settings.maximumSharePrice);
  const maximumNotional = Math.max(...eligible.map((print) => print.notionalValue), 1);
  const events = eligible.map((print): DarkPoolGexEvent => {
    const current = input.gex ? makeConfluence(print.mappedPrice, input.gex.levels, tickSize, settings) : null;
    const eventSlice = input.gex ? latestSliceAt(input.gex.exposureField, print.tradeTimeMs) : null;
    const eventTime = eventSlice ? makeConfluence(print.mappedPrice, eventSlice.nodes, tickSize, settings) : null;
    const primary = settings.contextMode === "event-time" ? eventTime : current;
    const rawStrength = clamp01(print.notionalValue / maximumNotional);
    const visualStrength = Math.sqrt(rawStrength);
    const combinedImportance = clamp01(0.65 * visualStrength + 0.35 * (primary?.confluence ?? 0));
    const ageDays = Math.max(0, nowMs - print.tradeTimeMs) / 86_400_000;
    return {
      id: `dark-pool-gex:${print.id}`,
      print,
      price: print.mappedPrice,
      sourcePrice: print.price,
      notional: print.notionalValue,
      shares: print.size,
      timestampMs: print.tradeTimeMs,
      direction: "UNKNOWN",
      classification: "OFF_EXCHANGE",
      quality: print.isDelayedPrint ? "delayed" : nowMs - print.tradeTimeMs <= 15 * 60_000 ? "live" : "historical",
      rawStrength,
      visualStrength,
      currentConfluence: current,
      eventTimeConfluence: eventTime,
      primaryConfluence: primary,
      combinedImportance,
      ageDays,
      ageFade: settings.ageFade ? Math.exp(-ageDays / Math.max(0.25, settings.ageFadeHalfLifeDays)) : 1,
    };
  });
  const topEvents = [...events].sort((a, b) => b.notional - a.notional).slice(0, Math.max(1, settings.topN));
  const clusters = buildClusters(events, tickSize, settings);
  const proxy = !input.darkPool.direct;
  const status: DarkPoolGexFrame["status"] = !events.length
    ? "NO_OFF_EXCHANGE_DATA"
    : proxy
      ? "PROXY_MODE"
      : !input.gex
        ? "NO_GEX_DATA"
        : input.darkPool.status === "LIVE"
          ? "LIVE"
          : input.darkPool.status === "DELAYED" || input.darkPool.status === "CACHED"
            ? "DELAYED"
            : input.darkPool.status === "UNAVAILABLE" || input.darkPool.status === "RATE_LIMITED"
              ? "STALE"
              : "HISTORICAL";
  return {
    schemaVersion: DARK_POOL_GEX_SCHEMA_VERSION,
    sourceTicker: input.darkPool.sourceTicker,
    displayInstrument: input.darkPool.displayInstrument,
    generatedAtMs: nowMs,
    status,
    rawEvents: topEvents,
    eligibleEventCount: events.length,
    clusters,
    gexSnapshotTimeMs: input.gex?.snapshotTimeMs ?? null,
    limitations: [
      "Dark-pool transactions are directionless unless a validated provider side field exists; this indicator always reports Direction: Unknown.",
      "Gamma sign is separate options-positioning context and never assigns a buy or sell side to a dark-pool print.",
      ...input.darkPool.limitations,
    ],
  } satisfies DarkPoolGexFrame;
}

export function isDarkPoolGexFrame(value: unknown): value is DarkPoolGexFrame {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const frame = value as Partial<DarkPoolGexFrame>;
  return frame.schemaVersion === 1 && Array.isArray(frame.rawEvents) && Array.isArray(frame.clusters);
}
