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

/**
 * Convert Databento's event timestamp to Unix milliseconds.
 *
 * JSON trade streams use nanosecond ISO timestamps such as
 * `2026-08-07T13:29:59.999740343Z`. JavaScript's Date parser only accepts
 * millisecond precision in every supported runtime, so feeding that value to
 * Date.parse directly rejects otherwise valid executions. Preserve the first
 * three fractional digits before parsing; a volume profile only needs the
 * millisecond bucket while the complete event remains represented in the
 * execution stream.
 */
export function databentoEventTimestampMs(raw: unknown): number | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;

    if (/^\d+$/.test(text)) {
      const numeric = Number(text);
      if (!Number.isFinite(numeric)) return null;
      return numeric > 1e15 ? Math.floor(numeric / 1_000_000) : numeric;
    }

    const millisecondIso = text.replace(
      /^(.*\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/,
      "$1$2",
    );
    const parsed = Date.parse(millisecondIso);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const numeric = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1e15 ? Math.floor(numeric / 1_000_000) : numeric;
}
