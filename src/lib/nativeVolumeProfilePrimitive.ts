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
  const pixelsPerLogicalBar = paneWidth / visibleLogicalSpan;
  const profileLogicalBars = referenceLogicalBars * widthPercent / 100;
  return clamp(
    profileLogicalBars * pixelsPerLogicalBar,
    0.5,
    paneWidth * clamp(maxPaneFraction, 0.05, 0.5),
  );
}

export type NativeVolumeProfileStyle = {
  mode: "delta-volume" | "bid-ask" | "delta";
  widthBasis: "chart" | "session";
  widthPercent: number;
  opacity: number;
  positiveDeltaColor: string;
  negativeDeltaColor: string;
  outsideValueAreaColor: string;
  valueAreaColor: string;
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

export class NativeVolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private models: NativeVolumeProfileModel[] = [];
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
        color: string,
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

      // A session's POC and value area stay live until the next session takes
      // over, so their lines run on to the START of the profile in front and
      // stop there — never underneath it. Chaining is per profile kind, so a
      // split session follows the next segment of its own kind rather than
      // jumping to an unrelated one, and the newest profile has nothing in
      // front of it and runs to the live edge.
      const nextProfileStartMsById = new Map<string, number>();
      const chainGroups = new Map<string, { id: string; startMs: number }[]>();
      for (const model of this.models) {
        const key = `${model.profile.period}:${model.profile.root}`;
        const group = chainGroups.get(key) ?? [];
        group.push({ id: model.id, startMs: model.profile.startMs });
        chainGroups.set(key, group);
      }
      for (const group of chainGroups.values()) {
        group.sort((left, right) => left.startMs - right.startMs);
        for (let index = 0; index < group.length - 1; index += 1) {
          nextProfileStartMsById.set(group[index].id, group[index + 1].startMs);
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
        const pinnedRight = style.snapMode === "right"
          && (profile.period !== "daily" || latestDailyProfile);
        const pinnedLeft = style.snapMode === "left"
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
                Math.max(0.5, sessionWidth * style.widthPercent / 100),
              ));
        // A daily profile has two independent halves: volume to the right of
        // its spine and signed delta to the left. Once its session anchor has
        // moved beyond the viewport, dock the volume-only half to the left
        // edge. Delta returns automatically when the anchor is visible again.
        const splitPinnedDaily = pinnedLeft && !pinnedRight && profile.period === "daily";
        const volumeOnlyPinnedDaily = splitPinnedDaily && style.mode === "delta-volume";
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
        const automaticMultiplier = style.automaticGrouping
          ? Math.max(1, Math.ceil((PROFILE_MIN_ROW_PIXELS * style.autoGroupFactor) / sourceRowPixels))
          : 1;
        const groupedTicks = profile.groupTicks * automaticMultiplier;
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
        const groupedMaxVolume = Math.max(1, ...levels.map((level) => level.volume));
        const groupedMaxAbsDelta = Math.max(1, ...levels.map((level) => Math.abs(level.delta)));
        const groupedMaxSideVolume = Math.max(
          1,
          ...levels.map((level) => Math.max(level.askVolume, level.bidVolume)),
        );
        const deltaScaleWidth = profile.period === "weekly" ? profileWidth * 0.5 : profileWidth;
        const deltaScaleMaximum = profile.period === "weekly"
          ? groupedMaxAbsDelta
          : pinned && !splitPinnedDaily
            ? groupedMaxVolume
            : groupedMaxAbsDelta;
        const valueArea = calculateVolumeProfileValueArea(
          levels,
          profile.tickSize * groupedTicks,
          // The trader's own % Value Area. Falls back to the 70% convention
          // only when the setting is absent.
          Number.isFinite(style.valueAreaPercent) && style.valueAreaPercent > 0
            ? style.valueAreaPercent
            : STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
        );
        const groupedPoc = valueArea.poc ?? profile.poc;
        const groupedVah = valueArea.vah ?? profile.vah;
        const groupedVal = valueArea.val ?? profile.val;
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
          const deltaWidth = profileWidth <= 0
            ? 0
            : Math.max(0.5, Math.abs(delta) / deltaScaleMaximum * deltaScaleWidth);
          const askWidth = Math.max(0, level.askVolume / groupedMaxSideVolume * profileWidth);
          const bidWidth = Math.max(0, level.bidVolume / groupedMaxSideVolume * profileWidth);
          const inValueArea = groupedVah !== null && groupedVal !== null
            && level.price <= groupedVah && level.price >= groupedVal;
          const isPoc = groupedPoc !== null
            && Math.abs(level.price - groupedPoc) < profile.tickSize * groupedTicks / 2;

          const valueAreaActive = inValueArea && style.showValueArea;
          if (style.mode === "delta-volume") {
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
            if (style.showDelta && !volumeOnlyPinnedDaily) {
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
              : style.mode === "delta"
                ? delta < 0 ? deltaWidth : 0
                : style.showDelta && !volumeOnlyPinnedDaily ? deltaWidth : 0;
            const rightExtent = style.mode === "bid-ask"
              ? askWidth
              : style.mode === "delta"
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
        fillPath(outsideValueAreaPath, style.outsideValueAreaColor, style.opacity * 0.34, style.visualStyle, style.borderWidth);
        fillPath(valueAreaPath, style.valueAreaColor, style.opacity * 0.82, style.visualStyle, style.borderWidth);
        fillPath(
          positiveDeltaPath,
          style.positiveDeltaColor,
          Math.min(0.94, style.opacity + 0.14),
          style.visualStyle,
          style.borderWidth,
        );
        fillPath(
          negativeDeltaPath,
          style.negativeDeltaColor,
          Math.min(0.94, style.opacity + 0.14),
          style.visualStyle,
          style.borderWidth,
        );
        fillPath(
          askVolumePath,
          style.positiveDeltaColor,
          Math.min(0.94, style.opacity + 0.08),
          style.visualStyle,
          style.borderWidth,
        );
        fillPath(
          bidVolumePath,
          style.negativeDeltaColor,
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
          if (style.showText && label) {
            const lineRight = Math.max(anchorX, lineEndX);
            context.globalAlpha = 0.88;
            context.fillStyle = color;
            context.font = "600 8px 'JetBrains Mono', monospace";
            context.textAlign = "right";
            context.textBaseline = "bottom";
            context.fillText(
              label,
              clamp(lineRight - 4, 18, mediaSize.width - 5),
              Math.max(9, y - 3),
            );
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
