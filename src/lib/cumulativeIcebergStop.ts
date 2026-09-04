import type { IcebergRefreshFrame } from "@/lib/icebergRefreshDetector";
import type { LiquidityStopSweepFrame } from "@/lib/liquidityStopSweepDetector";

export const CUMULATIVE_ICEBERG_STOP_SETTINGS_VERSION = 1;

export type CumulativeIcebergStopInput = "volume" | "orders";
export type CumulativeIcebergStopDisplayMode = "sum" | "last-minutes" | "last-seconds";

export interface CumulativeIcebergStopSettings {
  schemaVersion: number;
  inputData: CumulativeIcebergStopInput;
  filterMin: number;
  filterMax: number;
  displayMode: CumulativeIcebergStopDisplayMode;
  displayParameter: number;
  lineWidth: number;
  useSeparateAxes: boolean;
  showIceberg: boolean;
  showStop: boolean;
  useThemeColors: boolean;
  icebergAskColor: string;
  icebergBidColor: string;
  stopBidColor: string;
  stopAskColor: string;
  alertStopEnabled: boolean;
  alertStopThreshold: number;
  alertStopShowMessage: boolean;
  alertIcebergEnabled: boolean;
  alertIcebergThreshold: number;
  alertIcebergShowMessage: boolean;
  paneHeight: number;
}

export const DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS: CumulativeIcebergStopSettings = {
  schemaVersion: CUMULATIVE_ICEBERG_STOP_SETTINGS_VERSION,
  inputData: "volume",
  filterMin: 1,
  filterMax: 0,
  displayMode: "sum",
  displayParameter: 1,
  lineWidth: 2,
  useSeparateAxes: true,
  showIceberg: true,
  showStop: true,
  useThemeColors: true,
  icebergAskColor: "#EF4444",
  icebergBidColor: "#22C55E",
  stopBidColor: "#38BDF8",
  stopAskColor: "#F59E0B",
  alertStopEnabled: false,
  alertStopThreshold: 100,
  alertStopShowMessage: true,
  alertIcebergEnabled: false,
  alertIcebergThreshold: 100,
  alertIcebergShowMessage: true,
  paneHeight: 190,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function normalizeCumulativeIcebergStopSettings(input?: Record<string, unknown> | null): CumulativeIcebergStopSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS, ...source } as CumulativeIcebergStopSettings;
  settings.schemaVersion = CUMULATIVE_ICEBERG_STOP_SETTINGS_VERSION;
  settings.inputData = source.inputData === "orders" ? "orders" : "volume";
  settings.displayMode = ["sum", "last-minutes", "last-seconds"].includes(String(source.displayMode))
    ? String(source.displayMode) as CumulativeIcebergStopDisplayMode
    : "sum";
  settings.filterMin = clamp(finite(source.filterMin, 1), 0, 10_000_000);
  settings.filterMax = clamp(finite(source.filterMax, 0), 0, 10_000_000);
  if (settings.filterMax > 0 && settings.filterMax < settings.filterMin) settings.filterMax = settings.filterMin;
  settings.displayParameter = Math.round(clamp(finite(source.displayParameter, 1), 1, 86_400));
  settings.lineWidth = Math.round(clamp(finite(source.lineWidth, 2), 1, 4));
  settings.alertStopThreshold = clamp(finite(source.alertStopThreshold, 100), 0, 10_000_000);
  settings.alertIcebergThreshold = clamp(finite(source.alertIcebergThreshold, 100), 0, 10_000_000);
  settings.paneHeight = Math.round(clamp(finite(source.paneHeight, 190), 120, 520));
  for (const key of ["useSeparateAxes", "showIceberg", "showStop", "useThemeColors", "alertStopEnabled", "alertStopShowMessage", "alertIcebergEnabled", "alertIcebergShowMessage"] as const) {
    settings[key] = source[key] == null ? DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS[key] : source[key] === true;
  }
  return settings;
}

export type CumulativeIcebergStopPoint = {
  timestampMs: number;
  value: number;
  side: "bid" | "ask";
  eventValue: number;
};

export type CumulativeIcebergStopFrame = {
  generatedAt: number;
  status: "CONNECTING" | "LIVE" | "STALE" | "ORDER_IDS_REQUIRED" | "NO_EVENTS";
  iceberg: CumulativeIcebergStopPoint[];
  stop: CumulativeIcebergStopPoint[];
  currentIceberg: number;
  currentStop: number;
  icebergEventCount: number;
  stopEventCount: number;
  limitations: string[];
};

type Contribution = { id: string; timestampMs: number; side: "bid" | "ask"; value: number };

function passesFilter(value: number, settings: CumulativeIcebergStopSettings) {
  return value >= settings.filterMin && (settings.filterMax <= 0 || value <= settings.filterMax);
}

function windowMs(settings: CumulativeIcebergStopSettings) {
  if (settings.displayMode === "last-minutes") return settings.displayParameter * 60_000;
  if (settings.displayMode === "last-seconds") return settings.displayParameter * 1_000;
  return null;
}

