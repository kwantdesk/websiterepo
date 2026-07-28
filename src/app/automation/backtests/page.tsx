"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Gauge,
  Layers3,
  Play,
  Scale,
  Settings2,
  Sparkles,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import AutomationChartWorkspace from "@/components/automation/AutomationChartWorkspace";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { runBacktest, runStrategyCode, type BacktestConfig, type Candle, type Trade } from "@/lib/backtester";
import {
  appendAutomationBacktestRun,
  appendJournalEvent,
  attachBacktestSnapshotToSavedStrategyVersion,
  createJournalId,
  loadSavedStrategiesRaw,
  loadAutomationBacktest,
  loadAutomationBacktestHistory,
  normalizeSavedStrategies,
  saveAutomationBacktest,
  type AutomationBacktestSnapshot,
  type StrategyDraft,
} from "@/lib/automation";

type StrategyVersionOption = {
  strategyId: string;
  strategyName: string;
  version: number;
  versionLabel: string;
  timestampLabel: string;
  code: string;
  language: string;
};

type TradeFilter = "all" | "long" | "short" | "wins" | "losses";
type TradeSortKey = "entryTime" | "pnlPoints" | "pnlPercent" | "rMultiple" | "durationBars" | "runUp" | "drawdown";
type LaunchIntent = { strategyId: string; version: string; autoAnalyze: boolean };

const PENDING_BUILDER_ANALYSIS_KEY = "strategy-builder-pending-analysis";

const defaultBacktestSettings = {
  initialCapital: 10000,
  baseCurrency: "USD",
  orderSizeType: "fixed_quantity",
  orderSizeValue: 1,
  pyramiding: 0,
  commissionType: "fixed_contract",
  commissionValue: 1.82,
  slippage: 0.5,
  marginLong: 100,
  marginShort: 100,
  datePreset: "60",
  dateFrom: "",
  dateTo: "",
  fillOrders: "next_bar_open",
};

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function plainMoney(value: number) {
  return `$${Math.abs(value).toFixed(2)}`;
}

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ratio(value: number) {
  if (!Number.isFinite(value)) return "--";
  if (value >= 900) return "999";
  return value.toFixed(2);
}

function bars(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)} bars`;
}

function formatRunStamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTradeStamp(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseStrategyVersions(raw: string | null): StrategyVersionOption[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StrategyDraft[];
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((strategy) => {
      const fallbackTimestamp = strategy.updatedAt ?? strategy.createdAt ?? new Date().toISOString();
      const fallbackVersion = strategy.currentVersion ?? 1;
      const versions =
        strategy.versions && strategy.versions.length > 0
          ? strategy.versions
          : [{ code: strategy.code, timestamp: fallbackTimestamp, version: fallbackVersion }];

      return versions
        .filter((version) => typeof version.code === "string")
        .map((version) => ({
          strategyId: strategy.id,
          strategyName: strategy.name,
          version: version.version,
          versionLabel: `v${version.version}`,
          timestampLabel: new Date(version.timestamp).toLocaleDateString(),
          code: version.code,
          language: strategy.language ?? "JavaScript",
        }));
    });
  } catch {
    return [];
  }
}

function buildBacktestAnalysisPrompt(snapshot: AutomationBacktestSnapshot, code: string) {
  const bestTrades = [...snapshot.trades]
    .sort((left, right) => right.pnlPoints - left.pnlPoints)
    .slice(0, 5)
    .map((trade, index) => `${index + 1}. ${trade.direction} ${trade.result} | pnl ${trade.pnlPoints.toFixed(2)} pts | r ${trade.rMultiple.toFixed(2)} | runup ${trade.runUp.toFixed(2)} | dd ${trade.drawdown.toFixed(2)} | bars ${trade.durationBars}`)
    .join("\n");
  const worstTrades = [...snapshot.trades]
    .sort((left, right) => left.pnlPoints - right.pnlPoints)
    .slice(0, 5)
    .map((trade, index) => `${index + 1}. ${trade.direction} ${trade.result} | pnl ${trade.pnlPoints.toFixed(2)} pts | r ${trade.rMultiple.toFixed(2)} | runup ${trade.runUp.toFixed(2)} | dd ${trade.drawdown.toFixed(2)} | bars ${trade.durationBars}`)
    .join("\n");
  const recentTrades = snapshot.trades
    .slice(-12)
    .map((trade, index) => `${index + 1}. ${trade.direction} ${trade.result} | pnl ${trade.pnlPoints.toFixed(2)} pts | r ${trade.rMultiple.toFixed(2)} | bars ${trade.durationBars}`)
    .join("\n");

  return `BACKTEST ANALYSIS REQUEST

Analyze this Kwantify strategy backtest like a serious strategy research partner. Do not rewrite the code yet unless I explicitly ask. Journal the lesson, identify what worked, what did not, what might be a data/sample issue, what we should test next, and what we should avoid changing so we do not go in circles.

Required answer structure:
1. Verdict
2. What is good
3. What is worrying
4. Evidence breakdown
5. Hypotheses
6. One-change improvement plan
7. What not to change yet
8. Next exact experiment

