export const TPO_CHART_INDICATOR_ID = "tpo-chart";
export const WEEKLY_TPO_INDICATOR_ID = "weekly-tpo";
export const TPO_SETTINGS_SCHEMA_VERSION = 2;

/**
 * Presentation keys reset once when a v1 TPO is loaded.
 *
 * v1 shipped the developing POC, the initial balance and single prints all ON
 * by default, so every TPO ever added carries them whether or not the trader
 * chose them — the developing POC drawing an orange staircase across the
 * profiles. These three are restored to the new defaults exactly once, on the
 * v1 -> v2 read. Every other saved value is preserved, and anything the trader
 * sets after that is theirs.
 */
export const TPO_V2_RESET_KEYS = [
  "showDevelopingPoc",
  "showInitialBalance",
  "showSinglePrints",
] as const;

export type TpoIndicatorVariant = "daily-tpo" | "weekly-tpo";
export type TpoVisitSource = "exact-trades" | "bar-range" | "automatic";
export type TpoDisplayType = "automatic" | "letters" | "blocks";
export type TpoSplitMode = "none" | "last" | "all";
export type TpoScheduleKind = "daily" | "weekly" | "generic-period" | "custom-range";
export type TpoPeriodMode = "all-loaded-bars" | "multiple-profiles" | "custom-range";
export type TpoLengthUnit = "minute" | "day" | "week" | "month";
export type TpoWidthMode = "automatic" | "period-percent" | "window-percent" | "fixed-bars";
/**
 * How far a TPO level or zone runs to the right. `to-next-profile` stops it
 * at the back of the profile in front, so a level never draws underneath the
 * session that superseded it.
 */
export type TpoExtensionMode =
  | "none"
  | "until-first-interaction"
  | "to-window-end"
  | "to-next-profile";
export type TpoFilterMode = "none" | "filter" | "split-two" | "split-three";
export type TpoSessionPreset = "rth" | "eth" | "custom";
export type TpoColourCalculation = "time" | "volume" | "delta";
export type TpoColourReference = "fixed" | "fading" | "multiple-ranges";
export type TpoBarMarkerStyle = "body" | "candle";
export type TpoPocLineMode = "none" | "final" | "developing" | "extend-shifted";

export interface TpoTrade {
  instrumentId: string;
  timestampMs: number;
  sequence?: number | string;
  price: number;
  size: number;
  aggressorSide: "buy" | "sell" | "unknown";
  tickSize: number;
}

export interface TpoBar {
  instrumentId: string;
  startTimeMs: number;
  endTimeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  bidVolume?: number;
  askVolume?: number;
  tradeCount?: number;
  tickSize: number;
}

