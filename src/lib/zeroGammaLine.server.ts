import {
  getNativeFuturesSessionClose,
  getNativeFuturesSpot,
  getNativeGammaSnapshot,
  newYorkCashCloseIso,
  type NativeGammaRoot,
} from "@/lib/databentoGamma.server";
import type { ZeroGammaLinePayload, ZeroGammaLinePoint } from "@/lib/zeroGammaLine";

function previousTradingDay(sessionDate: string) {
  const value = new Date(`${sessionDate}T12:00:00.000Z`);
  do value.setUTCDate(value.getUTCDate() - 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

function currentNewYorkSessionDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  let value = `${parts.year}-${parts.month}-${parts.day}`;
  if (parts.weekday === "Sun") value = previousTradingDay(value);
  if (parts.weekday === "Sat") value = previousTradingDay(value);
  return value;
}

function newYorkMarketOpen(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return !["Sat", "Sun"].includes(String(parts.weekday)) && minutes >= 570 && minutes < 960;
}

function positiveAbove(curve: Array<{ price: number; netGex: number }>, zeroGamma: number | null) {
  if (zeroGamma === null || curve.length < 2) return null;
  const below = [...curve].filter((point) => point.price < zeroGamma).at(-1);
  const above = curve.find((point) => point.price > zeroGamma);
  if (!below || !above || Math.sign(below.netGex) === Math.sign(above.netGex)) return null;
  return above.netGex > below.netGex;
}

export async function getZeroGammaLinePayload(
  root: NativeGammaRoot,
  displayInstrument: string,
  historySessions = 5,
): Promise<ZeroGammaLinePayload> {
  const now = new Date();
  const sessionDate = currentNewYorkSessionDate(now);
  const marketOpen = newYorkMarketOpen(now);
  const completedDates: string[] = [];
  let cursor = marketOpen ? previousTradingDay(sessionDate) : sessionDate;
  while (completedDates.length < Math.max(1, Math.min(5, Math.round(historySessions)))) {
    completedDates.unshift(cursor);
    cursor = previousTradingDay(cursor);
  }

  const historical = await Promise.all(completedDates.map(async (date): Promise<ZeroGammaLinePoint | null> => {
    try {
      const close = await getNativeFuturesSessionClose(root, date);
      if (close === null) return null;
      const snapshot = await getNativeGammaSnapshot(root, date, close);
      if (snapshot.zeroGamma === null) return null;
      return {
        timestampMs: Date.parse(newYorkCashCloseIso(snapshot.sessionDate)),
        sessionDate: snapshot.sessionDate,
        value: snapshot.zeroGamma,
        status: "HISTORICAL",
      };
    } catch {
      return null;
    }
  }));

  const spot = await getNativeFuturesSpot(root).catch(() => null);
  const current = spot === null ? null : await getNativeGammaSnapshot(root, sessionDate, spot).catch(() => null);
  const points = historical.filter((point): point is ZeroGammaLinePoint => point !== null);
  if (current?.zeroGamma !== null && current?.zeroGamma !== undefined) {
    points.push({
      timestampMs: marketOpen ? now.getTime() : Date.parse(newYorkCashCloseIso(current.sessionDate)),
      sessionDate: current.sessionDate,
      value: current.zeroGamma,
      status: marketOpen ? "LIVE" : "EOD",
    });
  }

  const deduplicated = [...new Map(points.map((point) => [`${point.timestampMs}:${point.sessionDate}`, point])).values()]
    .sort((left, right) => left.timestampMs - right.timestampMs);
  if (!deduplicated.length) throw new Error(`No verified ${root} zero-Gamma snapshots are currently available.`);
  return {
    root,
    displayInstrument,
    asOf: now.toISOString(),
    status: marketOpen ? "LIVE" : "EOD",
    positiveAbove: current ? positiveAbove(current.gammaFlipCurve, current.zeroGamma) : null,
    points: deduplicated,
    method: "TRUE_OI_SCENARIO",
    disclosure: "Zero Gamma is the nearest aggregate dealer-Gamma zero crossing after repricing the native futures-options chain across hypothetical futures prices. Historical points become available only at their completed-session timestamp; no future snapshot is painted backward.",
  };
}
