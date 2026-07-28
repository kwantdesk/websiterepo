"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, BarChart3, CheckCircle2, Crosshair, Layers3, Loader2, Play, ShieldAlert } from "lucide-react";
import AutomationChartWorkspace from "@/components/automation/AutomationChartWorkspace";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import {
  appendJournalEvent,
  createJournalId,
  loadSavedStrategiesRaw,
  loadAutomationBacktest,
  type AutomationExecutionPosition,
  type AutomationWorkingOrder,
  loadAutomationBots,
  loadExecutionState,
  mergeExecutionState,
  normalizeSavedStrategies,
  runtimeModeLabels,
  saveAutomationBacktest,
  type AutomationBotRuntime,
  type AutomationBacktestSnapshot,
  type AutomationConnectionAccount,
  type RuntimeMode,
} from "@/lib/automation";
import { generateSampleData } from "@/lib/sampleData";
import { runBacktest, runStrategyCode, type BacktestConfig } from "@/lib/backtester";

type ExecutionResponse = {
  instrument: string;
  quote: {
    source: string;
    bid: number;
    ask: number;
    mid: number;
    spread: number;
    tradeable: boolean;
    status: string;
    time: string;
  };
  accounts: AutomationConnectionAccount[];
  instruments: string[];
  timeframes: string[];
  orderTypes: Array<"market" | "limit" | "stop">;
  emergencyActions: string[];
  positions: AutomationExecutionPosition[];
  workingOrders: AutomationWorkingOrder[];
};

