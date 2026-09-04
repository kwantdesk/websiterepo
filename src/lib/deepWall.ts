import type { FootprintBar, FootprintRow } from "./footprint.ts";

export const DEEP_WALL_SETTINGS_VERSION = 1;

export type DeepWallSettings = {
  schemaVersion: number;
  minimumTickBreakout: number;
  minimumDeltaPercent: number;
  minimumPerBarVolume: number;
  minimumClusterVolume: number;
  tickGrouping: number;
  highestLowestMinimumBars: number;
  highestLowestNearnessBars: number;
  plotPrice: "price-slope" | "high" | "low";
  alertSoundEnabled: boolean;
  alertTone: "chime" | "bell" | "pulse";
  messagePopupEnabled: boolean;
  messageText: string;
  buyWallColor: string;
  sellWallColor: string;
  markerWidthBars: number;
  lineWidth: number;
  opacity: number;
  useThemeColors: boolean;
};

export type DeepWallMarker = {
  id: string;
  timestamp: number;
  confirmedAt: number;
  side: "buy-wall" | "sell-wall";
  priceTick: number;
  aggressiveVolume: number;
  clusterVolume: number;
  deltaPercent: number;
};

export type DeepWallFrame = {
  instrument: string;
  tickSize: number;
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE" | "UNSUPPORTED_INSTRUMENT";
  markers: DeepWallMarker[];
};

export const DEFAULT_DEEP_WALL_SETTINGS: DeepWallSettings = {
  schemaVersion: DEEP_WALL_SETTINGS_VERSION,
  minimumTickBreakout: 1,
  minimumDeltaPercent: 70,
  minimumPerBarVolume: 20,
  minimumClusterVolume: 300,
  tickGrouping: 1,
  highestLowestMinimumBars: 2,
  highestLowestNearnessBars: 50,
  plotPrice: "price-slope",
  alertSoundEnabled: false,
  alertTone: "chime",
  messagePopupEnabled: false,
  messageText: "KWANT Wall",
  buyWallColor: "#22C55E",
  sellWallColor: "#EF4444",
  markerWidthBars: 1.6,
  lineWidth: 2,
  opacity: 92,
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function normalizeDeepWallSettings(input?: Record<string, unknown> | null): DeepWallSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_DEEP_WALL_SETTINGS, ...source } as DeepWallSettings;
  settings.schemaVersion = DEEP_WALL_SETTINGS_VERSION;
  settings.minimumTickBreakout = Math.round(clamp(finite(source.minimumTickBreakout, 1), 0, 2_000));
  settings.minimumDeltaPercent = clamp(finite(source.minimumDeltaPercent, 70), 0, 100);
  settings.minimumPerBarVolume = Math.round(clamp(finite(source.minimumPerBarVolume, 20), 0, 10_000_000));
  settings.minimumClusterVolume = Math.round(clamp(finite(source.minimumClusterVolume, 300), 0, 10_000_000));
  settings.tickGrouping = Math.round(clamp(finite(source.tickGrouping, 1), 1, 2_000));
  settings.highestLowestMinimumBars = Math.round(clamp(finite(source.highestLowestMinimumBars, 2), 2, 100));
  settings.highestLowestNearnessBars = Math.round(clamp(finite(source.highestLowestNearnessBars, 50), 1, 1_000));
  settings.markerWidthBars = clamp(finite(source.markerWidthBars, 1.6), 0.25, 12);
  settings.lineWidth = clamp(finite(source.lineWidth, 2), 0.5, 8);
  settings.opacity = clamp(finite(source.opacity, 92), 0, 100);
  if (!(new Set(["price-slope", "high", "low"]) as Set<unknown>).has(settings.plotPrice)) settings.plotPrice = "price-slope";
  if (!(new Set(["chime", "bell", "pulse"]) as Set<unknown>).has(settings.alertTone)) settings.alertTone = "chime";
  settings.messageText = String(source.messageText ?? "KWANT Wall").slice(0, 160);
  return settings;
}

export function isDeepWallInstrumentSupported(instrument: string) {
  const root = instrument.trim().toUpperCase().replace(/\.[VNC]\.\d+$/i, "").replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, "");
  return root === "ES" || root === "MES";
}

function edgeRows(bar: FootprintBar, side: DeepWallMarker["side"], groupTicks: number): FootprintRow[] {
  const edge = side === "sell-wall" ? bar.highTick : bar.lowTick;
  return bar.rows.filter((row) => side === "sell-wall"
    ? row.tickIndex > edge - groupTicks
    : row.tickIndex < edge + groupTicks);
}

