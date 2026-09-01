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
import { mixHexColors } from "@/lib/volumeProfileGradients";
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
  /**
   * How solid the POC row's highlight is, 2-100.
   *
   * The slider for this existed in the Point of Control tab and was read by
   * nothing: the fill was hardcoded, so dragging it moved a stored number and
   * never the chart.
   */
  pocHighlightOpacity?: number;
  /**
   * Tick grouping for the developing POC trail - DeepChart's ShiftPocTick.
   *
   * The POC drifts a tick at a time all session. Grouping it means the trail
   * only steps when control moves by a size the trader considers a real shift,
   * so what is left is the migration rather than the noise around it. Both this
   * and its opacity had controls in the Point of Control tab and were read by
   * nothing.
   */
  shiftedPocTicks?: number;
  /** How solid that trail is drawn, 2-100. */
  shiftedPocOpacity?: number;
  showProfileOutline: boolean;
  automaticGrouping: boolean;
  autoGroupFactor: number;
  /**
   * Manual row height in ticks, applied HERE rather than to the request.
   *
   * It used to be sent to the server, which returned the profile pre-binned at
   * that size - so the fine data was never fetched and zooming in could not
   * recover it. DeepChart treats the same control as a display bin over
   * full-resolution data, which is why setting 4 ticks there barely changes
   * what you see at ordinary zoom: the legibility floor is already coarser
   * than four ticks, and the setting only bites once you zoom in past it.
   */
  manualGroupTicks?: number;
  valueAreaPercent: number;
  snapMode: "off" | "left" | "right";
  /** Point of Control line weight. */
  pocLineWidth?: number;
  /** Trace the POC as it migrated through the session. */
  showDevelopingPoc?: boolean;
  /**
   * Trace both value-area edges as they widened through the session.
   *
   * DeepChart spells this as the line it draws rather than as a switch, and so
   * does our dialog: "no", or the dash pattern to draw it with.
   */
  developingValueArea?: "no" | "dash" | "solid";
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

/**
 * Width of a row's delta bar, in pixels.
 *
 * Extracted so the degenerate cases are testable. A profile carrying no
 * aggressor delta at all gives a scale maximum of zero, and the previous
 * inline form divided by it: `Math.abs(0) / 0` is NaN, `Math.max(0.5, NaN)`
 * is also NaN, and a canvas silently ignores a NaN rect. The delta half of
 * "Delta and total volume" therefore vanished with no error to follow —
 * indistinguishable from the feature having been removed. A profile with no
 * delta now returns zero and simply draws nothing.
 */
