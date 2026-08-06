import "server-only";

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

const GEXBOT_VIX_URL = "https://api.gex.bot/v2/VIX/classic/gex_full";
const LIVE_CACHE_MS = 2_000;
const STALE_IF_ERROR_MS = 2 * 60_000;

let lastGood: { value: GexBotVixSpot; receivedAt: number } | null = null;
let inFlight: Promise<GexBotVixSpot> | null = null;

function configuredApiKey() {
  return process.env.GEXBOT_API_KEY?.trim() ?? "";
}

export function hasGexBotVixAccess() {
  return Boolean(configuredApiKey());
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
  const apiKey = configuredApiKey();
  if (!apiKey) throw new Error("GEXBot VIX is not configured.");

  const response = await fetch(GEXBOT_VIX_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "KwantDesk/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
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
