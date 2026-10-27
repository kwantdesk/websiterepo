import type { Candle } from "@/lib/backtester";
import type { BigBlockRenderZone } from "@/lib/bigBlocksPrimitive";
import { mergeLiveIndicatorCandle } from "@/lib/chartLiveEvents";

export type LiveBigBlockZone = { sourceTimestamp: number; endSourceTimestamp?: number; zone: BigBlockRenderZone };

/** Per-chart/per-calculation-session authority, not an extra data feed.
 * Forming decisions REPLACE one another (including a no-signal decision).
 * Crossing into the next bar freezes the previous decision, including absence.
 * Sampled/history recalculations cannot subsequently invent a late live signal.
 */
export class BigBlocksLiveState {
  private source: Candle[] = [];
  private latestLiveTimestamp: number | null = null;
  private forming: LiveBigBlockZone[] = [];
  private readonly confirmed = new Map<string, LiveBigBlockZone>();
  private readonly observed = new Set<number>();
  private discardedThrough = -Infinity;

  readonly identity: string;

  constructor(identity: string) { this.identity = identity; }

  synchronizeSnapshot(snapshot: Candle[], zones?: LiveBigBlockZone[], minimumBars = 20, sealClosed = true) {
    // Preserve direct observations newer than a sampled React tail. Never
    // replace the live close/flow with an older snapshot of the same candle.
    const snapshotTail = snapshot.at(-1)?.timestamp ?? -Infinity;
    const directTail = this.latestLiveTimestamp === null ? []
      : this.source.filter(candle => candle.timestamp >= snapshotTail);
    let merged = snapshot.slice(-240);
    for (const candle of directTail) merged = mergeLiveIndicatorCandle(merged, candle);
    this.source = merged.slice(-240);
    if (zones && sealClosed) {
      // Snapshot-origin blocks need the same finality as directly observed
      // blocks. A missing/reclassified full-pass result must not erase a
      // closed marker that was already published ten bars earlier.
      const bySource = new Map<number, LiveBigBlockZone[]>();
      for (const item of zones) {
        const items = bySource.get(item.sourceTimestamp) ?? [];
        items.push(item); bySource.set(item.sourceTimestamp, items);
      }
      const warmup = Number.isFinite(minimumBars) ? Math.max(12, Math.min(200, Math.round(minimumBars))) : 20;
      for (let index = warmup - 1; index < snapshot.length - 1; index++) {
        const candle = snapshot[index];
        const classified = Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0);
        if (this.observed.has(candle.timestamp) || candle.timestamp <= this.discardedThrough
          || !Number.isFinite(classified) || classified <= 0) continue;
        this.observed.add(candle.timestamp);
        for (const item of bySource.get(candle.timestamp) ?? []) {
          this.confirmed.set(item.zone.id, { ...item, zone: { ...item.zone } });
        }
      }
      this.updateConfirmedProjection(zones);
      this.boundDecisions();
    }
  }

  sourceFor(candle: Candle): Candle[] | null {
    if (!Number.isFinite(candle.timestamp)
      || (this.source.length && candle.timestamp < this.source.at(-1)!.timestamp)) return null;
    this.source = mergeLiveIndicatorCandle(this.source, candle).slice(-240);
    return this.source;
  }

  update(timestamp: number, candidates: LiveBigBlockZone[], hasInputs = true) {
    if (!Number.isFinite(timestamp)
      || (this.latestLiveTimestamp !== null && timestamp < this.latestLiveTimestamp)) return;
    if (this.latestLiveTimestamp !== null && timestamp > this.latestLiveTimestamp) {
      for (const item of this.forming) this.confirmed.set(item.zone.id, item);
    }
    this.latestLiveTimestamp = timestamp;
    if (hasInputs) {
      this.observed.add(timestamp);
    }
    // Bound negative decisions as well as positive ones. Older discarded live
    // decisions stay excluded; genuine unobserved gaps in the retained window
    // can still receive ordinary historical backfill after a reconnect.
    // A faded condition or a direction reversal removes/replaces the preview,
    // rather than retaining every side that ever qualified during this bar.
    this.forming = (hasInputs ? candidates : []).filter(item => item.sourceTimestamp === timestamp)
      .map(item => ({ ...item, zone: { ...item.zone } }));
    // Existing projection expiry/close-cross still works. Only its right edge
    // can change after confirmation; origin, side and price bounds are frozen.
    this.updateConfirmedProjection(candidates);
    this.boundDecisions();
  }

  private updateConfirmedProjection(candidates: LiveBigBlockZone[]) {
    for (const item of candidates) {
      const fixed = this.confirmed.get(item.zone.id);
      if (fixed) this.confirmed.set(item.zone.id, {
        ...fixed,
        endSourceTimestamp: item.endSourceTimestamp,
        zone: { ...fixed.zone, endTime: item.zone.endTime, extensionBars: item.zone.extensionBars },
      });
    }
  }

  private boundDecisions() {
    if (this.observed.size > 4096) {
      const oldest = [...this.observed].sort((a, b) => a - b).slice(0, this.observed.size - 4096);
      for (const timestamp of oldest) this.observed.delete(timestamp);
      this.discardedThrough = Math.max(this.discardedThrough, oldest.at(-1)!);
    }
    if (this.confirmed.size > 120) {
      const oldest = [...this.confirmed.values()].sort((a, b) => a.sourceTimestamp - b.sourceTimestamp).slice(0, this.confirmed.size - 120);
      for (const item of oldest) this.confirmed.delete(item.zone.id);
    }
  }

  display(snapshot: LiveBigBlockZone[], chartTimes?: ReadonlyMap<number, number>): BigBlockRenderZone[] {
    const historical = snapshot.filter(item =>
      !this.observed.has(item.sourceTimestamp) && item.sourceTimestamp > this.discardedThrough);
    const zones = new Map(historical.map(item => [item.zone.id, item]));
    for (const item of this.confirmed.values()) zones.set(item.zone.id, item);
    for (const item of this.forming) zones.set(item.zone.id, item);
    return [...zones.values()].sort((a, b) => a.sourceTimestamp - b.sourceTimestamp)
      .slice(-120).map(item => chartTimes ? {
        ...item.zone,
        // Event/volume charts can reassign synthetic axis times after history
        // hydration. Freeze the source BAR, not its temporary axis coordinate.
        startTime: (chartTimes.get(item.sourceTimestamp) ?? item.zone.startTime) as BigBlockRenderZone["startTime"],
        endTime: ((item.endSourceTimestamp == null ? undefined : chartTimes.get(item.endSourceTimestamp)) ?? item.zone.endTime) as BigBlockRenderZone["endTime"],
      } : item.zone);
  }
}
