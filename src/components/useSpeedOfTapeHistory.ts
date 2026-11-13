"use client";

import { useEffect, useRef, useState } from "react";
import { createChartWarmHistory } from "@/lib/chartWarmHistory";
import { futuresVenue } from "@/lib/futuresVenue";
import { fetchJsonWithBudget } from "@/lib/marketDataRequest";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export const TAPE_HISTORY_CHUNK_MS = 15 * 60_000;
export const TAPE_HISTORY_WINDOW_MS = 8 * TAPE_HISTORY_CHUNK_MS;
type TapeWindow = { fromMs: number; toMs: number; records: InstitutionalTrade[] };
type ExactTapePayload = {
  schemaVersion?: string; contractSymbol?: string; truncated?: boolean;
  records?: number[][]; sourceRecordCount?: number; fromMs?: number; toMs?: number;
};

const warm = createChartWarmHistory<TapeWindow>(window => window.records.length);
const pending = new Map<string, Promise<TapeWindow | null>>();

function loadWindow(contract: string, fromMs: number) {
  const key = contract + ":" + fromMs;
  const cached = warm.get(key);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const toMs = fromMs + TAPE_HISTORY_CHUNK_MS;
  const query = new URLSearchParams({
    symbol: contract, contractSymbol: contract,
    exchange: futuresVenue(contract.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "")),
    fromMs: String(fromMs), toMs: String(toMs), exactWindow: "1",
  });
  const request = fetchJsonWithBudget<ExactTapePayload>(
    "/api/institutional-market-data/v1/market-data/trade-tape?" + query, 28_000,
  ).then(({ response, payload }) => {
    if (!response.ok || payload.schemaVersion !== "kwantdesk-exact-tape-window-v1"
      || payload.contractSymbol !== contract || payload.fromMs !== fromMs || payload.toMs !== toMs
      || payload.truncated !== false || !Array.isArray(payload.records)
      || payload.records.length !== payload.sourceRecordCount || payload.records.length > 100_000) return null;
    let previous = fromMs;
    const records: InstitutionalTrade[] = [];
    for (const [recordIndex, row] of payload.records.entries()) {
      if (!Array.isArray(row) || row.length !== 4) return null;
      const [timestamp, price, volume, side] = row;
      if (!Number.isSafeInteger(timestamp) || timestamp < previous || timestamp >= toMs
        || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(volume) || volume <= 0
        || ![-1, 0, 1].includes(side)) return null;
      previous = timestamp;
      const bidVolume = side < 0 ? volume : 0, askVolume = side > 0 ? volume : 0;
      records.push({ timestamp, recordIndex, open: price, high: price, low: price, close: price,
        volume, trades: 1, bidVolume, askVolume, delta: askVolume - bidVolume,
        sideSemanticsVersion: 2, aggressor: side > 0 ? "BUY" : side < 0 ? "SELL" : "UNKNOWN" });
    }
    const window = { fromMs, toMs, records };
    warm.put(key, window);
    return window;
  }).catch(() => null).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

const EMPTY_WINDOWS: TapeWindow[] = [];

export function useSpeedOfTapeHistory(contract: string | null, fromMs: number, toMs: number) {
  const [state, setState] = useState<{ contract: string; windows: TapeWindow[] } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (!contract || fromMs <= 0 || toMs <= fromMs) return;
    let active = true;
    const previous = stateRef.current;
    const loaded = new Set(previous?.contract === contract ? previous.windows.map(window => window.fromMs) : []);
    const timer = window.setTimeout(async () => {
      // Newest first and one bounded archive read at a time. Same-contract panes
      // share identical requests and scrolling stops obsolete queued reads.
      for (let start = toMs - TAPE_HISTORY_CHUNK_MS; active && start >= fromMs; start -= TAPE_HISTORY_CHUNK_MS) {
        if (loaded.has(start)) continue;
        const result = await loadWindow(contract, start);
        if (!active || !result) continue;
        setState(previous => {
          const windows = previous?.contract === contract ? previous.windows : [];
          if (windows.some(window => window.fromMs === result.fromMs)) return previous;
          const next = [...windows, result].filter(window => window.toMs > fromMs && window.fromMs < toMs)
            .sort((a, b) => a.fromMs - b.fromMs);
          return { contract, windows: next };
        });
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [contract, fromMs, toMs]);
  return state && state.contract === contract ? state.windows : EMPTY_WINDOWS;
}
