"use client";

import { useMemo, useState } from "react";
import Chart, { type ChartLevel } from "@/components/Chart";
import { defaultChartSettings } from "@/lib/chartSettings";
import { generateSampleData } from "@/lib/sampleData";
import type { Candle, Trade } from "@/lib/backtester";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { strategyLaunchInstruments } from "@/lib/strategyMetadata";

const instruments = strategyLaunchInstruments;
const timeframes = ["1m", "5m", "15m", "1h", "4h"];

function chartInstrumentSymbol(instrument: string) {
  if (instrument.includes("MNQ")) return "NAS100";
  if (instrument === "S&P500") return "S&P500";
  return instrument;
}

export default function AutomationChartWorkspace({
  title = "Live Automation Chart",
  eyebrow = "Workspace",
  compact = false,
  instrument: controlledInstrument,
  timeframe: controlledTimeframe,
  onInstrumentChange,
  onTimeframeChange,
  candles,
  trades,
  levels,
  statusBadges,
}: {
  title?: string;
  eyebrow?: string;
  compact?: boolean;
  instrument?: string;
  timeframe?: string;
  onInstrumentChange?: (value: string) => void;
  onTimeframeChange?: (value: string) => void;
  candles?: Candle[];
  trades?: (Trade & { markerVisible?: boolean })[];
  levels?: ChartLevel[];
  statusBadges?: string[];
}) {
  const fallbackCandles = useMemo(() => generateSampleData(28), []);
  const fallbackTrades = useMemo<(Trade & { markerVisible?: boolean })[]>(
    () => [
      {
        entryTime: fallbackCandles[820]?.timestamp ?? fallbackCandles[0].timestamp,
        exitTime: fallbackCandles[850]?.timestamp ?? fallbackCandles[20].timestamp,
        direction: "LONG",
        entryPrice: 19820,
        exitPrice: 19860,
        stopLoss: 19800,
        takeProfit: 19860,
        pnlPoints: 40,
        pnlPercent: 0.2,
        rMultiple: 2,
        result: "WIN",
        runUp: 45,
        drawdown: 8,
        durationBars: 30,
      },
      {
        entryTime: fallbackCandles[1260]?.timestamp ?? fallbackCandles[30].timestamp,
        exitTime: fallbackCandles[1282]?.timestamp ?? fallbackCandles[55].timestamp,
        direction: "SHORT",
        entryPrice: 29482.3,
        exitPrice: 29394,
        stopLoss: 29518,
        takeProfit: 29394,
        pnlPoints: 88.3,
        pnlPercent: 0.31,
        rMultiple: 2.5,
        result: "WIN",
        runUp: 91,
        drawdown: 12,
        durationBars: 22,
      },
    ],
    [fallbackCandles]
  );

  const [localInstrument, setLocalInstrument] = useState("MNQ SEP26");
  const [localTimeframe, setLocalTimeframe] = useState("5m");
  const instrument = controlledInstrument ?? localInstrument;
  const timeframe = controlledTimeframe ?? localTimeframe;

  function handleInstrumentChange(value: string) {
    if (onInstrumentChange) {
      onInstrumentChange(value);
      return;
    }
    setLocalInstrument(value);
  }

  function handleTimeframeChange(value: string) {
    if (onTimeframeChange) {
      onTimeframeChange(value);
      return;
    }
    setLocalTimeframe(value);
  }

  const chartTrades = trades ?? fallbackTrades;
  const chartCandles = candles && candles.length > 0 ? candles : fallbackCandles;
  const badges = statusBadges ?? [instrument, timeframe, "Tradovate Sim", "Bracket Auto", "Live Overlays On"];

  return (
    <SectionCard
      eyebrow={eyebrow}
      title={title}
      action={
        <div className="flex items-center gap-2">
          <select
            value={instrument}
            onChange={(event) => handleInstrumentChange(event.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-foreground outline-none"
          >
            {instruments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            {timeframes.map((item) => (
              <button
                key={item}
                onClick={() => handleTimeframeChange(item)}
                className={`rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors ${
                  timeframe === item
                    ? "bg-primary/10 text-primary"
                    : "border border-border bg-surface text-muted hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {badges.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-muted"
            >
              {item}
            </span>
          ))}
        </div>

        <div className={`overflow-hidden rounded-2xl border border-border bg-chart-background ${compact ? "h-[420px]" : "h-[560px]"}`}>
          <Chart
            candles={chartCandles}
            trades={chartTrades}
            levels={levels}
            instrument={chartInstrumentSymbol(instrument)}
            timeframe={timeframe}
            settings={defaultChartSettings}
          />
        </div>
      </div>
    </SectionCard>
  );
}
