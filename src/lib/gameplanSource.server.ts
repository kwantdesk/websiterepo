import "server-only";

import {
  buildGameplanPayload,
  currentGameplanSession,
  type GameplanPayload,
} from "@/lib/gameplan";
import {
  getNativeFuturesSessionClose,
  getNativeFuturesSpot,
  newYorkCashCloseIso,
} from "@/lib/databentoGamma.server";
import { isOptionsFuturesRatioSane, type OptionsFlowPayload } from "@/lib/optionsFlow";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
} from "@/lib/quantData.server";

export type GameplanSourceReceipt = {
  options: {
    source: "KwantData";
    asOf: string;
    status: "LIVE" | "FROZEN" | "STALE";
    detail: string;
  };
  futures: {
    source: string;
    asOf: string;
    status: "LIVE" | "FROZEN" | "STALE" | "DOWN";
    detail: string;
  };
  marketOpen: boolean;
  errors: string[];
};

export type SourceBackedGameplan = {
  payload: GameplanPayload;
  sources: GameplanSourceReceipt;
};

export async function buildSourceBackedGameplan(
  root: "NQ" | "ES",
  requestedSessionDate?: string,
): Promise<SourceBackedGameplan> {
  if (!getConfiguredQuantDataApiKey()) {
    throw new Error("The Gameplan options feed is not configured.");
  }

  const source = root === "NQ" ? "NDX" : "SPX";
  const historical = Boolean(requestedSessionDate);
  const session = requestedSessionDate ? "newyork" as const : currentGameplanSession();
  const options = await getOptionsFlowPayload(
    source,
    historical ? "CASH" : "FUTURES",
    requestedSessionDate,
    "GAMEPLAN",
  );
  // CME is already trading during the New York preparation window. A manual
  // pre-open run therefore uses the current futures spot against the settled
  // options fence; only an explicitly historical request uses the cash close.
  // If the live futures adapter is temporarily unavailable, retain the
  // completed close and announce the frozen calibration instead of inventing
  // a current value.
  const liveFuturesPrice = historical
    ? null
    : await getNativeFuturesSpot(root).catch(() => null);
  const futuresPrice = liveFuturesPrice
    ?? await getNativeFuturesSessionClose(root, options.session.sessionDate).catch(() => null);
  const liveFutures = !historical && liveFuturesPrice !== null;
  const cashPrice = options.stockPrice;
  const scale = futuresPrice && cashPrice && cashPrice > 0 ? futuresPrice / cashPrice : null;
  const canCalibrate = futuresPrice !== null
    && cashPrice !== null
    && scale !== null
    && isOptionsFuturesRatioSane(source, scale);
  const calibratedOptions: OptionsFlowPayload = canCalibrate
    ? {
      ...options,
      marketData: {
        ...options.marketData,
        mode: "FUTURES" as const,
        provider: "Databento" as const,
        status: liveFutures ? "LIVE" as const : "LAST_SESSION" as const,
        symbol: root,
        futuresRoot: root,
        asOf: liveFutures
          ? new Date().toISOString()
          : newYorkCashCloseIso(options.session.sessionDate),
        lastPrice: futuresPrice,
        bid: null,
        ask: null,
        basisToOptionsUnderlying: futuresPrice! - cashPrice!,
        levelPriceScale: scale,
        stale: !liveFutures,
        fallback: false,
        detail: liveFutures
          ? options.session.marketOpen
            ? "Live CME futures calibration against the active New York options snapshot."
            : "Live CME futures calibration against the settled pre-open options fence; the options board must re-grade at the New York wake."
          : "Frozen CME futures calibration at the selected completed New York close.",
      },
    }
    : options;

  const marketData = calibratedOptions.marketData;
  const optionsStatus = options.errors.length
    ? "STALE" as const
    : options.session.marketOpen && options.snapshotMode === "LIVE"
      ? "LIVE" as const
      : "FROZEN" as const;
  const futuresStatus = marketData.lastPrice === null
    ? "DOWN" as const
    : marketData.stale || marketData.status === "LAST_SESSION"
      ? "FROZEN" as const
      : marketData.status === "LIVE"
        ? "LIVE" as const
        : "STALE" as const;

  return {
    payload: buildGameplanPayload(calibratedOptions, root, session),
    sources: {
      options: {
        source: "KwantData",
        asOf: options.asOf,
        status: optionsStatus,
        detail: options.errors.length
          ? `Positioning frame retained with ${options.errors.length} announced source error(s).`
          : `Verified ${options.snapshotMode === "LIVE" ? "live" : "New York close"} options positioning for ${source}.`,
      },
      futures: {
        source: marketData.provider,
        asOf: marketData.asOf,
        status: futuresStatus,
        detail: marketData.detail,
      },
      marketOpen: options.session.marketOpen,
      errors: options.errors.slice(0, 12),
    },
  };
}
