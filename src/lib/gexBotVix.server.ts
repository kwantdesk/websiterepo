import "server-only";
import { fetchGexBotResearch, hasGexBotGatewayAccess } from "@/lib/gexBotGateway.server";

type GexBotVixResponse = {
  timestamp?: unknown;
  ticker?: unknown;
  spot?: unknown;
};

export type GexBotVixSpot = {
  price: number;
  timestamp: number;
  stale: boolean;
};

const LIVE_CACHE_MS = 2_000;
const STALE_IF_ERROR_MS = 2 * 60_000;

let lastGood: { value: GexBotVixSpot; receivedAt: number } | null = null;
let inFlight: Promise<GexBotVixSpot> | null = null;

export function hasGexBotVixAccess() {
  return hasGexBotGatewayAccess();
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimestamp(value: unknown) {
  const parsed = finiteNumber(value);
  if (parsed === null || parsed <= 0) return Date.now();
  return parsed < 10_000_000_000 ? parsed * 1_000 : parsed;
}

async function requestGexBotVix(): Promise<GexBotVixSpot> {
  const response = await fetchGexBotResearch({ ticker: "VIX", package: "classic", category: "gex_full" });
  const payload = await response.json().catch(() => ({})) as GexBotVixResponse & {
    detail?: unknown;
    error?: unknown;
    message?: unknown;
  };
  if (!response.ok) {
    const message = payload.detail ?? payload.error ?? payload.message;
    throw new Error(
      typeof message === "string" && message.trim()
        ? message
        : `GEXBot VIX request failed (${response.status}).`,
    );
  }

  const price = finiteNumber(payload.spot);
  if (price === null || price <= 0) {
    throw new Error("GEXBot returned a VIX frame without a valid spot value.");
  }
  const timestamp = normalizeTimestamp(payload.timestamp);
  return {
    price,
    timestamp,
    stale: Date.now() - timestamp > 2 * 60_000,
  };
}

export async function fetchGexBotVixSpot(): Promise<GexBotVixSpot> {
  const now = Date.now();
  if (lastGood && now - lastGood.receivedAt <= LIVE_CACHE_MS) return lastGood.value;
  if (inFlight) return inFlight;

  inFlight = requestGexBotVix()
    .then((value) => {
      lastGood = { value, receivedAt: Date.now() };
      return value;
    })
    .catch((error) => {
      if (lastGood && now - lastGood.receivedAt <= STALE_IF_ERROR_MS) {
        return { ...lastGood.value, stale: true };
      }
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
