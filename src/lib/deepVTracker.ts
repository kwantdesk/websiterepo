import type { FootprintBar, FootprintRow } from "./footprint.ts";

export const DEEP_V_TRACKER_SETTINGS_VERSION = 1;

export type DeepVTrackerStrength = "weak" | "medium" | "strong";
export type DeepVTrackerLevelMode = "conservative" | "medium" | "aggressive";

export type DeepVTrackerSettings = {
  schemaVersion: number;
  accelerationEnabled: boolean;
  accelerationMode: DeepVTrackerStrength;
  exhaustionEnabled: boolean;
  exhaustionMode: DeepVTrackerStrength;
  slowdownEnabled: boolean;
  slowdownMode: DeepVTrackerStrength;
  absorptionPressureEnabled: boolean;
  absorptionIntensity: DeepVTrackerStrength;
  levelMode: DeepVTrackerLevelMode;
  controlLineWidth: number;
  extremeLineWidth: number;
  textSize: number;
  projectionBars: number;
  extendFarRight: boolean;
  alertSoundEnabled: boolean;
  alertTone: "chime" | "bell" | "pulse";
  messagePopupEnabled: boolean;
  messageText: string;
  accelerationColor: string;
  exhaustionColor: string;
  slowdownColor: string;
  bidColor: string;
  askColor: string;
  patternOpacity: number;
  useThemeColors: boolean;
};

export type DeepVTrackerPattern = {
  id: string;
  timestamp: number;
  kind: "acceleration" | "exhaustion" | "slowdown";
  side: "buy" | "sell";
  lowTick: number;
  highTick: number;
  score: number;
};

export type DeepVTrackerLevel = {
  id: string;
  timestamp: number;
  endTimestamp: number;
  kind: "pressure" | "absorption";
  side: "bid" | "ask";
  controlTick: number;
  extremeTick: number;
  score: number;
  extendsToFarRight: boolean;
};

export type DeepVTrackerFrame = {
  instrument: string;
  tickSize: number;
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE";
  patterns: DeepVTrackerPattern[];
  levels: DeepVTrackerLevel[];
};

export const DEFAULT_DEEP_V_TRACKER_SETTINGS: DeepVTrackerSettings = {
  schemaVersion: DEEP_V_TRACKER_SETTINGS_VERSION,
  // DeepCharts' current guide recommends Acceleration alone for a clean stock
  // chart. Exhaustion and Slowdown remain one-click modules, not hidden logic.
  accelerationEnabled: true,
  accelerationMode: "strong",
  exhaustionEnabled: false,
  exhaustionMode: "medium",
  slowdownEnabled: false,
  slowdownMode: "medium",
  absorptionPressureEnabled: true,
  absorptionIntensity: "medium",
  levelMode: "medium",
  controlLineWidth: 2,
  extremeLineWidth: 1,
  textSize: 10,
  projectionBars: 20,
  extendFarRight: false,
  alertSoundEnabled: false,
  alertTone: "chime",
  messagePopupEnabled: false,
  messageText: "KWANT V-Tracker",
  accelerationColor: "#22D3EE",
  exhaustionColor: "#F59E0B",
  slowdownColor: "#A78BFA",
  bidColor: "#A855F7",
  askColor: "#22C55E",
  patternOpacity: 32,
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const STRENGTHS = new Set<unknown>(["weak", "medium", "strong"]);
const LEVEL_MODES = new Set<unknown>(["conservative", "medium", "aggressive"]);

export function normalizeDeepVTrackerSettings(input?: Record<string, unknown> | null): DeepVTrackerSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_DEEP_V_TRACKER_SETTINGS, ...source } as DeepVTrackerSettings;
  settings.schemaVersion = DEEP_V_TRACKER_SETTINGS_VERSION;
  if (!STRENGTHS.has(settings.accelerationMode)) settings.accelerationMode = "strong";
  if (!STRENGTHS.has(settings.exhaustionMode)) settings.exhaustionMode = "medium";
  if (!STRENGTHS.has(settings.slowdownMode)) settings.slowdownMode = "medium";
  if (!STRENGTHS.has(settings.absorptionIntensity)) settings.absorptionIntensity = "medium";
  if (!LEVEL_MODES.has(settings.levelMode)) settings.levelMode = "medium";
  if (!(new Set(["chime", "bell", "pulse"]) as Set<unknown>).has(settings.alertTone)) settings.alertTone = "chime";
  settings.controlLineWidth = clamp(finite(source.controlLineWidth, 2), 0, 8);
  settings.extremeLineWidth = clamp(finite(source.extremeLineWidth, 1), 0, 8);
  settings.textSize = clamp(finite(source.textSize, 10), 6, 50);
  settings.projectionBars = Math.round(clamp(finite(source.projectionBars, 20), 1, 5_000));
  settings.patternOpacity = clamp(finite(source.patternOpacity, 32), 0, 100);
  settings.messageText = String(source.messageText ?? "KWANT V-Tracker").slice(0, 160);
  return settings;
}

