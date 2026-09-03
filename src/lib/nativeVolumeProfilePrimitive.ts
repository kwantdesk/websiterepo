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
  groupVolumeProfileLevels,
  STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  volumeProfileBinTick,
} from "@/lib/volumeProfileMath";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type VolumeProfileBodySpan = {
  id: string;
  root: string;
  startMs: number;
  leftX: number;
  rightX: number;
};

export type VolumeProfileLabelBox = {
  id: string;
  preferredLeft: number;
  preferredTop: number;
  width: number;
  height: number;
};

/**
 * Keep every enabled profile label inside the pane and out of labels already
 * placed there. Profiles frequently share a high (or dock to the same edge),
 * so drawing all captions at their raw top coordinate makes later text paint
 * directly over earlier text and appear to replace it.
 */
export function placeVolumeProfileLabelBoxes(
  candidates: readonly VolumeProfileLabelBox[],
  bounds: { left: number; top: number; right: number; bottom: number },
): Array<VolumeProfileLabelBox & { left: number; top: number }> {
  const placed: Array<VolumeProfileLabelBox & { left: number; top: number }> = [];
  for (const candidate of candidates) {
    const width = Math.max(1, Math.min(candidate.width, Math.max(1, bounds.right - bounds.left)));
    const height = Math.max(1, Math.min(candidate.height, Math.max(1, bounds.bottom - bounds.top)));
    const left = clamp(candidate.preferredLeft, bounds.left, Math.max(bounds.left, bounds.right - width));
    const preferredTop = clamp(candidate.preferredTop, bounds.top, Math.max(bounds.top, bounds.bottom - height));
    const step = Math.max(3, height + 2);
    const maximumSteps = Math.max(1, Math.ceil((bounds.bottom - bounds.top) / step));
    let top = preferredTop;
    for (let distance = 0; distance <= maximumSteps; distance += 1) {
      const offsets = distance === 0 ? [0] : [distance * step, -distance * step];
      const available = offsets.find((offset) => {
        const trialTop = clamp(
          preferredTop + offset,
          bounds.top,
          Math.max(bounds.top, bounds.bottom - height),
        );
        return !placed.some((other) => (
          left < other.left + other.width + 2
          && left + width + 2 > other.left
          && trialTop < other.top + other.height + 2
          && trialTop + height + 2 > other.top
        ));
      });
      if (available !== undefined) {
        top = clamp(
          preferredTop + available,
          bounds.top,
          Math.max(bounds.top, bounds.bottom - height),
        );
        break;
      }
    }
    placed.push({ ...candidate, width, height, left, top });
  }
  return placed;
}

/**
 * Resolve only the visible, forward section of a profile level.
 *
 * A chronologically later profile body is opaque geometry for level purposes:
 * the line stops flush at its back edge and is never painted through it. An
 * older body that happens to be docked or offset to the right cannot truncate
 * the newest profile. If a later body already covers the source profile's
 * front edge there is no honest line segment to draw.
 */
export function forwardVolumeProfileLevelSegment(
  sourceId: string,
  root: string,
  sourceFrontX: number,
  rightEdge: number,
  bodies: readonly VolumeProfileBodySpan[],
): { startX: number; endX: number } | null {
  if (!Number.isFinite(sourceFrontX) || !Number.isFinite(rightEdge) || rightEdge <= sourceFrontX) {
    return null;
  }
  const source = bodies.find((body) => body.id === sourceId && body.root === root);
  if (!source || !Number.isFinite(source.startMs)) return null;
  let endX = rightEdge;
  for (const body of bodies) {
    if (body.id === sourceId || body.root !== root) continue;
    if (!Number.isFinite(body.startMs) || body.startMs <= source.startMs) continue;
    const leftX = Math.min(body.leftX, body.rightX);
    const bodyRightX = Math.max(body.leftX, body.rightX);
    if (!Number.isFinite(leftX) || !Number.isFinite(bodyRightX) || bodyRightX <= sourceFrontX) continue;
    // The source edge is already underneath another profile: draw no line,
    // rather than reversing it out of the back toward the left side.
    const stopX = Math.max(sourceFrontX, leftX);
    if (stopX < endX) endX = stopX;
  }
  return endX > sourceFrontX + 0.5 ? { startX: sourceFrontX, endX } : null;
}