export interface TpoIndicatorSettings {
  schemaVersion: number;
  indicatorVariant: TpoIndicatorVariant;
  scheduleKind: TpoScheduleKind;
  periodMode: TpoPeriodMode;
  lengthValue: number;
  lengthUnit: TpoLengthUnit;
  timezone: string;
  /**
   * Which venue's clock the session anchors were cut for. Stamped so a study
   * moved between an options underlying and a futures chart re-derives them
   * instead of keeping the other venue's day boundary.
   */
  tpoSessionFamily?: "cme" | "cash";
  dailyStartTime: string;
  dailyEndMode: "next-daily-start" | "explicit-time";
  dailyEndTime: string;
  enabledWeekdays: number[];
  weekStartDay: number;
  weekStartTime: string;
  weekEndMode: "next-week-start" | "explicit-day-time";
  weekEndDay: number;
  weekEndTime: string;
  weekLength: number;
  customStartMs: number | null;
  customEndMs: number | null;
  customEndFollowsLatest: boolean;
  subperiodMinutes: number;
  displayType: TpoDisplayType;
  /**
   * How a block is painted: filled, outlined, or reduced to the profile's
   * outer edge. Matches the volume profile's appearance control so the two
   * studies can be made to read the same way.
   */
  visualStyle: "solid" | "hollow" | "line";
  splitMode: TpoSplitMode;
  profileCount: number;
  visitSource: TpoVisitSource;
  groupingMode: "automatic" | "manual";
  ticksPerRow: number;
  autoTargetRows: number;
  autoGroupFactor: number;
  freezeActiveGrouping: boolean;
  valueAreaPercent: number;
  showPoc: boolean;
  showDevelopingPoc: boolean;
  showValueArea: boolean;
  showDevelopingValueArea: boolean;
  showInitialBalance: boolean;
  initialBalanceSubperiods: number;
  showSinglePrints: boolean;
  minimumSinglePrintTicks: number;
  /**
   * How many subperiod visits a price row may have and still count as a thin
   * print. 1 is the textbook single print; dragging it up reveals the thicker
   * low-volume shelves a trader can plainly see on the profile but which the
   * strict definition hides.
   */
  singlePrintMaxTpoCount: number;
  singlePrintQuality: number;
  // 0 keeps every single-print zone; dragging toward 100 keeps only the zones
  // with the LOWEST traded volume per tick — the true low-volume structural
  // extremes — and drops the noisy ones first.
  singlePrintVolumeSensitivity: number;
  includeExtremesInSinglePrints: boolean;
  showPeaks: boolean;
  showValleys: boolean;
  peakValleyRadius: number;
  peakMinimumProminence: number;
  /** 0-100 single control for peak/valley detection strength. */
  peakValleySensitivity: number;
  /** Never mark the profile's own extremes as a peak or valley. */
  peakValleyExcludeExtremes: boolean;
  showSummary: boolean;
  widthMode: TpoWidthMode;
  currentWidth: number;
  currentOffset: number;
  previousWidth: number;
  previousOffset: number;
  showOnRight: boolean;
  mirror: boolean;
  lockPosition: boolean;
  showAboveBars: boolean;
  opacityPercent: number;
  borderWidth: number;
  blockSize: number;
  blockGap: number;
  minimumTextSize: number;
  maximumTextSize: number;
  /**
   * Gradient scheme id, or "off". A scheme overrides every block colour and
   * fades the profile across its own price range, matching the schemes on the
   * volume profiles so a TPO and a VP on the same chart read as one system.
   */
  gradientPreset: string;
  colourCalculation: TpoColourCalculation;
  colourReference: TpoColourReference;
  fixedVolumeColor: string;
  fixedBidColor: string;
  fixedAskColor: string;
  range1Enabled: boolean;
  range1Minimum: number;
  range1VolumeColor: string;
  range1BidColor: string;
  range1AskColor: string;
  range2Enabled: boolean;
  range2Minimum: number;
  range2VolumeColor: string;
  range2BidColor: string;
  range2AskColor: string;
  range3Enabled: boolean;
  range3Minimum: number;
  range3VolumeColor: string;
  range3BidColor: string;
  range3AskColor: string;
  range4Enabled: boolean;
  range4Minimum: number;
  range4VolumeColor: string;
  range4BidColor: string;
  range4AskColor: string;
  initialAColorEnabled: boolean;
  initialAColor: string;
  initialBColorEnabled: boolean;
  initialBColor: string;
  initialCColorEnabled: boolean;
  initialCColor: string;
  initialDColorEnabled: boolean;
  initialDColor: string;
  colorOpenEnabled: boolean;
  openColor: string;
  colorCloseEnabled: boolean;
  closeColor: string;
  barMarkerEnabled: boolean;
  barMarkerStyle: TpoBarMarkerStyle;
  barMarkerWidth: number;
  barMarkerUpColor: string;
  barMarkerDownColor: string;
  barMarkerShowOpenClose: boolean;
  pocLineMode: TpoPocLineMode;
  pocHighlight: boolean;
  pocHighlightColor: string;
  pocLineColor: string;
  pocLineWidth: number;
  pocExtensionMode: TpoExtensionMode;
  developingPocStartOffset: number;
  shiftedPocTicks: number;
  pocGroupingOpacity: number;
  showPocPriceLabel: boolean;
  valueAreaHighlight: boolean;
  valueAreaHighlightInside: boolean;
  valueAreaOutsideColor: string;
  valueAreaShowLines: boolean;
  /**
   * Draw POC and value-area extensions on the newest profile only. A week of
   * TPOs each extending its own levels turns the chart into a grid; this keeps
   * them on the one still forming and silences the rest. Bodies are untouched.
   */
  recentLevelsOnly: boolean;
  valueAreaShowBackground: boolean;
  valueAreaBackgroundOpacity: number;
  valueAreaExtensionMode: TpoExtensionMode;
  valueAreaLineColor: string;
  valueAreaLineWidth: number;
  valueAreaShowLabels: boolean;
  singlePrintLineWidth: number;
  /** Minimum drop in TPO width against the surrounding rows for a step
   * down to be marked. 0 keeps only the strict single prints. */
  singlePrintStepDown: number;
  singlePrintExtensionMode: TpoExtensionMode;
  singlePrintFillZone: boolean;
  singlePrintFillOpacity: number;
  singlePrintShowLabel: boolean;
  singlePrintShowTestedState: boolean;
  initialBalanceStartSubperiod: number;
  initialBalanceShowHigh: boolean;
  initialBalanceShowLow: boolean;
  initialBalanceShowRangeLabel: boolean;
  initialBalanceShowExtensions: boolean;
  initialBalanceExtensionMultiples: string;
  initialBalanceLineColor: string;
  initialBalanceLineWidth: number;
  summaryLayout: "compact" | "full";
  summaryLocation: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  summaryShowVolume: boolean;
  summaryShowTrades: boolean;
  summaryShowBidAsk: boolean;
  summaryTextColor: string;
  summaryBackgroundColor: string;
  summaryBackgroundOpacity: number;
  summaryFontSize: number;
  filterMode: TpoFilterMode;
  sessionPreset: TpoSessionPreset;
  customSessionStart: string;
  customSessionEnd: string;
  /** Treat the session end as the start of the next trading day. */
  useEndSessionAsStartDay: boolean;
  inheritThemeColours: boolean;
  profileColor: string;
  pocColor: string;
  valueAreaColor: string;
  singlePrintColor: string;
  peakColor: string;
  valleyColor: string;
  allowDevelopingComposite: boolean;
  maximumMergeMembers: number;
  maximumRenderedBlocks: number;
  fpsCap: number;
}