const strengthThreshold = (strength: DeepVTrackerStrength) => (
  strength === "strong" ? 2 : strength === "medium" ? 1.55 : 1.2
);
const fadeThreshold = (strength: DeepVTrackerStrength) => (
  strength === "strong" ? 0.36 : strength === "medium" ? 0.56 : 0.76
);
const intensityThreshold = (strength: DeepVTrackerStrength) => (
  strength === "strong" ? 0.74 : strength === "medium" ? 0.62 : 0.52
);
const structureLookback = (mode: DeepVTrackerLevelMode) => (
  mode === "conservative" ? 12 : mode === "medium" ? 7 : 3
);

function durationSeconds(bar: FootprintBar, previous: FootprintBar | undefined) {
  if (Number.isFinite(bar.endTime)) return Math.max(0.05, (bar.endTime - bar.startTime) / 1_000);
  return Math.max(0.05, previous ? (bar.startTime - previous.startTime) / 1_000 : 1);
}

function directionalSide(bar: FootprintBar): "buy" | "sell" {
  if (bar.delta !== 0) return bar.delta > 0 ? "buy" : "sell";
  return bar.close >= bar.open ? "buy" : "sell";
}

function strongestRow(rows: FootprintRow[], side: "bid" | "ask") {
  let result: FootprintRow | null = null;
  for (const row of rows) {
    const value = side === "ask" ? row.askVolume : row.bidVolume;
    const prior = result ? (side === "ask" ? result.askVolume : result.bidVolume) : -1;
    if (value > prior) result = row;
  }
  return result;
}

function invalidateAt(
  bars: FootprintBar[], index: number, side: "bid" | "ask", extremeTick: number,
  settings: DeepVTrackerSettings,
): { endTimestamp: number; invalidated: boolean } {
  const lastIndex = settings.extendFarRight
    ? bars.length - 1
    : Math.min(bars.length - 1, index + settings.projectionBars);
  let endIndex = lastIndex;
  for (let next = index + 1; next <= lastIndex; next += 1) {
    const invalid = side === "ask" ? bars[next].closeTick > extremeTick : bars[next].closeTick < extremeTick;
    if (invalid) return { endTimestamp: bars[next].startTime, invalidated: true };
  }
  return { endTimestamp: bars[endIndex]?.startTime ?? bars[index].startTime, invalidated: false };
}

/**
 * DeepCharts protects the V-Tracker formula body. This is an evidence-bounded
 * implementation of the published contract, not a claim that its private
 * coefficients were copied. It uses only classified Rithmic executions:
 * speed anomalies drive Acceleration/Slowdown, failed continuation drives
 * Exhaustion, and row-level aggressive flow plus close location separates
 * Pressure from Absorption. OHLC-only candles never manufacture a signal.
 */