Backtest summary:
- Strategy: ${snapshot.strategyName}${snapshot.strategyVersionLabel ? ` ${snapshot.strategyVersionLabel}` : ""}
- Instrument/timeframe: ${snapshot.instrument} ${snapshot.timeframe}
- Range: ${snapshot.rangeLabel ?? "saved run"}
- Initial capital: ${(snapshot.initialCapital ?? 0).toFixed(2)}
- Total trades: ${snapshot.totalTrades}
- Win rate: ${snapshot.winRate.toFixed(2)}%
- Profit factor: ${snapshot.profitFactor.toFixed(2)}
- Net PnL: ${snapshot.totalPnL.toFixed(2)}
- Return: ${(snapshot.totalPnLPercent ?? 0).toFixed(2)}%
- Max drawdown: ${snapshot.maxDrawdown.toFixed(2)}
- Max drawdown percent: ${(snapshot.maxDrawdownPercent ?? 0).toFixed(2)}%
- Average R: ${(snapshot.averageRMultiple ?? 0).toFixed(2)}
- Sharpe: ${(snapshot.sharpeRatio ?? 0).toFixed(2)}
- Sortino: ${(snapshot.sortinoRatio ?? 0).toFixed(2)}
- Gross profit/loss: ${(snapshot.grossProfit ?? 0).toFixed(2)} / ${(snapshot.grossLoss ?? 0).toFixed(2)}
- Average winner/loser: ${(snapshot.avgWinningTrade ?? 0).toFixed(2)} / ${(snapshot.avgLosingTrade ?? 0).toFixed(2)}
- Largest winner/loser: ${(snapshot.largestWinningTrade ?? 0).toFixed(2)} / ${(snapshot.largestLosingTrade ?? 0).toFixed(2)}
- Average bars in winners/losers: ${(snapshot.avgBarsInWinningTrades ?? 0).toFixed(2)} / ${(snapshot.avgBarsInLosingTrades ?? 0).toFixed(2)}

Direction split:
- Long: ${snapshot.longTrades ? `${snapshot.longTrades.totalTrades} trades | WR ${snapshot.longTrades.winRate.toFixed(2)}% | PF ${snapshot.longTrades.profitFactor.toFixed(2)} | net ${snapshot.longTrades.totalPnL.toFixed(2)}` : "unavailable"}
- Short: ${snapshot.shortTrades ? `${snapshot.shortTrades.totalTrades} trades | WR ${snapshot.shortTrades.winRate.toFixed(2)}% | PF ${snapshot.shortTrades.profitFactor.toFixed(2)} | net ${snapshot.shortTrades.totalPnL.toFixed(2)}` : "unavailable"}

Best trades:
${bestTrades || "No trade sample available"}

Worst trades:
${worstTrades || "No trade sample available"}

Recent trades:
${recentTrades || "No trade sample available"}

Strategy code:
\`\`\`javascript
${code}
\`\`\``;
}