function plottedTick(bar: FootprintBar, side: DeepWallMarker["side"], mode: DeepWallSettings["plotPrice"]) {
  if (mode === "high") return bar.highTick;
  if (mode === "low") return bar.lowTick;
  return side === "sell-wall" ? Math.max(bar.closeTick, bar.highTick - 1) : Math.min(bar.closeTick, bar.lowTick + 1);
}

/**
 * DeepCharts' protected formula is not copied. This deterministic counterpart
 * implements its exposed contract: an ES-family local extreme, aggressive
 * volume and delta concentrated at that extreme, followed by the configured
 * rejection. It requires classified Rithmic volume-at-price and never invents
 * a wall from OHLC or unclassified volume.
 */
export function buildDeepWallFrame(
  barsInput: FootprintBar[], instrument: string, tickSize: number,
  input?: Record<string, unknown> | null,
): DeepWallFrame {
  const settings = normalizeDeepWallSettings(input);
  if (!isDeepWallInstrumentSupported(instrument)) return { instrument, tickSize, status: "UNSUPPORTED_INSTRUMENT", markers: [] };
  const bars = [...barsInput].sort((a, b) => a.startTime - b.startTime);
  if (!bars.some((bar) => bar.hasPriceLevelFlow)) return { instrument, tickSize, status: "WAITING_FOR_VOLUME_AT_PRICE", markers: [] };
  const markers: DeepWallMarker[] = [];
  const start = Math.max(0, settings.highestLowestMinimumBars - 1);
  for (let index = start; index < bars.length - 1; index += 1) {
    const bar = bars[index];
    if (!bar.hasPriceLevelFlow || !bar.isClosed) continue;
    const windowStart = Math.max(0, index - settings.highestLowestNearnessBars + 1);
    const comparison = bars.slice(windowStart, index + 1);
    if (comparison.length < settings.highestLowestMinimumBars) continue;
    for (const side of ["sell-wall", "buy-wall"] as const) {
      const isExtreme = side === "sell-wall"
        ? bar.highTick >= Math.max(...comparison.map((item) => item.highTick))
        : bar.lowTick <= Math.min(...comparison.map((item) => item.lowTick));
      if (!isExtreme) continue;
      const rows = edgeRows(bar, side, settings.tickGrouping);
      const aggressiveVolume = rows.reduce((sum, row) => sum + (side === "sell-wall" ? row.askVolume : row.bidVolume), 0);
      const clusterVolume = rows.reduce((sum, row) => sum + row.totalVolume, 0);
      const delta = rows.reduce((sum, row) => sum + row.askVolume - row.bidVolume, 0);
      const classified = rows.reduce((sum, row) => sum + row.askVolume + row.bidVolume, 0);
      const deltaPercent = classified > 0 ? Math.abs(delta) / classified * 100 : 0;
      const correctAggressor = side === "sell-wall" ? delta > 0 : delta < 0;
      if (!correctAggressor || aggressiveVolume < settings.minimumPerBarVolume || clusterVolume < settings.minimumClusterVolume || deltaPercent < settings.minimumDeltaPercent) continue;
      const rejectionTarget = side === "sell-wall" ? bar.highTick - settings.minimumTickBreakout : bar.lowTick + settings.minimumTickBreakout;
      let confirmation: FootprintBar | undefined;
      for (let next = index + 1; next < Math.min(bars.length, index + 1 + settings.highestLowestNearnessBars); next += 1) {
        const candidate = bars[next];
        if (side === "sell-wall" ? candidate.highTick > bar.highTick : candidate.lowTick < bar.lowTick) break;
        if (side === "sell-wall" ? candidate.closeTick <= rejectionTarget : candidate.closeTick >= rejectionTarget) { confirmation = candidate; break; }
      }
      if (!confirmation) continue;
      markers.push({
        id: `deep-wall:${bar.id}:${side}`,
        timestamp: bar.startTime,
        confirmedAt: confirmation.startTime,
        side,
        priceTick: plottedTick(bar, side, settings.plotPrice),
        aggressiveVolume,
        clusterVolume,
        deltaPercent,
      });
    }
  }
  const latest = bars.at(-1);
  return { instrument, tickSize, status: latest && !latest.isClosed ? "LIVE" : "HISTORICAL", markers };
}