/**
 * DeepCharts draws two signed cumulative lines. Bid activity adds and Ask
 * activity subtracts; a rolling display mode keeps only the selected time
 * window. Each source event is represented once at its latest verified size,
 * so a live detector update replaces the event instead of double-counting it.
 */
export function accumulateCumulativeIcebergStop(
  contributions: Contribution[],
  settings: CumulativeIcebergStopSettings,
  nowMs: number,
): CumulativeIcebergStopPoint[] {
  const accepted = contributions
    .filter((event) => Number.isFinite(event.value) && event.value >= 0 && passesFilter(event.value, settings))
    .sort((left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id));
  const duration = windowMs(settings);
  if (!accepted.length) return [];
  if (duration == null) {
    let value = 0;
    return accepted.map((event) => {
      value += event.side === "bid" ? event.value : -event.value;
      return { timestampMs: event.timestampMs, value, side: event.side, eventValue: event.value };
    });
  }
  const points = accepted.map((event, index) => {
    const cutoff = event.timestampMs - duration;
    let value = 0;
    for (let cursor = index; cursor >= 0 && accepted[cursor].timestampMs >= cutoff; cursor -= 1) {
      value += accepted[cursor].side === "bid" ? accepted[cursor].value : -accepted[cursor].value;
    }
    return { timestampMs: event.timestampMs, value, side: event.side, eventValue: event.value };
  });
  const last = points.at(-1)!;
  if (nowMs > last.timestampMs) {
    const cutoff = nowMs - duration;
    const current = accepted.filter((event) => event.timestampMs >= cutoff)
      .reduce((sum, event) => sum + (event.side === "bid" ? event.value : -event.value), 0);
    points.push({ timestampMs: nowMs, value: current, side: last.side, eventValue: 0 });
  }
  return points;
}

/** Build the pane from the two existing execution/book engines. */
export function buildCumulativeIcebergStopFrame(
  icebergFrame: IcebergRefreshFrame | null,
  stopFrame: LiquidityStopSweepFrame | null,
  rawSettings?: Record<string, unknown> | CumulativeIcebergStopSettings | null,
): CumulativeIcebergStopFrame {
  const settings = normalizeCumulativeIcebergStopSettings(rawSettings as Record<string, unknown>);
  const generatedAt = Math.max(icebergFrame?.generatedAt ?? 0, stopFrame?.generatedAt ?? 0, Date.now());
  const limitations = [
    "Icebergs are inferred from Rithmic executions and price-level replenishment; the current gateway does not expose native iceberg or maker-order lineage fields.",
    "Stop activity is inferred from aggressive sweeps through known reference levels; resting stop orders are not directly visible.",
  ];
  if (settings.inputData === "orders") {
    return { generatedAt, status: "ORDER_IDS_REQUIRED", iceberg: [], stop: [], currentIceberg: 0, currentStop: 0, icebergEventCount: 0, stopEventCount: 0, limitations: ["Order mode requires individual MBO maker/order IDs, which this Rithmic gateway does not currently expose.", ...limitations] };
  }

  const icebergEvents: Contribution[] = (icebergFrame?.candidates ?? [])
    .filter((candidate) => !["WATCHING", "REFRESHING", "EXPIRED"].includes(candidate.state))
    .map((candidate) => ({
      id: candidate.id,
      timestampMs: candidate.lastUpdatedMs,
      side: candidate.passiveSide === "BID" ? "bid" : "ask",
      value: Math.max(candidate.inferredReloadedQuantity, candidate.cumulativeAttributedReplenishment),
    }));
  const stopEvents: Contribution[] = (stopFrame?.events ?? [])
    // A reference match is the auditable evidence that turns an execution
    // sweep into possible stop activity. State may later become continuation
    // or rejection, but the same event must remain in the cumulative trail.
    .filter((event) => event.matchedReferences.length > 0)
    .map((event) => ({ id: event.id, timestampMs: event.endMs, side: event.direction === "buy" ? "bid" : "ask", value: event.totalQuantity }));
  const iceberg = accumulateCumulativeIcebergStop(icebergEvents, settings, generatedAt);
  const stop = accumulateCumulativeIcebergStop(stopEvents, settings, generatedAt);
  const stale = icebergFrame?.status === "STALE" || stopFrame?.status === "TRADE_DATA_STALE" || stopFrame?.status === "BOOK_CONTEXT_STALE";
  const connecting = !icebergFrame || !stopFrame || ["CONNECTING", "BUILDING_BOOK", "CALIBRATING"].includes(icebergFrame.status) || ["CONNECTING", "REBUILDING"].includes(stopFrame.status);
  return {
    generatedAt,
    status: stale ? "STALE" : connecting ? "CONNECTING" : iceberg.length || stop.length ? "LIVE" : "NO_EVENTS",
    iceberg,
    stop,
    currentIceberg: iceberg.at(-1)?.value ?? 0,
    currentStop: stop.at(-1)?.value ?? 0,
    icebergEventCount: icebergEvents.length,
    stopEventCount: stopEvents.length,
    limitations,
  };
}
