"use client";

import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import TradePostChart from "@/components/socials/TradePostChart";
import type { SharedTradeMessage } from "@/lib/sharedTrades";

function price(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function money(value: number) {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

export default function SharedTradeMessageCard({
  sharedTrade,
  chartHeight = 142,
  onOpen,
}: {
  sharedTrade: SharedTradeMessage;
  chartHeight?: number;
  onOpen?: (sharedTrade: SharedTradeMessage) => void;
}) {
  const trade = sharedTrade.trade;
  const DirectionIcon = trade.side === "SHORT" ? TrendingDown : TrendingUp;
  const open = () => {
    if (onOpen) onOpen(sharedTrade);
    else window.location.assign(sharedTrade.profilePath);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      className="mt-1.5 w-full min-w-[260px] max-w-[520px] cursor-pointer overflow-hidden rounded-2xl border border-primary/20 bg-panel text-foreground shadow-[0_16px_46px_rgba(0,0,0,0.32)] transition hover:border-primary/40 hover:shadow-[0_18px_52px_color-mix(in_srgb,var(--primary)_12%,transparent)] focus:outline-none focus:ring-2 focus:ring-primary/35"
      aria-label={`Open ${sharedTrade.ownerDisplayName}'s ${trade.instrument} trade on their profile`}
    >
      <div className="flex items-start gap-3 border-b border-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_8%,var(--panel)),var(--panel))] px-3 py-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${trade.side === "SHORT" ? "border-danger/25 bg-danger/10 text-danger" : "border-accent/25 bg-accent/10 text-accent"}`}>
          <DirectionIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold">{trade.instrument}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[6px] font-semibold ${trade.side === "SHORT" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>{trade.side}</span>
          </div>
          <div className="mt-0.5 truncate text-[7px] text-muted">Shared from @{sharedTrade.ownerHandle}&apos;s profile</div>
        </div>
        <div className="text-right">
          <div className="text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">Net P&amp;L</div>
          <div className={`mt-0.5 font-mono text-[14px] font-semibold ${trade.netPnl >= 0 ? "text-accent" : "text-danger"}`}>{money(trade.netPnl)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3">
        {[["ENTRY", price(trade.entryPrice)], ["EXIT", price(trade.exitPrice)], ["R : R", trade.rMultiple === null ? "—" : `${trade.rMultiple.toFixed(2)}R`]].map(([label, value]) => (
          <div key={label} className="bg-background/80 px-3 py-2">
            <div className="text-[6px] font-semibold tracking-[0.12em] text-muted">{label}</div>
            <div className="mt-0.5 truncate font-mono text-[8px] font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>
      <div className="p-2">
        <TradePostChart trade={trade} height={chartHeight} />
      </div>
      <button type="button" onClick={open} className="flex h-8 w-full items-center justify-center gap-1.5 border-t border-border text-[7px] font-semibold text-primary hover:bg-primary/[0.06]">
        Open trade on profile <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}
