"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeMarketIndexSnapshot, type MarketIndexLiveSnapshot } from "@/lib/marketIndexLiveClient";
import {
  buildVixEnvironmentSnapshot,
  normalizeVixHistoryCandles,
  resolveVixEnvironmentSymbol,
  type VixEnvironmentSnapshot,
  type VixEnvironmentThresholds,
  type VixHistoryCandle,
} from "@/lib/vixEnvironment";

type HistoryCacheEntry = {
  expiresAt: number;
  promise: Promise<{ rows: VixHistoryCandle[]; source: string }>;
};

const HISTORY_CACHE = new Map<string, HistoryCacheEntry>();
const HISTORY_TTL_MS = 15 * 60_000;

function historyCacheKey(symbol: string, asOfMs: number) {
  return `${symbol}:${new Date(asOfMs).toISOString().slice(0, 10)}`;
}

function loadHistory(symbol: "VIX" | "VXN", asOfMs: number) {
  const key = historyCacheKey(symbol, asOfMs);
  const cached = HISTORY_CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const to = String(asOfMs);
  const from = String(asOfMs - 370 * 86_400_000);
  const promise = fetch(
    `/api/market-indices?symbol=${encodeURIComponent(symbol)}&timeframe=1D&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { cache: "no-store" },
  ).then(async (response) => {
    const payload = await response.json() as { candles?: unknown; source?: string; error?: string };
    if (!response.ok) throw new Error(payload.error || `${symbol} history is unavailable.`);
    return {
      rows: normalizeVixHistoryCandles(payload.candles),
      source: String(payload.source ?? "server market-index history"),
    };
  });
  HISTORY_CACHE.set(key, { expiresAt: Date.now() + HISTORY_TTL_MS, promise });
  promise.catch(() => {
    if (HISTORY_CACHE.get(key)?.promise === promise) HISTORY_CACHE.delete(key);
  });
  return promise;
}

export function useVixEnvironment(options: {
  enabled: boolean;
  instrument: string;
  sourceSetting?: unknown;
  replayTimestampMs?: number | null;
  thresholds?: Partial<VixEnvironmentThresholds>;
}) {
  const symbol = resolveVixEnvironmentSymbol(options.instrument, options.sourceSetting);
  const [liveHistoryClock] = useState(() => Date.now());
  const historyAsOfMs = options.replayTimestampMs ?? liveHistoryClock;
  const [history, setHistory] = useState<VixHistoryCandle[]>([]);
  const [historySource, setHistorySource] = useState("server market-index history");
  const [live, setLive] = useState<MarketIndexLiveSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.enabled) {
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setHistory([]);
    setLoading(true);
    setError(null);
    void loadHistory(symbol, historyAsOfMs).then(({ rows, source }) => {
      if (cancelled) return;
      setHistory(rows);
      setHistorySource(source);
      setLoading(false);
    }).catch((loadError) => {
      if (cancelled) return;
      setError(loadError instanceof Error ? loadError.message : `${symbol} history is unavailable.`);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [historyAsOfMs, options.enabled, symbol]);

  useEffect(() => {
    if (!options.enabled || options.replayTimestampMs !== null && options.replayTimestampMs !== undefined) {
      setLive(null);
      return;
    }
    return subscribeMarketIndexSnapshot(
      symbol,
      (snapshot) => {
        setLive(snapshot);
        setError(null);
        setLoading(false);
      },
      (snapshotError) => setError(snapshotError.message),
    );
  }, [options.enabled, options.replayTimestampMs, symbol]);

  const snapshot = useMemo<VixEnvironmentSnapshot | null>(() => {
    const asOfMs = options.replayTimestampMs ?? live?.timestamp ?? Date.now();
    const built = buildVixEnvironmentSnapshot({
      symbol,
      live,
      history,
      asOfMs,
      thresholds: options.thresholds,
      replay: options.replayTimestampMs !== null && options.replayTimestampMs !== undefined,
    });
    return built && historySource && !built.sourceLabel.includes(historySource) && !live
      ? { ...built, sourceLabel: `${symbol} · ${historySource}` }
      : built;
  }, [history, historySource, live, options.replayTimestampMs, options.thresholds, symbol]);

  return { snapshot, loading, error, symbol };
}