export type VolumeProfileInteractionBar = {
  timestamp: number;
  high: number;
  low: number;
};

/**
 * First later real bar that trades through a profile level.
 *
 * DeepCharts calls this "Till interaction". Touching the level with either
 * wick counts; using closes would leave already-tested auction levels on the
 * chart and using nearest-price tolerances would stop them before a trade
 * actually occurred.
 */
export function firstVolumeProfileLevelInteraction(
  price: number,
  bars: readonly VolumeProfileInteractionBar[],
): VolumeProfileInteractionBar | null {
  for (const bar of bars) {
    if (
      Number.isFinite(bar.timestamp)
      && Number.isFinite(bar.low)
      && Number.isFinite(bar.high)
      && bar.low <= price
      && bar.high >= price
    ) return bar;
  }
  return null;
}

/**
 * Return the screen-space front edge of the row that owns a profile level.
 *
 * A profile's configured width is only the maximum available width. Most rows
 * are shorter, so starting every VAH/VAL/POC line at `anchor + profileWidth`
 * leaves the line floating in empty space. This mirrors the actual row paths
 * below and connects each level to the histogram that produced it.
 */
export function volumeProfileLevelFrontX(input: {
  anchorX: number;
  facesLeft: boolean;
  pinned: boolean;
  splitPinnedDaily: boolean;
  visualStyle: "automatic" | "solid" | "hollow" | "line" | "combined";
  mode: "volume" | "delta-volume" | "bid-ask" | "delta" | "delta-percentage";
  deltaOnRight: boolean;
  volumeWidth: number;
  deltaWidth: number;
  askWidth: number;
  bidWidth: number;
}): number {
  const {
    anchorX,
    facesLeft,
    pinned,
    splitPinnedDaily,
    visualStyle,
    mode,
    deltaOnRight,
    volumeWidth,
    deltaWidth,
    askWidth,
    bidWidth,
  } = input;
  if (facesLeft) return anchorX;
  if (visualStyle === "line") return anchorX + volumeWidth;
  if (mode === "volume") return anchorX + volumeWidth;
  if (mode === "delta-volume") {
    return anchorX + (
      pinned && !splitPinnedDaily
        ? Math.max(volumeWidth, deltaWidth)
        : volumeWidth
    );
  }
  if (mode === "bid-ask") {
    return anchorX + (
      pinned && !splitPinnedDaily
        ? Math.max(askWidth, bidWidth)
        : askWidth
    );
  }
  return anchorX + (pinned && !splitPinnedDaily || deltaOnRight ? deltaWidth : 0);
}

export type VolumeProfileLeftDockCandidate = {
  id: string;
  root: string;
  anchorMs: number;
  endMs: number;
  anchorX: number | null;
  snapMode: "off" | "left" | "right";
};

/**
 * Pick the single profile that owns each instrument's left dock.
 *
 * Ownership follows the stable session anchor, which is the order profiles
 * physically cross the viewport. `endMs` is only a deterministic tie-breaker:
 * live coverage and old cached profiles may extend it, so it must never make
 * an older profile retain the dock after a newer one has crossed.
 */
