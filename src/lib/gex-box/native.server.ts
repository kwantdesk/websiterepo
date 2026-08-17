import "server-only";

import { getDatabentoBars } from "@/lib/databento";
import {
  getNativeFuturesSessionClose,
  getNativeFuturesSpot,
  type NativeGammaRoot,
} from "@/lib/databentoGamma.server";
import type { GexBoxProviderView } from "@/lib/gex-box/domain";
import {
  NATIVE_GEX_BOX_FORMULA_VERSION,
  nativeGreekForCategory,
  nativeMajors,
  nativeMaxChange,
  nativeOrderflowFrames,
  nativeProfileFrames,
  replayWindow,
  type NativePricePoint,
} from "@/lib/gex-box/native";
import type {
  GexBotOrderflowFrame,
  GexBotProfileFrame,
  GexBotTerminalEnvelope,
} from "@/lib/gexBotTypes";
import {
  getGexDeskReplaySessionDates,
  getGexMapPanel,
  getUsOptionsSessionDate,
  isUsOptionsMarketOpen,
} from "@/lib/quantData.server";

type NativeInstrument = {
  exposureSymbol: string;
  futuresRoot: NativeGammaRoot | null;
};

const INSTRUMENTS: Record<string, NativeInstrument> = {
  NQ_NDX: { exposureSymbol: "NDX", futuresRoot: "NQ" },
  ES_SPX: { exposureSymbol: "SPX", futuresRoot: "ES" },
  NDX: { exposureSymbol: "NDX", futuresRoot: null },
  QQQ: { exposureSymbol: "QQQ", futuresRoot: null },
  SPX: { exposureSymbol: "SPX", futuresRoot: null },
  SPY: { exposureSymbol: "SPY", futuresRoot: null },
  RUT: { exposureSymbol: "RUT", futuresRoot: null },
  IWM: { exposureSymbol: "IWM", futuresRoot: null },
  VIX: { exposureSymbol: "VIX", futuresRoot: null },
};

function latestTimestamp(frames: Array<{ timestamp: number }>) {
  return frames.at(-1)?.timestamp ?? Date.now();
}

async function nativeDisplayPrices(
  root: NativeGammaRoot | null,
  sessionDate: string,
  frameWindow: ReturnType<typeof replayWindow>,
  historical: boolean,
): Promise<{ points: NativePricePoint[]; source: "Databento" | "QuantData" }> {
  if (!root) return { points: [], source: "QuantData" };
  try {
    if (historical && frameWindow) {
      const bars = await getDatabentoBars(`${root}.v.0`, "1m", frameWindow.start, frameWindow.end);
      const points = bars
        .filter((bar) => Number.isFinite(bar.timestamp) && Number.isFinite(bar.close) && bar.close > 0)
        .map((bar) => ({ timestamp: bar.timestamp, price: bar.close }));
      if (points.length) return { points, source: "Databento" };
    }
    const price = historical
      ? await getNativeFuturesSessionClose(root, sessionDate)
      : await getNativeFuturesSpot(root);
    if (price && Number.isFinite(price)) {
      return {
        points: [{
          timestamp: historical
            ? (frameWindow ? Date.parse(frameWindow.start) : Date.parse(`${sessionDate}T00:00:00.000Z`))
            : Date.now(),
          price,
        }],
        source: "Databento",
      };
    }
  } catch {
    // QuantData cash prices remain a valid, explicit fallback for the display
    // basis. Exposure itself never falls back from QuantData or becomes fake.
  }
  return { points: [], source: "QuantData" };
}

function sessionState(historical: boolean) {
  return historical || !isUsOptionsMarketOpen()
    ? "FROZEN_NEW_YORK_CLOSE" as const
    : "LIVE_RTH" as const;
}

