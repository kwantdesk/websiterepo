import type { JournalTrade } from "./journal.ts";

const numeric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function formatTradeHoldDuration(durationMs: number | null | undefined) {
  if (!numeric(durationMs) || durationMs < 0) return "Not recorded";
  if (durationMs < 1000) return `${Math.floor(durationMs)}ms`;
  let seconds = Math.floor(durationMs / 1000);
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", minutes ? `${minutes}m` : "", `${seconds}s`].filter(Boolean).join(" ");
}

export function journalTradeDetails(trade: JournalTrade) {
  const opened = Date.parse(trade.openedAt);
  const closed = Date.parse(trade.closedAt ?? "");
  const durationMs = numeric(trade.durationMs) && trade.durationMs >= 0 ? trade.durationMs
    : trade.entryTimeKnown !== false && trade.exitTimeKnown !== false && Number.isFinite(opened) && closed >= opened ? closed - opened : null;
  // No reconstructed excursions from entry/exit or candle highs: those cannot
  // establish the actual path of this position while it was open.
  const peakProfit = numeric(trade.favourableExcursion) && trade.favourableExcursion >= 0 ? trade.favourableExcursion : null;
  const worstUnrealised = numeric(trade.adverseExcursion) && trade.adverseExcursion <= 0 ? trade.adverseExcursion : null;
  const gross = numeric(trade.grossPnl) ? trade.grossPnl : null;
  const priceMove = numeric(trade.entryPrice) && numeric(trade.exitPrice) && trade.side !== "UNKNOWN"
    ? (trade.exitPrice - trade.entryPrice) * (trade.side === "SHORT" ? -1 : 1) : null;
  return {
    durationMs,
    peakProfit,
    worstUnrealised,
    // Compare like-for-like gross values; fees are displayed independently.
    profitGiveback: peakProfit !== null && gross !== null ? Math.max(0, peakProfit - gross) : null,
    capturePercent: peakProfit !== null && peakProfit > 0 && gross !== null ? gross / peakProfit * 100 : null,
    priceMove,
  };
}
