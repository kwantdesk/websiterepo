import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import {
  isCandleBackedVolumeProfile,
  isExecutionBackedVolumeProfile,
  type InstitutionalVolumeProfile,
} from "@/lib/institutionalMarketData";
import {
  calculateVolumeProfileStructure,
  calculateVolumeProfileVwap,
  summarizeVolumeProfile,
} from "./volumeProfileStructure";
import {
  calculateVolumeProfileValueArea,
  STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  volumeProfileBinTick,
} from "@/lib/volumeProfileMath";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Chart-width profiles are expressed against a stable logical viewport rather
// than the full Globex session. Treating a 24% KWANT Profile as 24% of all
// 1,380 one-minute bars made it consume the whole pane after a refresh.
/** Smallest height a profile row may occupy before rows are grouped. */
const PROFILE_MIN_ROW_PIXELS = 0.55;

const CHART_PROFILE_REFERENCE_BARS = 80;
const MAX_PROFILE_PANE_FRACTION = 0.36;
/**
 * Profiles shrink with the candles as the chart is zoomed out, but a profile
 * that has shrunk to a few pixels is a coloured smear, not a readable auction.
 * Shrinking stops here, so scrolling out keeps every profile legible instead of
 * dissolving it. The floor never overrides the pane-fraction ceiling, so a
 * narrow pane still bounds the profile rather than being taken over by it.
 */
const PROFILE_MIN_READABLE_WIDTH_PX = 50;

/**
 * How far a profile is allowed to shrink as the chart zooms out, as a fraction
 * of its configured width. At this point the scaling reverses and the profile
 * grows back toward full width the further out the chart goes.
 */
const PROFILE_REBOUND_FLOOR_SCALE = 0.5;

export function zoomScaledVolumeProfileWidth({
  paneWidth,
  visibleLogicalFrom,
  visibleLogicalTo,
  referenceLogicalBars,
  widthPercent,
  maxPaneFraction = MAX_PROFILE_PANE_FRACTION,
}: {
  paneWidth: number;
  visibleLogicalFrom: number;
  visibleLogicalTo: number;
  referenceLogicalBars: number;
  widthPercent: number;
  maxPaneFraction?: number;
}) {
  const visibleLogicalSpan = Math.abs(visibleLogicalTo - visibleLogicalFrom);
  if (
    !Number.isFinite(paneWidth)
    || paneWidth <= 0
    || !Number.isFinite(visibleLogicalSpan)
    || visibleLogicalSpan <= 0
    || !Number.isFinite(referenceLogicalBars)
    || referenceLogicalBars <= 0
    || !Number.isFinite(widthPercent)
  ) return null;
  if (widthPercent <= 0) return 0;

  // A profile's width lives in logical bars, not screen coordinates. The
  // visible-range span is unchanged by horizontal panning, so dragging left
  // or right can only translate the profile. Zooming changes that span and
  // therefore scales the profile in exactly the same direction as candles.
  // Width at the reference zoom, i.e. the profile drawn at 100% of its setting.
  const referenceWidth = paneWidth * widthPercent / 100;
  // How far the current zoom is from that reference. 1 = reference zoom,
  // below 1 = zoomed out, above 1 = zoomed in.
  const naturalScale = referenceLogicalBars / visibleLogicalSpan;
  // Scrolling out shrinks the profile with the candles, but only down to half
  // width. Past that the profile turns around and grows back toward its full
  // width, so a chart zoomed right out still shows a readable auction instead
  // of a sliver. The rebound is gradual — full width is reached once the view
  // spans eight times the reference — so the turn is not a visible jump.
  const effectiveScale = naturalScale >= PROFILE_REBOUND_FLOOR_SCALE
    ? naturalScale
    : clamp(
        PROFILE_REBOUND_FLOOR_SCALE * Math.sqrt(PROFILE_REBOUND_FLOOR_SCALE / naturalScale),
        PROFILE_REBOUND_FLOOR_SCALE,
        1,
      );
  const maxWidth = paneWidth * clamp(maxPaneFraction, 0.05, 0.5);
  return clamp(
    referenceWidth * effectiveScale,
    Math.min(PROFILE_MIN_READABLE_WIDTH_PX, maxWidth),
    maxWidth,
  );
}

export type NativeVolumeProfileStyle = {
  /**
   * What the bars measure. `volume` is the plain traded-volume profile;
   * `delta-volume` adds the signed delta bar beside it; `bid-ask` splits
   * the row into its aggressor sides; `delta` shows signed delta alone;
   * `delta-percentage` scales that delta by the row's own volume, so a
   * thin row that traded one-sided reads as strongly as a heavy one.
   */
  mode: "volume" | "delta-volume" | "bid-ask" | "delta" | "delta-percentage";
  widthBasis: "chart" | "session";
  widthPercent: number;
  opacity: number;
  positiveDeltaColor: string;
  negativeDeltaColor: string;
  outsideValueAreaColor: string;
  valueAreaColor: string;
  /**
   * Active gradient scheme. When set, the whole profile body fades from
   * `from` at its low to `to` at its high and every individual body colour
   * above is ignored, so the profile reads as one graded shape.
   */
  gradient?: { from: string; to: string } | null;
  pocColor: string;
  showValueArea: boolean;
  showDelta: boolean;
  showProfileSpine: boolean;
  showPocLine: boolean;
  showValueAreaLines: boolean;
  showText: boolean;
  showPocHighlight: boolean;
  showProfileOutline: boolean;
  automaticGrouping: boolean;
  autoGroupFactor: number;
  valueAreaPercent: number;
  snapMode: "off" | "left" | "right";
  /** Point of Control line weight. */
  pocLineWidth?: number;
  /** Trace the POC as it migrated through the session. */
  showDevelopingPoc?: boolean;
  /** Ignore developing points before this minute of the session, 0 = none. */
  developingPocStartMs?: number;
  /** Value Area boundary line weight. */
  valueAreaLineWidth?: number;
  /** Peak and Valley tab. Peaks are high-volume nodes, valleys low-volume ones. */
  showPeaks?: boolean;
  showValleys?: boolean;
  peakColor?: string;
  valleyColor?: string;
  peakLineWidth?: number;
  valleyLineWidth?: number;
  pvSensitivity?: number;
  pvExcludeHighLow?: boolean;
  peakMinVolumePercent?: number;
  valleyMaxVolumePercent?: number;
  peakOnlyOutsideValueArea?: boolean;
  valleyOnlyOutsideValueArea?: boolean;
  /** The band bounded by the outermost peaks. */
  showBusinessZone?: boolean;
  businessZoneColor?: string;
  businessZoneOpacity?: number;
  businessZoneLineWidth?: number;
  /** VWAP tab: the profile's own volume-weighted average price. */
  showVwap?: boolean;
  vwapColor?: string;
  vwapLineWidth?: number;
  vwapDash?: number[];
  /** Standard deviations to draw as envelopes around VWAP. */
  vwapBandDeviations?: number[];
  vwapBandColor?: string;
  /**
   * How far a level line runs to the right.
   * `none` carries it to the back of the profile in front (the live edge for
   * the newest profile); `till-interaction` stops it earlier, at the first bar
   * that traded back through it. A level is never drawn past the next profile.
   */
  extendMode?: "none" | "till-interaction";
  /** Dash pattern shared by the level lines, from the Line style dropdown. */
  levelDash?: number[];
  /** Name the POC and value area on the plot, the way IB levels are named. */
  showLevelLabels?: boolean;
  /** Which end of the level line the label sits at. */
  levelLabelSide?: "right" | "left";
  /** Print the level's price beside its name. */
  showLevelLabelPrice?: boolean;
  /** Bars after the profile, used to resolve `till-interaction`. */
  interactionBars?: readonly { time: number; high: number; low: number }[];
  /** Histogram appearance: filled, outlined, or a single edge line. */
  visualStyle?: "automatic" | "solid" | "hollow" | "line" | "combined";
  /** Outline weight when the style draws borders. */
  borderWidth?: number;
  /** Summary tab: totals printed beside the profile. */
  showSummaryVolume?: boolean;
  showSummaryTrades?: boolean;
  summaryTextColor?: string;
  summaryAskColor?: string;
  summaryBidColor?: string;
};

