"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, DatabaseZap } from "lucide-react";

import {
  subscribeRithmicLiquidity,
  type RithmicLiquidityStatus,
} from "@/lib/rithmicLiquidityStream";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { ChartSettings } from "@/lib/chartSettings";
import type { RithmicLiquiditySnapshot } from "@/lib/structureLevels";

type Props = {
  instrument: string;
  contractSymbol?: string | null;
  latestPrice?: number | null;
  indicator: ChartIndicatorInstance;
  chartSettings: ChartSettings;
};

type LadderRow = {
  price: number;
  bidSize: number;
  askSize: number;
  bidOrders: number;
  askOrders: number;
  bidCumulative: number;
  askCumulative: number;
};

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function finite(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function decimalPlaces(tickSize: number) {
  if (tickSize >= 1) return 0;
  if (tickSize >= 0.1) return 1;
  if (tickSize >= 0.01) return 2;
  return 3;
}

function statusLabel(status: RithmicLiquidityStatus, snapshot: RithmicLiquiditySnapshot | null) {
  if (status === "connected" && snapshot?.bookValid) return "LIVE";
  if (status === "checking") return "SYNCING";
  return "OFFLINE";
}

export default function DepthOfMarketPanel({
  instrument,
  contractSymbol,
  latestPrice,
  indicator,
  chartSettings,
}: Props) {
  const [snapshot, setSnapshot] = useState<RithmicLiquiditySnapshot | null>(null);
  const [status, setStatus] = useState<RithmicLiquidityStatus>("checking");
  const settings = indicator.settings ?? {};
  const width = Math.max(176, Math.min(420, finite(settings.width, 244)));
  const requestedRows = Math.max(11, Math.min(101, Math.round(finite(settings.rows, 41))));
  const rowCount = requestedRows % 2 === 0 ? requestedRows + 1 : requestedRows;
  const groupTicks = Math.max(1, Math.min(100, Math.round(finite(settings.groupTicks, 1))));
  const showCumulative = settings.showCumulative === true;
  const showOrderCount = settings.showOrderCount === true;
  const useThemeColors = settings.useThemeColors !== false;
  const bidColor = useThemeColors ? chartSettings.upColor : String(settings.bidColor ?? chartSettings.upColor);
  const askColor = useThemeColors ? chartSettings.downColor : String(settings.askColor ?? chartSettings.downColor);

  useEffect(() => subscribeRithmicLiquidity({
    root: instrument,
    contractSymbol,
    exchange: "CME",
    onSnapshot: setSnapshot,
    onStatus: setStatus,
  }), [contractSymbol, instrument]);

  const model = useMemo(() => {
    const tickSize = snapshot?.tickSize && snapshot.tickSize > 0 ? snapshot.tickSize : 0.25;
    const increment = tickSize * groupTicks;
    const grouped = new Map<number, Omit<LadderRow, "bidCumulative" | "askCumulative">>();
    for (const level of snapshot?.levels ?? []) {
      const price = Math.round(level.price / increment) * increment;
      const key = Math.round(price / increment);
      const current = grouped.get(key) ?? {
        price,
        bidSize: 0,
        askSize: 0,
        bidOrders: 0,
        askOrders: 0,
      };
      if (level.side === "BID") {
        current.bidSize += level.size;
        current.bidOrders += level.orders;
      } else {
        current.askSize += level.size;
        current.askOrders += level.orders;
      }
      grouped.set(key, current);
    }

    const bidPrices = [...grouped.values()].filter((row) => row.bidSize > 0).map((row) => row.price);
    const askPrices = [...grouped.values()].filter((row) => row.askSize > 0).map((row) => row.price);
    const bestBid = bidPrices.length ? Math.max(...bidPrices) : null;
    const bestAsk = askPrices.length ? Math.min(...askPrices) : null;
    const bookMid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk;
    const centre = Number.isFinite(Number(latestPrice)) && Number(latestPrice) > 0
      ? Number(latestPrice)
      : bookMid ?? 0;
    const centreTick = Math.round(centre / increment);
    const half = Math.floor(rowCount / 2);
    let bidCumulative = 0;
    let askCumulative = 0;
    const rows: LadderRow[] = [];
    for (let offset = half; offset >= -half; offset -= 1) {
      const key = centreTick + offset;
      const current = grouped.get(key) ?? {
        price: key * increment,
        bidSize: 0,
        askSize: 0,
        bidOrders: 0,
        askOrders: 0,
      };
      bidCumulative += current.bidSize;
      askCumulative += current.askSize;
      rows.push({ ...current, bidCumulative, askCumulative });
    }
    const maxSize = Math.max(1, ...rows.flatMap((row) => [
      showCumulative ? row.bidCumulative : row.bidSize,
      showCumulative ? row.askCumulative : row.askSize,
    ]));
    return { rows, maxSize, bestBid, bestAsk, increment, precision: decimalPlaces(tickSize) };
  }, [groupTicks, latestPrice, rowCount, showCumulative, snapshot]);

  const connected = status === "connected" && Boolean(snapshot?.bookValid);

  return (
    <aside
      className="absolute bottom-[92px] right-[74px] top-16 z-[18] flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background/94 shadow-2xl shadow-black/45 backdrop-blur-xl"
      style={{ width }}
      aria-label="Live depth of market"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2.5">
        <DatabaseZap className="h-3.5 w-3.5 text-primary" />
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] font-bold tracking-[0.12em] text-foreground">DEPTH OF MARKET</div>
          <div className="truncate font-mono text-[8px] text-muted">{snapshot?.contractSymbol || contractSymbol || instrument} · FULL BOOK</div>
        </div>
        <div className={`ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[7px] font-bold ${connected ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-primary" : "bg-muted"}`} />
          {statusLabel(status, snapshot)}
        </div>
      </header>

      <div className="grid h-6 shrink-0 grid-cols-[1fr_76px_1fr] items-center border-b border-border/70 bg-surface/35 px-1.5 font-mono text-[7px] font-semibold tracking-[0.1em] text-muted">
        <span className="text-right">BID {showCumulative ? "CUM" : "SIZE"}</span>
        <span className="text-center">PRICE</span>
        <span>ASK {showCumulative ? "CUM" : "SIZE"}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {model.rows.map((row) => {
          const bidValue = showCumulative ? row.bidCumulative : row.bidSize;
          const askValue = showCumulative ? row.askCumulative : row.askSize;
          const atBid = model.bestBid !== null && Math.abs(row.price - model.bestBid) < model.increment / 2;
          const atAsk = model.bestAsk !== null && Math.abs(row.price - model.bestAsk) < model.increment / 2;
          const atMarket = atBid || atAsk;
          return (
            <div
              key={row.price}
              className={`relative grid grid-cols-[1fr_76px_1fr] items-center border-b border-border/[0.16] px-1.5 font-mono ${atMarket ? "bg-primary/[0.07]" : ""}`}
              style={{ height: `${100 / rowCount}%`, minHeight: 11 }}
            >
              <div className="relative flex h-full items-center justify-end overflow-hidden pr-1.5">
                <span className="absolute inset-y-[1px] right-0 rounded-l-sm opacity-20" style={{ width: `${bidValue / model.maxSize * 100}%`, backgroundColor: bidColor }} />
                <span className="relative text-[8px] font-semibold" style={{ color: bidValue ? bidColor : "var(--muted)" }}>
                  {showOrderCount && row.bidOrders ? `${row.bidOrders} · ` : ""}{bidValue ? numberFormatter.format(bidValue) : ""}
                </span>
              </div>
              <div className={`relative flex h-full items-center justify-center border-x border-border/35 text-[8px] font-semibold ${atMarket ? "text-primary" : "text-foreground"}`}>
                {row.price.toFixed(model.precision)}
                {atMarket ? <span className="absolute left-1 h-1 w-1 rounded-full bg-primary shadow-[0_0_7px_var(--primary)]" /> : null}
              </div>
              <div className="relative flex h-full items-center overflow-hidden pl-1.5">
                <span className="absolute inset-y-[1px] left-0 rounded-r-sm opacity-20" style={{ width: `${askValue / model.maxSize * 100}%`, backgroundColor: askColor }} />
                <span className="relative text-[8px] font-semibold" style={{ color: askValue ? askColor : "var(--muted)" }}>
                  {askValue ? numberFormatter.format(askValue) : ""}{showOrderCount && row.askOrders ? ` · ${row.askOrders}` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-1.5 border-t border-border bg-surface/30 px-2 font-mono text-[7px] text-muted">
        <Activity className={`h-3 w-3 ${connected ? "text-primary" : "text-muted"}`} />
        <span>{snapshot?.fullDepth ? "FULL DEPTH" : "WAITING FOR FULL DEPTH"}</span>
        {snapshot?.ageMs != null ? <span className="ml-auto">{Math.max(0, Math.round(snapshot.ageMs))}MS</span> : null}
      </footer>
    </aside>
  );
}
