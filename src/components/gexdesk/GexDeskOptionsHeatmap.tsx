"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  Flame,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Waves,
} from "lucide-react";
import KwantSelect from "@/components/ui/KwantSelect";
import type { DatabentoLiveStatus } from "@/lib/chartLiveEvents";
import type {
  GexDeskHistoryPayload,
  GexDeskOptionPrint,
  GexDeskPayload,
} from "@/lib/gexDesk";

type HeatWindow = 15 | 30 | 60 | 120;
type HeatMetric = "PREMIUM" | "CONTRACTS" | "GEX";
type HeatView = "LIVE" | "REPLAY";
type ReplaySpeed = 0.5 | 1 | 2 | 4;
type PriceTick = { price: number; delta: number; timestamp: number };
type HeatCell = {
  timestamp: number;
  price: number;
  callPremium: number;
  putPremium: number;
  callContracts: number;
  putContracts: number;
  callGex: number;
  putGex: number;
  calls: number;
  puts: number;
};
type TapeLevel = Omit<HeatCell, "timestamp">;

const PLOT_LEFT = 24;
const PLOT_RIGHT = 918;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 522;
const HEAT_WINDOWS: HeatWindow[] = [15, 30, 60, 120];
const REPLAY_SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];
const MAX_HEAT_CELLS = 3_200;
const REPLAY_LEVELS_PER_FRAME = 44;
const HEATMAP_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `$${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `$${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `$${(absolute / 1_000).toFixed(1)}K`;
  return `$${absolute.toFixed(0)}`;
}

function compactContracts(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function compactExposure(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `${(absolute / 1_000_000_000_000).toFixed(2)}T`;
  if (absolute >= 1_000_000_000) return `${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${(absolute / 1_000).toFixed(1)}K`;
  return absolute.toFixed(0);
}

function formatPrice(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "--"
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeTimestamp(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const timestamp = value >= 1e18
    ? Math.floor(value / 1e6)
    : value >= 1e15
      ? Math.floor(value / 1e3)
      : value >= 1e12
        ? Math.floor(value)
        : value >= 1e9
          ? Math.floor(value * 1e3)
          : Number.NaN;
  return Number.isFinite(timestamp) && !Number.isNaN(new Date(timestamp).getTime())
    ? timestamp
    : null;
}

function timeLabel(timestamp: number) {
  const safeTimestamp = normalizeTimestamp(timestamp);
  if (safeTimestamp === null) return "--:--";
  try {
    return HEATMAP_TIME_FORMATTER.format(new Date(safeTimestamp));
  } catch {
    return "--:--";
  }
}

function percentile(values: number[], amount: number) {
  if (!values.length) return 1;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * amount))] || 1;
}

function sideValue(cell: HeatCell | TapeLevel, side: "CALL" | "PUT", metric: HeatMetric) {
  if (metric === "GEX") {
    return side === "CALL" ? cell.callGex : cell.putGex;
  }
  if (metric === "CONTRACTS") {
    return side === "CALL" ? cell.callContracts : cell.putContracts;
  }
  return side === "CALL" ? cell.callPremium : cell.putPremium;
}

function aggregateTape(
  prints: GexDeskOptionPrint[],
  bucketSize: number,
  startTime: number,
) {
  const cells = new Map<string, HeatCell>();
  const levels = new Map<number, TapeLevel>();
  for (const print of prints.slice(-2_500)) {
    if (print.contractType !== "CALL" && print.contractType !== "PUT") continue;
    const safeTimestamp = normalizeTimestamp(Number(print.timestamp));
    const mappedPrice = Number(print.mappedPrice);
    const premium = Math.max(0, Number(print.premium));
    const size = Math.max(0, Number(print.size));
    if (
      safeTimestamp === null
      || safeTimestamp < startTime
      || !Number.isFinite(mappedPrice)
      || mappedPrice <= 0
      || !Number.isFinite(premium)
      || !Number.isFinite(size)
    ) continue;
    const timestamp = Math.floor(safeTimestamp / 60_000) * 60_000;
    const price = Math.round(mappedPrice / bucketSize) * bucketSize;
    const key = `${timestamp}:${price}`;
    const cell = cells.get(key) ?? {
      timestamp,
      price,
      callPremium: 0,
      putPremium: 0,
      callContracts: 0,
      putContracts: 0,
      callGex: 0,
      putGex: 0,
      calls: 0,
      puts: 0,
    };
    const level = levels.get(price) ?? {
      price,
      callPremium: 0,
      putPremium: 0,
      callContracts: 0,
      putContracts: 0,
      callGex: 0,
      putGex: 0,
      calls: 0,
      puts: 0,
    };
    const confidence = Number(print.confidence);
    const confidenceWeight = Number.isFinite(confidence) ? clamp(confidence, 0.2, 1) : 0.3;
    if (print.contractType === "CALL") {
      cell.callPremium += premium * confidenceWeight;
      cell.callContracts += size * confidenceWeight;
      cell.calls += 1;
      level.callPremium += premium * confidenceWeight;
      level.callContracts += size * confidenceWeight;
      level.calls += 1;
    } else {
      cell.putPremium += premium * confidenceWeight;
      cell.putContracts += size * confidenceWeight;
      cell.puts += 1;
      level.putPremium += premium * confidenceWeight;
      level.putContracts += size * confidenceWeight;
      level.puts += 1;
    }
    cells.set(key, cell);
    levels.set(price, level);
  }
  return {
    cells: [...cells.values()].sort((left, right) => left.timestamp - right.timestamp),
    levels: [...levels.values()],
  };
}

