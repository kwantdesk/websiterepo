"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TradeSyncerSelect } from "@/components/trade-syncer/TradeSyncerControls";

const tradeMetrics = [
  { label: "Open trades", value: "2", detail: "1 copied from live leader" },
  { label: "Closed today", value: "7", detail: "5 winners, 2 losers" },
  { label: "Followers matched", value: "97.8%", detail: "Across last 50 events" },
  { label: "Avg copy lag", value: "118ms", detail: "Median follower placement" },
];

const openTrades = [
  ["MNQ long", "Tradovate-Demo-Lead", "MNQ", "1", "21542.25", "21518.25", "21606.25", "Open"],
  ["MNQ long", "Tradovate-Prop-A", "MNQ", "1", "21542.50", "21518.25", "21606.25", "Open"],
];

const closedTrades = [
  ["MNQ short", "Tradovate-Prop-B", "MNQ", "1", "21580.00", "21552.00", "+$56.00", "Copied"],
  ["MNQ short", "Rithmic-Sim-Lead", "MNQ", "1", "21580.00", "21552.25", "+$55.50", "Copied"],
  ["MNQ long", "Tradovate-Demo-Lead", "MNQ", "1", "21498.75", "21476.75", "-$44.00", "Closed"],
];

function TradeSyncerAccountTradesPageContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const activeView = searchParams.get("view") === "closed" ? "Closed Positions" : "Open Positions";
  const exportFormat = searchParams.get("export");

  const rows = useMemo(() => {
    const source = activeView === "Open Positions" ? openTrades : closedTrades;
    return source.filter((row) => row.join(" ").toLowerCase().includes(search.toLowerCase()));
  }, [activeView, search]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-panel px-6 py-6">
        <div>
          <div className="text-[24px] font-semibold tracking-tight text-foreground">Account Trades</div>
          <div className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Review open and closed copier activity by account, symbol, and outcome. This is where operators check whether follower state really matched the leader.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
            <Link
              href="/trade-syncer/account-trades?view=open"
              className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                activeView === "Open Positions" ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              Open Positions
            </Link>
            <Link
              href="/trade-syncer/account-trades?view=closed"
              className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                activeView === "Closed Positions" ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              Closed Positions
            </Link>
          </div>
          <Link
            href={`/trade-syncer/account-trades?view=${activeView === "Open Positions" ? "open" : "closed"}&export=csv`}
            className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            Export
          </Link>
        </div>
      </section>

      {exportFormat ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] leading-6 text-primary">
          Trade ledger export queued in {exportFormat.toUpperCase()} format.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tradeMetrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-panel px-5 py-4">
            <div className="text-[12px] text-muted">{metric.label}</div>
            <div className="mt-4 text-[18px] font-semibold text-foreground">{metric.value}</div>
            <div className="mt-2 text-[12px] text-muted">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-border bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <div className="text-[18px] font-semibold text-foreground">{activeView}</div>
            <div className="mt-1 text-[12px] text-muted">
              {activeView === "Open Positions"
                ? "Open copied trades should be easy to scan by account, symbol, and protection level."
                : "Closed trade history should feel like a real ledger, not a hidden debug stream."}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by ticket or account number"
              className="w-[240px] rounded-xl border border-border bg-background/40 px-4 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted focus:border-primary/30"
            />
            <div className="w-[210px]">
              <TradeSyncerSelect label="Visible Columns" options={["All columns visible", "Hide price columns", "Hide protection columns"]} />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto px-6 py-4">
          <table className="min-w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr className="border-b border-border">
                {(activeView === "Open Positions"
                  ? ["Trade", "Account", "Symbol", "Qty", "Entry", "SL", "TP", "Status"]
                  : ["Trade", "Account", "Symbol", "Qty", "Entry", "Exit", "PnL", "Status"]
                ).map((head) => (
                  <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row[1]}-${row[4]}`} className="border-b border-border/60 last:border-0">
                  {row.map((cell, index) => (
                    <td key={`${row[1]}-${index}`} className="py-4 pr-4 text-muted first:font-medium first:text-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function TradeSyncerAccountTradesPage() {
  return (
    <Suspense fallback={null}>
      <TradeSyncerAccountTradesPageContent />
    </Suspense>
  );
}
