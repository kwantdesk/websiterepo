import type { ChartGammaSourceLevel } from "@/lib/chartGammaLevels";

export type NativeGammaState = "LIVE" | "STALE" | "MARKET_CLOSED";

export type NativeGammaPayload = {
  schemaVersion?: "kwantdesk-native-gamma-v1";
  root?: "NQ";
  underlyingContract?: string;
  spot?: number;
  generatedAt: string | null;
  oiAsOf: string | null;
  spotAge: number | null;
  stale: boolean;
  state: NativeGammaState;
  oiStale: boolean;
  heartbeat: string;
  matchingBand?: number;
  expiryScope?: string;
  dominantExpiry?: string | null;
  regime?: "POSITIVE" | "NEGATIVE";
  cumulativeAtSpot?: number;
  gammaFlip?: number | null;
  gammaFlipCrossings?: number[];
  gammaFlipNote?: string;
  signConvention?: "ASSUMED_DEALER_CONVENTION";
  signConventionDetail?: string;
  levels: ChartGammaSourceLevel[];
  mapAvailable?: boolean;
  dailyJobError?: string | null;
  gatewayError?: string;
};

export function nativeGammaStatusLabel(payload: NativeGammaPayload) {
  const oi = payload.oiAsOf
    ? payload.oiStale ? `OI: ${payload.oiAsOf} (stale)` : "OI prior settle"
    : "OI unavailable";
  if (payload.state === "MARKET_CLOSED") return `MARKET CLOSED · ${oi}`;
  if (payload.state === "STALE") {
    const age = payload.spotAge == null ? "unknown" : `${Math.round(payload.spotAge)}s`;
    return `NATIVE STALE ${age} · ${oi}`;
  }
  return `NATIVE LIVE · ${oi}`;
}

export function shouldNativeOutrankConverted(payload: NativeGammaPayload) {
  return payload.state !== "STALE" && payload.stale !== true && payload.levels.length > 0;
}