function BacktestEquityCurve({ equityCurve }: { equityCurve: { timestamp: number; equity: number }[] }) {
  if (!equityCurve.length) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 text-[13px] text-muted">
        Run a backtest to see the equity path.
      </div>
    );
  }

  const width = 900;
  const height = 280;
  const padding = { top: 20, right: 70, bottom: 30, left: 16 };
  const minEquity = Math.min(...equityCurve.map((point) => point.equity));
  const maxEquity = Math.max(...equityCurve.map((point) => point.equity));
  const range = Math.max(maxEquity - minEquity, 1);
  const yMin = minEquity - range * 0.08;
  const yMax = maxEquity + range * 0.08;
  const xScale = (index: number) =>
    padding.left + (index / Math.max(equityCurve.length - 1, 1)) * (width - padding.left - padding.right);
  const yScale = (value: number) => padding.top + ((yMax - value) / (yMax - yMin)) * (height - padding.top - padding.bottom);
  const path = equityCurve
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(index)} ${yScale(point.equity)}`)
    .join(" ");
  const fillPath = `${path} L ${xScale(equityCurve.length - 1)} ${height - padding.bottom} L ${xScale(0)} ${height - padding.bottom} Z`;
  const finalPoint = equityCurve[equityCurve.length - 1];
  const finalColor = finalPoint.equity >= equityCurve[0].equity ? "#00F5A0" : "#EF4444";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full overflow-hidden rounded-2xl border border-border bg-chart-background">
      <path d={fillPath} fill="rgba(0,245,160,0.10)" />
      <path d={path} fill="none" stroke={finalColor} strokeWidth="2" />
      <circle cx={xScale(equityCurve.length - 1)} cy={yScale(finalPoint.equity)} r="4" fill={finalColor} />
      <text
        x={width - padding.right + 8}
        y={yScale(finalPoint.equity) + 4}
        fill={finalColor}
        fontSize="10"
        fontFamily="monospace"
      >
        {finalPoint.equity.toFixed(2)}
      </text>
    </svg>
  );
}

function DirectionSummaryCard({
  title,
  tone,
  trades,
  winRate,
  profitFactor,
  netPnl,
  avgTrade,
}: {
  title: string;
  tone: string;
  trades?: number;
  winRate?: number;
  profitFactor?: number;
  netPnl?: number;
  avgTrade?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-4">
      <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${tone}`}>{title}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-[11px] text-muted">Trades</div>
          <div className="mt-1 text-[18px] font-semibold text-foreground">{typeof trades === "number" ? trades : "--"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted">Win Rate</div>
          <div className="mt-1 text-[18px] font-semibold text-foreground">{typeof winRate === "number" ? `${winRate.toFixed(1)}%` : "--"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted">Profit Factor</div>
          <div className="mt-1 text-[18px] font-semibold text-foreground">{typeof profitFactor === "number" ? ratio(profitFactor) : "--"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted">Avg Trade</div>
          <div className="mt-1 text-[18px] font-semibold text-foreground">{typeof avgTrade === "number" ? money(avgTrade) : "--"}</div>
        </div>
      </div>
      <div className={`mt-4 text-[13px] font-medium ${typeof netPnl === "number" && netPnl >= 0 ? "text-primary" : "text-danger"}`}>
        {typeof netPnl === "number" ? money(netPnl) : "--"} net
      </div>
    </div>
  );
}

export default function AutomationBacktestsPage() {
  const [savedStrategies, setSavedStrategies] = useState<ReturnType<typeof normalizeSavedStrategies>>([]);
  const [versionOptions, setVersionOptions] = useState<StrategyVersionOption[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState("");
  const [selectedVersion, setSelectedVersion] = useState("1");
  const [selectedInstrument, setSelectedInstrument] = useState("MNQ SEP26");
  const [selectedTimeframe, setSelectedTimeframe] = useState("5m");
  const [backtesting, setBacktesting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [history, setHistory] = useState<AutomationBacktestSnapshot[]>([]);
  const [snapshot, setSnapshot] = useState<AutomationBacktestSnapshot | null>(null);
  const [settings, setSettings] = useState(defaultBacktestSettings);
  const [historicalCandles, setHistoricalCandles] = useState<Candle[]>([]);
  const [historicalSource, setHistoricalSource] = useState("Awaiting history");
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>("all");
  const [tradeSortKey, setTradeSortKey] = useState<TradeSortKey>("entryTime");
  const [tradeSortDirection, setTradeSortDirection] = useState<"asc" | "desc">("desc");
  const [launchIntent, setLaunchIntent] = useState<LaunchIntent | null>(null);
  const [showRunConfig, setShowRunConfig] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = loadSavedStrategiesRaw();
    const strategies = normalizeSavedStrategies(raw);
    const versions = parseStrategyVersions(raw);

    setSavedStrategies(strategies);
    setVersionOptions(versions);
    setHistory(loadAutomationBacktestHistory());
    setSnapshot(loadAutomationBacktest());

    const urlSearchParams = new URLSearchParams(window.location.search);
    const requestedStrategyId = urlSearchParams.get("strategyId");
    const requestedVersion = urlSearchParams.get("version");
    const requestedInstrument = urlSearchParams.get("instrument");
    const requestedTimeframe = urlSearchParams.get("timeframe");
    const requestedAnalyze = urlSearchParams.get("analyze") === "1";

    const initialStrategy =
      (requestedStrategyId && strategies.find((strategy) => strategy.id === requestedStrategyId)) ?? strategies[0];

    if (requestedInstrument) {
      setSelectedInstrument(requestedInstrument);
    }

    if (requestedTimeframe) {
      setSelectedTimeframe(requestedTimeframe);
    }

    if (initialStrategy) {
      setSelectedStrategyId(initialStrategy.id);
      const firstVersion =
        (requestedVersion &&
          versions.find(
            (item) => item.strategyId === initialStrategy.id && String(item.version) === requestedVersion
          )) ||
        versions.find((item) => item.strategyId === initialStrategy.id);
      if (firstVersion) {
        setSelectedVersion(String(firstVersion.version));
      }
    }

    if (requestedStrategyId && requestedVersion) {
      setLaunchIntent({ strategyId: requestedStrategyId, version: requestedVersion, autoAnalyze: requestedAnalyze });
    }
  }, []);

  const selectedVersionOption = useMemo(
    () =>
      versionOptions.find(
        (option) => option.strategyId === selectedStrategyId && String(option.version) === selectedVersion
      ) ?? null,
    [selectedStrategyId, selectedVersion, versionOptions]
  );

  const versionChoices = useMemo(
    () => versionOptions.filter((option) => option.strategyId === selectedStrategyId),
    [selectedStrategyId, versionOptions]
  );

  useEffect(() => {
    if (versionChoices.length > 0 && !versionChoices.some((option) => String(option.version) === selectedVersion)) {
      setSelectedVersion(String(versionChoices[0].version));
    }
  }, [selectedVersion, versionChoices]);

  useEffect(() => {
    if (!history.length || !selectedStrategyId) return;

    const matchingRun =
      history.find(
        (run) =>
          run.strategyId === selectedStrategyId &&
          run.strategyVersionLabel === selectedVersionOption?.versionLabel &&
          run.instrument === selectedInstrument &&
          run.timeframe === selectedTimeframe
      ) ||
      history.find(
        (run) =>
          run.strategyId === selectedStrategyId &&
          run.strategyVersionLabel === selectedVersionOption?.versionLabel
      ) ||
      null;

    if (matchingRun) {
      setSnapshot(matchingRun);
      setLaunchIntent(null);
    }
  }, [history, selectedInstrument, selectedStrategyId, selectedTimeframe, selectedVersionOption]);

  const selectedRunComparison = useMemo(() => {
    if (!snapshot || history.length === 0) return null;
    return history.find((run) => run.runId !== snapshot.runId && run.strategyId === snapshot.strategyId) ?? history.find((run) => run.runId !== snapshot.runId) ?? null;
  }, [history, snapshot]);

  const filteredTrades = useMemo(() => {
    const trades = snapshot?.trades ?? [];
    switch (tradeFilter) {
      case "long":
        return trades.filter((trade) => trade.direction === "LONG");
      case "short":
        return trades.filter((trade) => trade.direction === "SHORT");
      case "wins":
        return trades.filter((trade) => trade.result === "WIN");
      case "losses":
        return trades.filter((trade) => trade.result === "LOSS");
      default:
        return trades;
    }
  }, [snapshot, tradeFilter]);

  const sortedTrades = useMemo(() => {
    const trades = [...filteredTrades];
    trades.sort((left, right) => {
      const direction = tradeSortDirection === "asc" ? 1 : -1;
      const leftValue = left[tradeSortKey];
      const rightValue = right[tradeSortKey];

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }

      return 0;
    });
    return trades;
  }, [filteredTrades, tradeSortDirection, tradeSortKey]);

  const chartTrades = snapshot?.trades;
  const selectedRangeDays = settings.datePreset === "all" ? 365 : Number(settings.datePreset) || 60;
  const chartOutputSize = useMemo(() => {
    const barsPerDayMap: Record<string, number> = {
      "1m": 1440,
      "5m": 288,
      "15m": 96,
      "1h": 24,
      "4h": 6,
    };
    const barsPerDay = barsPerDayMap[selectedTimeframe] ?? 288;
    return Math.min(Math.max(selectedRangeDays * barsPerDay, 1500), 120000);
  }, [selectedRangeDays, selectedTimeframe]);
  const chartBadges = [
    selectedInstrument,
    selectedTimeframe,
    selectedVersionOption ? `${selectedVersionOption.strategyName} ${selectedVersionOption.versionLabel}` : "No strategy selected",
    historicalSource,
    snapshot ? `${snapshot.totalTrades} trades` : dataLoading ? "Loading history" : "Awaiting run",
  ];
  const currentRunLabel = snapshot
    ? `${snapshot.strategyName}${snapshot.strategyVersionLabel ? ` | ${snapshot.strategyVersionLabel}` : ""}`
    : selectedVersionOption
      ? `${selectedVersionOption.strategyName} | ${selectedVersionOption.versionLabel}`
      : "No strategy selected";
  const currentRunStatus = snapshot
    ? `${snapshot.instrument} | ${snapshot.timeframe} | ${snapshot.rangeLabel ?? "saved run"}`
    : selectedVersionOption
      ? `${selectedInstrument} | ${selectedTimeframe} | awaiting run`
      : "Save or select a strategy to begin";

  useEffect(() => {
    let cancelled = false;

    async function loadHistoricalCandles() {
      try {
        setDataLoading(true);
        setDataError("");
        const query = new URLSearchParams({
          symbol: selectedInstrument,
          interval: selectedTimeframe,
          timeframe: selectedTimeframe,
          outputsize: String(chartOutputSize),
          limit: String(chartOutputSize),
        });
        const storedResponse = await fetch(`/api/market-data/history?${query.toString()}`, { cache: "no-store" });
        const storedPayload = await storedResponse.json();
        const shouldUseStored = storedResponse.ok && Array.isArray(storedPayload.candles) && storedPayload.candles.length > 0;

        const response = shouldUseStored ? storedResponse : await fetch(`/api/market-data?${query.toString()}`, { cache: "no-store" });
        const payload = shouldUseStored ? storedPayload : await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load historical market data.");
        }

        if (!cancelled) {
          setHistoricalCandles(payload.candles ?? []);
          setHistoricalSource(payload.source ?? "Historical feed");
        }
      } catch (nextError) {
        if (!cancelled) {
          setHistoricalCandles([]);
          setHistoricalSource("History unavailable");
          setDataError((nextError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    }

    loadHistoricalCandles();

    return () => {
      cancelled = true;
    };
  }, [chartOutputSize, selectedInstrument, selectedTimeframe]);

  function updateTradeSort(nextKey: TradeSortKey) {
    if (tradeSortKey === nextKey) {
      setTradeSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setTradeSortKey(nextKey);
    setTradeSortDirection("desc");
  }

  function sendSnapshotToBuilder(nextSnapshot = snapshot) {
    if (!nextSnapshot || !selectedVersionOption) return;
    window.sessionStorage.setItem(
      PENDING_BUILDER_ANALYSIS_KEY,
      JSON.stringify({
        prompt: buildBacktestAnalysisPrompt(nextSnapshot, selectedVersionOption.code),
        code: selectedVersionOption.code,
        runId: nextSnapshot.runId,
        strategyId: nextSnapshot.strategyId,
        strategyVersionLabel: nextSnapshot.strategyVersionLabel,
      }),
    );
    window.location.href = "/ai";
  }

  async function runUniversalBacktest() {
    if (!selectedVersionOption) {
      setError("Choose a saved strategy version before running a backtest.");
      return;
    }

    try {
      setBacktesting(true);
      setError("");

      if (historicalCandles.length < 52) {
        throw new Error(`Not enough ${selectedInstrument} historical candles loaded for a reliable backtest.`);
      }

      const candles = historicalCandles;
      const config: BacktestConfig = {
        initialBalance: settings.initialCapital,
        broker: {
          spread: selectedInstrument.includes("MNQ") ? 1 : 0.4,
          slippage: settings.slippage,
          commission: settings.commissionValue,
        },
        maxPositions: Math.max(1, settings.pyramiding + 1),
        baseCurrency: settings.baseCurrency,
        orderSizeType: settings.orderSizeType,
        orderSizeValue: settings.orderSizeValue,
        pyramiding: settings.pyramiding,
        commissionType: settings.commissionType,
        commissionValue: settings.commissionValue,
        slippage: settings.slippage,
        marginLong: settings.marginLong,
        marginShort: settings.marginShort,
        fillOrders: settings.fillOrders,
        dateFrom: settings.dateFrom,
        dateTo: settings.dateTo,
        datePreset: settings.datePreset === "all" ? "all" : "custom",
      };

      const result = selectedVersionOption.code?.trim()
        ? runStrategyCode(candles, selectedVersionOption.code, config)
        : runBacktest(candles, config);

      if (result.error) {
        throw new Error(result.error);
      }

      const nextSnapshot: AutomationBacktestSnapshot = {
        runId: `backtest-${Date.now()}`,
        strategyId: selectedVersionOption.strategyId,
        strategyName: selectedVersionOption.strategyName,
        strategyVersionLabel: selectedVersionOption.versionLabel,
        instrument: selectedInstrument,
        timeframe: selectedTimeframe,
        ranAt: new Date().toISOString(),
        rangeLabel: settings.datePreset === "all" ? "all loaded history" : `${selectedRangeDays} day sample`,
        initialCapital: settings.initialCapital,
        totalTrades: result.totalTrades,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        totalPnL: result.totalPnL,
        totalPnLPercent: result.totalPnLPercent,
        maxDrawdown: result.maxDrawdown,
        maxDrawdownPercent: result.maxDrawdownPercent,
        averageRMultiple: result.averageRMultiple,
        sharpeRatio: result.sharpeRatio,
        sortinoRatio: result.sortinoRatio,
        grossProfit: result.grossProfit,
        grossLoss: result.grossLoss,
        avgWinningTrade: result.avgWinningTrade,
        avgLosingTrade: result.avgLosingTrade,
        largestWinningTrade: result.largestWinningTrade,
        largestLosingTrade: result.largestLosingTrade,
        avgBarsInTrades: result.avgBarsInTrades,
        avgBarsInWinningTrades: result.avgBarsInWinningTrades,
        avgBarsInLosingTrades: result.avgBarsInLosingTrades,
        longTrades: result.longTrades,
        shortTrades: result.shortTrades,
        maxRunUp: result.maxRunUp,
        recoveryFactor: result.recoveryFactor,
        annualizedReturn: result.annualizedReturn,
        maxMarginUsed: result.maxMarginUsed,
        marginEfficiency: result.marginEfficiency,
        avgEquityRunUp: result.avgEquityRunUp,
        maxEquityRunUp: result.maxEquityRunUp,
        avgDrawdownDuration: result.avgDrawdownDuration,
        maxDrawdownDuration: result.maxDrawdownDuration,
        equityCurve: result.equityCurve,
        trades: result.trades,
      };

      saveAutomationBacktest(nextSnapshot);
      const nextHistory = appendAutomationBacktestRun(nextSnapshot);
      const nextRawStrategies = attachBacktestSnapshotToSavedStrategyVersion(nextSnapshot);
      setSnapshot(nextSnapshot);
      setHistory(nextHistory);
      if (nextRawStrategies) {
        const raw = JSON.stringify(nextRawStrategies);
        setSavedStrategies(normalizeSavedStrategies(raw));
        setVersionOptions(parseStrategyVersions(raw));
      }

      appendJournalEvent({
        id: createJournalId(),
        time: nextSnapshot.ranAt,
        bot: nextSnapshot.strategyName,
        action: "UNIVERSAL BACKTEST RUN",
        reason: `${nextSnapshot.strategyVersionLabel} | ${selectedInstrument} | ${selectedTimeframe} | ${nextSnapshot.rangeLabel}`,
        level: "success",
      });

      if (launchIntent?.autoAnalyze) {
        window.sessionStorage.setItem(
          PENDING_BUILDER_ANALYSIS_KEY,
          JSON.stringify({
            prompt: buildBacktestAnalysisPrompt(nextSnapshot, selectedVersionOption.code),
            code: selectedVersionOption.code,
            runId: nextSnapshot.runId,
            strategyId: nextSnapshot.strategyId,
            strategyVersionLabel: nextSnapshot.strategyVersionLabel,
          }),
        );
        window.location.href = "/ai";
        return;
      }

      setToast(`Backtest complete for ${nextSnapshot.strategyName}`);
      window.setTimeout(() => setToast(""), 1800);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBacktesting(false);
    }
  }

  useEffect(() => {
    if (!launchIntent) return;
    if (launchIntent.strategyId !== selectedStrategyId || launchIntent.version !== selectedVersion) return;
    if (!selectedVersionOption || dataLoading || backtesting || historicalCandles.length < 52) return;

    const hasMatchingSnapshot =
      snapshot?.strategyId === selectedStrategyId &&
      snapshot?.strategyVersionLabel === selectedVersionOption.versionLabel &&
      snapshot?.instrument === selectedInstrument &&
      snapshot?.timeframe === selectedTimeframe;

    if (hasMatchingSnapshot) {
      setLaunchIntent(null);
      return;
    }

    setLaunchIntent(null);
    void runUniversalBacktest();
  }, [
    backtesting,
    dataLoading,
    historicalCandles.length,
    launchIntent,
    selectedInstrument,
    selectedStrategyId,
    selectedTimeframe,
    selectedVersion,
    selectedVersionOption,
    snapshot,
  ]);

  const summaryCards = [
    {
      label: "Trades",
      value: snapshot ? String(snapshot.totalTrades) : "--",
      detail: "Closed bot trades",
    },
    {
      label: "Win Rate",
      value: snapshot ? `${snapshot.winRate.toFixed(1)}%` : "--",
      detail: "Percent of winning trades",
    },
    {
      label: "Profit Factor",
      value: snapshot ? ratio(snapshot.profitFactor) : "--",
      detail: "Gross profit / gross loss",
    },
    {
      label: "Net P&L",
      value: snapshot ? money(snapshot.totalPnL) : "--",
      detail: "Net strategy performance",
    },
    {
      label: "Drawdown",
      value: snapshot ? `$${snapshot.maxDrawdown.toFixed(2)}` : "--",
      detail: "Peak-to-trough pain",
    },
    {
      label: "Sharpe",
      value: snapshot && typeof snapshot.sharpeRatio === "number" ? ratio(snapshot.sharpeRatio) : "--",
      detail: "Risk-adjusted return",
    },
  ];

  const capitalBreakdown = [
    ["Initial Capital", snapshot?.initialCapital ? plainMoney(snapshot.initialCapital) : "--"],
    ["Return on Capital", snapshot && typeof snapshot.totalPnLPercent === "number" ? percent(snapshot.totalPnLPercent) : "--"],
    ["Annualized Return", snapshot && typeof snapshot.annualizedReturn === "number" ? percent(snapshot.annualizedReturn) : "--"],
    ["Average R", snapshot && typeof snapshot.averageRMultiple === "number" ? ratio(snapshot.averageRMultiple) : "--"],
    ["Max Margin Used", snapshot && typeof snapshot.maxMarginUsed === "number" ? plainMoney(snapshot.maxMarginUsed) : "--"],
    ["Margin Efficiency", snapshot && typeof snapshot.marginEfficiency === "number" ? ratio(snapshot.marginEfficiency) : "--"],
  ];

  const drawdownBreakdown = [
    ["Max Drawdown ($)", snapshot ? plainMoney(snapshot.maxDrawdown) : "--"],
    ["Max Drawdown (%)", snapshot && typeof snapshot.maxDrawdownPercent === "number" ? percent(-Math.abs(snapshot.maxDrawdownPercent)) : "--"],
    ["Recovery Factor", snapshot && typeof snapshot.recoveryFactor === "number" ? ratio(snapshot.recoveryFactor) : "--"],
    ["Avg Equity Run-up", snapshot && typeof snapshot.avgEquityRunUp === "number" ? plainMoney(snapshot.avgEquityRunUp) : "--"],
    ["Max Equity Run-up", snapshot && typeof snapshot.maxEquityRunUp === "number" ? plainMoney(snapshot.maxEquityRunUp) : "--"],
    ["Max Run-up", snapshot && typeof snapshot.maxRunUp === "number" ? plainMoney(snapshot.maxRunUp) : "--"],
    ["Avg DD Duration", bars(snapshot?.avgDrawdownDuration)],
    ["Max DD Duration", bars(snapshot?.maxDrawdownDuration)],
  ];

  const tradeQualityBreakdown = [
    ["Gross Profit", snapshot && typeof snapshot.grossProfit === "number" ? plainMoney(snapshot.grossProfit) : "--"],
    ["Gross Loss", snapshot && typeof snapshot.grossLoss === "number" ? plainMoney(snapshot.grossLoss) : "--"],
    ["Avg Winning Trade", snapshot && typeof snapshot.avgWinningTrade === "number" ? money(snapshot.avgWinningTrade) : "--"],
    ["Avg Losing Trade", snapshot && typeof snapshot.avgLosingTrade === "number" ? money(snapshot.avgLosingTrade) : "--"],
    ["Largest Winner", snapshot && typeof snapshot.largestWinningTrade === "number" ? money(snapshot.largestWinningTrade) : "--"],
    ["Largest Loser", snapshot && typeof snapshot.largestLosingTrade === "number" ? money(snapshot.largestLosingTrade) : "--"],
    ["Avg Bars In Trade", bars(snapshot?.avgBarsInTrades)],
    ["Sortino", snapshot && typeof snapshot.sortinoRatio === "number" ? ratio(snapshot.sortinoRatio) : "--"],
  ];

  return (
    <>
      <AutomationChartWorkspace
        title="Universal Backtest Workspace"
        eyebrow="Backtests"
        compact
        instrument={selectedInstrument}
        timeframe={selectedTimeframe}
        onInstrumentChange={setSelectedInstrument}
        onTimeframeChange={setSelectedTimeframe}
        candles={historicalCandles}
        trades={chartTrades}
        statusBadges={chartBadges}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          eyebrow="Backtest Report"
          title="Strategy Backtest Results"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowRunConfig((current) => !current)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[12px] font-semibold text-foreground"
              >
                <Settings2 className="h-4 w-4" />
                {showRunConfig ? "Hide Run Config" : "Show Run Config"}
              </button>
              <button
                onClick={runUniversalBacktest}
                disabled={backtesting || !selectedVersionOption}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-background disabled:opacity-60"
              >
                {backtesting ? <TimerReset className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {snapshot ? "Rerun Backtest" : "Run Backtest"}
              </button>
              {snapshot ? (
                <button
                  onClick={() => sendSnapshotToBuilder()}
                  disabled={!selectedVersionOption}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  Analyze in AI Builder
                </button>
              ) : null}
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Strategy</div>
                <div className="mt-3 text-[16px] font-semibold text-foreground">{currentRunLabel}</div>
                <div className="mt-1 text-[12px] text-muted">{currentRunStatus}</div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Assumptions</div>
                <div className="mt-3 text-[13px] font-medium text-foreground">
                  {settings.orderSizeValue} contract | {settings.fillOrders === "next_bar_open" ? "Next bar open" : "Bar close"}
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  Slip {settings.slippage} | Comm {settings.commissionValue.toFixed(2)}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Capital</div>
                <div className="mt-3 text-[13px] font-medium text-foreground">{plainMoney(settings.initialCapital)} starting balance</div>
                <div className="mt-1 text-[12px] text-muted">
                  Margin {settings.marginLong} long | {settings.marginShort} short
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Range</div>
                <div className="mt-3 text-[13px] font-medium text-foreground">
                  {{
                    "30": "30 day sprint",
                    "60": "60 day desk test",
                    "90": "90 day confidence run",
                    "180": "180 day validation run",
                    "365": "365 day operator review",
                    all: "All available",
                  }[settings.datePreset] ?? settings.datePreset}
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  {historicalSource} | {dataLoading ? "Loading history" : `${historicalCandles.length} candles`}
                </div>
              </div>
            </div>

            {showRunConfig ? (
              <div className="space-y-4 rounded-2xl border border-border bg-surface/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-foreground">Run configuration</div>
                    <div className="mt-1 text-[12px] text-muted">
                      Use this when you want to rerun the bot under different assumptions. The report above stays read-first.
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Strategy</div>
                    <KwantSelect
                      value={selectedStrategyId}
                      onChange={(event) => setSelectedStrategyId(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                    >
                      {savedStrategies.map((strategy) => (
                        <option key={strategy.id} value={strategy.id}>
                          {strategy.name}
                        </option>
                      ))}
                    </KwantSelect>
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Version</div>
                    <KwantSelect
                      value={selectedVersion}
                      onChange={(event) => setSelectedVersion(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                    >
                      {versionChoices.map((option) => (
                        <option key={`${option.strategyId}-${option.version}`} value={String(option.version)}>
                          {option.versionLabel} | {option.timestampLabel}
                        </option>
                      ))}
                    </KwantSelect>
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Date Preset</div>
                    <KwantSelect
                      value={settings.datePreset}
                      onChange={(event) => setSettings((current) => ({ ...current, datePreset: event.target.value }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                    >
                      <option value="30">30 day sprint</option>
                      <option value="60">60 day desk test</option>
                      <option value="90">90 day confidence run</option>
                      <option value="180">180 day validation run</option>
                      <option value="365">365 day operator review</option>
                      <option value="all">All available</option>
                    </KwantSelect>
                  </label>

                  <div className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Loaded</div>
                    <div className="mt-3 text-[13px] font-medium text-foreground">
                      {selectedVersionOption ? `${selectedVersionOption.strategyName} ${selectedVersionOption.versionLabel}` : "No strategy"}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {selectedVersionOption ? `${selectedVersionOption.language} | ${selectedInstrument}` : "Save a strategy to begin"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Initial Capital</div>
                    <input
                      type="number"
                      value={settings.initialCapital}
                      onChange={(event) => setSettings((current) => ({ ...current, initialCapital: Number(event.target.value) }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
                    />
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Order Size Type</div>
                    <KwantSelect
                      value={settings.orderSizeType}
                      onChange={(event) => setSettings((current) => ({ ...current, orderSizeType: event.target.value }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                    >
                      <option value="fixed_quantity">Fixed quantity</option>
                      <option value="percent_equity">% of equity</option>
                      <option value="fixed_usd">Fixed USD</option>
                    </KwantSelect>
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Order Size Value</div>
                    <input
                      type="number"
                      value={settings.orderSizeValue}
                      onChange={(event) => setSettings((current) => ({ ...current, orderSizeValue: Number(event.target.value) }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
                    />
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Fill Model</div>
                    <KwantSelect
                      value={settings.fillOrders}
                      onChange={(event) => setSettings((current) => ({ ...current, fillOrders: event.target.value }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                    >
                      <option value="next_bar_open">Next bar open</option>
                      <option value="bar_close">Bar close</option>
                    </KwantSelect>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Slippage</div>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.slippage}
                      onChange={(event) => setSettings((current) => ({ ...current, slippage: Number(event.target.value) }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
                    />
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Commission Type</div>
                    <KwantSelect
                      value={settings.commissionType}
                      onChange={(event) => setSettings((current) => ({ ...current, commissionType: event.target.value }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                    >
                      <option value="fixed_contract">Fixed per contract</option>
                      <option value="percent">Percent of position</option>
                      <option value="fixed_order">Fixed per order</option>
                    </KwantSelect>
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Commission Value</div>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.commissionValue}
                      onChange={(event) => setSettings((current) => ({ ...current, commissionValue: Number(event.target.value) }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
                    />
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Margin Long</div>
                    <input
                      type="number"
                      value={settings.marginLong}
                      onChange={(event) => setSettings((current) => ({ ...current, marginLong: Number(event.target.value) }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
                    />
                  </label>

                  <label className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Margin Short</div>
                    <input
                      type="number"
                      value={settings.marginShort}
                      onChange={(event) => setSettings((current) => ({ ...current, marginShort: Number(event.target.value) }))}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {dataError ? (
              <div className="rounded-2xl border border-border bg-surface/40 px-4 py-3 text-[13px] text-foreground">
                {dataError}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {summaryCards.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-border bg-surface/40 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{metric.label}</div>
                  <div className="mt-3 text-[24px] font-semibold text-foreground">{metric.value}</div>
                  <div className="mt-1 text-[12px] text-muted">{metric.detail}</div>
                </div>
              ))}
            </div>

            <BacktestEquityCurve equityCurve={snapshot?.equityCurve ?? []} />
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard eyebrow="Recent Runs" title="Saved Backtest History">
            <div className="space-y-3">
              {history.length > 0 ? (
                history.map((run) => (
                  <button
                    key={run.runId ?? `${run.strategyId}-${run.ranAt}`}
                    onClick={() => setSnapshot(run)}
                    className="w-full rounded-2xl border border-border bg-surface/60 p-4 text-left transition-colors hover:bg-surface"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">
                          {run.strategyName} {run.strategyVersionLabel ? `| ${run.strategyVersionLabel}` : ""}
                        </div>
                        <div className="mt-1 text-[12px] text-muted">
                          {run.instrument} | {run.timeframe} | {run.rangeLabel ?? "sample"}
                        </div>
                      </div>
                      <div className={`text-[12px] font-medium ${run.totalPnL >= 0 ? "text-primary" : "text-danger"}`}>
                        {money(run.totalPnL)}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-muted">
                      <span>{formatRunStamp(run.ranAt)}</span>
                      <span>{run.totalTrades} trades | PF {ratio(run.profitFactor)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-6 text-[13px] text-muted">
                  No universal backtest runs saved yet.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Comparison" title="Previous Run Delta">
            {snapshot && selectedRunComparison ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface/50 p-4">
                  <div className="text-[12px] font-semibold text-foreground">
                    Comparing against {selectedRunComparison.strategyName} {selectedRunComparison.strategyVersionLabel ? `| ${selectedRunComparison.strategyVersionLabel}` : ""}
                  </div>
                  <div className="mt-1 text-[12px] text-muted">{formatRunStamp(selectedRunComparison.ranAt)}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["Net P&L", snapshot.totalPnL - selectedRunComparison.totalPnL],
                    ["Win Rate", snapshot.winRate - selectedRunComparison.winRate],
                    ["Profit Factor", snapshot.profitFactor - selectedRunComparison.profitFactor],
                    ["Drawdown", selectedRunComparison.maxDrawdown - snapshot.maxDrawdown],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-border bg-surface/40 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</div>
                      <div className={`mt-2 text-[18px] font-semibold ${Number(value) >= 0 ? "text-primary" : "text-danger"}`}>
                        {label === "Win Rate" ? percent(Number(value)) : label === "Profit Factor" ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}` : money(Number(value))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-6 text-[13px] text-muted">
                Once you have multiple saved runs, this panel will compare the current run against the previous one so version changes are easy to review.
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard eyebrow="Direction Split" title="Long vs Short Performance">
          <div className="space-y-4">
            <DirectionSummaryCard
              title="Long Book"
              tone="text-primary"
              trades={snapshot?.longTrades?.totalTrades}
              winRate={snapshot?.longTrades?.winRate}
              profitFactor={snapshot?.longTrades?.profitFactor}
              netPnl={snapshot?.longTrades?.totalPnL}
              avgTrade={snapshot?.longTrades?.avgTrade}
            />
            <DirectionSummaryCard
              title="Short Book"
              tone="text-danger"
              trades={snapshot?.shortTrades?.totalTrades}
              winRate={snapshot?.shortTrades?.winRate}
              profitFactor={snapshot?.shortTrades?.profitFactor}
              netPnl={snapshot?.shortTrades?.totalPnL}
              avgTrade={snapshot?.shortTrades?.avgTrade}
            />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Capital" title="Capital and Efficiency">
          <div className="grid gap-3 md:grid-cols-2">
            {capitalBreakdown.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-surface/40 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</div>
                <div className="mt-2 text-[18px] font-semibold text-foreground">{value}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Risk" title="Drawdowns and Trade Quality">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {drawdownBreakdown.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-surface/40 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</div>
                  <div className="mt-2 text-[18px] font-semibold text-foreground">{value}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {tradeQualityBreakdown.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-surface/40 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</div>
                  <div className="mt-2 text-[18px] font-semibold text-foreground">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Trade Ledger"
        title="Human Review"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["all", "All"],
              ["long", "Long"],
              ["short", "Short"],
              ["wins", "Wins"],
              ["losses", "Losses"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTradeFilter(value)}
                className={`rounded-lg px-3 py-2 text-[11px] font-medium ${
                  tradeFilter === value
                    ? "bg-primary/10 text-primary"
                    : "border border-border bg-surface text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-4">
          {snapshot?.trades?.length ? (
            <div className="max-h-[640px] overflow-auto rounded-xl border border-border">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-panel">
                  <tr className="border-b border-border text-muted">
                    {[
                      ["Dir", null],
                      ["Entry", "entryTime"],
                      ["Exit", null],
                      ["P&L", "pnlPoints"],
                      ["P&L %", "pnlPercent"],
                      ["R", "rMultiple"],
                      ["Run-up", "runUp"],
                      ["Drawdown", "drawdown"],
                      ["Bars", "durationBars"],
                    ].map(([label, key]) => (
                      <th
                        key={label}
                        onClick={key ? () => updateTradeSort(key as TradeSortKey) : undefined}
                        className={`px-3 py-2 font-medium ${key ? "cursor-pointer hover:text-foreground" : ""}`}
                      >
                        {label}
                        {key && tradeSortKey === key ? (tradeSortDirection === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTrades.map((trade, index) => (
                    <tr key={`${trade.entryTime}-${trade.exitTime}-${index}`} className="border-b border-border/60">
                      <td className={`px-3 py-2 font-semibold ${trade.direction === "LONG" ? "text-primary" : "text-danger"}`}>
                        {trade.direction === "LONG" ? "BUY" : "SELL"}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        <div>{formatTradeStamp(trade.entryTime)}</div>
                        <div className="font-mono text-foreground">{trade.entryPrice.toFixed(2)}</div>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        <div>{formatTradeStamp(trade.exitTime)}</div>
                        <div className="font-mono text-foreground">{trade.exitPrice.toFixed(2)}</div>
                      </td>
                      <td className={`px-3 py-2 font-mono ${trade.pnlPoints >= 0 ? "text-primary" : "text-danger"}`}>
                        {money(trade.pnlPoints)}
                      </td>
                      <td className={`px-3 py-2 font-mono ${trade.pnlPercent >= 0 ? "text-primary" : "text-danger"}`}>
                        {percent(trade.pnlPercent)}
                      </td>
                      <td className={`px-3 py-2 font-mono ${trade.rMultiple >= 0 ? "text-primary" : "text-danger"}`}>
                        {trade.rMultiple.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">{trade.runUp.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono text-foreground">{trade.drawdown.toFixed(2)}</td>
                      <td className="px-3 py-2 text-muted">{trade.durationBars}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-6 text-[13px] text-muted">
              Run a backtest and every trade will show up here for operator review.
            </div>
          )}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard eyebrow="Purpose" title="Why this exists">
          <div className="space-y-3">
            {[
              "Universal backtest home for every saved strategy and version",
              "Same command language as the live execution desk, so testing and live operation stay aligned",
              "Built to ingest deeper KWANTMASTER analytics later without changing the operator workflow",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 text-[13px] text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Imported Later" title="KWANTMASTER Port Targets">
          <div className="space-y-3">
            {[
              { icon: Gauge, label: "Probability calibration, forward-test distributions, and version deltas" },
              { icon: Scale, label: "Richer drawdown/run-up analysis and deeper trade context" },
              { icon: Layers3, label: "Universal strategy family histories and cross-version review" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 text-[13px] text-foreground">
                <item.icon className="mt-0.5 h-4 w-4 text-primary" />
                {item.label}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Operator Flow" title="Universal Backtest Workflow">
          <div className="space-y-3">
            {[
              { icon: Settings2, label: "Choose strategy, version, market, and execution assumptions" },
              { icon: TrendingUp, label: "Run the bot and review equity, capital efficiency, and long/short split" },
              { icon: BarChart3, label: "Inspect the trade ledger and carry the same strategy into demo or live later" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 text-[13px] text-foreground">
                <item.icon className="mt-0.5 h-4 w-4 text-primary" />
                {item.label}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-primary/20 bg-panel px-4 py-3 text-[13px] text-primary shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
