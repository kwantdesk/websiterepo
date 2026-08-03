"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Candle } from "@/lib/backtester";
import { futuresTickSize } from "@/lib/eventBars";
import { subscribeRithmicLiquidity, type RithmicLiquidityStatus } from "@/lib/rithmicLiquidityStream";
import {
  buildHistoricalStructureBase,
  buildStructureLevelsSnapshot,
  emptyStructureLevelsSnapshot,
  type RithmicLiquiditySnapshot,
} from "@/lib/structureLevels";

type HistoryCache = { candles: Candle[]; updatedAt: number };
const historyCache = new Map<string, HistoryCache>();
const historyRequests = new Map<string, Promise<Candle[]>>();
const HISTORY_CACHE_MS = 60_000;

function sanitizeCandles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Candle[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<Candle>;
    const candle = {
      timestamp: Number(row.timestamp),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume ?? 0),
    };
    return Object.values(candle).every(Number.isFinite) ? [candle] : [];
  }).sort((left, right) => left.timestamp - right.timestamp);
}

async function loadCanonicalHistory(symbol: string, force = false) {
  const key = `${symbol}:5m:8d`;
  const cached = historyCache.get(key);
  if (!force && cached && Date.now() - cached.updatedAt <= HISTORY_CACHE_MS) return cached.candles;
  const existing = historyRequests.get(key);
  if (existing) return existing;
  const request = fetch(`/api/databento/market?symbol=${encodeURIComponent(symbol)}&timeframe=5m&days=8`, { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json() as { candles?: unknown; error?: string };
      if (!response.ok) throw new Error(payload.error || "Five-day CME structure history is unavailable.");
      const candles = sanitizeCandles(payload.candles);
      if (!candles.length) throw new Error("CME returned no structure history.");
      historyCache.set(key, { candles, updatedAt: Date.now() });
      return candles;
    })
    .finally(() => historyRequests.delete(key));
  historyRequests.set(key, request);
  return request;
}

export function useStructureLevels(args: {
  enabled: boolean;
  symbol: string;
  instrument: string;
  contractSymbol?: string | null;
  upColor: string;
  downColor: string;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [liquidity, setLiquidity] = useState<RithmicLiquiditySnapshot | null>(null);
  const [liquidityStatus, setLiquidityStatus] = useState<RithmicLiquidityStatus>("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const tickSize = futuresTickSize(args.symbol);

  useEffect(() => {
    if (!args.enabled) return;
    let cancelled = false;
    const cached = historyCache.get(`${args.symbol}:5m:8d`)?.candles ?? [];
    if (cached.length) setCandles(cached);
    setLoading(!cached.length);
    setError("");
    void loadCanonicalHistory(args.symbol, refreshNonce > 0)
      .then((rows) => {
        if (cancelled) return;
        setCandles(rows);
        setLoading(false);
      })
      .catch((problem) => {
        if (cancelled) return;
        setLoading(false);
        setError(problem instanceof Error ? problem.message : "Structure history is unavailable.");
      });
    return () => { cancelled = true; };
  }, [args.enabled, args.symbol, refreshNonce]);

  useEffect(() => {
    if (!args.enabled) {
      setLiquidity(null);
      return;
    }
    return subscribeRithmicLiquidity({
      root: args.instrument,
      contractSymbol: args.contractSymbol,
      onSnapshot: setLiquidity,
      onStatus: setLiquidityStatus,
    });
  }, [args.contractSymbol, args.enabled, args.instrument]);

  useEffect(() => {
    if (!args.enabled) return;
    const timer = window.setInterval(() => setRefreshNonce((current) => current + 1), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [args.enabled]);

  const historySignature = candles.length
    ? `${candles.length}:${candles.at(-1)?.timestamp}:${candles.at(-1)?.close}`
    : "empty";
  const base = useMemo(
    () => buildHistoricalStructureBase({ candles, instrument: args.instrument, tickSize }),
    // The signature intentionally limits the expensive historical pass to a new
    // completed canonical five-minute bar or a refreshed historical tail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [args.instrument, historySignature, tickSize],
  );
  const snapshot = useMemo(
    () => args.enabled
      ? buildStructureLevelsSnapshot({ base, liquidity, upColor: args.upColor, downColor: args.downColor })
      : emptyStructureLevelsSnapshot(args.instrument),
    [args.downColor, args.enabled, args.instrument, args.upColor, base, liquidity],
  );

  const refresh = useCallback(() => setRefreshNonce((current) => current + 1), []);
  return { snapshot, loading, error, liquidityStatus, refresh };
}
