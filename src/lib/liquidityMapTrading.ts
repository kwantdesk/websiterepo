import { normalizePaperSymbol, snapPaperPrice, type PaperOrder, type PaperPosition } from "./paperTrading.ts";

export type MapTradeLevel = {
  id: string; ownerId: string; accountId: string; price: number;
  kind: "entry" | "stop_loss" | "take_profit";
  targetId?: string; resting: boolean; draggable: boolean; label: string;
};

/** A view of the shared ledger, never a second trading ledger. Minis and micros stay distinct. */
export function liquidityMapTradeLevels(symbol: string, accountId: string | undefined, positions: PaperPosition[], orders: PaperOrder[]): MapTradeLevel[] {
  const levels: MapTradeLevel[] = [];
  const add = (owner: PaperPosition | PaperOrder, resting: boolean) => {
    if (owner.accountId !== accountId || normalizePaperSymbol(owner.symbol) !== normalizePaperSymbol(symbol)) return;
    const entry = resting ? (owner as PaperOrder).price : (owner as PaperPosition).entryPrice;
    if (!(Number(entry) > 0)) return;
    const push = (kind: MapTradeLevel["kind"], price: number | null, label: string, targetId?: string) => {
      if (!Number.isFinite(price) || !(Number(price) > 0)) return;
      levels.push({ id: `${owner.id}:${kind}:${targetId ?? ""}`, ownerId: owner.id, accountId: owner.accountId,
        price: Number(price), kind, targetId, resting, draggable: resting || kind !== "entry", label });
    };
    push("entry", Number(entry), `${owner.side.toUpperCase()} ${resting ? owner.quantity : (owner as PaperPosition).remainingQuantity}${resting ? " · WORKING" : ""}`);
    push("stop_loss", owner.stopLoss, "SL");
    owner.takeProfits.forEach((target, index) => {
      if (!resting && (target as PaperPosition["takeProfits"][number]).filledQuantity >= target.quantity) return;
      push("take_profit", target.price, `TP${owner.takeProfits.length > 1 ? index + 1 : ""}`, resting ? `${owner.id}-tp-${index}` : (target as PaperPosition["takeProfits"][number]).id);
    });
  };
  positions.filter(p => p.status === "open" && p.remainingQuantity > 0).forEach(p => add(p, false));
  orders.filter(o => o.status === "working").forEach(o => add(o, true));
  return levels;
}

export function liquidityMapPickedPrice(symbol: string, price: unknown) {
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? snapPaperPrice(symbol, price) : null;
}

export function liquidityMapExecutionQuote(raw: unknown, symbol: string, paneId: string, now = Date.now()) {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  if (q.symbol !== normalizePaperSymbol(symbol) || q.source !== "live") return null;
  const { bid, ask, timestamp, last } = q;
  if (typeof bid !== "number" || typeof ask !== "number" || typeof timestamp !== "number"
    || ![bid, ask, timestamp].every(Number.isFinite) || bid <= 0 || ask < bid
    || now - timestamp > 5_000 || timestamp - now > 1_000) return null;
  return { paneId, symbol: normalizePaperSymbol(symbol), source: "live" as const, bid, ask, mid: (bid + ask) / 2,
    timestamp, receivedAt: now, ...(typeof last === "number" && Number.isFinite(last) && last > 0 ? { last } : {}) };
}
