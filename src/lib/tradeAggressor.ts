/**
 * Normalize Databento's trade-side field into the aggressor terminology used
 * by the chart studies. For Trade records Databento uses Ask for a seller
 * aggressor and Bid for a buyer aggressor.
 */
export function databentoTradeAggressor(
  raw: unknown,
): "BUY" | "SELL" | "NONE" {
  const value = typeof raw === "object" && raw !== null
    ? (raw as { value?: unknown }).value
    : raw;
  const side = String(value ?? "").trim().toUpperCase().slice(0, 1);
  if (side === "A" || side === "S") return "SELL";
  if (side === "B") return "BUY";
  return "NONE";
}
