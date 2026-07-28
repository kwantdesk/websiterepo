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
  source: "QuantData Interval Map";
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


