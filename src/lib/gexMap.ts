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

