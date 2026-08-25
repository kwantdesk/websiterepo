import type { ExposureStrike, GreekMode, OptionsCandle } from "@/lib/optionsFlow";

export const GEX_MAP_GREEKS: ReadonlyArray<{
  mode: GreekMode;
  short: string;
  label: string;
}> = [
  { mode: "GAMMA", short: "GEX", label: "Gamma exposure" },
  { mode: "DELTA", short: "DEX", label: "Delta exposure" },
  { mode: "VANNA", short: "VEX", label: "Vanna exposure" },
  { mode: "CHARM", short: "CHARM", label: "Charm exposure" },
];

export type GexMapFrame = {
  timestamp: number;
  updates: ExposureStrike[];
};

export type GexMapExpiryScope = "ALL_EXPIRIES" | "FRONT_EXPIRY";

export type GexMapRepresentation = "PER_ONE_DOLLAR_MOVE" | "PER_ONE_PERCENT_MOVE";

/** The comparable dealer ladder is the nearest listed expiry (0DTE during a
 * normal index session). Keep the complete chain available as an explicit
 * diagnostic instead of silently mixing expiries into the default surface. */
export const DEFAULT_GEX_MAP_EXPIRY_SCOPE: GexMapExpiryScope = "FRONT_EXPIRY";

/** Skylit-style strike ladders display exposure per $1 underlying move. Keep
 * the native 1% convention available as an explicit diagnostic instead of
 * silently mixing two differently scaled surfaces. */
export const DEFAULT_GEX_MAP_REPRESENTATION: GexMapRepresentation = "PER_ONE_DOLLAR_MOVE";

export type GexMapPanelPayload = {
  symbol: string;
  greekMode: GreekMode;
  sessionDate: string;
  expiration: string | null;
  expirations: string[];
  scope: GexMapExpiryScope;
  model: "STRUCTURAL_OI";
  representation: GexMapRepresentation;
  source: "KwantData Interval Map";
  sourceTimeZone: "America/New_York";
  asOf: string;
  status: "LIVE" | "LAST_SESSION" | "DELAYED";
  refreshAfterMs: number;
  stockPrice: number | null;
  sessionChangePercent: number | null;
  latestStrikes: ExposureStrike[];
  frames: GexMapFrame[];
  candles: OptionsCandle[];
  netExposure: number;
  grossExposure: number;
  rateLimitRemaining: number | null;
};

export const GEX_MAP_LIVE_LOOKBACK_MINUTES = [10, 5, 2, 1] as const;

/**
 * Keep the live map cheap without weakening replay.
 *
 * A full interval-map response grows by one set of strike updates every
 * minute. Sending that whole session for every panel every five seconds made
 * the browser retain the old surfaces while parsing the replacements, which
 * produced a large recurring heap spike beside a multi-pane chart workspace.
 *
 * Live mode only needs the current ladder and the state at the four selectable
 * comparison windows. Reconstruct those states once on the server and emit
 * them as complete frames. The existing client snapshot logic can consume
 * this payload unchanged, while historical replay continues to request the
 * unmodified full frame history.
 */
export function compactLiveGexMapPanel(
  payload: GexMapPanelPayload,
  lookbackMinutes: readonly number[] = GEX_MAP_LIVE_LOOKBACK_MINUTES,
): GexMapPanelPayload {
  if (!payload.frames.length) {
    return { ...payload, candles: payload.candles.slice(-2) };
  }

  const lastTimestamp = payload.frames[payload.frames.length - 1].timestamp;
  const targets = [...new Set(lookbackMinutes
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
    .map((minutes) => lastTimestamp - minutes * 60_000))]
    .sort((left, right) => left - right);
  const surface = new Map<number, ExposureStrike>();
  const frames: GexMapFrame[] = [];
  let targetIndex = 0;

  const capture = (timestamp: number) => {
    if (!surface.size) return;
    frames.push({
      timestamp,
      updates: [...surface.values()].map((row) => ({ ...row })),
    });
  };

  for (const frame of payload.frames) {
    while (targetIndex < targets.length && targets[targetIndex] < frame.timestamp) {
      capture(targets[targetIndex]);
      targetIndex += 1;
    }
    for (const update of frame.updates) surface.set(update.strike, update);
    while (targetIndex < targets.length && targets[targetIndex] === frame.timestamp) {
      capture(targets[targetIndex]);
      targetIndex += 1;
    }
  }
  while (targetIndex < targets.length) {
    capture(targets[targetIndex]);
    targetIndex += 1;
  }

  // Preserve the real newest frame timestamp: the live comparison window is
  // anchored to it after the cash close rather than to a drifting `asOf`.
  capture(lastTimestamp);

  return {
    ...payload,
    frames,
    candles: payload.candles.slice(-2),
  };
}

/**
 * QuantData exposes the S&P index option chain and its cash history beneath
 * the SPX underlying. SPXW is the weekly option class, not a separately
 * quoted cash underlying, so requesting SPXW directly returns a successful
 * but empty payload. Keep SPXW as the product-facing symbol while reading the
 * front-expiry surface from SPX (which is the weekly/0DTE surface in this
 * workspace).
 */
export function gexMapProviderTicker(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return normalized === "SPXW" ? "SPX" : normalized;
}

/**
 * Reconstruct the most recent complete strike surface from interval updates.
 * KwantData can clear the expired front-expiry node in exposure-by-strike
 * shortly after the cash close while retaining the session's interval map.
 * Those interval buckets are incremental, so the final frame alone is not a
 * complete ladder; replay every update in order to recover the frozen close.
 */
export function latestGexMapStrikesFromFrames(frames: GexMapFrame[]): ExposureStrike[] {
  const strikes = new Map<number, ExposureStrike>();
  for (const frame of frames) {
    for (const row of frame.updates) strikes.set(row.strike, { ...row });
  }
  return [...strikes.values()].sort((left, right) => left.strike - right.strike);
}

/**
 * Select the dominant signed-exposure strike from the complete surface.
 *
 * This deliberately uses the unrounded raw net value. It must stay independent
 * from the live/centre price, heat intensity, interval change and viewport.
 */
export function selectGexMapStarNode(rows: readonly ExposureStrike[]): ExposureStrike | null {
  let starNode: ExposureStrike | null = null;
  let starMagnitude = -1;

  for (const row of rows) {
    if (!Number.isFinite(row.net)) continue;
    const magnitude = Math.abs(row.net);
    if (magnitude > starMagnitude) {
      starNode = row;
      starMagnitude = magnitude;
    }
  }

  return starNode;
}

/** A panel is safe to paint only when it contains a recoverable strike ladder. */
export function hasRenderableGexMapSurface(
  payload: Pick<GexMapPanelPayload, "latestStrikes" | "frames"> | null | undefined,
) {
  if (!payload) return false;
  return payload.latestStrikes.length > 0 || latestGexMapStrikesFromFrames(payload.frames).length > 0;
}
