import { detectAuctionGaps, normalizeAuctionGapDetection } from "./auctionGapTracker.ts";
import { advanceAuctionGapActive, type AuctionGapActiveZone, type AuctionGapLifecycleSettings,
  type AuctionGapSourceBar, type AuctionGapZone } from "./auctionGapLifecycle.ts";

type Source = Parameters<typeof detectAuctionGaps>[1];
type Status = "ready" | "invalid-data" | "requires-raw-volume" | "requires-rebuild" | "capacity-limit";
type Checkpoint = {
  allLength: number;
  count: number;
  priorTime: number;
  instrument: string | null;
  active: { item: AuctionGapActiveZone; before: AuctionGapZone }[];
  ids: string[];
};

/** Incremental zone lifecycle only, not a source/coverage validator.
 * Supply every reset segment of the current chart bar on each replacement.
 * Older corrections/replay/settings changes need a fresh instance + history.
 * Retains no historical price rows. Tail work touches current rows and active
 * zones only; snapshot materialization is intentionally separate from updates.
 */
export class AuctionGapLiveLifecycle {
  private readonly source: Source;
  private readonly detection: ReturnType<typeof normalizeAuctionGapDetection>;
  private readonly settings: AuctionGapLifecycleSettings;
  private readonly limit: number;
  private all: AuctionGapZone[] = [];
  private active: AuctionGapActiveZone[] = [];
  private ids = new Set<string>();
  private count = 0;
  private priorTime = -Infinity;
  private instrument: string | null = null;
  private lastIndex = -1;
  private checkpoint: Checkpoint | null = null;

  constructor(source: Source, detection: Record<string, unknown>, settings: AuctionGapLifecycleSettings,
    limit = 250_000) {
    if (!Number.isInteger(settings.extendedBars) || settings.extendedBars < 0 || settings.extendedBars > 10000
      || !["touch", "cross"].includes(settings.retestMode) || !Number.isSafeInteger(limit) || limit < 1) {
      throw new Error("Invalid Auction Gap lifecycle configuration");
    }
    this.source = { ...source };
    this.detection = normalizeAuctionGapDetection(detection);
    this.settings = { ...settings };
    this.limit = limit;
  }

  updateTail(segments: readonly AuctionGapSourceBar[]): Status {
    const index = segments[0]?.chartIndex;
    if (!Number.isSafeInteger(index) || index === undefined || index < 0 || !segments.length) return "invalid-data";
    if (index < this.lastIndex) return "requires-rebuild";
    // A dropped/coalesced update must not skip an intervening bar's retests.
    if (this.lastIndex >= 0 && index > this.lastIndex + 1) return "requires-rebuild";
    const replacing = index === this.lastIndex;
    const base = replacing ? this.checkpoint : null;
    const replacedIds = new Set(base?.ids);
    let priorTime = base?.priorTime ?? this.priorTime;
    let instrument = base ? base.instrument : this.instrument;
    const batchIds = new Set<string>();
    const prepared = [];
    // Validate the entire replacement before rolling back the displayed tail.
    for (const segment of segments) {
      const { bar, detectionBar } = segment;
      if (segment.chartIndex !== index || bar.startTime < priorTime
        || (instrument !== null && instrument !== bar.instrument)
        || batchIds.has(bar.id) || (this.ids.has(bar.id) && !replacedIds.has(bar.id))) return "invalid-data";
      const raw = detectAuctionGaps(bar, this.source, this.detection);
      if (raw.status !== "ready") return raw.status;
      const filtered = detectionBar ? detectAuctionGaps(detectionBar, this.source, this.detection) : raw;
      if (filtered.status !== "ready") return filtered.status;
      prepared.push({ segment, gaps: segment.detect ? filtered.gaps : [] });
      batchIds.add(bar.id); priorTime = bar.startTime; instrument = bar.instrument;
    }
    const baseCount = base?.count ?? this.count, baseLength = base?.allLength ?? this.all.length;
    if (baseCount + segments.length > this.limit
      || baseLength + prepared.reduce((sum, entry) => sum + entry.gaps.length, 0) > this.limit) return "capacity-limit";
    if (base) {
      this.all.length = base.allLength;
      this.active = base.active.map(({ item, before }) => {
        Object.assign(item.zone, before);
        return item;
      });
      for (const id of base.ids) this.ids.delete(id);
      this.count = base.count;
      base.ids = [];
    } else {
      this.checkpoint = {
        allLength: this.all.length, count: this.count, priorTime: this.priorTime, instrument: this.instrument,
        active: this.active.map(item => ({ item, before: { ...item.zone } })), ids: [],
      };
    }
    for (const { segment, gaps } of prepared) {
      advanceAuctionGapActive(this.active, segment.bar, index, segment.resetKey, this.settings);
      for (const gap of gaps) {
        const zone: AuctionGapZone = { ...gap, sourceIndex: index, endIndex: index, state: "fresh",
          triggeredAtBarId: null, triggeredAtIndex: null, stoppedBy: null };
        this.all.push(zone);
        this.active.push({ zone, resetKey: segment.resetKey, expires: index + this.settings.extendedBars });
      }
      this.ids.add(segment.bar.id); this.checkpoint!.ids.push(segment.bar.id); this.count++;
    }
    this.lastIndex = index; this.priorTime = priorTime; this.instrument = instrument;
    return "ready";
  }

  /** Copy once per requested render/history response, not per execution. */
  snapshot(): AuctionGapZone[] {
    return this.all.filter(zone => zone.state === "triggered" ? this.settings.showTriggered : !this.settings.onlyTriggered)
      .map(zone => ({ ...zone }));
  }

  get retainedCounts() { return { segments: this.count, zones: this.all.length, activeZones: this.active.length }; }
}
