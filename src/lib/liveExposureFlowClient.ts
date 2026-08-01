"use client";

import type { GreekMode, OptionsPositioningPulsePayload } from "@/lib/optionsFlow";

type StrikeRange = { min: number; max: number } | null;
type PositioningRequest = {
  symbol: string;
  mode: GreekMode;
  expiration: string;
  strikeRange?: StrikeRange;
};

const POSITIONING_UPDATE_EVENT = "kwantdesk:positioning-pulse";
const pulseCache = new Map<string, OptionsPositioningPulsePayload>();
const requests = new Map<string, Promise<OptionsPositioningPulsePayload>>();

function requestKey({ symbol, mode, expiration, strikeRange = null }: PositioningRequest) {
  return [
    symbol.toUpperCase(),
    mode,
    expiration,
    strikeRange ? `${strikeRange.min}:${strikeRange.max}` : "FULL",
  ].join("::");
}

export function readPositioningPulse(request: PositioningRequest) {
  return pulseCache.get(requestKey(request)) ?? null;
}

export function subscribePositioningPulse(
  request: PositioningRequest,
  listener: (payload: OptionsPositioningPulsePayload) => void,
) {
  if (typeof window === "undefined") return () => undefined;
  const key = requestKey(request);
  const receive = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string; payload: OptionsPositioningPulsePayload }>).detail;
    if (detail?.key === key) listener(detail.payload);
  };
  window.addEventListener(POSITIONING_UPDATE_EVENT, receive);
  return () => window.removeEventListener(POSITIONING_UPDATE_EVENT, receive);
}

export function fetchPositioningPulse(request: PositioningRequest) {
  const key = requestKey(request);
  const pending = requests.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({
    symbol: request.symbol,
    mode: request.mode,
    expiration: request.expiration,
  });
  if (request.strikeRange) {
    params.set("minStrike", String(request.strikeRange.min));
    params.set("maxStrike", String(request.strikeRange.max));
  }

  const promise = fetch(`/api/options-flow/positioning?${params}`, { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json() as OptionsPositioningPulsePayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Live exposure flow is unavailable.");
      pulseCache.set(key, payload);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(POSITIONING_UPDATE_EVENT, {
          detail: { key, payload },
        }));
      }
      return payload;
    })
    .finally(() => requests.delete(key));

  requests.set(key, promise);
  return promise;
}