export interface TpoSubperiod {
  id: string;
  profileId: string;
  index: number;
  startTimeMs: number;
  endTimeMs: number;
  marker: string;
  sessionSegment: number;
  openTick: number | null;
  highTick: number | null;
  lowTick: number | null;
  closeTick: number | null;
}

export interface TpoProfileRow {
  rowTick: number;
  lowTick: number;
  highTick: number;
  subperiodIds: string[];
  subperiodIndexes: number[];
  markers: string[];
  cells: TpoProfileCell[];
  tpoCount: number;
  volume: number | null;
  bidVolume: number | null;
  askVolume: number | null;
  delta: number | null;
  trades: number | null;
}

export interface TpoProfileCell {
  subperiodIndex: number;
  marker: string;
  sessionSegment: number;
  volume: number | null;
  bidVolume: number | null;
  askVolume: number | null;
  delta: number | null;
  trades: number | null;
}

export interface TpoSinglePrintZone {
  lowTick: number;
  highTick: number;
  tested: boolean;
  firstInteractionMs?: number | null;
  // Average traded volume per tick inside the zone; null when the source
  // carries no volume. Drives the low-volume sensitivity ranking.
  volumePerTick?: number | null;
}

export interface TpoPeakValley {
  kind: "peak" | "valley";
  rowTick: number;
  value: number;
}

export interface TpoProfileModel {
  id: string;
  instrumentId: string;
  startTimeMs: number;
  endTimeMs: number;
  developing: boolean;
  source: Exclude<TpoVisitSource, "automatic">;
  lowerGranularity: boolean;
  tickSize: number;
  ticksPerRow: number;
  rows: TpoProfileRow[];
  subperiods: TpoSubperiod[];
  totalTpos: number;
  profileHighTick: number | null;
  profileLowTick: number | null;
  closeTick: number | null;
  pocTick: number | null;
  vahTick: number | null;
  valTick: number | null;
  pocFirstInteractionMs?: number | null;
  vahFirstInteractionMs?: number | null;
  valFirstInteractionMs?: number | null;
  developingPoc: Array<{ timeMs: number; tick: number }>;
  developingVah: Array<{ timeMs: number; tick: number }>;
  developingVal: Array<{ timeMs: number; tick: number }>;
  initialBalanceHighTick: number | null;
  initialBalanceLowTick: number | null;
  singlePrints: TpoSinglePrintZone[];
  peaksValleys: TpoPeakValley[];
  totalVolume: number | null;
  totalTrades: number | null;
  bidVolume: number | null;
  askVolume: number | null;
  delta: number | null;
  memberProfileIds?: string[];
  anchorProfileId?: string;
}

export interface TpoMergeRecord {
  id: string;
  indicatorInstanceId: string;
  instrumentId: string;
  anchorProfileId: string;
  memberProfileIds: string[];
  createdAtMs: number;
  visualAnchor: {
    anchorTimeMs: number;
    side: "left" | "right";
    widthMode: TpoWidthMode;
    widthValue: number;
    offsetValue: number;
  };
  markerSequenceMode: "continuous" | "restart-per-source-profile";
  groupingMode: "recalculate-from-source" | "normalise-to-anchor";
  previousMergeId?: string;
}

export function priceToTick(price: number, tickSize: number) {
  return Math.round(price / tickSize);
}

export function tickToPrice(tick: number, tickSize: number) {
  return tick * tickSize;
}