export type NativeVolumeProfileModel = {
  id: string;
  profile: InstitutionalVolumeProfile;
  style: NativeVolumeProfileStyle;
  lastCandleTime: number | null;
  intervalSeconds: number | null;
  maxVolume: number;
  maxAbsDelta: number;
  lowPrice: number;
  highPrice: number;
  drawingBounds?: {
    startTime: number;
    endTime: number;
    firstPrice: number;
    secondPrice: number;
  };
};

type ProfileDerived = {
  levels: InstitutionalVolumeProfile["levels"];
  maxVolume: number;
  maxAbsDelta: number;
  maxSideVolume: number;
  valueArea: ReturnType<typeof calculateVolumeProfileValueArea>;
};

export class NativeVolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private models: NativeVolumeProfileModel[] = [];
  /**
   * Per-profile derived data, keyed by everything that can change it.
   *
   * `draw()` runs on EVERY chart repaint — crosshair moves, live ticks, a
   * sibling indicator updating — and this work does not depend on any of
   * those. Recomputing it per frame meant regrouping every row into a fresh
   * Map, three full scans for the bar scales and a complete value-area
   * expansion, per profile, several times a second. With a daily, a weekly and
   * the split sessions on one chart that is the bulk of the profile's cost.
   */
  private derived = new Map<string, { key: string; value: ProfileDerived }>();
  private paneInsets = { left: 0, right: 0 };
  private readonly paneView = {
    // Volume distributions are chart context, not foreground annotations.
    // Paint them below the candlestick series so candle bodies and wicks stay
    // completely legible even where the developing daily profile overlaps.
    zOrder: () => "bottom" as const,
    renderer: () => ({
      draw: (target: CanvasRenderingTarget2D) => this.draw(target),
    }),
  };

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
  }

  detached() {
    this.attachedParams = null;
  }

  paneViews() {
    return [this.paneView];
  }

  updateAllViews() {
    // Coordinates are intentionally resolved inside draw() so the profile and
    // candles always use the exact same viewport snapshot.
  }

  setModels(models: NativeVolumeProfileModel[]) {
    // A refreshed profile can briefly arrive alongside the previous snapshot.
    // Keep one canvas model per session so a docked profile can never leave a
    // second, session-anchored copy behind it.
    this.models = [...models.filter((model) => isExecutionBackedVolumeProfile(model.profile) || isCandleBackedVolumeProfile(model.profile)).reduce((unique, model) => {
      unique.set(model.id, model);
      return unique;
    }, new Map<string, NativeVolumeProfileModel>()).values()];
    // Drop derived data for profiles that are no longer drawn. Switching
    // instrument or scrolling through trading dates would otherwise retain a
    // grouped copy of every profile the pane had ever shown.
    if (this.derived.size) {
      const live = new Set(this.models.map((model) => model.id));
      for (const id of this.derived.keys()) if (!live.has(id)) this.derived.delete(id);
    }
    this.attachedParams?.requestUpdate();
  }

  setPaneInsets(insets: { left?: number; right?: number }) {
    const next = {
      left: Math.max(0, Number.isFinite(insets.left) ? Number(insets.left) : 0),
      right: Math.max(0, Number.isFinite(insets.right) ? Number(insets.right) : 0),
    };
    if (next.left === this.paneInsets.left && next.right === this.paneInsets.right) return;
    this.paneInsets = next;
    this.attachedParams?.requestUpdate();
  }

  private timeToCoordinate(model: NativeVolumeProfileModel, timestamp: number) {
    const timeScale = this.attachedParams?.chart.timeScale();
    if (!timeScale) return null;
    const direct = timeScale.timeToCoordinate(timestamp as Time);
    if (direct != null) return direct;
    if (
      model.lastCandleTime == null
      || model.intervalSeconds == null
      || model.intervalSeconds <= 0
    ) return null;
    const lastCoordinate = timeScale.timeToCoordinate(model.lastCandleTime as Time);
    if (lastCoordinate == null) return null;
    const lastLogical = timeScale.coordinateToLogical(lastCoordinate);
    if (lastLogical == null) return null;
    const projectedLogical = Number(lastLogical)
      + (timestamp - model.lastCandleTime) / model.intervalSeconds;
    return timeScale.logicalToCoordinate(projectedLogical as Logical);
  }

  private draw(target: CanvasRenderingTarget2D) {
    const params = this.attachedParams;
    if (!params || !this.models.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const leftEdge = clamp(this.paneInsets.left, 0, Math.max(0, mediaSize.width - 4));
      const rightEdge = clamp(
        mediaSize.width - this.paneInsets.right,
        leftEdge + 4,
        mediaSize.width,
      );
      const usablePaneWidth = Math.max(4, rightEdge - leftEdge);
      const addBar = (
        path: Path2D,
        x: number,
        y: number,
        width: number,
        height: number,
        side: "left" | "right" | "both",
      ) => {
        const radius = Math.min(2.25, height / 2, width / 2);
        if (radius < 0.55) {
          path.rect(x, y, width, height);
          return;
        }
        path.roundRect(
          x,
          y,
          width,
          height,
          side === "left"
            ? [radius, 0, 0, radius]
            : side === "right"
              ? [0, radius, radius, 0]
              : radius,
        );
      };
      // Visual Appearance. Solid fills the row, Hollow outlines it, Line draws
      // the profile's edge only, and Combined does both — the same four ways
      // DeepChart can render a histogram.
      const fillPath = (
        path: Path2D,
        color: string | CanvasGradient,
        opacity: number,
        visual: "automatic" | "solid" | "hollow" | "line" | "combined" = "automatic",
        borderWidth = 1,
      ) => {
        context.globalAlpha = opacity;
        if (visual === "hollow" || visual === "line") {
          context.strokeStyle = color;
          context.lineWidth = visual === "line" ? Math.max(0.5, borderWidth * 0.6) : Math.max(0.5, borderWidth);
          context.setLineDash([]);
          context.stroke(path);
          return;
        }
        context.fillStyle = color;
        context.fill(path);
        if (visual === "combined") {
          context.globalAlpha = Math.min(1, opacity + 0.2);
          context.strokeStyle = color;
          context.lineWidth = Math.max(0.5, borderWidth);
          context.setLineDash([]);
          context.stroke(path);
        }
      };
      context.save();
      context.beginPath();
      // The fixed drawing rail is now part of the chart chrome. Treat its
      // right edge as the true start of the drawable pane so docked profiles
      // can never paint underneath the controls.
      context.rect(leftEdge, 0, usablePaneWidth, mediaSize.height);
      context.clip();

      const weeklyProfileOccupiesLeftEdge = this.models.some((model) => {
        const { profile, style } = model;
        if (profile.period !== "weekly" || style.snapMode !== "left") return false;
        const anchorX = this.timeToCoordinate(
          model,
          model.drawingBounds?.startTime ?? profile.startMs / 1_000,
        );
        return anchorX != null && anchorX < leftEdge + 2;
      });
      const latestDailyEndMs = this.models.reduce((latestEndMs, model) => {
        const { profile } = model;
        if (profile.period !== "daily") return latestEndMs;
        return Math.max(latestEndMs, profile.endMs);
      }, Number.NEGATIVE_INFINITY);
      // The newest profile of each kind, per instrument.
      //
      // Only that one is allowed to dock to a screen edge. Docking is a way to
      // keep the CURRENT profile reachable once its anchor scrolls away — it
      // is not a parking space. Every older profile of the same kind used to
      // dock to the same two pixels as well, so scrolling forward piled them
      // onto one another and they read as a single combined profile.
      const latestEndMsByKind = new Map<string, number>();
      for (const model of this.models) {
        const kind = `${model.profile.period}:${model.profile.root}`;
        latestEndMsByKind.set(
          kind,
          Math.max(latestEndMsByKind.get(kind) ?? Number.NEGATIVE_INFINITY, model.profile.endMs),
        );
      }

      // A session's POC and value area stay live until the next session takes
      // over, so their lines run on to the START of the profile in front and
      // stop there — never underneath it. Chaining is per profile kind, so a
      // split session follows the next segment of its own kind rather than
      // jumping to an unrelated one, and the newest profile has nothing in
      // front of it and runs to the live edge.
      const nextProfileStartMsById = new Map<string, number>();
      const chainGroups = new Map<string, { id: string; startMs: number; endMs: number }[]>();
      for (const model of this.models) {
        // Every profile on the same instrument competes for the same space, so
        // they all share one chain: daily, weekly, split sessions and fixed
        // ranges alike. Chaining per profile KIND meant a level only ever
        // yielded to another of its own kind and ran straight underneath
        // anything else standing in front of it.
        const group = chainGroups.get(model.profile.root) ?? [];
        group.push({
          id: model.id,
          startMs: model.drawingBounds ? model.drawingBounds.startTime * 1_000 : model.profile.startMs,
          endMs: model.drawingBounds ? model.drawingBounds.endTime * 1_000 : model.profile.endMs,
        });
        chainGroups.set(model.profile.root, group);
      }
      for (const group of chainGroups.values()) {
        group.sort((left, right) => left.startMs - right.startMs);
        for (const entry of group) {
          // "In front" means starting at or after this profile ENDS, never
          // merely after it starts. Comparing against the end is what lets a
          // weekly keep its levels running across the dailies drawn inside its
          // own span while still stopping at the week in front of it, and it
          // is what makes a split session stop at the back of the next session
          // rather than painting underneath it.
          let blockerStartMs: number | null = null;
          for (const candidate of group) {
            if (candidate.id === entry.id || candidate.startMs < entry.endMs) continue;
            if (blockerStartMs === null || candidate.startMs < blockerStartMs) {
              blockerStartMs = candidate.startMs;
            }
          }
          if (blockerStartMs !== null) nextProfileStartMsById.set(entry.id, blockerStartMs);
        }
      }

      for (const model of this.models) {
        const { profile, style } = model;
        const topPrice = params.series.coordinateToPrice(0);
        const bottomPrice = params.series.coordinateToPrice(mediaSize.height);
        const visibleLow = topPrice == null || bottomPrice == null
          ? Number.NEGATIVE_INFINITY
          : Math.min(topPrice, bottomPrice);
        const visibleHigh = topPrice == null || bottomPrice == null
          ? Number.POSITIVE_INFINITY
          : Math.max(topPrice, bottomPrice);
        if (model.highPrice < visibleLow || model.lowPrice > visibleHigh) continue;
        const sessionAnchorX = this.timeToCoordinate(
          model,
          model.drawingBounds?.startTime ?? profile.startMs / 1_000,
        );
        const sessionEndX = this.timeToCoordinate(
          model,
          model.drawingBounds?.endTime ?? profile.endMs / 1_000,
        );
        if (sessionAnchorX == null || sessionEndX == null || !profile.levels.length) continue;
        const customProfile = profile.period === "custom" && model.drawingBounds;
        const rawCustomLeft = Math.min(sessionAnchorX, sessionEndX);
        const rawCustomRight = Math.max(sessionAnchorX, sessionEndX);
        const customCenterX = (rawCustomLeft + rawCustomRight) / 2;
        const customWidth = Math.max(120, rawCustomRight - rawCustomLeft);
        const customLeft = clamp(
          customCenterX - customWidth / 2,
          leftEdge + 2,
          Math.max(leftEdge + 2, rightEdge - 122),
        );
        const customRight = Math.min(rightEdge - 2, customLeft + customWidth);
        // Keep the newest daily execution profile visible when its Globex
        // open has moved off the left edge. The old renderer only pinned once
        // the *entire* session was off-screen, so a cash-session viewport had
        // real profile data loaded but drew every bar beyond the canvas.
        const autoPinnedDailyLeft = profile.period === "daily"
          && sessionAnchorX < leftEdge + 2
          && profile.endMs === latestDailyEndMs;
        const latestDailyProfile = profile.period === "daily"
          && profile.endMs === latestDailyEndMs;
        const pinnedDailyLeft = profile.period === "daily"
          && latestDailyProfile
          && style.snapMode === "left"
          && autoPinnedDailyLeft;
        if (pinnedDailyLeft && weeklyProfileOccupiesLeftEdge) continue;
        // Docking is reserved for the newest profile of this kind; an older one
        // whose anchor has scrolled past simply leaves the screen with it.
        const isNewestOfKind = profile.endMs
          >= (latestEndMsByKind.get(`${profile.period}:${profile.root}`) ?? profile.endMs);
        const pinnedRight = style.snapMode === "right"
          && isNewestOfKind
          && (profile.period !== "daily" || latestDailyProfile);
        const pinnedLeft = style.snapMode === "left"
          && isNewestOfKind
          && (profile.period === "daily" ? autoPinnedDailyLeft : sessionAnchorX < leftEdge + 2);
        const pinned = pinnedLeft || pinnedRight;
        const rawAnchorX = customProfile
          ? (customLeft + customRight) / 2
          : pinned
          ? pinnedRight ? rightEdge - 2 : leftEdge + 2
          : sessionAnchorX;
        const endX = customProfile
          ? customRight
          : pinned
          ? pinnedRight ? leftEdge : rightEdge
          : sessionEndX;

        // Where this profile's level lines must stop: the back of the profile
        // in front, or the right edge when nothing follows.
        const nextProfileStartMs = nextProfileStartMsById.get(model.id);
        const nextProfileStartX = nextProfileStartMs === undefined
          ? null
          : this.timeToCoordinate(model, Math.floor(nextProfileStartMs / 1_000));
        const levelChainEndX = nextProfileStartX == null
          ? mediaSize.width
          : Math.max(endX, nextProfileStartX);

        // Decimals come from the contract's own tick, so a level never prints
        // more precision than the instrument actually trades in.
        const pricePrecision = profile.tickSize >= 1
          ? 0
          : Math.min(6, Math.max(0, Math.ceil(-Math.log10(profile.tickSize))));

        const sessionWidth = Math.max(0.5, Math.abs(sessionEndX - sessionAnchorX));
        const visibleLogicalRange = params.chart.timeScale().getVisibleLogicalRange();
        const profileDurationSeconds = Math.abs(
          (model.drawingBounds?.endTime ?? profile.endMs / 1_000)
          - (model.drawingBounds?.startTime ?? profile.startMs / 1_000),
        );
        const durationLogicalBars = model.intervalSeconds == null || model.intervalSeconds <= 0
          ? null
          : profileDurationSeconds / model.intervalSeconds;
        const referenceLogicalBars = customProfile || style.widthBasis === "session"
          ? durationLogicalBars
          : CHART_PROFILE_REFERENCE_BARS;
        const zoomScaledWidth = visibleLogicalRange == null || model.intervalSeconds == null
          || referenceLogicalBars == null
          ? null
          : zoomScaledVolumeProfileWidth({
              paneWidth: usablePaneWidth,
              visibleLogicalFrom: Number(visibleLogicalRange.from),
              visibleLogicalTo: Number(visibleLogicalRange.to),
              referenceLogicalBars,
              widthPercent: style.widthPercent,
            });
        const profileWidth = zoomScaledWidth
          ?? (style.widthPercent <= 0
            ? 0
            : Math.min(
                usablePaneWidth * MAX_PROFILE_PANE_FRACTION,
                Math.max(
                  Math.min(
                    PROFILE_MIN_READABLE_WIDTH_PX,
                    usablePaneWidth * MAX_PROFILE_PANE_FRACTION,
                  ),
                  sessionWidth * style.widthPercent / 100,
                ),
              ));
        // A daily profile has two independent halves: volume to the right of
        // its spine and signed delta to the left. Once its session anchor has
        // moved beyond the viewport, dock the volume-only half to the left
        // edge. Delta returns automatically when the anchor is visible again.
        const splitPinnedDaily = pinnedLeft && !pinnedRight && profile.period === "daily";
        const volumeOnlyPinnedDaily = splitPinnedDaily
          && (style.mode === "delta-volume" || style.mode === "volume");
        const anchorX = volumeOnlyPinnedDaily
          ? rawAnchorX
          : splitPinnedDaily
            ? Math.min(rightEdge - 2, leftEdge + profileWidth + 2)
            : rawAnchorX;
        if (!pinned && (
          Math.max(anchorX, endX) + profileWidth < leftEdge
          || Math.min(anchorX, endX) - profileWidth > rightEdge
        )) continue;
        const sourceLevels = profile.levels;
        // The trader's own % Value Area. Falls back to the 70% convention only
        // when the setting is absent.
        const requestedValueAreaPercent = Number.isFinite(style.valueAreaPercent)
          && style.valueAreaPercent > 0
          ? style.valueAreaPercent
          : STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT;
        const referencePrice = profile.poc ?? sourceLevels[Math.floor(sourceLevels.length / 2)]?.price;
        const referenceY = referencePrice == null ? null : params.series.priceToCoordinate(referencePrice);
        const nextReferenceY = referencePrice == null ? null : params.series.priceToCoordinate(
          referencePrice + profile.tickSize * profile.groupTicks,
        );
        const sourceRowPixels = referenceY == null || nextReferenceY == null
          ? 1
          : Math.max(0.01, Math.abs(nextReferenceY - referenceY));
        // Rows are allowed to fall well under a pixel before the renderer
        // collapses them: a profile reads as structure — shelves, single
        // prints, the notch beside a POC — only while each traded tick still
        // has its own row. Requiring a full pixel per row silently doubled the
        // grouping at ordinary zoom and flattened that structure into blocks.
        // Auto group factory scales this, so raising it deliberately coarsens.
        //
        // Manual grouping sets the DATA bin size — it does not mean "draw rows
        // thinner than a pixel". Manual used to skip this collapse entirely, so
        // a manually binned profile lost every shelf, notch and single print
        // the moment the rows fell under a pixel and smeared into a solid
        // block. The legibility floor now applies in both modes; only the
        // trader's coarsening factor is exclusive to automatic, so at ordinary
        // zoom a manual profile still draws exactly the rows it was asked for.
        const groupingFloorFactor = style.automaticGrouping ? style.autoGroupFactor : 1;
        const automaticMultiplier = Math.max(
          1,
          Math.ceil((PROFILE_MIN_ROW_PIXELS * groupingFloorFactor) / sourceRowPixels),
        );
        const groupedTicks = profile.groupTicks * automaticMultiplier;
        // Everything below depends only on the profile, its grouping and the
        // value-area percentage — never on the viewport — so it is computed
        // once per change instead of once per repaint.
        const derivedKey = [
          profile.asOf,
          profile.levels.length,
          groupedTicks,
          profile.groupTicks,
          profile.tickSize,
          requestedValueAreaPercent,
        ].join(":");
        const cachedDerived = this.derived.get(model.id);
        let derived = cachedDerived?.key === derivedKey ? cachedDerived.value : null;
        if (!derived) {
          const levels = automaticMultiplier === 1
          ? sourceLevels
          : [...sourceLevels.reduce((buckets, level) => {
              const sourceTick = Math.round(level.price / profile.tickSize);
              const groupedTick = volumeProfileBinTick(sourceTick, groupedTicks);
              const existing = buckets.get(groupedTick);
              if (existing) {
                existing.volume += level.volume;
                existing.bidVolume += level.bidVolume;
                existing.askVolume += level.askVolume;
                existing.delta += level.delta;
                existing.trades += level.trades;
              } else {
                buckets.set(groupedTick, {
                  price: Number((groupedTick * profile.tickSize).toFixed(10)),
                  volume: level.volume,
                  bidVolume: level.bidVolume,
                  askVolume: level.askVolume,
                  delta: level.delta,
                  trades: level.trades,
                });
              }
              return buckets;
            }, new Map<number, InstitutionalVolumeProfile["levels"][number]>()).values()]
            .sort((a, b) => a.price - b.price);
          let maxVolume = 1;
          let maxAbsDelta = 1;
          let maxSideVolume = 1;
          // Allocation-free scans: spreading a few hundred rows into
          // Math.max three times per profile per frame is both garbage and a
          // latent argument-limit failure on a dense profile.
          for (const level of levels) {
            if (level.volume > maxVolume) maxVolume = level.volume;
            const absDelta = Math.abs(level.delta);
            if (absDelta > maxAbsDelta) maxAbsDelta = absDelta;
            const side = Math.max(level.askVolume, level.bidVolume);
            if (side > maxSideVolume) maxSideVolume = side;
          }
          derived = {
            levels,
            maxVolume,
            maxAbsDelta,
            maxSideVolume,
            valueArea: calculateVolumeProfileValueArea(
              sourceLevels,
              profile.tickSize * profile.groupTicks,
              requestedValueAreaPercent,
            ),
          };
          this.derived.set(model.id, { key: derivedKey, value: derived });
        }
        const levels = derived.levels;
        const groupedMaxVolume = derived.maxVolume;
        const groupedMaxAbsDelta = derived.maxAbsDelta;
        const groupedMaxSideVolume = derived.maxSideVolume;
        const deltaScaleWidth = profile.period === "weekly" ? profileWidth * 0.5 : profileWidth;
        const deltaScaleMaximum = profile.period === "weekly"
          ? groupedMaxAbsDelta
          : pinned && !splitPinnedDaily
            ? groupedMaxVolume
            : groupedMaxAbsDelta;
        const groupedPoc = derived.valueArea.poc ?? profile.poc;
        const groupedVah = derived.valueArea.vah ?? profile.vah;
        const groupedVal = derived.valueArea.val ?? profile.val;
        let firstVisible = 0;
        let lastVisible = levels.length;
        if (Number.isFinite(visibleLow) && Number.isFinite(visibleHigh)) {
          let low = 0;
          let high = levels.length;
          while (low < high) {
            const middle = (low + high) >>> 1;
            if (levels[middle].price < visibleLow) low = middle + 1;
            else high = middle;
          }
          firstVisible = Math.max(0, low - 1);
          low = firstVisible;
          high = levels.length;
          while (low < high) {
            const middle = (low + high) >>> 1;
            if (levels[middle].price <= visibleHigh) low = middle + 1;
            else high = middle;
          }
          lastVisible = Math.min(levels.length, low + 1);
        }

        // Line style traces the profile's outer edge as one stepped polyline
        // rather than outlining every row rectangle, which is what makes it
        // read as a profile silhouette instead of a stack of boxes.
        const outlineSteps: { y: number; height: number; width: number }[] = [];
        const valueAreaPath = new Path2D();
        const outsideValueAreaPath = new Path2D();
        const positiveDeltaPath = new Path2D();
        const negativeDeltaPath = new Path2D();
        const askVolumePath = new Path2D();
        const bidVolumePath = new Path2D();
        const outlinePath = new Path2D();
        const pocPath = new Path2D();
        for (let levelIndex = firstVisible; levelIndex < lastVisible; levelIndex += 1) {
          const level = levels[levelIndex];
          const volume = level.volume;
          const delta = level.delta;
          const top = params.series.priceToCoordinate(
            level.price + profile.tickSize * groupedTicks / 2,
          );
          const bottom = params.series.priceToCoordinate(
            level.price - profile.tickSize * groupedTicks / 2,
          );
          if (top == null || bottom == null) continue;
          if (
            (top < 0 && bottom < 0)
            || (top > mediaSize.height && bottom > mediaSize.height)
          ) continue;
          const y = Math.min(top, bottom);
          const height = Math.max(0.72, Math.abs(bottom - top) - 0.12);
          const volumeWidth = Math.max(0, volume / groupedMaxVolume * profileWidth);
          if (style.visualStyle === "line") outlineSteps.push({ y, height, width: volumeWidth });
          // Delta percentage measures how one-sided a row was rather than how
          // big its delta was, so a thin row that traded entirely on the offer
          // reads as strongly as a heavy balanced one.
          const deltaShare = volume > 0 ? Math.abs(delta) / volume : 0;
          const deltaWidth = profileWidth <= 0
            ? 0
            : style.mode === "delta-percentage"
              ? Math.max(0.5, deltaShare * deltaScaleWidth)
              : Math.max(0.5, Math.abs(delta) / deltaScaleMaximum * deltaScaleWidth);
          const askWidth = Math.max(0, level.askVolume / groupedMaxSideVolume * profileWidth);
          const bidWidth = Math.max(0, level.bidVolume / groupedMaxSideVolume * profileWidth);
          const inValueArea = groupedVah !== null && groupedVal !== null
            && level.price <= groupedVah && level.price >= groupedVal;
          const isPoc = groupedPoc !== null
            && Math.abs(level.price - groupedPoc) < profile.tickSize * groupedTicks / 2;

          const valueAreaActive = inValueArea && style.showValueArea;
          if (style.mode === "delta-volume" || style.mode === "volume") {
            addBar(
              valueAreaActive ? valueAreaPath : outsideValueAreaPath,
              pinnedRight ? anchorX - volumeWidth : anchorX,
              y,
              volumeWidth,
              height,
              pinnedRight ? "left" : "right",
            );
            if (style.showProfileOutline && height >= 2.2) {
              const radius = Math.min(2.25, height / 2, volumeWidth / 2);
              outlinePath.roundRect(
                pinnedRight ? anchorX - volumeWidth : anchorX,
                y,
                volumeWidth,
                height,
                pinnedRight ? [radius, 0, 0, radius] : [0, radius, radius, 0],
              );
            }
            if (style.mode !== "volume" && style.showDelta && !volumeOnlyPinnedDaily) {
              addBar(
                delta >= 0 ? positiveDeltaPath : negativeDeltaPath,
                pinned && !splitPinnedDaily
                  ? pinnedRight ? anchorX - deltaWidth : anchorX
                  : anchorX - deltaWidth,
                y,
                deltaWidth,
                height,
                pinned && !splitPinnedDaily
                  ? pinnedRight ? "left" : "right"
                  : "left",
              );
            }
          } else if (style.mode === "bid-ask") {
            addBar(
              askVolumePath,
              pinnedRight ? anchorX - askWidth : anchorX,
              y,
              askWidth,
              height,
              pinnedRight ? "left" : "right",
            );
            addBar(
              bidVolumePath,
              pinned && !splitPinnedDaily
                ? pinnedRight ? anchorX - bidWidth : anchorX
                : anchorX - bidWidth,
              y,
              bidWidth,
              height,
              pinned && !splitPinnedDaily
                ? pinnedRight ? "left" : "right"
                : "left",
            );
          } else if (style.showDelta) {
            const deltaOnRight = delta >= 0 && !pinnedRight;
            addBar(
              delta >= 0 ? positiveDeltaPath : negativeDeltaPath,
              pinned && !splitPinnedDaily
                ? pinnedRight ? anchorX - deltaWidth : anchorX
                : deltaOnRight ? anchorX : anchorX - deltaWidth,
              y,
              deltaWidth,
              height,
              pinned && !splitPinnedDaily
                ? pinnedRight ? "left" : "right"
                : deltaOnRight ? "right" : "left",
            );
          }

          if (style.showPocHighlight && isPoc) {
            const leftExtent = style.mode === "bid-ask"
              ? bidWidth
              : (style.mode === "delta" || style.mode === "delta-percentage")
                ? delta < 0 ? deltaWidth : 0
                : style.showDelta && !volumeOnlyPinnedDaily ? deltaWidth : 0;
            const rightExtent = style.mode === "bid-ask"
              ? askWidth
              : (style.mode === "delta" || style.mode === "delta-percentage")
                ? delta >= 0 ? deltaWidth : 0
                : volumeWidth;
            addBar(
              pocPath,
              pinned
                ? pinnedRight ? anchorX - Math.max(leftExtent, rightExtent) : anchorX
                : anchorX - leftExtent,
              y,
              pinned
                ? Math.max(leftExtent, rightExtent)
                : leftExtent + rightExtent,
              height,
              "both",
            );
          }
        }
        // One vertical gradient across the profile's own price extent. Built
        // per profile rather than per row so the fade is continuous instead of
        // banded, and reused by every body path below.
        let bodyGradient: CanvasGradient | null = null;
        if (style.gradient) {
          const lowPrice = levels[0]?.price;
          const highPrice = levels.at(-1)?.price;
          const lowY = lowPrice == null ? null : params.series.priceToCoordinate(lowPrice);
          const highY = highPrice == null ? null : params.series.priceToCoordinate(highPrice);
          if (lowY != null && highY != null && Math.abs(lowY - highY) > 0.5) {
            bodyGradient = context.createLinearGradient(0, lowY, 0, highY);
            bodyGradient.addColorStop(0, style.gradient.from);
            bodyGradient.addColorStop(1, style.gradient.to);
          }
        }
        const bodyColor = (fallback: string) => bodyGradient ?? fallback;
        if (style.visualStyle === "line" && outlineSteps.length) {
          // Walk the rows in price order, stepping out to each row's width and
          // then along to the next — the same shape the filled profile makes,
          // drawn as a single continuous edge.
          const ordered = [...outlineSteps].sort((left, right) => left.y - right.y);
          const direction = pinnedRight ? -1 : 1;
          const silhouette = new Path2D();
          let previousWidth: number | null = null;
          for (const step of ordered) {
            const edgeX = anchorX + direction * step.width;
            if (previousWidth === null) {
              silhouette.moveTo(anchorX, step.y);
              silhouette.lineTo(edgeX, step.y);
            } else if (step.width !== previousWidth) {
              silhouette.lineTo(edgeX, step.y);
            }
            silhouette.lineTo(edgeX, step.y + step.height);
            previousWidth = step.width;
          }
          context.globalAlpha = Math.min(1, style.opacity + 0.2);
          context.strokeStyle = bodyColor(style.valueAreaColor);
          context.lineWidth = Math.max(0.5, style.borderWidth ?? 1);
          context.setLineDash([]);
          context.lineJoin = "miter";
          context.stroke(silhouette);
        } else {
          fillPath(outsideValueAreaPath, bodyColor(style.outsideValueAreaColor), style.opacity * 0.34, style.visualStyle, style.borderWidth);
        }
        // Line is an OUTLINE, and nothing else. The silhouette above already
        // drew the profile's edge; every remaining path here is built from one
        // rectangle per row, so stroking them in line mode outlined each row
        // individually — the bars reappearing inside the outline as soon as
        // the chart was zoomed in far enough for the rows to separate. In line
        // mode the interior stays completely see-through and the POC keeps its
        // own level line, which is drawn separately.
        const drawsInterior = style.visualStyle !== "line";
        if (drawsInterior) {
          fillPath(valueAreaPath, bodyColor(style.valueAreaColor), style.opacity * 0.82, style.visualStyle, style.borderWidth);
          fillPath(
            positiveDeltaPath,
            bodyColor(style.positiveDeltaColor),
            Math.min(0.94, style.opacity + 0.14),
            style.visualStyle,
            style.borderWidth,
          );
          fillPath(
            negativeDeltaPath,
            bodyColor(style.negativeDeltaColor),
            Math.min(0.94, style.opacity + 0.14),
            style.visualStyle,
            style.borderWidth,
          );
          fillPath(
            askVolumePath,
            bodyColor(style.positiveDeltaColor),
            Math.min(0.94, style.opacity + 0.08),
            style.visualStyle,
            style.borderWidth,
          );
          fillPath(
            bidVolumePath,
            bodyColor(style.negativeDeltaColor),
            Math.min(0.94, style.opacity + 0.08),
            style.visualStyle,
            style.borderWidth,
          );
          if (style.showProfileOutline) {
            context.globalAlpha = 0.3;
            context.strokeStyle = style.valueAreaColor;
            context.lineWidth = 0.35;
            context.stroke(outlinePath);
          }
          if (style.showPocHighlight) fillPath(pocPath, style.pocColor, 0.72, style.visualStyle, style.borderWidth);
        }

        const high = levels.at(-1)?.price ?? null;
        const low = levels[0]?.price ?? null;
        const top = high == null ? null : params.series.priceToCoordinate(
          high + profile.tickSize * groupedTicks / 2,
        );
        const bottom = low == null ? null : params.series.priceToCoordinate(
          low - profile.tickSize * groupedTicks / 2,
        );
        if (style.showProfileSpine && top != null && bottom != null) {
          context.globalAlpha = 0.72;
          context.strokeStyle = style.positiveDeltaColor;
          context.lineWidth = 0.8;
          context.setLineDash([]);
          context.beginPath();
          context.moveTo(anchorX, Math.min(top, bottom));
          context.lineTo(anchorX, Math.max(top, bottom));
          context.stroke();
        }

        // When a day is split into session windows, several profiles sit side
        // by side on the same date. Name each one at its top, otherwise the
        // split is invisible and the chart just looks like more profiles.
        // Only while the profile itself is still on screen. Clamping an
        // off-screen profile's name back into view stacked every scrolled-past
        // session on the same few pixels, so panning right built a pile of
        // overlapping words in the corner.
        const sessionLabelVisible = profile.sessionLabel
          && top != null
          && bottom != null
          && Math.max(anchorX, endX) > leftEdge
          && Math.min(anchorX, endX) - profileWidth < mediaSize.width
          && Math.min(top, bottom) > 0
          && Math.max(top, bottom) < mediaSize.height;
        if (sessionLabelVisible && profile.sessionLabel && top != null && bottom != null) {
          const sessionLabel = profile.sessionLabel;
          const labelY = Math.min(top, bottom) - 4;
          context.globalAlpha = 0.92;
          context.font = "600 9px 'JetBrains Mono', monospace";
          context.textAlign = pinnedRight ? "right" : "left";
          context.textBaseline = "alphabetic";
          const measured = context.measureText(sessionLabel).width;
          const labelX = clamp(
            pinnedRight ? anchorX - 2 : anchorX + 2,
            leftEdge + (pinnedRight ? measured + 4 : 4),
            mediaSize.width - (pinnedRight ? 4 : measured + 4),
          );
          context.fillStyle = style.pocColor;
          context.fillText(sessionLabel, labelX, labelY);
        }

        const drawLevel = (
          price: number | null,
          color: string,
          dash: number[],
          label: string | null,
          lineWidth?: number,
        ) => {
          if (price == null) return;
          const y = params.series.priceToCoordinate(price);
          if (y == null) return;
          // Extend Line. `till-interaction` runs on until a later bar trades
          // back through the level, which is the point the line stops being
          // untested — drawing past it would overstate the level.
          // A level runs on until the session in front begins. Extend modes may
          // stop it EARLIER — never later — so a line can never be drawn
          // underneath the next profile, whatever the split settings are.
          let lineEndX = levelChainEndX;
          const extendMode = style.extendMode ?? "none";
          if (extendMode === "till-interaction") {
            const bars = style.interactionBars ?? [];
            let touchedX: number | null = null;
            for (const bar of bars) {
              if (bar.low <= price && bar.high >= price) {
                const barX = this.timeToCoordinate(model, bar.time);
                if (barX != null && barX > endX) { touchedX = barX; break; }
              }
            }
            if (touchedX != null) lineEndX = Math.min(lineEndX, touchedX);
          }
          context.globalAlpha = 0.82;
          context.strokeStyle = color;
          context.lineWidth = Math.max(0.5, Number.isFinite(lineWidth) ? Number(lineWidth) : 1);
          context.setLineDash(style.levelDash ?? dash);
          context.beginPath();
          context.moveTo(anchorX, y);
          context.lineTo(lineEndX, y);
          context.stroke();
          // Named levels, matching how IB levels are labelled: the name and its
          // price at the line's terminus, which for a forward level is the
          // screen edge. Left keeps them beside the profile that produced them.
          if (style.showLevelLabels !== false && label) {
            const labelText = style.showLevelLabelPrice === false
              ? label
              : `${label} ${price.toFixed(pricePrecision)}`;
            context.globalAlpha = 0.9;
            context.fillStyle = color;
            context.font = "700 9px 'JetBrains Mono', monospace";
            context.textBaseline = "bottom";
            const measured = context.measureText(labelText).width;
            const labelY = Math.max(11, Math.min(mediaSize.height - 3, y - 3));
            const labelOnLeft = (style.levelLabelSide ?? "right") === "left";
            // Where the label naturally belongs: at the line's own terminus.
            const naturalX = labelOnLeft
              ? Math.min(anchorX, lineEndX) + 5
              : Math.max(anchorX, lineEndX) - 5;
            // The clamp exists so a partly visible level keeps its label clear
            // of the fixed drawing rail. It must NOT drag a label belonging to
            // a level that has scrolled away back into view: doing that piled
            // every previous session's VAH, VAL and POC into one unreadable
            // column against the left edge as soon as the chart was panned.
            const labelLow = leftEdge + (labelOnLeft ? 4 : measured + 4);
            const labelHigh = mediaSize.width - (labelOnLeft ? measured + 4 : 4);
            if (naturalX >= leftEdge && naturalX <= mediaSize.width) {
              context.textAlign = labelOnLeft ? "left" : "right";
              context.fillText(labelText, clamp(naturalX, labelLow, labelHigh), labelY);
            }
          }
        };
        // Developing POC: where control sat at each recorded minute. Drawn as
        // a step trail because the POC holds a price until enough volume moves
        // it, so interpolating between points would invent migration that
        // never happened.
        if (style.showDevelopingPoc && profile.developingPoc.length > 1) {
          const startMs = Number(style.developingPocStartMs ?? 0);
          const trail = startMs > 0
            ? profile.developingPoc.filter((point) => point.timestamp >= startMs)
            : profile.developingPoc;
          if (trail.length > 1) {
            context.globalAlpha = 0.7;
            context.strokeStyle = style.pocColor;
            context.lineWidth = Math.max(0.5, Number(style.pocLineWidth ?? 1));
            context.setLineDash([]);
            context.beginPath();
            let started = false;
            let previousY: number | null = null;
            for (const point of trail) {
              const pointX = this.timeToCoordinate(model, Math.floor(point.timestamp / 1000));
              const pointY = params.series.priceToCoordinate(point.price);
              if (pointX == null || pointY == null) continue;
              if (!started) {
                context.moveTo(pointX, pointY);
                started = true;
              } else {
                if (previousY != null && previousY !== pointY) context.lineTo(pointX, previousY);
                context.lineTo(pointX, pointY);
              }
              previousY = pointY;
            }
            if (started) context.stroke();
          }
        }
        if (style.showPocLine) {
          drawLevel(groupedPoc, style.pocColor, [2, 3], "POC", style.pocLineWidth);
        }
        if (style.showValueAreaLines) {
          drawLevel(groupedVah, style.valueAreaColor, [3, 3], "VAH", style.valueAreaLineWidth);
          drawLevel(groupedVal, style.valueAreaColor, [3, 3], "VAL", style.valueAreaLineWidth);
        }

        // Peak and Valley: high- and low-volume nodes read off the same grouped
        // rows the histogram is drawn from, so a node always lines up with the
        // bar that produced it.
        if (style.showPeaks || style.showValleys || style.showBusinessZone) {
          const structure = calculateVolumeProfileStructure(
            levels,
            {
              sensitivity: style.pvSensitivity ?? 40,
              excludeHighLow: style.pvExcludeHighLow !== false,
              peakMinVolumePercent: style.peakMinVolumePercent ?? 0,
              valleyMaxVolumePercent: style.valleyMaxVolumePercent ?? 100,
              peakOnlyOutsideValueArea: style.peakOnlyOutsideValueArea === true,
              valleyOnlyOutsideValueArea: style.valleyOnlyOutsideValueArea === true,
            },
            { vah: groupedVah ?? null, val: groupedVal ?? null },
          );
          if (style.showBusinessZone && structure.businessZone) {
            const highY = params.series.priceToCoordinate(structure.businessZone.high);
            const lowY = params.series.priceToCoordinate(structure.businessZone.low);
            if (highY != null && lowY != null) {
              const zoneTop = Math.min(highY, lowY);
              const zoneHeight = Math.abs(lowY - highY);
              context.globalAlpha = clamp((style.businessZoneOpacity ?? 18) / 100, 0.02, 1);
              context.fillStyle = style.businessZoneColor ?? style.valueAreaColor;
              context.fillRect(
                Math.min(anchorX, endX),
                zoneTop,
                Math.abs(endX - anchorX),
                Math.max(1, zoneHeight),
              );
              context.globalAlpha = 0.7;
              context.strokeStyle = style.businessZoneColor ?? style.valueAreaColor;
              context.lineWidth = Math.max(0.5, style.businessZoneLineWidth ?? 1);
              context.setLineDash([4, 3]);
              context.strokeRect(
                Math.min(anchorX, endX),
                zoneTop,
                Math.abs(endX - anchorX),
                Math.max(1, zoneHeight),
              );
            }
          }
          if (style.showPeaks) {
            for (const peak of structure.peaks) {
              drawLevel(peak.price, style.peakColor ?? style.positiveDeltaColor, [1, 2], "PEAK", style.peakLineWidth);
            }
          }
          if (style.showValleys) {
            for (const valley of structure.valleys) {
              drawLevel(valley.price, style.valleyColor ?? style.negativeDeltaColor, [1, 2], "VLY", style.valleyLineWidth);
            }
          }
        }

        // VWAP of this profile, with optional standard-deviation envelopes.
        if (style.showVwap) {
          const vwap = calculateVolumeProfileVwap(levels, style.vwapBandDeviations ?? []);
          if (vwap.vwap !== null) {
            drawLevel(vwap.vwap, style.vwapColor ?? style.pocColor, style.vwapDash ?? [6, 3], "VWAP", style.vwapLineWidth);
            for (const band of vwap.bands) {
              const bandColor = style.vwapBandColor ?? style.vwapColor ?? style.pocColor;
              drawLevel(band.upper, bandColor, [2, 4], null, style.vwapLineWidth);
              drawLevel(band.lower, bandColor, [2, 4], null, style.vwapLineWidth);
            }
          }
        }

        // Summary block: the totals behind the picture.
        if (style.showSummaryVolume || style.showSummaryTrades) {
          const summary = summarizeVolumeProfile(levels);
          const lines: { text: string; color: string }[] = [];
          if (style.showSummaryVolume) {
            lines.push({
              text: `V ${Math.round(summary.totalVolume).toLocaleString("en-US")}`,
              color: style.summaryTextColor ?? style.pocColor,
            });
            lines.push({
              text: `${summary.delta >= 0 ? "+" : "−"}${Math.abs(Math.round(summary.delta)).toLocaleString("en-US")}`,
              color: summary.delta >= 0
                ? (style.summaryAskColor ?? style.positiveDeltaColor)
                : (style.summaryBidColor ?? style.negativeDeltaColor),
            });
          }
          if (style.showSummaryTrades) {
            lines.push({
              text: `T ${Math.round(summary.trades).toLocaleString("en-US")}`,
              color: style.summaryTextColor ?? style.pocColor,
            });
          }
          context.globalAlpha = 0.9;
          context.font = "600 8px 'JetBrains Mono', monospace";
          context.textAlign = "left";
          context.textBaseline = "top";
          let summaryY = 6;
          for (const line of lines) {
            context.fillStyle = line.color;
            context.fillText(line.text, clamp(Math.min(anchorX, endX) + 4, 4, mediaSize.width - 60), summaryY);
            summaryY += 10;
          }
        }

      }

      context.restore();
    });
  }
}
