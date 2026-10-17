"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "@/lib/backtester";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";
import { decodeCompactFootprintHistory } from "@/lib/compactFootprintHistory";
import { futuresVenue } from "@/lib/futuresVenue";
const EMPTY: InstitutionalTrade[] = [];

export function useExactFootprintHistory(contract: string | null, candles: Candle[], intervalMs: number | null, enabled: boolean, live: boolean,
  minimumTradeVolume = 0, maximumTradeVolume = 0) {
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const fromMs = candles[0]?.timestamp ?? 0;
  const last = candles.at(-1)?.timestamp ?? 0;
  // An active market does not make a candle in a scrolled-back viewport live.
  const forming = live && last + (intervalMs ?? 0) > Date.now();
  const toMs = forming ? last : last + (intervalMs ?? 0);
  const active = enabled && Boolean(contract && /[FGHJKMNQUVXZ]\d{1,2}$/.test(contract)) && intervalMs !== null && intervalMs >= 60000 && toMs > fromMs;
  const signature = active ? candles.filter(c => c.timestamp < toMs)
    .map(c => `${c.timestamp}:${c.open}:${c.high}:${c.low}:${c.close}:${c.volume}`).join(";") : "";
  const scope = active ? `${contract}:${intervalMs}:${fromMs}:${toMs}:${minimumTradeVolume}:${maximumTradeVolume}:${signature}` : "";
  const [state, setState] = useState<{ scope: string; contract: string | null; records: InstitutionalTrade[]; error: string | null }>({ scope: "", contract: null, records: [], error: null });
  useEffect(() => {
    if (!scope || !contract) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const root = contract.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
      const query = new URLSearchParams({ symbol: contract, exchange: futuresVenue(root),
        contractSymbol: contract });
      void fetch(`/api/institutional-market-data/v1/market-data/trade-tape?${query}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts: candlesRef.current.filter(c => c.timestamp < toMs).map(c => c.timestamp),
          toMs, minimumTradeVolume, maximumTradeVolume }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]), cache: "no-store" })
        .then(async response => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Exact Footprint history is unavailable.");
          const records = decodeCompactFootprintHistory(payload, contract, candlesRef.current, fromMs, toMs, minimumTradeVolume, maximumTradeVolume);
          if (!controller.signal.aborted) setState({ scope, contract, records, error: null });
        }).catch(error => {
          if (!controller.signal.aborted) setState(previous => ({ scope, contract,
            records: previous.contract === contract ? previous.records : [],
            error: error instanceof Error ? error.message : "Exact Footprint history is unavailable." }));
        });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [scope, contract, fromMs, toMs, minimumTradeVolume, maximumTradeVolume]);
  // A new live minute must not blank every settled footprint while its exact
  // history loads. Retain only overlapping, same-contract proven executions.
  const records = useMemo(() => state.contract === contract
    ? state.records.filter(row => row.timestamp >= fromMs && row.timestamp < toMs) : EMPTY,
  [state.contract, state.records, contract, fromMs, toMs]);
  return { active, boundary: toMs, records, error: state.scope === scope ? state.error : null };
}