export function buildDeepVTrackerFrame(
  barsInput: FootprintBar[], instrument: string, tickSize: number,
  input?: Record<string, unknown> | null,
): DeepVTrackerFrame {
  const settings = normalizeDeepVTrackerSettings(input);
  const bars = [...barsInput].sort((a, b) => a.startTime - b.startTime);
  if (!bars.some((bar) => bar.hasPriceLevelFlow)) {
    return { instrument, tickSize, status: "WAITING_FOR_VOLUME_AT_PRICE", patterns: [], levels: [] };
  }
  const patterns: DeepVTrackerPattern[] = [];
  const levels: DeepVTrackerLevel[] = [];
  let speedBaseline = 0;
  let rangeBaseline = 0;
  let volumeBaseline = 0;
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    if (!bar.hasPriceLevelFlow) continue;
    const previous = bars[index - 1];
    const duration = durationSeconds(bar, previous);
    const speed = bar.classifiedVolume / duration;
    const range = Math.max(1, bar.highTick - bar.lowTick);
    if (!(speedBaseline > 0)) speedBaseline = Math.max(1, speed);
    if (!(rangeBaseline > 0)) rangeBaseline = range;
    if (!(volumeBaseline > 0)) volumeBaseline = Math.max(1, bar.classifiedVolume);
    const speedRatio = speed / speedBaseline;
    const volumeRatio = bar.classifiedVolume / volumeBaseline;
    const bodyTicks = Math.abs(bar.closeTick - bar.openTick);
    const side = directionalSide(bar);
    const aligned = (side === "buy" && bar.delta > 0 && bar.closeTick >= bar.openTick)
      || (side === "sell" && bar.delta < 0 && bar.closeTick <= bar.openTick);

    if (settings.accelerationEnabled && aligned && speedRatio >= strengthThreshold(settings.accelerationMode)) {
      patterns.push({
        id: `deep-v:${bar.id}:acceleration`, timestamp: bar.startTime, kind: "acceleration", side,
        lowTick: Math.min(bar.openTick, bar.closeTick), highTick: Math.max(bar.openTick, bar.closeTick), score: speedRatio,
      });
    }

    if (settings.exhaustionEnabled && previous && index >= 2) {
      const recent = bars.slice(Math.max(0, index - 6), index);
      const atExtreme = side === "buy"
        ? bar.highTick >= Math.max(...recent.map((item) => item.highTick))
        : bar.lowTick <= Math.min(...recent.map((item) => item.lowTick));
      const directionalFade = Math.abs(bar.delta) / Math.max(1, Math.abs(previous.delta));
      const rejected = side === "buy"
        ? bar.highTick - bar.closeTick >= Math.max(1, bodyTicks)
        : bar.closeTick - bar.lowTick >= Math.max(1, bodyTicks);
      if (atExtreme && rejected && directionalFade <= fadeThreshold(settings.exhaustionMode)) {
        patterns.push({
          id: `deep-v:${bar.id}:exhaustion`, timestamp: bar.startTime, kind: "exhaustion", side,
          lowTick: bar.lowTick, highTick: bar.highTick, score: 1 / Math.max(0.01, directionalFade),
        });
      }
    }

    if (settings.slowdownEnabled && index >= 2) {
      const threshold = fadeThreshold(settings.slowdownMode);
      const compact = range / Math.max(1, rangeBaseline) <= threshold;
      if (speedRatio <= threshold && volumeRatio <= 1 && compact) {
        patterns.push({
          id: `deep-v:${bar.id}:slowdown`, timestamp: bar.startTime, kind: "slowdown", side,
          lowTick: bar.lowTick, highTick: bar.highTick, score: 1 / Math.max(0.01, speedRatio),
        });
      }
    }

    if (settings.absorptionPressureEnabled && bar.rows.length) {
      const lookback = bars.slice(Math.max(0, index - structureLookback(settings.levelMode)), index + 1);
      const atHigh = bar.highTick >= Math.max(...lookback.map((item) => item.highTick));
      const atLow = bar.lowTick <= Math.min(...lookback.map((item) => item.lowTick));
      const closeLocation = (bar.closeTick - bar.lowTick) / range;
      for (const flowSide of ["ask", "bid"] as const) {
        const row = strongestRow(bar.rows, flowSide);
        if (!row) continue;
        const aggressive = flowSide === "ask" ? row.askVolume : row.bidVolume;
        const opposing = flowSide === "ask" ? row.bidVolume : row.askVolume;
        const rowShare = aggressive / Math.max(1, bar.classifiedVolume);
        const dominance = aggressive / Math.max(1, aggressive + opposing);
        const score = Math.max(rowShare * 4, dominance);
        if (dominance < intensityThreshold(settings.absorptionIntensity) || aggressive < Math.max(1, volumeBaseline * 0.08)) continue;
        const pressure = flowSide === "ask" ? closeLocation >= 0.67 : closeLocation <= 0.33;
        const absorbed = flowSide === "ask" ? atHigh && closeLocation <= 0.55 : atLow && closeLocation >= 0.45;
        if (!pressure && !absorbed) continue;
        const kind = absorbed ? "absorption" : "pressure";
        const extremeTick = flowSide === "ask" ? bar.highTick : bar.lowTick;
        const extension = invalidateAt(bars, index, flowSide, extremeTick, settings);
        levels.push({
          id: `deep-v:${bar.id}:${kind}:${flowSide}`,
          timestamp: bar.startTime,
          endTimestamp: extension.endTimestamp,
          kind,
          side: flowSide,
          controlTick: row.tickIndex,
          extremeTick,
          score,
          extendsToFarRight: settings.extendFarRight && !extension.invalidated,
        });
      }
    }

    // A small adaptive baseline follows changing participation without a
    // rolling-array allocation, keeping the study linear on long histories.
    const alpha = 2 / 21;
    speedBaseline += (speed - speedBaseline) * alpha;
    rangeBaseline += (range - rangeBaseline) * alpha;
    volumeBaseline += (bar.classifiedVolume - volumeBaseline) * alpha;
  }
  const latest = bars.at(-1);
  return { instrument, tickSize, status: latest && !latest.isClosed ? "LIVE" : "HISTORICAL", patterns, levels };
}