export async function getNativeGexBoxEnvelope(
  view: GexBoxProviderView,
  tickerInput: string,
  category: string,
  requestedDate?: string | null,
): Promise<GexBotTerminalEnvelope<GexBotProfileFrame | GexBotOrderflowFrame>> {
  const ticker = tickerInput.toUpperCase();
  const instrument = INSTRUMENTS[ticker];
  if (!instrument) throw new Error(`${ticker} is not supported by the native GEX Box adapter.`);
  const currentDate = getUsOptionsSessionDate();
  const historical = Boolean(requestedDate) || !isUsOptionsMarketOpen();
  const date = requestedDate ?? currentDate;

  if (view === "orderflow") {
    const [gammaPanel, deltaPanel, vannaPanel, charmPanel] = await Promise.all([
      getGexMapPanel(instrument.exposureSymbol, "GAMMA", date),
      getGexMapPanel(instrument.exposureSymbol, "DELTA", date),
      getGexMapPanel(instrument.exposureSymbol, "VANNA", date),
      getGexMapPanel(instrument.exposureSymbol, "CHARM", date),
    ]);
    const display = await nativeDisplayPrices(
      instrument.futuresRoot,
      date,
      replayWindow(gammaPanel.frames),
      historical,
    );
    const gamma = nativeProfileFrames(gammaPanel, ticker, display.points);
    const delta = nativeProfileFrames(deltaPanel, ticker, display.points);
    const vanna = nativeProfileFrames(vannaPanel, ticker, display.points);
    const charm = nativeProfileFrames(charmPanel, ticker, display.points);
    const history = nativeOrderflowFrames({ ticker, gamma, delta, vanna, charm });
    const frame = history.at(-1) ?? null;
    return {
      ok: Boolean(frame),
      view,
      ticker,
      category,
      session: sessionState(historical),
      marketOpen: !historical && isUsOptionsMarketOpen(),
      checkedAt: Date.now(),
      frame,
      history,
      historyDate: date,
      historyStatus: history.length ? "LOADED" : "UNAVAILABLE",
      historySimulated: false,
      majors: nativeMajors(gamma.at(-1) ?? null),
      maxChange: nativeMaxChange(gamma),
      entitlementRequired: false,
      error: frame ? undefined : `QuantData returned no ${date} order-flow exposure frames for ${instrument.exposureSymbol}.`,
      dataSource: {
        exposure: "QuantData",
        underlying: display.source,
        formulaVersion: NATIVE_GEX_BOX_FORMULA_VERSION,
      },
    };
  }

  const greek = nativeGreekForCategory(category);
  const panel = await getGexMapPanel(instrument.exposureSymbol, greek, date);
  const display = await nativeDisplayPrices(
    instrument.futuresRoot,
    date,
    replayWindow(panel.frames),
    historical,
  );
  const history = nativeProfileFrames(panel, ticker, display.points);
  const frame = history.at(-1) ?? null;
  return {
    ok: Boolean(frame),
    view,
    ticker,
    category,
    session: sessionState(historical),
    marketOpen: !historical && isUsOptionsMarketOpen(),
    checkedAt: Date.now(),
    frame,
    history,
    historyDate: date,
    historyStatus: history.length ? "LOADED" : "UNAVAILABLE",
    historySimulated: false,
    majors: nativeMajors(frame),
    maxChange: nativeMaxChange(history),
    entitlementRequired: false,
    error: frame ? undefined : `QuantData returned no ${date} ${greek.toLowerCase()} frames for ${instrument.exposureSymbol}.`,
    dataSource: {
      exposure: "QuantData",
      underlying: display.source,
      formulaVersion: NATIVE_GEX_BOX_FORMULA_VERSION,
    },
  };
}

export async function getNativeGexBoxReplay(
  view: GexBoxProviderView,
  ticker: string,
  category: string,
  requestedDate?: string | null,
) {
  let date = requestedDate;
  if (!date) {
    const dates = await getGexDeskReplaySessionDates(10);
    const current = getUsOptionsSessionDate();
    date = [...dates].reverse().find((candidate) => (
      isUsOptionsMarketOpen() ? candidate < current : candidate <= current
    )) ?? dates.at(-1) ?? null;
  }
  if (!date) {
    return { ok: false, status: "UNAVAILABLE" as const, date: null, simulated: false, frames: [], error: "QuantData returned no completed replay sessions." };
  }
  const envelope = await getNativeGexBoxEnvelope(view, ticker, category, date);
  const frames = envelope.history ?? (envelope.frame ? [envelope.frame] : []);
  return {
    ok: frames.length > 0,
    status: frames.length ? "LOADED" as const : "UNAVAILABLE" as const,
    date,
    simulated: false,
    frames,
    error: frames.length ? undefined : envelope.error,
    dataSource: envelope.dataSource,
    lastTimestamp: latestTimestamp(frames),
  };
}
