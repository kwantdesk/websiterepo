import type { AuctionGapZone } from "./auctionGapLifecycle.ts";

export type AuctionGapAlertState = {
  scope: string | null;
  hydrated: boolean;
  seen: Set<string>;
  latestSourceTimestampMs: number;
};

export type AuctionGapAlertEvent = {
  id: string;
  side: "buy" | "sell";
  sourceTimestampMs: number;
  lowTick: number;
  highTick: number;
};

export function createAuctionGapAlertState(): AuctionGapAlertState {
  return { scope: null, hydrated: false, seen: new Set(), latestSourceTimestampMs: -Infinity };
}

/**
 * Alerts only for a newly observed zone at the live edge of an already
 * hydrated calculation. Historical load, replay, reconnect, closed-market
 * corrections and settings/scope changes become the new baseline silently.
 */
export function collectAuctionGapAlerts(
  state: AuctionGapAlertState,
  input: {
    scope: string;
    zones: readonly AuctionGapZone[];
    sourceTimestampForIndex: (index: number) => number | null;
    live: boolean;
    continuous: boolean;
    enabled: boolean;
  },
): AuctionGapAlertEvent[] {
  const candidates = input.zones.flatMap((zone): AuctionGapAlertEvent[] => {
    const timestamp = input.sourceTimestampForIndex(zone.sourceIndex);
    if (!Number.isFinite(timestamp)) return [];
    return [{
      id: zone.id,
      side: zone.side,
      sourceTimestampMs: Number(timestamp),
      lowTick: zone.lowTick,
      highTick: zone.highTick,
    }];
  });
  const newest = candidates.reduce(
    (value, candidate) => Math.max(value, candidate.sourceTimestampMs),
    state.latestSourceTimestampMs,
  );

  if (state.scope !== input.scope || !state.hydrated) {
    state.scope = input.scope;
    state.hydrated = true;
    state.seen = new Set(candidates.map((candidate) => candidate.id));
    state.latestSourceTimestampMs = newest;
    return [];
  }

  const priorWatermark = state.latestSourceTimestampMs;
  const alerts: AuctionGapAlertEvent[] = [];
  for (const candidate of candidates) {
    if (state.seen.has(candidate.id)) continue;
    state.seen.add(candidate.id);
    if (
      input.enabled
      && input.live
      && input.continuous
      && candidate.sourceTimestampMs >= priorWatermark
    ) alerts.push(candidate);
  }
  state.latestSourceTimestampMs = newest;
  return alerts;
}