export function resolveVolumeProfileLeftDockOwners(
  candidates: readonly VolumeProfileLeftDockCandidate[],
  leftEdge: number,
): Map<string, string> {
  const owners = new Map<string, VolumeProfileLeftDockCandidate>();
  for (const candidate of candidates) {
    if (candidate.snapMode !== "left") continue;
    if (candidate.anchorX == null || candidate.anchorX >= leftEdge + 2) continue;
    const current = owners.get(candidate.root);
    if (
      !current
      || candidate.anchorMs > current.anchorMs
      || (candidate.anchorMs === current.anchorMs && candidate.endMs > current.endMs)
      || (
        candidate.anchorMs === current.anchorMs
        && candidate.endMs === current.endMs
        && candidate.id.localeCompare(current.id) > 0
      )
    ) {
      owners.set(candidate.root, candidate);
    }
  }
  return new Map([...owners].map(([root, owner]) => [root, owner.id]));
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

/** Resolve the four DeepCharts Width type contracts without conflating units. */
export function resolveVolumeProfileWidth({
  mode,
  value,
  paneWidth,
  sessionWidth,
  visibleLogicalSpan,
  automaticWidth,
}: {
  mode: "automatic" | "period-percent" | "window-percent" | "bars";
  value: number;
  paneWidth: number;
  sessionWidth: number;
  visibleLogicalSpan: number | null;
  automaticWidth: number | null;
}) {
  const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
  if (mode === "period-percent") return Math.max(0, sessionWidth) * safeValue / 100;
  if (mode === "window-percent") return Math.max(0, paneWidth) * safeValue / 100;
  if (mode === "bars") {
    return visibleLogicalSpan != null && Number.isFinite(visibleLogicalSpan) && visibleLogicalSpan > 0
      ? Math.max(0, paneWidth) * safeValue / visibleLogicalSpan
      : null;
  }
  return automaticWidth;
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
  widthBasis: "automatic" | "period-percent" | "window-percent" | "bars";
  widthPercent: number;
  /**
   * DeepChart's Plot Width/Offset tab: the CURRENT profile and the completed
   * ones behind it are sized and nudged independently.
   *
   * `widthPercent` is the current profile's width and stays the fallback for
   * both, so a chart that has never touched these draws exactly as it did.
   * Offsets are in pixels and shift a profile along the time axis - what a desk
   * uses to lift the live profile clear of the bars it is measuring.
   */
  previousWidthPercent?: number;
  currentOffsetPx?: number;
  previousOffsetPx?: number;
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
  /** DeepCharts line-extension contract. */
  pocExtensionMode?: "none" | "until-first-interaction" | "to-window-end";
  /** Trace the POC as it migrated through the session. */
  showDevelopingPoc?: boolean;
  /** Raw developing movement or DeepCharts' tick-grouped shifted movement. */
  developingPocMode?: "developing" | "extend-shifted";
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
  valueAreaExtensionMode?: "none" | "until-first-interaction" | "to-window-end";
  /** Peak and Valley tab. Peaks are high-volume nodes, valleys low-volume ones. */
  showPeaks?: boolean;
  showValleys?: boolean;
  peakColor?: string;
  valleyColor?: string;
  peakLineWidth?: number;
  valleyLineWidth?: number;
  peakExtensionMode?: "none" | "until-first-interaction" | "to-window-end";
  valleyExtensionMode?: "none" | "until-first-interaction" | "to-window-end";
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
  vwapExtensionMode?: "none" | "until-first-interaction" | "to-window-end";
  vwapDash?: number[];
  /** Standard deviations to draw as envelopes around VWAP. */
  vwapBandDeviations?: number[];
  vwapBandColor?: string;
  /** Dash pattern shared by the level lines, from the Line style dropdown. */
  levelDash?: number[];
  /** Name the POC and value area on the plot, the way IB levels are named. */
  showLevelLabels?: boolean;
  /** Which end of the level line the label sits at. */
  levelLabelSide?: "right" | "left";
  /** Print the level's price beside its name. */
  showLevelLabelPrice?: boolean;
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
  /** Later real candles used to stop "Till interaction" at the first touch. */
  laterBars?: readonly VolumeProfileInteractionBar[];
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

      const latestDailyEndMs = this.models.reduce((latestEndMs, model) => {
        const { profile } = model;
        if (profile.period !== "daily") return latestEndMs;
        return Math.max(latestEndMs, profile.endMs);
      }, Number.NEGATIVE_INFINITY);
      // The newest profile of each kind, per instrument, for RIGHT docking.
      //
      // Right docking keeps the CURRENT profile reachable at the live edge.
      // Left docking has separate viewport-crossing ownership below.
      const latestEndMsByKind = new Map<string, number>();
      for (const model of this.models) {
        const kind = `${model.profile.period}:${model.profile.root}`;
        latestEndMsByKind.set(
          kind,
          Math.max(latestEndMsByKind.get(kind) ?? Number.NEGATIVE_INFINITY, model.profile.endMs),
        );
      }

      // Which profile owns the LEFT dock, per instrument.
      //
      // Daily and weekly used to own separate docks at the same two pixels,
      // then a special case hid whichever daily happened to collide with the
      // weekly. That is the random/stuck profile: the visible winner was not
      // the next profile to cross. One physical dock has one owner.
      const leftDockOwners = resolveVolumeProfileLeftDockOwners(
        this.models.map((model) => {
          const anchorMs = model.drawingBounds?.startTime != null
            ? model.drawingBounds.startTime * 1_000
            : model.profile.startMs;
          return {
            id: model.id,
            root: model.profile.root,
            anchorMs,
            endMs: model.profile.endMs,
            anchorX: this.timeToCoordinate(model, anchorMs / 1_000),
            snapMode: model.style.snapMode,
          };
        }),
        leftEdge,
      );
      const ownsLeftDock = (model: NativeVolumeProfileModel) =>
        leftDockOwners.get(model.profile.root) === model.id;

      // Exact screen-space body spans. Level occlusion is a visual rule, so it
      // must use where every body was actually painted — including docked,
      // right-facing, weekly and overlapping session profiles — rather than a
      // time-only guess at where its spine ought to be.
      const drawnBodySpans = new Map<string, VolumeProfileBodySpan>();
      // Level lines are drawn after every body has been placed. Within one
      // pass a profile can only see the geometry of models drawn before it,
      // and the profile in front is frequently drawn after. Deferral makes
      // every body's exact back edge available before any line is clipped.
      const deferredLevelDraws: Array<() => void> = [];
      const deferredProfileText: Array<{
        box: VolumeProfileLabelBox;
        draw: (left: number, top: number) => void;
      }> = [];

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
        const profileVerticallyVisible = !(model.highPrice < visibleLow || model.lowPrice > visibleHigh);
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
        // Keep the current left-dock owner visible when its session open has
        // moved off the left edge. The old renderer only pinned once
        // the *entire* session was off-screen, so a cash-session viewport had
        // real profile data loaded but drew every bar beyond the canvas.
        const autoPinnedDailyLeft = profile.period === "daily"
          && sessionAnchorX < leftEdge + 2
          && ownsLeftDock(model);
        const latestDailyProfile = profile.period === "daily"
          && profile.endMs === latestDailyEndMs;
        // Right docking is reserved for the newest profile of this kind.
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
        /*
         * DeepChart's Vbp offset, in pixels along the time axis.
         *
         * Applied to a profile sitting at its own session anchor only. A docked
         * profile is deliberately pinned to a screen edge and a fixed-range one
         * is deliberately at the trader's own anchors; nudging either would move
         * it off the thing it was pinned to.
         */
        const profileOffsetPx = customProfile || pinned
          ? 0
          : Number((isNewestOfKind ? style.currentOffsetPx : style.previousOffsetPx) ?? 0);
        const rawAnchorX = (customProfile
          ? (customLeft + customRight) / 2
          : pinned
          ? pinnedRight ? rightEdge - 2 : leftEdge + 2
          : facesLeft ? sessionEndX : sessionAnchorX) + profileOffsetPx;
        const endX = (customProfile
          ? customRight
          : pinned
          ? pinnedRight ? leftEdge : rightEdge
          : sessionEndX) + profileOffsetPx;

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
        /*
         * Current and Previous Width are independent in DeepCharts. Resolve
         * the active value before zoom conversion; the old order converted
         * every completed profile with the CURRENT width and made Previous
         * Width a saved control that did nothing on normal chart viewports.
         */
        const effectiveWidthPercent = isNewestOfKind
          ? style.widthPercent
          : Number(style.previousWidthPercent ?? style.widthPercent);
        const visibleLogicalSpan = visibleLogicalRange == null
          ? null
          : Math.abs(Number(visibleLogicalRange.to) - Number(visibleLogicalRange.from));
        const automaticWidth = visibleLogicalRange == null || model.intervalSeconds == null
          ? null
          : zoomScaledVolumeProfileWidth({
              paneWidth: usablePaneWidth,
              visibleLogicalFrom: Number(visibleLogicalRange.from),
              visibleLogicalTo: Number(visibleLogicalRange.to),
              referenceLogicalBars: customProfile
                ? durationLogicalBars ?? CHART_PROFILE_REFERENCE_BARS
                : CHART_PROFILE_REFERENCE_BARS,
              widthPercent: effectiveWidthPercent,
            });
        const resolvedModeWidth = resolveVolumeProfileWidth({
          mode: style.widthBasis,
          value: effectiveWidthPercent,
          paneWidth: usablePaneWidth,
          sessionWidth,
          visibleLogicalSpan,
          automaticWidth,
        });
        /*
         * A completed profile may be drawn narrower than the live one, which is
         * how DeepChart separates "what is forming" from "what is settled".
         */
        const profileWidth = resolvedModeWidth
          ?? (effectiveWidthPercent <= 0
            ? 0
            : Math.min(
                usablePaneWidth * MAX_PROFILE_PANE_FRACTION,
                Math.max(
                  Math.min(
                    PROFILE_MIN_READABLE_WIDTH_PX,
                    usablePaneWidth * MAX_PROFILE_PANE_FRACTION,
                  ),
                  sessionWidth * effectiveWidthPercent / 100,
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
          // Group whenever the row requested by the trader is coarser than
          // the data that arrived. The old condition looked only at the
          // zoom-driven multiplier. In manual 4-tick mode that multiplier is
          // normally 1, so four single-tick rows were painted on top of one
          // another at a four-tick height while POC/VAH/VAL were calculated
          // from real four-tick bins. The picture and its levels therefore
          // described different profiles.
          const levels = groupedTicks === profile.groupTicks
            ? sourceLevels
            : groupVolumeProfileLevels(sourceLevels, profile.tickSize, groupedTicks);
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
        drawnBodySpans.set(model.id, {
          id: model.id,
          root: profile.root,
          startMs: model.drawingBounds?.startTime != null
            ? model.drawingBounds.startTime * 1_000
            : profile.startMs,
          leftX: anchorX - bodyReachesLeftBy,
          // Levels always travel forward on screen from the rightmost point
          // the source profile can paint. This prevents right-facing and
          // docked profiles from emitting a line out of their back.
          rightX: anchorX + (facesLeft ? 0 : profileWidth),
        });
        // Even when this profile's traded price range is above or below the
        // viewport, its session body still owns the horizontal boundary. Keep
        // the span in the chain, then skip only its paint work. Otherwise a
        // visible older VAH/VAL can blow straight through the hidden session.
        if (!profileVerticallyVisible) continue;
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
        const levelFrontRows: Array<{ price: number; frontX: number }> = [];
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
          levelFrontRows.push({
            price: level.price,
            frontX: volumeProfileLevelFrontX({
              anchorX,
              facesLeft,
              pinned,
              splitPinnedDaily,
              visualStyle: style.visualStyle ?? "automatic",
              mode: style.mode,
              deltaOnRight,
              volumeWidth,
              deltaWidth,
              askWidth,
              bidWidth,
            }),
          });
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
        const bodySpan = drawnBodySpans.get(model.id);
        const profileTop = top == null || bottom == null ? null : Math.min(top, bottom);
        const profileBottom = top == null || bottom == null ? null : Math.max(top, bottom);
        const sessionLabelVisible = style.showLevelLabels !== false
          && profile.sessionLabel
          && top != null
          && bottom != null
          && bodySpan != null
          && Math.max(bodySpan.leftX, bodySpan.rightX) > leftEdge
          && Math.min(bodySpan.leftX, bodySpan.rightX) < rightEdge
          && profileBottom != null
          && profileTop != null
          && profileBottom > 0
          && profileTop < mediaSize.height;
        if (sessionLabelVisible && profile.sessionLabel && top != null && bottom != null) {
          const sessionLabel = profile.sessionLabel;
          context.font = "600 9px 'JetBrains Mono', monospace";
          const measured = context.measureText(sessionLabel).width;
          deferredProfileText.push({
            box: {
              id: `${model.id}:session`,
              preferredLeft: facesLeft ? anchorX - measured - 2 : anchorX + 2,
              preferredTop: Math.min(top, bottom) - 13,
              width: measured,
              height: 11,
            },
            draw: (left, labelTop) => {
              context.globalAlpha = 0.92;
              context.font = "600 9px 'JetBrains Mono', monospace";
              context.textAlign = "left";
              context.textBaseline = "top";
              context.fillStyle = style.pocColor;
              context.fillText(sessionLabel, left, labelTop);
            },
          });
        }

        const drawLevel = (
          price: number | null,
          color: string,
          dash: number[],
          label: string | null,
          lineWidth?: number,
          extensionMode: "none" | "until-first-interaction" | "to-window-end" = "to-window-end",
        ) => {
          if (price == null) return;
          const y = params.series.priceToCoordinate(price);
          if (y == null) return;
          // VAH, VAL and POC obey one spatial contract: start at the source
          // profile's front, finish flush with the next chronological profile,
          // and let the newest profile reach the pane edge. Candle interaction
          // must not shorten these structural session levels.
          const sourceBody = drawnBodySpans.get(model.id);
          if (!sourceBody) return;
          const sourceFrontX = levelFrontRows.reduce<{ price: number; frontX: number } | null>(
            (nearest, row) => (
              nearest == null || Math.abs(row.price - price) < Math.abs(nearest.price - price)
                ? row
                : nearest
            ),
            null,
          )?.frontX ?? (facesLeft ? anchorX : sourceBody.rightX);
          const lineSegment = forwardVolumeProfileLevelSegment(
            model.id,
            profile.root,
            sourceFrontX,
            rightEdge,
            [...drawnBodySpans.values()],
          );
          let lineEndX = lineSegment?.endX ?? sourceFrontX;
          if (extensionMode === "none") {
            lineEndX = sourceFrontX;
          } else if (extensionMode === "until-first-interaction" && lineSegment) {
            const touched = firstVolumeProfileLevelInteraction(price, model.laterBars ?? []);
            if (touched) {
              const touchX = this.timeToCoordinate(model, Math.floor(touched.timestamp / 1000));
              if (touchX != null && touchX > sourceFrontX) lineEndX = Math.min(lineEndX, touchX);
            }
          }
          if (lineSegment && lineEndX > sourceFrontX + 0.5) {
            context.globalAlpha = 0.82;
            context.strokeStyle = color;
            context.lineWidth = Math.max(0.5, Number.isFinite(lineWidth) ? Number(lineWidth) : 1);
            context.setLineDash(style.levelDash ?? dash);
            context.beginPath();
            context.moveTo(lineSegment.startX, y);
            context.lineTo(lineEndX, y);
            context.stroke();
          }
          // Named levels, matching how IB levels are labelled: the name and its
          // price at the line's terminus, which for a forward level is the
          // screen edge. Left keeps them beside the profile that produced them.
          if (style.showLevelLabels !== false && label) {
            const labelText = style.showLevelLabelPrice === false
              ? label
              : `${label} ${price.toFixed(pricePrecision)}`;
            context.font = "700 9px 'JetBrains Mono', monospace";
            const measured = context.measureText(labelText).width;
            const labelY = Math.max(11, Math.min(mediaSize.height - 3, y - 3));
            const labelOnLeft = (style.levelLabelSide ?? "right") === "left";
            // Where the label naturally belongs: at the line's own terminus.
            const naturalX = labelOnLeft
              ? sourceFrontX + 5
              : lineEndX - 5;
            deferredProfileText.push({
              box: {
                id: `${model.id}:${label}:${price}`,
                preferredLeft: labelOnLeft ? naturalX : naturalX - measured,
                preferredTop: labelY - 11,
                width: measured,
                height: 11,
              },
              draw: (left, top) => {
                context.globalAlpha = 0.9;
                context.fillStyle = color;
                context.font = "700 9px 'JetBrains Mono', monospace";
                context.textAlign = "left";
                context.textBaseline = "top";
                context.fillText(labelText, left, top);
              },
            });
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
          const grouped = style.developingPocMode === "extend-shifted" && shiftTicks > 1
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
        // Queued rather than drawn: see deferredLevelDraws. The queue has the
        // geometry of every visible body, so each segment can terminate at
        // the nearest back edge and none is painted through a histogram.
        if (style.showPocLine || style.showValueAreaLines) {
          deferredLevelDraws.push(() => {
            if (style.showPocLine) {
              drawLevel(groupedPoc, levelPocColor, [2, 3], "POC", style.pocLineWidth, style.pocExtensionMode);
            }
            if (style.showValueAreaLines) {
              drawLevel(groupedVah, levelValueAreaColor, [3, 3], "VAH", style.valueAreaLineWidth, style.valueAreaExtensionMode);
              drawLevel(groupedVal, levelValueAreaColor, [3, 3], "VAL", style.valueAreaLineWidth, style.valueAreaExtensionMode);
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
              const businessLineWidth = Math.max(0, style.businessZoneLineWidth ?? 0);
              if (businessLineWidth > 0) {
                context.globalAlpha = 0.7;
                context.strokeStyle = style.businessZoneColor ?? style.valueAreaColor;
                context.lineWidth = businessLineWidth;
                context.setLineDash([4, 3]);
                context.strokeRect(
                  Math.min(anchorX, endX),
                  zoneTop,
                  Math.abs(endX - anchorX),
                  Math.max(1, zoneHeight),
                );
              }
            }
          }
          if (style.showPeaks) {
            for (const peak of structure.peaks) {
              drawLevel(peak.price, style.peakColor ?? style.positiveDeltaColor, [1, 2], "PEAK", style.peakLineWidth, style.peakExtensionMode);
            }
          }
          if (style.showValleys) {
            for (const valley of structure.valleys) {
              drawLevel(valley.price, style.valleyColor ?? style.negativeDeltaColor, [1, 2], "VLY", style.valleyLineWidth, style.valleyExtensionMode);
            }
          }
        }

        // VWAP of this profile, with optional standard-deviation envelopes.
        if (style.showVwap) {
          const vwap = calculateVolumeProfileVwap(levels, style.vwapBandDeviations ?? []);
          if (vwap.vwap !== null) {
            drawLevel(vwap.vwap, style.vwapColor ?? style.pocColor, style.vwapDash ?? [6, 3], "VWAP", style.vwapLineWidth, style.vwapExtensionMode);
            for (const band of vwap.bands) {
              const bandColor = style.vwapBandColor ?? style.vwapColor ?? style.pocColor;
              drawLevel(band.upper, bandColor, [2, 4], null, style.vwapLineWidth, style.vwapExtensionMode);
              drawLevel(band.lower, bandColor, [2, 4], null, style.vwapLineWidth, style.vwapExtensionMode);
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
          context.font = "600 8px 'JetBrains Mono', monospace";
          const summaryWidth = Math.max(1, ...lines.map((line) => context.measureText(line.text).width));
          const summaryLeft = Math.min(anchorX, endX) + 4;
          const summaryTop = (profileTop ?? 0) + 4;
          deferredProfileText.push({
            box: {
              id: `${model.id}:summary`,
              preferredLeft: summaryLeft,
              preferredTop: summaryTop,
              width: summaryWidth,
              height: Math.max(10, lines.length * 10),
            },
            draw: (left, top) => {
              context.globalAlpha = 0.9;
              context.font = "600 8px 'JetBrains Mono', monospace";
              context.textAlign = "left";
              context.textBaseline = "top";
              lines.forEach((line, index) => {
                context.fillStyle = line.color;
                context.fillText(line.text, left, top + index * 10);
              });
            },
          });
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

      // Text is the final paint layer. No later profile body may cover a
      // caption, and labels sharing a high or dock are assigned stable lanes.
      const placedProfileText = placeVolumeProfileLabelBoxes(
        deferredProfileText.map((item) => item.box),
        { left: leftEdge + 4, top: 2, right: rightEdge - 4, bottom: mediaSize.height - 2 },
      );
      deferredProfileText.forEach((item, index) => {
        const placed = placedProfileText[index];
        if (!placed) return;
        context.save();
        item.draw(placed.left, placed.top);
        context.restore();
      });

      context.restore();
    });
  }
}
