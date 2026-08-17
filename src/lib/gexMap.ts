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

export type GexMapPanelPayload = {
  symbol: string;
  greekMode: GreekMode;
  sessionDate: string;
  expiration: string;
  scope: "FRONT_EXPIRY";
  representation: "PER_ONE_PERCENT_MOVE";
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
