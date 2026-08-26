"use client";

import { useMemo, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import {
  TIME_IN_FORCE_OPTIONS,
  breakevenStopPrice,
  openPnlCurrency,
  openPnlPoints,
  type ConnectorCapabilities,
  type OrderDirection,
  type Position,
  type TimeInForce,
} from "@/lib/tradingPanel";

/**
 * The order ticket.
 *
 * Laid out the way a DOM panel is: the six entry buttons in a buy/sell grid at
 * the top where they are reachable without reading, the destructive controls
 * (cancel, reverse, close) beneath them, and the protection settings last.
 *
 * Everything the broker cannot honour is DISABLED rather than hidden or
 * silently ignored, with the reason on the control. A greyed toggle that says
 * why is information; a toggle that flips and then does nothing is a trap,
 * because the trader believes a protection is in force when it is not.
 */

export type TradingPanelAccount = {
  id: string;
  label: string;
};

export type EntryIntent = {
  direction: OrderDirection;
  /** market takes whatever is there; ask/bid rest a limit on that side. */
  at: "market" | "ask" | "bid";
  quantity: number;
  timeInForce: TimeInForce;
  reduceOnly: boolean;
  oco: boolean;
};

export type ProtectionLeg = {
  enabled: boolean;
  value: number;
  unit: "ticks" | "price" | "percent";
};

type Props = {
  accounts: TradingPanelAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  capabilities: ConnectorCapabilities;
  position: Position;
  lastPrice: number;
  pointValue: number;
  tickSize: number;
  /** Working order counts, used only to enable or disable the cancel buttons. */
  workingBids: number;
  workingAsks: number;
  onEntry: (intent: EntryIntent) => void;
  onCancel: (scope: "bids" | "asks" | "all") => void;
  onReverse: () => void;
  onClose: () => void;
  onBreakeven: (stopPrice: number) => void;
  onEditProtection: () => void;
  tradingOnChart: boolean;
  onToggleTradingOnChart: () => void;
  busy?: string | null;
};

const CHIP = "flex h-8 w-full items-center justify-center rounded-[3px] border text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-35";
const NEUTRAL = "border-border bg-surface/40 text-muted hover:bg-surface hover:text-foreground";

function Toggle({
  on, onChange, label, disabled, title,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      title={title}
      onClick={onChange}
      className="flex items-center gap-2 text-[10px] text-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className={`relative h-4 w-8 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-border"}`}>
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-background transition-[left] ${on ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
      <span className={on ? "text-foreground" : undefined}>{label}</span>
    </button>
  );
}

export default function TradingPanel({
  accounts, selectedAccountId, onSelectAccount, capabilities, position, lastPrice,
  pointValue, tickSize, workingBids, workingAsks, onEntry, onCancel, onReverse,
  onClose, onBreakeven, onEditProtection, tradingOnChart, onToggleTradingOnChart, busy,
}: Props) {
  const [quantity, setQuantity] = useState(1);
  const [accountHidden, setAccountHidden] = useState(false);
  const [timeInForce, setTimeInForce] = useState<TimeInForce>("gtc");
  const [oco, setOco] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [protectionOn, setProtectionOn] = useState(true);
  const [takeProfit, setTakeProfit] = useState<ProtectionLeg>({ enabled: true, value: 10, unit: "ticks" });
  const [stopLoss, setStopLoss] = useState<ProtectionLeg>({ enabled: true, value: 10, unit: "ticks" });
  const [readout, setReadout] = useState<"pnl" | "flat" | "entry">("pnl");

  const flat = position.quantity === 0;
  const breakeven = useMemo(
    () => breakevenStopPrice(position, tickSize),
    [position, tickSize],
  );

  const entry = (direction: OrderDirection, at: EntryIntent["at"]) => onEntry({
    direction, at, quantity,
    timeInForce,
    // Never claim a flag the venue will drop; the model strips these too, but
    // the panel should not be the thing that lies about it.
    reduceOnly: reduceOnly && capabilities.reduceOnly,
    oco,
  });

  const readoutValue = () => {
    if (flat) return "--";
    if (readout === "entry") return position.averagePrice.toFixed(2);
    if (readout === "flat") return `${position.quantity > 0 ? "+" : ""}${position.quantity}`;
    const money = openPnlCurrency(position, lastPrice, pointValue);
    const points = openPnlPoints(position, lastPrice);
    return `${money >= 0 ? "+" : "-"}$${Math.abs(money).toFixed(2)} · ${points >= 0 ? "+" : ""}${points.toFixed(2)}`;
  };

  const tifChoices = TIME_IN_FORCE_OPTIONS.filter((option) =>
    capabilities.timeInForce.includes(option.id));

  return (
    <div className="flex w-full flex-col gap-2.5 border border-border bg-panel p-3 text-foreground">
      {/* Account */}
      <label className="block space-y-1">
        <span className="text-[9px] uppercase tracking-[0.12em] text-muted">Account</span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex-1">
            <KwantSelect
              value={selectedAccountId ?? ""}
              onChange={(event) => onSelectAccount(event.target.value)}
              className="h-8 w-full appearance-none rounded-[3px] border border-border bg-background px-2 pr-7 font-mono text-[11px] text-foreground outline-none focus:border-primary/40"
            >
              {accounts.length === 0 ? <option value="">No account linked</option> : null}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountHidden ? "••••••••" : account.label}
                </option>
              ))}
            </KwantSelect>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-muted" />
          </span>
          <button
            type="button"
            onClick={() => setAccountHidden((value) => !value)}
            title={accountHidden ? "Show the account number" : "Hide the account number"}
            aria-label={accountHidden ? "Show the account number" : "Hide the account number"}
            className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border text-muted hover:text-foreground"
          >
            {accountHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </span>
      </label>

      {/* Quantity */}
      <label className="block space-y-1">
        <span className="text-[9px] uppercase tracking-[0.12em] text-muted">Qty</span>
        <span className="relative block">
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
            className="h-8 w-full rounded-[3px] border border-border bg-background px-2 pr-12 font-mono text-[11px] text-foreground outline-none focus:border-primary/40"
          />
          <span className="pointer-events-none absolute right-2 top-2 text-[10px] text-muted">Lots</span>
        </span>
      </label>

      {/* Entry grid: market, then resting on each side. */}
      <div className="grid grid-cols-2 gap-1.5">
        {([
          ["Buy Market", "buy", "market", true],
          ["Sell Market", "sell", "market", true],
          ["Buy Ask", "buy", "ask", false],
          ["Sell Ask", "sell", "ask", false],
          ["Buy Bid", "buy", "bid", false],
          ["Sell Bid", "sell", "bid", false],
        ] as const).map(([label, direction, at, strong]) => (
          <button
            key={label}
            type="button"
            disabled={Boolean(busy) || !selectedAccountId}
            onClick={() => entry(direction, at)}
            className={`${CHIP} ${
              direction === "buy"
                ? strong
                  ? "border-emerald-500/60 bg-emerald-600/85 text-white hover:bg-emerald-600"
                  : "border-emerald-600/40 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/50"
                : strong
                  ? "border-rose-500/60 bg-rose-700/85 text-white hover:bg-rose-700"
                  : "border-rose-600/40 bg-rose-950/50 text-rose-200 hover:bg-rose-900/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Working-order and position controls. */}
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => onCancel("bids")} disabled={!workingBids} className={`${CHIP} ${NEUTRAL}`}>
          Cancel Bids
        </button>
        <button type="button" onClick={() => onCancel("asks")} disabled={!workingAsks} className={`${CHIP} ${NEUTRAL}`}>
          Cancel Asks
        </button>
        <button type="button" onClick={() => onCancel("all")} disabled={!workingBids && !workingAsks} className={`${CHIP} ${NEUTRAL}`}>
          Cancel All
        </button>
        <button type="button" onClick={onReverse} disabled={flat} className={`${CHIP} ${NEUTRAL}`}>
          Reverse
        </button>
      </div>

      <button
        type="button"
        onClick={() => breakeven != null && onBreakeven(breakeven)}
        disabled={flat || breakeven == null}
        title={flat ? "No position to protect" : `Move the stop to ${breakeven?.toFixed(2)}`}
        className={`${CHIP} ${NEUTRAL}`}
      >
        Breakeven{breakeven != null && !flat ? ` · ${breakeven.toFixed(2)}` : ""}
      </button>

      <button
        type="button"
        onClick={onClose}
        disabled={flat}
        className={`${CHIP} border-sky-500/60 bg-sky-600 text-white hover:bg-sky-500`}
      >
        Close
      </button>

      {/* Position readout. The three buttons choose what the row above shows. */}
      <div className="rounded-[3px] border border-border bg-background/50 px-2 py-1.5 text-center font-mono text-[11px] text-foreground">
        {readoutValue()}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(["pnl", "flat", "entry"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setReadout(mode)}
            className={`${CHIP} ${
              readout === mode
                ? "border-primary/40 bg-primary/[0.10] text-primary"
                : NEUTRAL
            }`}
          >
            {mode === "pnl" ? "PnL" : mode === "flat" ? "Flat" : "Entry"}
          </button>
        ))}
      </div>

      {/* Order options. */}
      <div className="flex items-center justify-between gap-2">
        <Toggle
          on={oco}
          onChange={() => setOco((value) => !value)}
          label="OCO"
          title={capabilities.serverOco
            ? "The broker enforces the group"
            : "This broker has no server-side OCO, so the desk cancels the other leg on the first fill"}
        />
        <span className="relative">
          <KwantSelect
            value={timeInForce}
            onChange={(event) => setTimeInForce(event.target.value as TimeInForce)}
            className="h-7 appearance-none rounded-[3px] border border-border bg-background pl-2 pr-6 text-[10px] uppercase text-foreground outline-none focus:border-primary/40"
            aria-label="Time in force"
          >
            {tifChoices.map((option) => (
              <option key={option.id} value={option.id} title={option.hint}>
                {option.label}
              </option>
            ))}
          </KwantSelect>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-2 h-3 w-3 text-muted" />
        </span>
      </div>

      <Toggle
        on={reduceOnly && capabilities.reduceOnly}
        onChange={() => setReduceOnly((value) => !value)}
        label="Reduce-Only"
        disabled={!capabilities.reduceOnly}
        title={capabilities.reduceOnly
          ? "Never let this order open a position the other way"
          : "This broker does not support reduce-only, so the desk will not pretend it is on"}
      />

      {/* Protection. */}
      <div className="mt-0.5 flex items-center justify-between border-t border-border pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">SL/TP</span>
        <Toggle
          on={protectionOn}
          onChange={() => setProtectionOn((value) => !value)}
          label={protectionOn ? "On" : "Off"}
        />
      </div>

      {protectionOn ? (
        <div className="space-y-1.5">
          {([
            ["TP", takeProfit, setTakeProfit] as const,
            ["SL", stopLoss, setStopLoss] as const,
          ]).map(([label, leg, setLeg]) => (
            <div key={label} className="flex items-center gap-1.5">
              <label className="flex w-10 shrink-0 items-center gap-1.5 text-[10px] text-muted">
                <input
                  type="checkbox"
                  checked={leg.enabled}
                  onChange={(event) => setLeg({ ...leg, enabled: event.target.checked })}
                  className="accent-primary"
                />
                <span>{label}</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={leg.value}
                disabled={!leg.enabled}
                onChange={(event) => setLeg({ ...leg, value: Math.max(0, Number(event.target.value) || 0) })}
                className="h-7 min-w-0 flex-1 rounded-[3px] border border-border bg-background px-2 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40 disabled:opacity-40"
              />
              <KwantSelect
                value={leg.unit}
                disabled={!leg.enabled}
                onChange={(event) => setLeg({ ...leg, unit: event.target.value as ProtectionLeg["unit"] })}
                aria-label={`${label} unit`}
                className="h-7 w-12 rounded-[3px] border border-border bg-background px-1 text-[10px] uppercase text-foreground outline-none focus:border-primary/40 disabled:opacity-40"
              >
                <option value="ticks">T</option>
                <option value="price">P</option>
                <option value="percent">%</option>
              </KwantSelect>
            </div>
          ))}
          <button type="button" onClick={onEditProtection} className={`${CHIP} border-sky-500/60 bg-sky-600 text-white hover:bg-sky-500`}>
            Edit
          </button>
        </div>
      ) : null}

      <div className="border-t border-border pt-2">
        <Toggle on={tradingOnChart} onChange={onToggleTradingOnChart} label="Trading on chart" />
      </div>

      {busy ? (
        <div className="rounded-[3px] border border-primary/30 bg-primary/[0.06] px-2 py-1.5 text-center text-[10px] text-primary">
          {busy}
        </div>
      ) : null}
    </div>
  );
}