function historyHeat(
  history: GexDeskHistoryPayload,
  frameIndex: number,
) {
  const latestIndex = Math.max(0, history.timestamps.length - 1);
  const selectedIndex = Math.round(clamp(frameIndex, 0, latestIndex));
  const cells: HeatCell[] = [];
  for (let index = 0; index <= selectedIndex; index += 1) {
    const timestamp = history.timestamps[index];
    const strongest = history.rows
      .map((row) => ({
        price: row.price,
        call: Math.abs(Number(row.call[index]) || 0),
        put: Math.abs(Number(row.put[index]) || 0),
      }))
      .filter((row) => row.call > 0 || row.put > 0)
      .sort((left, right) => right.call + right.put - left.call - left.put)
      .slice(0, REPLAY_LEVELS_PER_FRAME);
    for (const row of strongest) {
      cells.push({
        timestamp,
        price: row.price,
        callPremium: 0,
        putPremium: 0,
        callContracts: 0,
        putContracts: 0,
        callGex: row.call,
        putGex: row.put,
        calls: row.call > 0 ? 1 : 0,
        puts: row.put > 0 ? 1 : 0,
      });
    }
  }
  const levels: TapeLevel[] = history.rows
    .map((row) => ({
      price: row.price,
      callPremium: 0,
      putPremium: 0,
      callContracts: 0,
      putContracts: 0,
      callGex: Math.abs(Number(row.call[selectedIndex]) || 0),
      putGex: Math.abs(Number(row.put[selectedIndex]) || 0),
      calls: Number(row.call[selectedIndex]) ? 1 : 0,
      puts: Number(row.put[selectedIndex]) ? 1 : 0,
    }))
    .filter((row) => row.callGex > 0 || row.putGex > 0);
  return { selectedIndex, cells: cells.slice(-MAX_HEAT_CELLS), levels };
}