function formatQuote(value: number, instrument: string) {
  if (instrument.includes("MNQ") || instrument === "NAS100" || instrument === "GER40" || instrument === "S&P500" || instrument === "UK100") {
    return value.toFixed(1);
  }
  if (instrument === "XAUUSD") return value.toFixed(3);
  return value.toFixed(5);
}

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatTradeStamp(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AutomationExecutionPage() {
  const [bots, setBots] = useState<AutomationBotRuntime[]>([]);
  const [savedStrategies, setSavedStrategies] = useState(() => normalizeSavedStrategies(null));
  const [selectedInstrument, setSelectedInstrument] = useState("MNQ SEP26");
  const [selectedTimeframe, setSelectedTimeframe] = useState("5m");
  const [selectedAccount, setSelectedAccount] = useState("tradovate-sim");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderUnits, setOrderUnits] = useState("1");
  const [tpEnabled, setTpEnabled] = useState(true);
  const [slEnabled, setSlEnabled] = useState(true);
  const [tpValue, setTpValue] = useState("");
  const [slValue, setSlValue] = useState("");
  const [data, setData] = useState<ExecutionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "running">("idle");
  const [selectedBacktestStrategyId, setSelectedBacktestStrategyId] = useState("");
  const [backtestDays, setBacktestDays] = useState("60");
  const [backtesting, setBacktesting] = useState(false);
  const [backtestError, setBacktestError] = useState("");
  const [backtestSnapshot, setBacktestSnapshot] = useState<AutomationBacktestSnapshot | null>(null);
  const [showBacktestTrades, setShowBacktestTrades] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    setBots(loadAutomationBots());
    setBacktestSnapshot(loadAutomationBacktest());
    if (typeof window !== "undefined") {
      const nextStrategies = normalizeSavedStrategies(loadSavedStrategiesRaw());
      setSavedStrategies(nextStrategies);
      setSelectedBacktestStrategyId((current) => current || nextStrategies[0]?.id || "");
    }

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`/api/automation/execution?instrument=${encodeURIComponent(selectedInstrument)}`, {
          cache: "no-store",
        });
        const next = await response.json();

        if (!response.ok) {
          throw new Error(next?.error || "Failed to load execution desk.");
        }

        if (!cancelled) {
          setData(next);
          if (!tpValue) setTpValue(next.quote.mid ? formatQuote(next.quote.mid + 40, selectedInstrument) : "");
          if (!slValue) setSlValue(next.quote.mid ? formatQuote(next.quote.mid - 20, selectedInstrument) : "");
        }
      } catch (nextError) {
        if (!cancelled) {
          setError((nextError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [selectedInstrument]);

  useEffect(() => {
    if (!selectedBacktestStrategyId && savedStrategies.length > 0) {
      setSelectedBacktestStrategyId(savedStrategies[0].id);
    }
  }, [savedStrategies, selectedBacktestStrategyId]);

  const accounts = data?.accounts ?? [];
  const quote = data?.quote;
  const seedPositions = data?.positions ?? [];
  const seedWorkingOrders = data?.workingOrders ?? [];
  const localExecutionState = useMemo(() => loadExecutionState(), [data?.instrument, submitState]);
  const positions = [...localExecutionState.positions, ...seedPositions].slice(0, 8);
  const workingOrders = [...localExecutionState.workingOrders, ...seedWorkingOrders].slice(0, 12);
  const selectedAccountMeta = useMemo(
    () => accounts.find((account) => account.id === selectedAccount) ?? null,
    [accounts, selectedAccount]
  );
  const activeBot = useMemo(
    () =>
      bots.find(
        (bot) =>
          bot.instrument === selectedInstrument &&
          bot.accountId === selectedAccount &&
          (bot.status === "armed" || bot.status === "running")
      ) ?? null,
    [bots, selectedAccount, selectedInstrument]
  );
  const selectedBacktestStrategy = useMemo(
    () => savedStrategies.find((strategy) => strategy.id === selectedBacktestStrategyId) ?? null,
    [savedStrategies, selectedBacktestStrategyId]
  );
  const chartTrades = useMemo(
    () => (showBacktestTrades && backtestSnapshot ? backtestSnapshot.trades : undefined),
    [backtestSnapshot, showBacktestTrades]
  );
  const chartBadges = useMemo(() => {
    const badges = [selectedInstrument, selectedTimeframe, selectedAccountMeta?.label ?? "No account"];
    if (backtestSnapshot) {
      badges.push(`Backtest ${backtestSnapshot.totalTrades} trades`);
      badges.push(backtestSnapshot.strategyName);
    } else {
      badges.push("Execution overlays");
    }
    return badges;
  }, [backtestSnapshot, selectedAccountMeta?.label, selectedInstrument, selectedTimeframe]);

  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((account) => account.id === selectedAccount)) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts, selectedAccount]);

  async function submitPaperRun() {
    if (!quote || !selectedAccountMeta) return;

    try {
      setSubmitState("running");
      setError("");
      const response = await fetch("/api/automation/paper-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botName: activeBot?.strategyName ?? "Manual automation run",
          accountLabel: selectedAccountMeta.label,
          instrument: selectedInstrument,
          side: orderSide,
          orderType,
          quantity: orderUnits,
          takeProfit: tpEnabled ? tpValue : undefined,
          stopLoss: slEnabled ? slValue : undefined,
          bid: quote.bid,
          ask: quote.ask,
          mode: selectedAccountMeta.mode,
        }),
      });
      const next = await response.json();

      if (!response.ok) {
        throw new Error(next?.error || "Failed to simulate execution.");
      }

      mergeExecutionState({
        positions: [next.position, ...localExecutionState.positions].slice(0, 8),
        workingOrders: [next.workingOrder, ...localExecutionState.workingOrders].slice(0, 12),
      });

      next.events.forEach((event: { id: string; time: string; action: string; reason: string; level: "info" | "success" | "warn" | "error" }) => {
        appendJournalEvent({
          id: event.id || createJournalId(),
          time: event.time,
          bot: activeBot?.strategyName ?? "Manual execution",
          action: event.action,
          reason: event.reason,
          level: event.level,
        });
      });

      setToast(`Paper run opened on ${selectedInstrument}`);
      setBots(loadAutomationBots());
      window.setTimeout(() => setToast(""), 2200);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setSubmitState("idle");
    }
  }

  async function runAutomationBacktest() {
    const strategy = selectedBacktestStrategy;
    if (!strategy) {
      setBacktestError("Choose a strategy before running an automation backtest.");
      return;
    }

    try {
      setBacktesting(true);
      setBacktestError("");

      const candles = generateSampleData(Math.max(14, Number(backtestDays) || 60));
      const config: BacktestConfig = {
        initialBalance: 10000,
        broker: {
          spread: selectedInstrument.includes("MNQ") ? 1 : 0.4,
          slippage: selectedInstrument.includes("MNQ") ? 0.5 : 0.1,
          commission: selectedInstrument.includes("MNQ") ? 1.82 : 0,
        },
        maxPositions: 1,
        orderSizeType: "fixed_quantity",
        orderSizeValue: Math.max(1, Number(orderUnits) || 1),
        commissionType: selectedInstrument.includes("MNQ") ? "fixed_contract" : "percent",
        commissionValue: selectedInstrument.includes("MNQ") ? 1.82 : 0,
        slippage: selectedInstrument.includes("MNQ") ? 0.5 : 0.1,
        fillOrders: "next_bar_open",
        datePreset: "all",
      };

      const result = strategy.code?.trim()
        ? runStrategyCode(candles, strategy.code, config)
        : runBacktest(candles, config);

      if (result.error) {
        throw new Error(result.error);
      }

      const snapshot: AutomationBacktestSnapshot = {
        strategyId: strategy.id,
        strategyName: strategy.name,
        instrument: selectedInstrument,
        timeframe: selectedTimeframe,
        ranAt: new Date().toISOString(),
        totalTrades: result.totalTrades,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        totalPnL: result.totalPnL,
        maxDrawdown: result.maxDrawdown,
        trades: result.trades,
      };

      saveAutomationBacktest(snapshot);
      setBacktestSnapshot(snapshot);
      setShowBacktestTrades(true);

      appendJournalEvent({
        id: createJournalId(),
        time: snapshot.ranAt,
        bot: strategy.name,
        action: "AUTOMATION BACKTEST",
        reason: `${snapshot.totalTrades} trades on ${selectedInstrument} / ${selectedTimeframe} / ${backtestDays}d sample`,
        level: "success",
      });

      setToast(`Backtest complete for ${strategy.name}`);
      window.setTimeout(() => setToast(""), 2200);
    } catch (nextError) {
      setBacktestError((nextError as Error).message);
    } finally {
      setBacktesting(false);
    }
  }

  return (
    <>
      <AutomationChartWorkspace
        title="Execution Workspace"
        eyebrow="Execution"
        compact
        instrument={selectedInstrument}
        timeframe={selectedTimeframe}
        onInstrumentChange={setSelectedInstrument}
        onTimeframeChange={setSelectedTimeframe}
        trades={chartTrades}
        statusBadges={chartBadges}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_0.9fr_0.9fr_1.1fr]">
        <SectionCard eyebrow="Chart Trader" title="Order Ticket">
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-4 py-3 text-[13px] text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Syncing execution desk
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
                {error}
              </div>
            ) : null}

            <label className="block rounded-xl border border-border bg-surface/60 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Account</div>
              <select
                value={selectedAccount}
                onChange={(event) => setSelectedAccount(event.target.value)}
                className="mt-2 w-full bg-transparent text-[13px] text-foreground outline-none"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block rounded-xl border border-border bg-surface/60 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Instrument</div>
              <select
                value={selectedInstrument}
                onChange={(event) => setSelectedInstrument(event.target.value)}
                className="mt-2 w-full bg-transparent text-[13px] text-foreground outline-none"
              >
                {(data?.instruments ?? ["MNQ SEP26", "NAS100"]).map((instrument) => (
                  <option key={instrument} value={instrument}>
                    {instrument}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOrderSide("sell")}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  orderSide === "sell" ? "border-danger/30 bg-danger/20 text-danger" : "border-danger/20 bg-danger/10 text-danger/80"
                }`}
              >
                <div className="text-[12px] font-semibold">Sell</div>
                <div className="mt-1 font-mono text-[13px]">{quote ? formatQuote(quote.bid, selectedInstrument) : "--"}</div>
              </button>
              <button
                onClick={() => setOrderSide("buy")}
                className={`rounded-xl border px-3 py-3 text-right transition-all ${
                  orderSide === "buy" ? "border-primary/30 bg-primary/20 text-primary" : "border-primary/20 bg-primary/10 text-primary/80"
                }`}
              >
                <div className="text-[12px] font-semibold">Buy</div>
                <div className="mt-1 font-mono text-[13px]">{quote ? formatQuote(quote.ask, selectedInstrument) : "--"}</div>
              </button>
            </div>

            <div className="grid grid-cols-3 border-b border-border text-[13px]">
              {(["market", "limit", "stop"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`py-2 capitalize transition-colors ${
                    orderType === type ? "border-b-2 border-primary text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <label className="block rounded-xl border border-border bg-surface/60 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Quantity</div>
              <input
                value={orderUnits}
                onChange={(event) => setOrderUnits(event.target.value)}
                className="mt-2 w-full bg-transparent text-right font-mono text-[13px] text-foreground outline-none"
              />
            </label>

            {orderType !== "market" && (
              <label className="block rounded-xl border border-border bg-surface/60 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {orderType === "limit" ? "Limit Price" : "Stop Price"}
                </div>
                <input
                  defaultValue={quote ? formatQuote(quote.mid, selectedInstrument) : ""}
                  className="mt-2 w-full bg-transparent text-right font-mono text-[13px] text-foreground outline-none"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="rounded-xl border border-border bg-surface/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Take Profit</span>
                  <input type="checkbox" checked={tpEnabled} onChange={() => setTpEnabled((value) => !value)} />
                </div>
                <input
                  value={tpValue}
                  onChange={(event) => setTpValue(event.target.value)}
                  disabled={!tpEnabled}
                  className="mt-2 w-full bg-transparent text-right font-mono text-[13px] text-foreground outline-none disabled:text-muted"
                />
              </label>
              <label className="rounded-xl border border-border bg-surface/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Stop Loss</span>
                  <input type="checkbox" checked={slEnabled} onChange={() => setSlEnabled((value) => !value)} />
                </div>
                <input
                  value={slValue}
                  onChange={(event) => setSlValue(event.target.value)}
                  disabled={!slEnabled}
                  className="mt-2 w-full bg-transparent text-right font-mono text-[13px] text-foreground outline-none disabled:text-muted"
                />
              </label>
            </div>

            <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">
              Route: {selectedAccountMeta?.label ?? "No account"} • Mode:{" "}
              {selectedAccountMeta?.mode && selectedAccountMeta.mode !== "service"
                ? runtimeModeLabels[selectedAccountMeta.mode as RuntimeMode]
                : "Service"}
              {quote ? ` • Spread ${formatQuote(quote.spread, selectedInstrument)}` : ""}
            </div>

            {activeBot && (
              <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-[12px] text-primary">
                Armed bot: {activeBot.strategyName} • {activeBot.timeframe} • {runtimeModeLabels[activeBot.mode]}
              </div>
            )}

            <button
              onClick={submitPaperRun}
              disabled={submitState === "running"}
              className={`w-full rounded-xl py-3 text-[13px] font-semibold text-background disabled:opacity-60 ${orderSide === "buy" ? "bg-primary" : "bg-danger"}`}
            >
              {submitState === "running"
                ? "Routing..."
                : `${orderSide === "buy" ? "Buy" : "Sell"} ${orderUnits || "1"} ${selectedInstrument} ${orderType.toUpperCase()}`}
            </button>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Ladder" title="DOM Surface">
          <div className="space-y-3">
            {[
              quote ? `Bid ${formatQuote(quote.bid, selectedInstrument)}` : "Bid --",
              quote ? `Ask ${formatQuote(quote.ask, selectedInstrument)}` : "Ask --",
              quote ? `Mid ${formatQuote(quote.mid, selectedInstrument)}` : "Mid --",
              quote ? `Spread ${formatQuote(quote.spread, selectedInstrument)}` : "Spread --",
              quote ? `Source ${quote.source} / ${quote.status}` : "Waiting for quote source",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-[13px] text-muted">
                {item}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Emergency" title="Operator Controls">
          <div className="space-y-3">
            {[
              { icon: Crosshair, label: "Flatten all positions" },
              { icon: ArrowRightLeft, label: "Cancel all working orders" },
              { icon: Layers3, label: "Reverse current position" },
              { icon: ShieldAlert, label: "Pause all automation" },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 text-left text-[13px] text-foreground"
              >
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Routing" title="Live Orders & Positions">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Active Positions</div>
              <div className="space-y-2">
                {positions.map((position) => (
                  <div key={`${position.id ?? position.symbol}-${position.side}`} className="rounded-xl border border-border bg-surface/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[13px] font-semibold text-foreground">{position.symbol}</div>
                      <div className={`text-[13px] font-medium ${position.tone}`}>{position.pnl}</div>
                    </div>
                    <div className="mt-2 text-[12px] text-muted">
                      {position.side} • size {position.size} • stop {position.stop} • target {position.target}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Working Orders</div>
              <div className="space-y-2">
                {workingOrders.map((order) => (
                  <div key={`${order.id ?? order.venue}-${order.symbol}`} className="rounded-xl border border-border bg-surface/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[13px] font-semibold text-foreground">{order.symbol}</div>
                      <div className="text-[12px] text-muted">{order.status}</div>
                    </div>
                    <div className="mt-2 text-[12px] text-muted">{order.type} • {order.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Automation Backtests"
        title="Bot Backtest Desk"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/automation/backtests"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:text-foreground"
            >
              <BarChart3 className="h-4 w-4 text-primary" />
              Open Full Backtest Lab
            </Link>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={showBacktestTrades}
                onChange={() => setShowBacktestTrades((value) => !value)}
              />
              Show trades on chart
            </label>
            <button
              onClick={runAutomationBacktest}
              disabled={backtesting || !selectedBacktestStrategy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-background disabled:opacity-60"
            >
              {backtesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Bot Backtest
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
            <label className="block rounded-xl border border-border bg-surface/60 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Strategy</div>
              <select
                value={selectedBacktestStrategyId}
                onChange={(event) => setSelectedBacktestStrategyId(event.target.value)}
                className="mt-2 w-full bg-transparent text-[13px] text-foreground outline-none"
              >
                {savedStrategies.length === 0 ? <option value="">No saved strategies yet</option> : null}
                {savedStrategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name} • {strategy.currentVersionLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="block rounded-xl border border-border bg-surface/60 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Range</div>
              <select
                value={backtestDays}
                onChange={(event) => setBacktestDays(event.target.value)}
                className="mt-2 w-full bg-transparent text-[13px] text-foreground outline-none"
              >
                <option value="30">30 day sprint</option>
                <option value="60">60 day desk test</option>
                <option value="90">90 day confidence run</option>
                <option value="180">180 day deep run</option>
              </select>
            </label>

            <div className="rounded-xl border border-border bg-surface/60 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Execution model</div>
              <div className="mt-2 text-[13px] text-foreground">Bot first</div>
              <div className="mt-1 text-[12px] text-muted">Next-bar fill, spread, slippage, and bracket handling.</div>
            </div>

            <div className="rounded-xl border border-border bg-surface/60 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Human review</div>
              <div className="mt-2 text-[13px] text-foreground">Trade ledger on chart</div>
              <div className="mt-1 text-[12px] text-muted">Every backtest trade is inspectable like an operator would review it.</div>
            </div>
          </div>

          {backtestError ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
              {backtestError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: "Trades",
                value: backtestSnapshot ? String(backtestSnapshot.totalTrades) : "--",
                detail: "Total automation entries closed",
              },
              {
                label: "Win Rate",
                value: backtestSnapshot ? `${backtestSnapshot.winRate.toFixed(1)}%` : "--",
                detail: "Closed trades that finished green",
              },
              {
                label: "Profit Factor",
                value: backtestSnapshot ? backtestSnapshot.profitFactor.toFixed(2) : "--",
                detail: "Gross profit divided by gross loss",
              },
              {
                label: "Net P&L",
                value: backtestSnapshot ? money(backtestSnapshot.totalPnL) : "--",
                detail: "Net after the execution model costs",
              },
              {
                label: "Max DD",
                value: backtestSnapshot ? `$${backtestSnapshot.maxDrawdown.toFixed(2)}` : "--",
                detail: "Worst peak-to-trough drawdown",
              },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border bg-surface/40 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{card.label}</div>
                <div className="mt-3 text-[24px] font-semibold text-foreground">{card.value}</div>
                <div className="mt-1 text-[12px] text-muted">{card.detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-border bg-surface/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">
                <BarChart3 className="h-4 w-4 text-primary" />
                Backtest Summary
              </div>
              {backtestSnapshot ? (
                <div className="space-y-3 text-[13px]">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <span className="text-muted">Strategy</span>
                    <span className="font-medium text-foreground">{backtestSnapshot.strategyName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <span className="text-muted">Instrument</span>
                    <span className="font-medium text-foreground">{backtestSnapshot.instrument}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <span className="text-muted">Timeframe</span>
                    <span className="font-medium text-foreground">{backtestSnapshot.timeframe}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">Last run</span>
                    <span className="font-medium text-foreground">{new Date(backtestSnapshot.ranAt).toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-[13px] text-muted">
                  Run the first automation backtest and this desk will hold the bot summary, the trade trail, and the chart overlays together.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">Trade Ledger</div>
                {backtestSnapshot ? (
                  <div className="text-[12px] text-muted">{backtestSnapshot.trades.length} trades plotted</div>
                ) : null}
              </div>
              {backtestSnapshot && backtestSnapshot.trades.length > 0 ? (
                <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-panel">
                      <tr className="border-b border-border text-muted">
                        <th className="px-3 py-2 font-medium">Dir</th>
                        <th className="px-3 py-2 font-medium">Entry</th>
                        <th className="px-3 py-2 font-medium">Exit</th>
                        <th className="px-3 py-2 font-medium">Result</th>
                        <th className="px-3 py-2 font-medium">P&L</th>
                        <th className="px-3 py-2 font-medium">Bars</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtestSnapshot.trades.slice(0, 150).map((trade, index) => (
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
                          <td className="px-3 py-2">
                            <span className={`font-semibold ${trade.result === "WIN" ? "text-primary" : trade.result === "LOSS" ? "text-danger" : "text-foreground"}`}>
                              {trade.result}
                            </span>
                          </td>
                          <td className={`px-3 py-2 font-mono ${trade.pnlPoints >= 0 ? "text-primary" : "text-danger"}`}>
                            {money(trade.pnlPoints)}
                          </td>
                          <td className="px-3 py-2 text-muted">{trade.durationBars}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-[13px] text-muted">
                  This is where every bot trade shows up for human review. Once a backtest runs, you’ll get the full ledger here and the same trades painted on the chart above.
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

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
