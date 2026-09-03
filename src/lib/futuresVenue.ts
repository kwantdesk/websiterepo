/** Resolve the exchange that owns a futures root. */
export function futuresVenue(symbol: string): "CME" | "CBOT" | "COMEX" | "NYMEX" {
  const upper = String(symbol || "").toUpperCase();
  const continuous = upper.match(/^([A-Z0-9]{1,3})\.[A-Z]\.\d+$/);
  const root = continuous?.[1] ?? upper.replace(/[A-Z]\d$/, "");
  if (["YM", "MYM", "ZN", "TN", "ZB", "UB", "ZF", "ZT", "ZC", "ZS", "ZW", "ZM", "ZL"].includes(root)) {
    return "CBOT";
  }
  if (["GC", "MGC", "SI", "SIL", "HG"].includes(root)) return "COMEX";
  if (["CL", "MCL", "QM", "NG", "QG", "RB", "HO", "PL", "PA"].includes(root)) return "NYMEX";
  return "CME";
}