export default function GexDeskOptionsHeatmap({
  payload,
  history,
  historyLoading,
  historyError,
  livePrice,
  priceTicks,
  feedStatus,
  liveInstrument,
}: {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  historyLoading: boolean;
  historyError: string;
  livePrice: number | null;
  priceTicks: PriceTick[];
  feedStatus: DatabentoLiveStatus;
  liveInstrument: "MNQ" | "NQ";
}) {
  const [windowMinutes, setWindowMinutes] = useState<HeatWindow>(60);
  const [metric, setMetric] = useState<HeatMetric>("PREMIUM");
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [view, setView] = useState<HeatView>("LIVE");
  const [replayDates, setReplayDates] = useState<string[]>([]);
  const [replayDate, setReplayDate] = useState("");
  const [replayHistory, setReplayHistory] = useState<GexDeskHistoryPayload | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
  const [playing, setPlaying] = useState(false);
  const replayCacheRef = useRef(new Map<string, GexDeskHistoryPayload>());
  const replaySessionRef = useRef("");
  const optionsTape = Array.isArray(payload.optionsTape) ? payload.optionsTape : [];
  const tapeUnavailable = payload.errors.some((error) => error.includes("options tape:"));

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/gexdesk/history?scope=sessions", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json() as { sessionDates?: string[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Replay sessions could not be loaded.");
        const dates = Array.isArray(body.sessionDates) ? body.sessionDates.slice(-5) : [];
        setReplayError("");
        setReplayDates(dates);
        setReplayDate((current) => current && dates.includes(current) ? current : dates.at(-1) ?? "");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setReplayError(error instanceof Error ? error.message : "Replay sessions could not be loaded.");
      }
    })();
    return () => controller.abort();
  }, [payload.sessionDate]);

  useEffect(() => {
    if (history) replayCacheRef.current.set(`${history.source}:${history.sessionDate}`, history);
  }, [history]);

  useEffect(() => {
    if (view !== "REPLAY" || !replayDate) return;
    const source = history?.source ?? "COMBINED";
    const cacheKey = `${source}:${replayDate}`;
    const cached = replayCacheRef.current.get(cacheKey);
    if (cached) {
      setReplayHistory(cached);
      setReplayError("");
      return;
    }
    const controller = new AbortController();
    setReplayLoading(true);
    setReplayError("");
    void (async () => {
      try {
        const response = await fetch(
          `/api/gexdesk/history?source=${encodeURIComponent(source)}&instrument=NQ&sessionDate=${encodeURIComponent(replayDate)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json() as GexDeskHistoryPayload & { error?: string };
        if (!response.ok) throw new Error(body.error || "The selected replay session could not be loaded.");
        replayCacheRef.current.set(cacheKey, body);
        setReplayHistory(body);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setReplayHistory(null);
        setReplayError(error instanceof Error ? error.message : "The selected replay session could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setReplayLoading(false);
      }
    })();
    return () => controller.abort();
  }, [history?.source, replayDate, view]);

  const replaySource = history?.source ?? "COMBINED";
  const activeReplayHistory = view === "REPLAY"
    ? replayCacheRef.current.get(`${replaySource}:${replayDate}`)
      ?? (replayHistory?.sessionDate === replayDate && replayHistory.source === replaySource ? replayHistory : null)
    : null;
  const replayLatestIndex = Math.max(0, (activeReplayHistory?.timestamps.length ?? 1) - 1);

  useEffect(() => {
    const sessionKey = activeReplayHistory
      ? `${activeReplayHistory.source}:${activeReplayHistory.sessionDate}`
      : "";
    if (!sessionKey) return;
    if (replaySessionRef.current !== sessionKey) {
      replaySessionRef.current = sessionKey;
      setReplayIndex(replayLatestIndex);
      setPlaying(false);
      setSelectedPrice(null);
      return;
    }
    setReplayIndex((current) => Math.min(current, replayLatestIndex));
  }, [activeReplayHistory, replayLatestIndex]);

  useEffect(() => {
    if (view !== "REPLAY" || !playing || !activeReplayHistory?.timestamps.length) return;
    const timer = window.setInterval(() => {
      setReplayIndex((current) => {
        if (current >= replayLatestIndex) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, Math.max(70, 520 / replaySpeed));
    return () => window.clearInterval(timer);
  }, [activeReplayHistory, playing, replayLatestIndex, replaySpeed, view]);

  const activeMetric: HeatMetric = view === "REPLAY" ? "GEX" : metric;
  const model = useMemo(() => {
    if (view === "REPLAY" && activeReplayHistory?.timestamps.length) {
      const replay = historyHeat(activeReplayHistory, replayIndex);
      const startTime = activeReplayHistory.timestamps[0];
      const endTime = activeReplayHistory.timestamps.at(-1) ?? startTime;
      const selectedTime = activeReplayHistory.timestamps[replay.selectedIndex] ?? endTime;
      const timestampDeltas = activeReplayHistory.timestamps
        .slice(1)
        .map((timestamp, index) => timestamp - activeReplayHistory.timestamps[index])
        .filter((value) => value > 0)
        .sort((left, right) => left - right);
      const cellDurationMs = timestampDeltas[Math.floor(timestampDeltas.length / 2)] ?? 60_000;
      const snapshotPrice = activeReplayHistory.futuresPrices[replay.selectedIndex]
        ?? activeReplayHistory.nqPrices[replay.selectedIndex]
        ?? null;
      const bucketSize = activeReplayHistory.bucketSize;
      const low = activeReplayHistory.priceLow;
      const high = activeReplayHistory.priceHigh;
      const xForTime = (timestamp: number) => PLOT_LEFT + clamp(
        (timestamp - startTime) / Math.max(1, endTime - startTime),
        0,
        1,
      ) * (PLOT_RIGHT - PLOT_LEFT);
      const yForPrice = (price: number) => PLOT_TOP + (high - price) / Math.max(1, high - low) * (PLOT_BOTTOM - PLOT_TOP);
      const sideValues = replay.cells.flatMap((cell) => [cell.callGex, cell.putGex]).filter((value) => value > 0);
      const heatCeiling = Math.max(1, percentile(sideValues, 0.94));
      const center = snapshotPrice ?? (low + high) / 2;
      const visibleLevels = replay.levels
        .sort((left, right) => Math.abs(left.price - center) - Math.abs(right.price - center))
        .slice(0, 38)
        .sort((left, right) => right.price - left.price);
      const totalCall = replay.levels.reduce((sum, level) => sum + level.callGex, 0);
      const totalPut = replay.levels.reduce((sum, level) => sum + level.putGex, 0);
      const hottest = [...replay.levels].sort((left, right) => (
        right.callGex + right.putGex - left.callGex - left.putGex
      ))[0] ?? null;
      return {
        snapshotPrice,
        startTime,
        endTime,
        selectedTime,
        cellDurationMs,
        bucketSize,
        low,
        high,
        xForTime,
        yForPrice,
        cells: replay.cells,
        levels: visibleLevels,
        heatCeiling,
        totalCall,
        totalPut,
        total: totalCall + totalPut,
        hottest,
      };
    }
    const snapshotPrice = Number.isFinite(payload.nqPrice) ? payload.nqPrice : null;
    const latestTapeTimestamp = optionsTape.reduce((latest, print) => {
      const timestamp = normalizeTimestamp(Number(print.timestamp));
      return timestamp === null ? latest : Math.max(latest, timestamp);
    }, 0);
    const payloadTimestamp = normalizeTimestamp(Date.parse(payload.asOf)) ?? 0;
    const latestDataTimestamp = Math.max(latestTapeTimestamp, payloadTimestamp);
    const endTime = payload.marketOpen
      ? Math.max(Date.now(), latestDataTimestamp)
      : latestDataTimestamp || Date.now();
    const startTime = endTime - windowMinutes * 60_000;
    const bucketSize = snapshotPrice
      ? Math.max(10, Math.round((snapshotPrice * 0.0007) / 5) * 5)
      : 20;
    const aggregate = aggregateTape(optionsTape, bucketSize, startTime);
    const activePrintPrices = aggregate.levels.map((level) => level.price);
    const center = snapshotPrice
      ?? activePrintPrices[Math.floor(activePrintPrices.length / 2)]
      ?? 0;
    const rawLow = activePrintPrices.reduce((lowest, price) => Math.min(lowest, price), center);
    const rawHigh = activePrintPrices.reduce((highest, price) => Math.max(highest, price), center);
    const minimumSpan = 700;
    const low = Math.floor(Math.max(center - 900, Math.min(rawLow - bucketSize, center - minimumSpan / 2)) / bucketSize) * bucketSize;
    const high = Math.ceil(Math.min(center + 900, Math.max(rawHigh + bucketSize, center + minimumSpan / 2)) / bucketSize) * bucketSize;
    const xForTime = (timestamp: number) => PLOT_LEFT + clamp(
      (timestamp - startTime) / Math.max(1, endTime - startTime),
      0,
      1,
    ) * (PLOT_RIGHT - PLOT_LEFT);
    const yForPrice = (price: number) => PLOT_TOP + (high - price) / Math.max(1, high - low) * (PLOT_BOTTOM - PLOT_TOP);

    const sideValues = aggregate.cells.flatMap((cell) => [
      sideValue(cell, "CALL", activeMetric),
      sideValue(cell, "PUT", activeMetric),
    ]).filter((value) => value > 0);
    const heatCeiling = Math.max(1, percentile(sideValues, 0.94));
    const visibleLevels = aggregate.levels
      .filter((level) => level.price >= low && level.price <= high)
      .sort((left, right) => Math.abs(left.price - center) - Math.abs(right.price - center))
      .slice(0, 38)
      .sort((left, right) => right.price - left.price);
    const totalCallPremium = aggregate.levels.reduce((sum, level) => sum + level.callPremium, 0);
    const totalPutPremium = aggregate.levels.reduce((sum, level) => sum + level.putPremium, 0);
    const totalPremium = totalCallPremium + totalPutPremium;
    const hottest = [...aggregate.levels].sort((left, right) => (
      sideValue(right, "CALL", activeMetric) + sideValue(right, "PUT", activeMetric)
      - sideValue(left, "CALL", activeMetric) - sideValue(left, "PUT", activeMetric)
    ))[0] ?? null;
    return {
      snapshotPrice,
      startTime,
      endTime,
      selectedTime: endTime,
      cellDurationMs: 60_000,
      bucketSize,
      low,
      high,
      xForTime,
      yForPrice,
      cells: aggregate.cells
        .filter((cell) => cell.price >= low && cell.price <= high)
        .slice(-MAX_HEAT_CELLS),
      levels: visibleLevels,
      heatCeiling,
      totalCall: totalCallPremium,
      totalPut: totalPutPremium,
      total: totalPremium,
      hottest,
    };
  }, [activeMetric, activeReplayHistory, optionsTape, payload.asOf, payload.marketOpen, payload.nqPrice, replayIndex, view, windowMinutes]);

  const currentPrice = view === "REPLAY"
    ? model.snapshotPrice
    : livePrice !== null && Number.isFinite(livePrice)
      ? livePrice
      : model.snapshotPrice;
  const pricePath = useMemo(() => {
    const pathHistory = view === "REPLAY" ? activeReplayHistory : history;
    const historyLimit = view === "REPLAY" ? replayIndex + 1 : pathHistory?.timestamps.length ?? 0;
    const historicalPricePoints = pathHistory && Array.isArray(pathHistory.timestamps) && Array.isArray(pathHistory.nqPrices)
      ? pathHistory.timestamps.slice(0, historyLimit).map((timestamp, index) => ({
          timestamp: normalizeTimestamp(Number(timestamp)),
          price: Number(pathHistory.futuresPrices[index] ?? pathHistory.nqPrices[index]),
        }))
      : [];
    const livePoint = view === "LIVE" && livePrice !== null && Number.isFinite(livePrice)
      ? [{ timestamp: model.endTime, price: livePrice }]
      : [];
    const combinedPoints = [
      ...historicalPricePoints,
      ...(view === "LIVE" ? priceTicks : []).map((point) => ({
        timestamp: normalizeTimestamp(Number(point.timestamp)),
        price: Number(point.price),
      })),
      ...livePoint,
    ]
      .filter((point): point is { timestamp: number; price: number } => (
        point.timestamp !== null
        && point.timestamp >= model.startTime
        && point.timestamp <= model.endTime
        && Number.isFinite(point.price)
        && point.price >= model.low - model.bucketSize
        && point.price <= model.high + model.bucketSize
      ))
      .sort((left, right) => left.timestamp - right.timestamp);
    const pointBuckets = new Map<number, { timestamp: number; price: number }>();
    for (const point of combinedPoints) {
      pointBuckets.set(Math.floor(point.timestamp / 5_000), point);
    }
    return [...pointBuckets.values()].map((point, index) => (
      `${index ? "L" : "M"}${model.xForTime(point.timestamp).toFixed(2)},${model.yForPrice(point.price).toFixed(2)}`
    )).join(" ");
  }, [activeReplayHistory, history, livePrice, model, priceTicks, replayIndex, view]);

  const maximumLevelValue = Math.max(
    1,
    ...model.levels.flatMap((level) => [
      sideValue(level, "CALL", activeMetric),
      sideValue(level, "PUT", activeMetric),
    ]),
  );
  const callShare = model.total > 0 ? model.totalCall / model.total : 0.5;
  const selected = selectedPrice === null
    ? model.hottest
    : model.levels.find((level) => level.price === selectedPrice) ?? model.hottest;
  const hasHeatData = view === "REPLAY"
    ? Boolean(activeReplayHistory?.timestamps.length && model.cells.length)
    : optionsTape.length > 0;
  const formatHeatValue = (value: number) => activeMetric === "PREMIUM"
    ? compactMoney(value)
    : activeMetric === "CONTRACTS"
      ? compactContracts(value)
      : compactExposure(value);
  const selectedTimestamp = activeReplayHistory?.timestamps[replayIndex] ?? model.selectedTime;

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-border bg-panel">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.06] text-primary">
            <Flame className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[6px] font-semibold uppercase tracking-[0.15em] text-primary">{view === "REPLAY" ? "HISTORICAL EXPOSURE REPLAY" : "CALL / PUT TAPE"}</div>
            <div className="mt-0.5 text-[10px] font-semibold">{view === "REPLAY" ? "Call / put gamma heatmap replay" : "Options activity heatmap"}</div>
            <div className="mt-0.5 text-[7px] text-muted">{view === "REPLAY" ? "Timestamped NDX and QQQ gamma exposure mapped to archived NQ prices." : `NDX and QQQ prints mapped onto NQ-equivalent levels with a live ${liveInstrument} price path.`}</div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-border bg-background p-1">
              {(["LIVE", "REPLAY"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setView(value);
                    setPlaying(false);
                    setSelectedPrice(null);
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[7px] font-semibold transition-colors ${view === value ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}
                >
                  {value === "LIVE" ? "Live" : "Replay"}
                </button>
              ))}
            </div>
            {view === "LIVE" ? <>
              <div className="flex rounded-xl border border-border bg-background p-1">
                {HEAT_WINDOWS.map((minutes) => (
                  <button key={minutes} type="button" onClick={() => setWindowMinutes(minutes)} className={`rounded-lg px-2.5 py-1.5 text-[7px] font-semibold transition-colors ${windowMinutes === minutes ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}>
                    {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                  </button>
                ))}
              </div>
              <div className="flex rounded-xl border border-border bg-background p-1">
                {(["PREMIUM", "CONTRACTS"] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setMetric(value)} className={`rounded-lg px-2.5 py-1.5 text-[7px] font-semibold transition-colors ${metric === value ? "bg-primary/15 text-primary" : "text-muted hover:text-foreground"}`}>
                    {value === "PREMIUM" ? "Premium" : "Contracts"}
                  </button>
                ))}
              </div>
              <span className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[6px] font-semibold ${feedStatus === "live" ? "border-primary/25 bg-primary/[0.05] text-primary" : "border-border text-muted"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${feedStatus === "live" ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"}`} />
                {liveInstrument} {feedStatus.toUpperCase()}
              </span>
            </> : <>
              <KwantSelect value={replayDate} onChange={(event) => setReplayDate(event.target.value)} menuLabel="Replay session" className="h-8 min-w-[142px] rounded-xl border border-border bg-background px-2.5 text-[7px] font-semibold text-foreground">
                {replayDates.map((date) => <option key={date} value={date}>{date}</option>)}
              </KwantSelect>
              <span className="flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/[0.05] px-2.5 py-1.5 text-[6px] font-semibold text-primary">
                <CalendarDays className="h-3 w-3" />5 sessions · GEX
              </span>
            </>}
          </div>
        </div>

        <div className="grid min-h-[650px] xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="relative min-w-0 overflow-hidden border-b border-border bg-background xl:border-b-0 xl:border-r">
            {!hasHeatData ? (
              <div className="flex h-[650px] items-center justify-center p-6 text-center">
                <div className="max-w-sm">
                  <Waves className={`mx-auto h-7 w-7 ${replayLoading ? "animate-pulse text-primary" : "text-muted"}`} />
                  <div className="mt-3 text-[10px] font-semibold">
                    {view === "REPLAY" ? replayLoading ? "Restoring historical exposure" : "Replay session unavailable" : tapeUnavailable ? "Options tape temporarily unavailable" : "Waiting for mapped options prints"}
                  </div>
                  <p className="mt-2 text-[7px] leading-5 text-muted">
                    {view === "REPLAY"
                      ? replayError || "Select one of the five most recent options sessions to load its verified exposure history."
                      : tapeUnavailable
                      ? "The live options source did not return a usable tape. Kwant Desk will retry automatically."
                      : "The heatmap appears from real NDX and QQQ consolidated call/put activity. No synthetic heat is drawn when the tape is unavailable."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative h-[650px] overflow-hidden bg-[radial-gradient(circle_at_68%_42%,color-mix(in_srgb,var(--primary)_6%,transparent),transparent_42%)]">
                <svg className="h-full w-full" viewBox="0 0 1000 560" preserveAspectRatio="none" role="img" aria-label="Mapped options call and put activity heatmap with live MNQ price">
                  <defs>
                    <linearGradient id="gexdesk-heat-fade" x1="0" x2="1">
                      <stop offset="0%" stopColor="var(--background)" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="1000" height="560" fill="var(--background)" />
                  {Array.from({ length: 9 }, (_, index) => {
                    const ratio = index / 8;
                    const y = PLOT_TOP + ratio * (PLOT_BOTTOM - PLOT_TOP);
                    const price = model.high - ratio * (model.high - model.low);
                    return (
                      <g key={`price-grid-${index}`}>
                        <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="var(--border)" strokeOpacity="0.36" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
                        <text x="930" y={y + 3} fill="var(--muted)" fontSize="9" fontFamily="monospace">{price.toFixed(0)}</text>
                      </g>
                    );
                  })}
                  {Array.from({ length: 7 }, (_, index) => {
                    const ratio = index / 6;
                    const timestamp = model.startTime + ratio * (model.endTime - model.startTime);
                    const x = PLOT_LEFT + ratio * (PLOT_RIGHT - PLOT_LEFT);
                    return (
                      <g key={`time-grid-${index}`}>
                        <line x1={x} x2={x} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="var(--border)" strokeOpacity="0.24" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
                        <text x={x} y="546" textAnchor={index === 0 ? "start" : index === 6 ? "end" : "middle"} fill="var(--muted)" fontSize="8" fontFamily="monospace">{timeLabel(timestamp)}</text>
                      </g>
                    );
                  })}
                  {model.cells.map((cell) => {
                    const x = model.xForTime(cell.timestamp);
                    const nextX = model.xForTime(cell.timestamp + model.cellDurationMs);
                    const centerY = model.yForPrice(cell.price);
                    const rowHeight = Math.max(3.5, Math.abs(model.yForPrice(cell.price - model.bucketSize / 2) - model.yForPrice(cell.price + model.bucketSize / 2)));
                    const callValue = sideValue(cell, "CALL", activeMetric);
                    const putValue = sideValue(cell, "PUT", activeMetric);
                    const callIntensity = callValue > 0 ? clamp(Math.pow(callValue / model.heatCeiling, 0.42), 0.08, 1) : 0;
                    const putIntensity = putValue > 0 ? clamp(Math.pow(putValue / model.heatCeiling, 0.42), 0.08, 1) : 0;
                    return (
                      <g key={`${cell.timestamp}:${cell.price}`}>
                        {callIntensity ? <rect x={x} y={centerY - rowHeight / 2} width={Math.max(2, nextX - x + 0.6)} height={rowHeight / 2 + 0.2} fill="var(--primary)" opacity={0.08 + callIntensity * 0.84} /> : null}
                        {putIntensity ? <rect x={x} y={centerY} width={Math.max(2, nextX - x + 0.6)} height={rowHeight / 2 + 0.2} fill="var(--accent)" opacity={0.08 + putIntensity * 0.84} /> : null}
                      </g>
                    );
                  })}
                  {selected ? (
                    <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={model.yForPrice(selected.price)} y2={model.yForPrice(selected.price)} stroke="var(--foreground)" strokeOpacity="0.26" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                  ) : null}
                  {pricePath ? (
                    <>
                      <path d={pricePath} fill="none" stroke="var(--background)" strokeOpacity="0.9" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      <path d={pricePath} fill="none" stroke="var(--foreground)" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </>
                  ) : null}
                  {currentPrice !== null ? (
                    <g className="gexdesk-live-price">
                      <line x1={PLOT_LEFT} x2="956" y1={model.yForPrice(currentPrice)} y2={model.yForPrice(currentPrice)} stroke="var(--foreground)" strokeOpacity="0.72" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                      <rect x="922" y={model.yForPrice(currentPrice) - 10} width="70" height="20" rx="5" fill="var(--primary)" />
                      <text x="957" y={model.yForPrice(currentPrice) + 3.5} textAnchor="middle" fill="var(--background)" fontSize="8.5" fontFamily="monospace" fontWeight="700">{formatPrice(currentPrice)}</text>
                    </g>
                  ) : null}
                  <rect x={PLOT_LEFT} y={PLOT_TOP} width="84" height={PLOT_BOTTOM - PLOT_TOP} fill="url(#gexdesk-heat-fade)" />
                  <text x="34" y="38" fill="var(--primary)" fontSize="8" fontFamily="monospace">CALL {view === "REPLAY" ? "GEX" : "HEAT"}</text>
                  <text x="34" y="52" fill="var(--accent)" fontSize="8" fontFamily="monospace">PUT {view === "REPLAY" ? "GEX" : "HEAT"}</text>
                </svg>
                {(view === "REPLAY" ? replayLoading : historyLoading && !history) ? (
                  <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-xl border border-border bg-background/85 px-3 py-2 text-[6px] text-muted backdrop-blur">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                    {view === "REPLAY" ? "Loading exposure frames and aligned NQ history" : "Restoring session path · live feed remains active"}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <aside className="flex min-h-0 flex-col bg-panel">
            <div className="border-b border-border px-3 py-3">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <div>
                  <div className="text-[8px] font-semibold">{view === "REPLAY" ? "Exposure ladder at replay time" : "Call / put level tape"}</div>
                  <div className="mt-0.5 text-[6px] text-muted">{view === "REPLAY" ? `${replayDate} · ${timeLabel(selectedTimestamp)} ET` : "Confidence-weighted mapped activity"}</div>
                </div>
                <span className="ml-auto font-mono text-[8px] font-semibold text-foreground">{formatPrice(currentPrice)}</span>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface">
                <div className="bg-primary" style={{ width: `${callShare * 100}%` }} />
                <div className="bg-accent" style={{ width: `${(1 - callShare) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[6px] text-muted">
                <span className="text-primary">Calls {formatHeatValue(model.totalCall)}</span>
                <span>{(callShare * 100).toFixed(0)} / {((1 - callShare) * 100).toFixed(0)}</span>
                <span className="text-accent">Puts {formatHeatValue(model.totalPut)}</span>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_74px_1fr] border-b border-border px-3 py-2 text-[6px] font-semibold uppercase tracking-[0.1em] text-muted">
              <span>Calls</span><span className="text-center">{view === "REPLAY" ? "NQ" : liveInstrument}</span><span className="text-right">Puts</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {model.levels.map((level) => {
                const callValue = sideValue(level, "CALL", activeMetric);
                const putValue = sideValue(level, "PUT", activeMetric);
                const nearLive = currentPrice !== null && Math.abs(level.price - currentPrice) <= model.bucketSize / 2;
                const active = selected?.price === level.price;
                return (
                  <button
                    key={level.price}
                    type="button"
                    onClick={() => setSelectedPrice(level.price)}
                    className={`relative grid h-9 w-full grid-cols-[1fr_74px_1fr] items-center overflow-hidden border-b border-border/45 px-3 font-mono text-[7px] transition-colors ${active ? "bg-foreground/[0.045]" : "hover:bg-surface/60"}`}
                  >
                    <span className="absolute inset-y-1 left-0 bg-primary/[0.13]" style={{ width: `${callValue / maximumLevelValue * 42}%` }} />
                    <span className="absolute inset-y-1 right-0 bg-accent/[0.13]" style={{ width: `${putValue / maximumLevelValue * 42}%` }} />
                    <span className="relative z-10 text-left text-primary">
                      {formatHeatValue(callValue)}
                      {view === "LIVE" ? <small className="ml-1 text-[5px] text-muted">{level.calls}</small> : null}
                    </span>
                    <span className={`relative z-10 rounded-md px-1.5 py-1 text-center font-semibold ${nearLive ? "bg-primary text-background shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_35%,transparent)]" : active ? "border border-foreground/20 text-foreground" : "text-foreground"}`}>{level.price.toFixed(0)}</span>
                    <span className="relative z-10 text-right text-accent">
                      {formatHeatValue(putValue)}
                      {view === "LIVE" ? <small className="ml-1 text-[5px] text-muted">{level.puts}</small> : null}
                    </span>
                  </button>
                );
              })}
              {!model.levels.length ? <div className="p-5 text-center text-[7px] leading-5 text-muted">{view === "REPLAY" ? "No call or put exposure is present in this replay frame." : "No mapped prints fall inside this time and price window."}</div> : null}
            </div>

            <div className="space-y-2 border-t border-border p-3">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                <div className="flex items-center gap-2 text-[6px] font-semibold uppercase tracking-[0.11em] text-primary"><Flame className="h-3 w-3" />Hottest mapped level</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="font-mono text-[15px] font-semibold">{selected?.price.toFixed(0) ?? "--"}</span>
                  <span className="text-right text-[6px] leading-4 text-muted">{selected ? view === "REPLAY" ? `${formatHeatValue(selected.callGex + selected.putGex)} gross GEX` : `${selected.calls + selected.puts} prints · ${compactMoney(selected.callPremium + selected.putPremium)}` : "Waiting for activity"}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3 text-[6px] leading-4 text-muted">
                <Radio className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>{view === "REPLAY" ? "Replay brightness is historical call/put gamma exposure from KwantData Interval Map frames. The white path is timestamp-aligned Databento NQ history; it is not a reconstructed options tape." : "Brightness measures actual consolidated call/put premium or contracts at each mapped level. It is options activity, not resting futures liquidity."}</span>
              </div>
              {(view === "REPLAY" ? replayError : historyError) ? <div className="text-[6px] leading-4 text-warning">{view === "REPLAY" ? replayError : historyError}</div> : null}
            </div>
          </aside>
        </div>
        {view === "REPLAY" ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-background/35 px-4 py-3">
            <button
              type="button"
              disabled={!activeReplayHistory?.timestamps.length || replayLoading}
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                  return;
                }
                if (replayIndex >= replayLatestIndex) setReplayIndex(0);
                setPlaying(true);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={playing ? "Pause replay" : "Play replay"}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              disabled={!activeReplayHistory?.timestamps.length || replayLoading}
              onClick={() => {
                setPlaying(false);
                setReplayIndex(0);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:text-foreground disabled:opacity-35"
              aria-label="Restart replay"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-[118px]">
              <div className="text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">Replay clock · ET</div>
              <div className="mt-1 font-mono text-[9px] font-semibold text-foreground">{replayDate || "---- -- --"} · {timeLabel(selectedTimestamp)}</div>
            </div>
            <input
              type="range"
              min={0}
              max={replayLatestIndex}
              step={1}
              value={Math.min(replayIndex, replayLatestIndex)}
              disabled={!activeReplayHistory?.timestamps.length || replayLoading}
              onChange={(event) => {
                setPlaying(false);
                setReplayIndex(Number(event.target.value));
                setSelectedPrice(null);
              }}
              className="h-1 min-w-[220px] flex-1 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Heatmap replay timeline"
            />
            <span className="min-w-[62px] text-right font-mono text-[7px] text-muted">
              {activeReplayHistory?.timestamps.length ? `${replayIndex + 1} / ${activeReplayHistory.timestamps.length}` : "-- / --"}
            </span>
            <div className="flex rounded-xl border border-border bg-surface p-1">
              {REPLAY_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setReplaySpeed(speed)}
                  className={`rounded-lg px-2 py-1.5 text-[7px] font-semibold transition-colors ${replaySpeed === speed ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}
                >
                  {speed}×
                </button>
              ))}
            </div>
            <div className="w-full text-[6px] leading-4 text-muted">
              Historical exposure: KwantData Interval Map · Price path: Databento NQ 1-minute history · The session list rolls forward automatically to the latest five available US options sessions.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