export function resolveDeltaBarWidth(input: {
  mode: "volume" | "delta-volume" | "bid-ask" | "delta" | "delta-percentage";
  delta: number;
  volume: number;
  profileWidth: number;
  deltaScaleWidth: number;
  deltaScaleMaximum: number;
}): number {
  const { mode, delta, volume, profileWidth, deltaScaleWidth, deltaScaleMaximum } = input;
  if (!(profileWidth > 0) || !(deltaScaleWidth > 0)) return 0;
  if (!Number.isFinite(delta) || delta === 0) return 0;
  if (mode === "delta-percentage") {
    // Delta percentage measures how one-sided a row was rather than how big
    // its delta was, so a thin row that traded entirely on the offer reads as
    // strongly as a heavy balanced one.
    if (!(volume > 0)) return 0;
    const share = Math.min(1, Math.abs(delta) / volume);
    return Math.max(0.5, share * deltaScaleWidth);
  }
  if (!(deltaScaleMaximum > 0)) return 0;
  const share = Math.min(1, Math.abs(delta) / deltaScaleMaximum);
  return Math.max(0.5, share * deltaScaleWidth);
}

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
    // Volume profiles read as the structure everything else sits inside, so
    // they paint ABOVE the candles and any other overlay. Row opacity is a
    // real setting, so lowering it lets the price action show through rather
    // than the profile being hidden behind it.
    zOrder: () => "top" as const,
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
    // Project from the last candle when it is on screen, and from whatever IS
    // on screen when it is not.
    //
    // Zoomed into a region far behind the live edge, the last candle is off
    // screen and timeToCoordinate returns null for it too — so this fallback
    // failed exactly when it was needed. The caller then had no position for
    // the profile in front, and a week-old profile's value-area lines ran
    // straight through everything to the right edge. Anything visible is a
    // usable origin: the scale is linear in logical space, so one resolvable
    // anchor plus the bar interval places any time, on screen or not.
    const anchorTime = timeScale.timeToCoordinate(model.lastCandleTime as Time) != null
      ? model.lastCandleTime
      : timeScale.getVisibleRange()?.from ?? null;
    if (anchorTime == null) return null;
    const anchorCoordinate = timeScale.timeToCoordinate(anchorTime as Time);
    if (anchorCoordinate == null) return null;
    const anchorLogical = timeScale.coordinateToLogical(anchorCoordinate);
    if (anchorLogical == null) return null;
    const projectedLogical = Number(anchorLogical)
      + (timestamp - Number(anchorTime)) / model.intervalSeconds;
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
      // Only that one is allowed to dock to a screen edge. Docking keeps the
      // CURRENT profile reachable once its anchor scrolls away — it is not a
      // parking space. Every older profile of the same kind used to dock to the
      // same two pixels as well, so scrolling forward piled them onto one
      // another and they read as a single combined profile.
      const latestEndMsByKind = new Map<string, number>();
      for (const model of this.models) {
        const kind = `${model.profile.period}:${model.profile.root}`;
        latestEndMsByKind.set(
          kind,
          Math.max(latestEndMsByKind.get(kind) ?? Number.NEGATIVE_INFINITY, model.profile.endMs),
        );
      }

      // Which profile owns the LEFT dock, per kind.
      //
      // The dock belongs to the most recent profile that has actually scrolled
      // past the left edge — not to the newest profile in the pane. Those are
      // the same thing at the live edge, but they diverge the moment the chart
      // is scrolled back through history, and using the newest one meant an
      // older profile kept the dock after a newer one had passed it. As each
      // profile slides off, it takes the dock from the one before it and that
      // one simply leaves the screen.
      const leftDockByKind = new Map<string, { id: string; endMs: number }>();
      for (const model of this.models) {
        if (model.style.snapMode !== "left") continue;
        const anchorX = this.timeToCoordinate(
          model,
          model.drawingBounds?.startTime ?? model.profile.startMs / 1_000,
        );
        if (anchorX == null || anchorX >= leftEdge + 2) continue;
        const kind = `${model.profile.period}:${model.profile.root}`;
        const current = leftDockByKind.get(kind);
        if (!current || model.profile.endMs > current.endMs) {
          leftDockByKind.set(kind, { id: model.id, endMs: model.profile.endMs });
        }
      }
      const ownsLeftDock = (model: NativeVolumeProfileModel) =>
        leftDockByKind.get(`${model.profile.period}:${model.profile.root}`)?.id === model.id;

      // Where each profile's spine is actually DRAWN.
      //
      // A docked profile is deliberately painted at a screen edge rather than
      // at its own time, so its time coordinate says nothing about where its
      // body ended up. Level lines were stopped at that time coordinate, which
      // meant they halted in empty space and ran straight through the docked
      // body — and a docked profile's own levels ran from the edge across
      // every profile between it and its successor's time. Docking only
      // engages once the anchor scrolls off, which is why the lines behaved
      // until the chart was moved away.
      const latestEndMsByKindForDock = latestEndMsByKind;
      const drawnAnchorXById = new Map<string, number>();
      // The BACK of each profile's drawn body — its leftmost painted pixel,
      // which is the edge an incoming level line has to stop at. The anchor is
      // not that edge: a body that extends left from its spine (any docked or
      // right-anchored profile, and the delta half of a normal daily) has its
      // back a full width earlier, so stopping a line at the anchor ran it
      // straight across the profile it was supposed to stop behind.
      const drawnBackXById = new Map<string, number>();
      // Level lines are drawn after every body has been placed. Within one
      // pass a profile can only see the geometry of models drawn before it,
      // and the profile in front is frequently drawn after — which is why the
      // stop edge could not be measured at the point the line was drawn.
      const deferredLevelDraws: Array<() => void> = [];
      for (const model of this.models) {
        const rawAnchorX = this.timeToCoordinate(
          model,
          model.drawingBounds?.startTime ?? model.profile.startMs / 1_000,
        );
        if (rawAnchorX == null) continue;
        const isNewestOfKind = model.profile.endMs >= (
          latestEndMsByKindForDock.get(`${model.profile.period}:${model.profile.root}`)
          ?? model.profile.endMs
        );
        if (model.style.snapMode === "right" && isNewestOfKind) {
          drawnAnchorXById.set(model.id, rightEdge - 2);
          continue;
        }
        if (model.style.snapMode === "left" && ownsLeftDock(model) && rawAnchorX < leftEdge + 2) {
          drawnAnchorXById.set(model.id, leftEdge + 2);
          continue;
        }
        drawnAnchorXById.set(model.id, rawAnchorX);
      }

      // A session's POC and value area stay live until the next session takes
      // over, so their lines run on to the START of the profile in front and
      // stop there — never underneath it. Chaining is per profile kind, so a
      // split session follows the next segment of its own kind rather than
      // jumping to an unrelated one, and the newest profile has nothing in
      // front of it and runs to the live edge.
      const blockerIdById = new Map<string, string>();
      // The blocker's start in TIME, kept alongside its id so a level can still
      // be stopped when the blocker itself is not on screen to be measured.
      const blockerStartMsById = new Map<string, number>();
      const chainGroups = new Map<string, { id: string; startMs: number; endMs: number; period: string }[]>();
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
          period: model.profile.period,
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
          //
          // Sessions of the SAME period are the exception, and they are the
          // hard rule: whichever one begins next stops the one before it, to
          // the second, even where the two spans overlap. A Globex profile
          // running from the evening open through to the cash close overlaps
          // the New York session sitting inside it, so the end-based test
          // never saw New York as being "in front" and Globex's POC, VAH and
          // VAL ran straight through it and on across the chart. Only the
          // profiles actually being drawn are considered, so the level stops
          // at the next session the trader has switched ON — turn Asia off
          // and the line carries through to London instead.
          let blockerStartMs: number | null = null;
          let blockerId: string | null = null;
          const considerBlocker = (candidate: typeof entry) => {
            if (blockerStartMs === null || candidate.startMs < blockerStartMs) {
              blockerStartMs = candidate.startMs;
              blockerId = candidate.id;
            }
          };
          for (const candidate of group) {
            if (candidate.id === entry.id) continue;
            const samePeriod = candidate.period === entry.period;
            // Same period: the next one to begin, overlap or not.
            if (samePeriod && candidate.startMs > entry.startMs) considerBlocker(candidate);
            // A different period nests — a weekly holds its levels across the
            // dailies drawn inside its own span — so it only yields to one
            // that begins at or after it ends.
            else if (!samePeriod && candidate.startMs >= entry.endMs) considerBlocker(candidate);
          }
          if (blockerId !== null) {
            blockerIdById.set(entry.id, blockerId);
            if (blockerStartMs !== null) blockerStartMsById.set(entry.id, blockerStartMs);
          }
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
          && ownsLeftDock(model);
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
        // Which WAY the profile is drawn, as opposed to where it is anchored.
        //
        // Docking to the screen edge is reserved for the newest profile of a
        // kind, and that is deliberate. Direction is not: asking for profiles
        // on the right and getting every one except the newest drawn growing
        // rightward — off toward the price scale — is the setting doing the
        // opposite of what it says on every bar but one.
        const facesLeft = style.snapMode === "right";
        const pinnedLeft = style.snapMode === "left"
          && ownsLeftDock(model)
          && (profile.period === "daily" ? autoPinnedDailyLeft : sessionAnchorX < leftEdge + 2);
        const pinned = pinnedLeft || pinnedRight;
        // A left-facing profile must open back across ITS OWN session.
        //
        // An undocked profile anchored at its session START and drawn leftward
        // opens across the session BEFORE it — the histogram sits over bars it
        // was not built from, which is the profile reading backwards. Anchoring
        // it at the session end instead makes it cover exactly the range it
        // measured, whichever way it faces. The TPO renderer already does this
        // ("an older right-facing profile hangs off the end of its own period
        // and opens back across it"); the volume profile did not, which is why
        // only some profiles looked reversed.
        const rawAnchorX = customProfile
          ? (customLeft + customRight) / 2
          : pinned
          ? pinnedRight ? rightEdge - 2 : leftEdge + 2
          : facesLeft ? sessionEndX : sessionAnchorX;
        const endX = customProfile
          ? customRight
          : pinned
          ? pinnedRight ? leftEdge : rightEdge
          : sessionEndX;

        // Where this profile's level lines must stop: the back of the profile
        // in front, or the right edge when nothing follows.
        //
        // Measured where that profile is DRAWN, not where its time sits, so a
        // docked profile stops the lines at its body instead of being painted
        // over. A blocker drawn to the left of this profile is not in front of
        // it on screen and cannot stop anything.
        const blockerId = blockerIdById.get(model.id);
        const blockerDrawnX = blockerId === undefined
          ? null
          : drawnAnchorXById.get(blockerId) ?? null;
        // A blocker that is off screen, or whose own anchor time the scale
        // cannot resolve, has no drawn position — but it is still in front.
        // Project its start through THIS model, which is being drawn and so
        // always has a usable projection basis, rather than giving up because
        // the blocker could not measure itself.
        const blockerStartMs = blockerStartMsById.get(model.id);
        const blockerX = blockerDrawnX ?? (blockerStartMs === undefined
          ? null
          : this.timeToCoordinate(model, blockerStartMs / 1_000));
        const ownDrawnX = drawnAnchorXById.get(model.id) ?? null;
        const nextProfileStartX = blockerX == null
          || (ownDrawnX != null && blockerX <= ownDrawnX)
          ? null
          : blockerX;
        // Three distinct cases, and only one of them may reach the live edge:
        //   - the profile in front is placed: stop at its back;
        //   - it is placed BEHIND this one (a dock pinned it left), so nothing
        //     is actually in front on screen: run on;
        //   - it exists but could not be placed at all: stop at this profile's
        //     own end. Running to the live edge there is what made levels
        //     shoot forward across every profile ahead of them on a zoom.
        const blockerPlacedBehind = blockerX != null
          && ownDrawnX != null
          && blockerX <= ownDrawnX;
        // Resolved when the level is actually drawn, by which time every body
        // has recorded where it was painted. Prefers the blocker's measured
        // back edge and falls back to its anchor for a blocker that never
        // drew a body (off screen, or zero width at this zoom).
        const resolveLevelChainEndX = () => {
          const blockerBackX = blockerId === undefined
            ? null
            : drawnBackXById.get(blockerId) ?? null;
          const stopX = blockerBackX != null
            && (ownDrawnX == null || blockerBackX > ownDrawnX)
            ? blockerBackX
            : nextProfileStartX;
          return stopX != null
            ? Math.max(endX, stopX)
            : blockerId !== undefined && !blockerPlacedBehind
              ? endX
              : mediaSize.width;
        };

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
        /*
         * The trader's manual bin is a floor on the ROW, not a coarser fetch.
         *
         * `profile.groupTicks` is whatever the data arrived binned at, which is
         * now always tick resolution. Taking the larger of the two means manual
         * never draws finer than asked and never throws away detail the way a
         * pre-binned request did.
         */
        const requestedTicks = style.automaticGrouping
          ? profile.groupTicks
          : Math.max(profile.groupTicks, Math.max(1, Math.round(style.manualGroupTicks ?? 1)));
        const groupedTicks = requestedTicks * automaticMultiplier;
        // Everything below depends only on the profile, its grouping and the
        // value-area percentage — never on the viewport — so it is computed
        // once per change instead of once per repaint.
        const derivedKey = [
          profile.asOf,
          profile.levels.length,
          groupedTicks,
          requestedTicks,
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
            /*
             * Measured over the rows the TRADER asked for.
             *
             * Not `profile.groupTicks`, which is now always tick resolution
             * because the fetch is - that measured a 4-tick profile's value
             * area over single ticks, and the two-row expansion then covered a
             * quarter of the price distance, which moved the edges.
             *
             * Not `groupedTicks` either: that carries the zoom-dependent
             * legibility multiplier, and a value area that moved when you
             * zoomed would be worse than one that is merely off.
             */
            valueArea: calculateVolumeProfileValueArea(
              sourceLevels,
              profile.tickSize * requestedTicks,
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
        // The leftmost pixel this profile will paint, recorded for the level
        // chaining further up. Volume runs RIGHT from the spine, except on a
        // profile docked to the right where it runs left instead; a daily's
        // delta half runs left from the spine when it is not docked. Whichever
        // reaches furthest left is the back an incoming level must stop at.
        const bodyReachesLeftBy = facesLeft
          ? profileWidth
          : style.mode !== "volume" && style.showDelta && !pinned
            ? deltaScaleWidth
            : 0;
        drawnBackXById.set(model.id, anchorX - bodyReachesLeftBy);
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
          const deltaWidth = resolveDeltaBarWidth({
            mode: style.mode,
            delta,
            volume,
            profileWidth,
            deltaScaleWidth,
            deltaScaleMaximum,
          });
          // Which side this row's delta bar is drawn on. Declared here so the
          // POC highlight below traces the same side the bar was drawn on.
          const deltaOnRight = delta >= 0 && !facesLeft;
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
              facesLeft ? anchorX - volumeWidth : anchorX,
              y,
              volumeWidth,
              height,
              facesLeft ? "left" : "right",
            );
            if (style.showProfileOutline && height >= 2.2) {
              const radius = Math.min(2.25, height / 2, volumeWidth / 2);
              outlinePath.roundRect(
                facesLeft ? anchorX - volumeWidth : anchorX,
                y,
                volumeWidth,
                height,
                facesLeft ? [radius, 0, 0, radius] : [0, radius, radius, 0],
              );
            }
            if (style.mode !== "volume" && style.showDelta) {
              // Delta normally sits BEHIND the volume half, on the opposite
              // side of the spine. Docked to the screen edge there is no room
              // for it there, and it used to be dropped entirely — so choosing
              // "Delta and total volume" appeared to lose the delta the moment
              // the profile docked. It now draws INSIDE the volume bar,
              // sharing its baseline and bounded by its width, so the reading
              // survives the dock instead of disappearing with it.
              const insideDock = volumeOnlyPinnedDaily;
              const barWidth = insideDock
                ? Math.max(0.5, Math.min(deltaWidth, volumeWidth))
                : deltaWidth;
              const sideAnchored = pinned && !splitPinnedDaily;
              addBar(
                delta >= 0 ? positiveDeltaPath : negativeDeltaPath,
                insideDock
                  ? facesLeft ? anchorX - barWidth : anchorX
                  : sideAnchored
                    ? facesLeft ? anchorX - deltaWidth : anchorX
                    : anchorX - deltaWidth,
                // Inset so the delta reads as a bar within the volume rather
                // than replacing it.
                y + Math.min(height * 0.22, 2),
                barWidth,
                Math.max(1, height - Math.min(height * 0.44, 4)),
                insideDock || sideAnchored
                  ? facesLeft ? "left" : "right"
                  : "left",
              );
            }
          } else if (style.mode === "bid-ask") {
            addBar(
              askVolumePath,
              facesLeft ? anchorX - askWidth : anchorX,
              y,
              askWidth,
              height,
              facesLeft ? "left" : "right",
            );
            addBar(
              bidVolumePath,
              pinned && !splitPinnedDaily
                ? facesLeft ? anchorX - bidWidth : anchorX
                : anchorX - bidWidth,
              y,
              bidWidth,
              height,
              pinned && !splitPinnedDaily
                ? facesLeft ? "left" : "right"
                : "left",
            );
          } else if (style.showDelta) {
            addBar(
              delta >= 0 ? positiveDeltaPath : negativeDeltaPath,
              pinned && !splitPinnedDaily
                ? facesLeft ? anchorX - deltaWidth : anchorX
                : deltaOnRight ? anchorX : anchorX - deltaWidth,
              y,
              deltaWidth,
              height,
              pinned && !splitPinnedDaily
                ? facesLeft ? "left" : "right"
                : deltaOnRight ? "right" : "left",
            );
          }

          if (style.showPocHighlight && isPoc) {
            // The highlight traces the row it highlights, so it must follow
            // where that row's bars were actually drawn. In volume mode the
            // delta bar sits on the RIGHT whenever delta is positive, but the
            // highlight always added its width to the LEFT — painting a bar
            // out of the back of the profile with nothing underneath it, over
            // whatever the trader has behind (a delta footprint, usually).
            const deltaExtent = style.showDelta && !volumeOnlyPinnedDaily ? deltaWidth : 0;
            const leftExtent = style.mode === "bid-ask"
              ? bidWidth
              : (style.mode === "delta" || style.mode === "delta-percentage")
                ? delta < 0 ? deltaWidth : 0
                : deltaOnRight ? 0 : deltaExtent;
            const rightExtent = style.mode === "bid-ask"
              ? askWidth
              : (style.mode === "delta" || style.mode === "delta-percentage")
                ? delta >= 0 ? deltaWidth : 0
                : Math.max(volumeWidth, deltaOnRight ? deltaExtent : 0);
            addBar(
              pocPath,
              pinned
                ? facesLeft ? anchorX - Math.max(leftExtent, rightExtent) : anchorX
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
        // A gradient scheme IS the profile's colour setting, so the levels
        // drawn off it have to follow, or a yellow POC and blue value area
        // sit on a pink-to-blue profile looking like a different study.
        // POC takes the scheme's high end; the value area is mostly that end
        // pulled toward the low one, which keeps the two distinguishable
        // without letting either land on an unreadable colour the way using
        // the raw endpoints would on black-to-white.
        const levelPocColor = style.gradient ? style.gradient.to : style.pocColor;
        const levelValueAreaColor = style.gradient
          ? mixHexColors(style.gradient.to, style.gradient.from, 0.35)
          : style.valueAreaColor;
        if (style.visualStyle === "line" && outlineSteps.length) {
          // Walk the rows in price order, stepping out to each row's width and
          // then along to the next — the same shape the filled profile makes,
          // drawn as a single continuous edge.
          const ordered = [...outlineSteps].sort((left, right) => left.y - right.y);
          const direction = facesLeft ? -1 : 1;
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
            context.strokeStyle = levelValueAreaColor;
            context.lineWidth = 0.35;
            context.stroke(outlinePath);
          }
          if (style.showPocHighlight) {
            const pocHighlightAlpha = Math.min(1, Math.max(0.02, Number(style.pocHighlightOpacity ?? 72) / 100));
            fillPath(pocPath, levelPocColor, pocHighlightAlpha, style.visualStyle, style.borderWidth);
          }
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
          context.textAlign = facesLeft ? "right" : "left";
          context.textBaseline = "alphabetic";
          const measured = context.measureText(sessionLabel).width;
          const labelX = clamp(
            facesLeft ? anchorX - 2 : anchorX + 2,
            leftEdge + (facesLeft ? measured + 4 : 4),
            mediaSize.width - (facesLeft ? 4 : measured + 4),
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
          let lineEndX = resolveLevelChainEndX();
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
        const developingStartMs = Number(style.developingPocStartMs ?? 0);
        const withinDevelopingWindow = <T extends { timestamp: number }>(trail: readonly T[]) => (
          developingStartMs > 0
            ? trail.filter((point) => point.timestamp >= developingStartMs)
            : trail
        );
        const drawDevelopingTrail = (
          trail: readonly { timestamp: number; price: number }[],
          colour: string,
          width: number,
          dash: number[] = [],
          alpha = 0.7,
        ) => {
          if (trail.length < 2) return;
          context.globalAlpha = alpha;
          context.strokeStyle = colour;
          context.lineWidth = Math.max(0.5, width);
          context.setLineDash(dash);
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
        };

        if (style.showDevelopingPoc && profile.developingPoc.length > 1) {
          /*
           * Grouped to the trader's shift size before it is drawn.
           *
           * Floored to the same grid the rows use, so a step in the trail lands
           * on a row boundary rather than between two of them. A grouping of 1
           * is the identity, which is the untouched behaviour.
           */
          const shiftTicks = Math.max(1, Math.round(Number(style.shiftedPocTicks ?? 1)));
          const trail = withinDevelopingWindow(profile.developingPoc);
          const grouped = shiftTicks > 1
            ? trail.map((point) => ({
              timestamp: point.timestamp,
              price: volumeProfileBinTick(
                Math.round(point.price / profile.tickSize), shiftTicks,
              ) * profile.tickSize,
            }))
            : trail;
          drawDevelopingTrail(
            grouped,
            style.pocColor,
            Number(style.pocLineWidth ?? 1),
            [],
            Math.min(1, Math.max(0.02, Number(style.shiftedPocOpacity ?? 70) / 100)),
          );
        }
        /*
         * Developing value area: both edges as they widened through the
         * session. Two trails rather than a filled band - a fill would sit
         * over the histogram it is measuring, and the edges are what a trader
         * reads against.
         *
         * Only the live top-up records these, so a historical-only profile has
         * none and this honestly draws nothing rather than interpolating a
         * shape from the finished value area.
         */
        if (
          style.developingValueArea
          && style.developingValueArea !== "no"
          && (profile.developingValueArea?.length ?? 0) > 1
        ) {
          const trail = withinDevelopingWindow(profile.developingValueArea ?? []);
          const width = Number(style.valueAreaLineWidth ?? 1);
          const dash = style.developingValueArea === "dash" ? [3, 3] : [];
          for (const edge of ["vah", "val"] as const) {
            drawDevelopingTrail(
              trail.map((point) => ({ timestamp: point.timestamp, price: point[edge] })),
              levelValueAreaColor,
              width,
              dash,
            );
          }
          context.setLineDash([]);
        }
        // Queued rather than drawn: see deferredLevelDraws. This also puts
        // every level above every body, so a profile drawn later can no longer
        // paint over an earlier profile's POC and value area.
        if (style.showPocLine || style.showValueAreaLines) {
          deferredLevelDraws.push(() => {
            if (style.showPocLine) {
              drawLevel(groupedPoc, levelPocColor, [2, 3], "POC", style.pocLineWidth);
            }
            if (style.showValueAreaLines) {
              drawLevel(groupedVah, levelValueAreaColor, [3, 3], "VAH", style.valueAreaLineWidth);
              drawLevel(groupedVal, levelValueAreaColor, [3, 3], "VAL", style.valueAreaLineWidth);
            }
          });
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

      // Every body is placed, so each level now knows exactly where the
      // profile in front was painted and can stop at its back edge. Drawing
      // them here also lifts every level above every body, so a profile drawn
      // later cannot paint over an earlier profile's POC or value area.
      for (const drawDeferredLevel of deferredLevelDraws) {
        context.save();
        // Each level sets the styling it needs, but not alpha, and the row
        // painting above leaves that wherever it finished.
        context.globalAlpha = 1;
        drawDeferredLevel();
        context.restore();
      }

      context.restore();
    });
  }
}
