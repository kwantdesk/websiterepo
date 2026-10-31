"use client";

import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import type { AlgoRun } from "@/lib/algoWorkspace";
import type { AlgoChartIntegration } from "@/lib/algoChartIntegration";
import KwantLoader from "@/components/KwantLoader";

const NormalCharts = dynamic(() => import("@/components/KwantifyWorkspace"), {
  ssr: false, loading: () => <KwantLoader title="Opening charts" />,
});

/** The actual Charts workspace: same feed, panes, tools, studies and saved drawings. */
export default memo(function AlgoChart({ run, showTrades, selectedTrade, onInstrumentChange }: {
  run: AlgoRun; showTrades: boolean; selectedTrade: string | null;
  onInstrumentChange: (symbol: string) => void;
}) {
  const focus = useMemo(() => {
    const selected = run.trades.find(t => t.id === selectedTrade);
    return selected ? { id: run.id + ":" + selected.id, atMs: selected.exitTime, fromMs: selected.entryTime - 30 * 60000, toMs: selected.exitTime + 5 * 60000 } : null;
  }, [run, selectedTrade]);
  const integration = useMemo<AlgoChartIntegration>(() => {
    return {
      symbol: run.config.instrument, onInstrumentChange,
      focus,
      trades: showTrades && run.kind === "recorded" ? run.trades.map(t => ({
        entryTime: t.entryTime, exitTime: t.exitTime, direction: t.direction === "Long" ? "LONG" : "SHORT",
        entryPrice: t.entryPrice, exitPrice: t.exitPrice, stopLoss: t.stopPrice, takeProfit: t.targetPrice,
        pnlPoints: (t.direction === "Long" ? 1 : -1) * (t.exitPrice - t.entryPrice),
        pnlPercent: t.net / run.config.capital * 100, rMultiple: t.r,
        result: t.net > 0 ? "WIN" : t.net < 0 ? "LOSS" : "BREAKEVEN", runUp: 0, drawdown: 0,
        durationBars: Math.max(1, (t.exitTime - t.entryTime) / 60000), markerVisible: true,
      })) : [],
    };
  }, [run, focus, showTrades, onInstrumentChange]);
  return <NormalCharts section="charts" embedded algo={integration} />;
});
