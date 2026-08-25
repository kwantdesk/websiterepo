import type { LabSnapshot } from "@/lib/labSnapshot";

export type LabOutcomeCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type LabTradeOutcomeStatus =
  | "NOT_ARMED"
  | "AWAITING_ENTRY"
  | "LIVE"
  | "CORE_HIT"
  | "RUNNER_HIT"
  | "STOPPED"
  | "INDETERMINATE";

export type LabTradeOutcome = {
  status: LabTradeOutcomeStatus;
  entryPrice: number | null;
  entryAt: string | null;
  coreHitAt: string | null;
  runnerHitAt: string | null;
  stopHitAt: string | null;
  mfePoints: number | null;
  maePoints: number | null;
  peakR: number | null;
  summary: string;
};

function iso(timestamp: number | null) {
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function emptyOutcome(status: "NOT_ARMED" | "AWAITING_ENTRY", entryPrice: number | null, summary: string): LabTradeOutcome {
  return {
    status,
    entryPrice,
    entryAt: null,
    coreHitAt: null,
    runnerHitAt: null,
    stopHitAt: null,
    mfePoints: null,
    maePoints: null,
    peakR: null,
    summary,
  };
}

export function evaluateLabTradeOutcome(
  candles: LabOutcomeCandle[],
  trade: LabSnapshot["trade"] | null,
  fallbackArmedAt: string | null = null,
): LabTradeOutcome {
  if (!trade?.side || !trade.zone) {
    return emptyOutcome("NOT_ARMED", null, "No repository-issued setup exists to grade.");
  }
  const entryPrice = trade.entryReference
    ?? (trade.side === "LONG" ? Math.max(...trade.zone) : Math.min(...trade.zone));
  const armedAt = trade.armedAt ?? (trade.status === "ARMED" ? fallbackArmedAt : null);
  const armedMs = armedAt ? Date.parse(armedAt) : Number.NaN;
  if (!Number.isFinite(armedMs)) {
    return emptyOutcome("NOT_ARMED", entryPrice, "The candidate has not passed the live A+ arming gate, so it has no trade result.");
  }

  const rows = candles
    .filter((candle) => Number.isFinite(candle.timestamp)
      && Number.isFinite(candle.high)
      && Number.isFinite(candle.low)
      && candle.high >= candle.low
      && candle.timestamp >= armedMs - 5 * 60_000)
    .slice()
    .sort((left, right) => left.timestamp - right.timestamp);
  const entryIndex = rows.findIndex((candle) => candle.low <= entryPrice && candle.high >= entryPrice);
  if (entryIndex < 0) {
    return emptyOutcome("AWAITING_ENTRY", entryPrice, "The setup armed, but the conservative entry reference has not traded yet.");
  }

  const side = trade.side;
  const stop = trade.stop;
  const core = trade.coreTarget;
  const runner = trade.runnerTarget;
  const risk = stop === null ? null : Math.abs(entryPrice - stop);
  let mfe = 0;
  let mae = 0;
  let coreHitAt: number | null = null;
  let runnerHitAt: number | null = null;
  let stopHitAt: number | null = null;
  let indeterminateAt: number | null = null;

  for (const candle of rows.slice(entryIndex)) {
    const favorable = side === "LONG" ? candle.high - entryPrice : entryPrice - candle.low;
    const adverse = side === "LONG" ? entryPrice - candle.low : candle.high - entryPrice;
    mfe = Math.max(mfe, favorable);
    mae = Math.max(mae, adverse);
    const hitsCore = core !== null && (side === "LONG" ? candle.high >= core : candle.low <= core);
    const hitsRunner = runner !== null && (side === "LONG" ? candle.high >= runner : candle.low <= runner);
    const hitsStop = stop !== null && (side === "LONG" ? candle.low <= stop : candle.high >= stop);
    if (hitsStop && ((hitsCore && coreHitAt === null) || (hitsRunner && runnerHitAt === null))) {
      indeterminateAt = candle.timestamp;
      if (hitsCore && coreHitAt === null) coreHitAt = candle.timestamp;
      if (hitsRunner && runnerHitAt === null) runnerHitAt = candle.timestamp;
      stopHitAt = candle.timestamp;
      break;
    }
    if (hitsCore && coreHitAt === null) coreHitAt = candle.timestamp;
    if (hitsRunner && runnerHitAt === null) runnerHitAt = candle.timestamp;
    if (hitsStop && stopHitAt === null) {
      stopHitAt = candle.timestamp;
      break;
    }
    if (runnerHitAt !== null) break;
  }

  const status: LabTradeOutcomeStatus = indeterminateAt !== null
    ? "INDETERMINATE"
    : runnerHitAt !== null
      ? "RUNNER_HIT"
      : coreHitAt !== null
        ? "CORE_HIT"
        : stopHitAt !== null
          ? "STOPPED"
          : "LIVE";
  const summary = status === "INDETERMINATE"
    ? "A target and the structural stop traded inside the same candle; intrabar order is unknown, so the result is not graded as a win or loss."
    : status === "RUNNER_HIT"
      ? "Price touched both the core door and runner door after the entry reference."
      : status === "CORE_HIT"
        ? stopHitAt !== null
          ? "The core door traded before price later reached the structural stop; the runner path needs execution receipts for an exact P&L grade."
          : "The core door traded; the runner has not reached its structural door yet."
        : status === "STOPPED"
          ? "Price reached the structural stop before either recorded target door."
          : "The entry reference traded and the setup remains unresolved on the available tape.";

  return {
    status,
    entryPrice,
    entryAt: iso(rows[entryIndex].timestamp),
    coreHitAt: iso(coreHitAt),
    runnerHitAt: iso(runnerHitAt),
    stopHitAt: iso(stopHitAt),
    mfePoints: round(Math.max(0, mfe)),
    maePoints: round(Math.max(0, mae)),
    peakR: risk && risk > 0 ? round(Math.max(0, mfe) / risk) : null,
    summary,
  };
}
