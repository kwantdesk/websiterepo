export const GEX_VUE_REPLAY_TIME_ZONE = "America/New_York";
export const GEX_VUE_REPLAY_OPEN_MINUTE = 9 * 60 + 30;
export const GEX_VUE_REPLAY_CLOSE_MINUTE = 16 * 60;

export type GexVueReplayState = {
  active: boolean;
  sessionDate: string;
  startMs: number;
  endMs: number;
  timestampMs: number;
  playing: boolean;
  speed: number;
};

function zonedParts(timestamp: number, timeZone = GEX_VUE_REPLAY_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minute: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function timeZoneOffset(timestamp: number, timeZone = GEX_VUE_REPLAY_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ) - timestamp;
}

export function newYorkSessionTimestamp(sessionDate: string, minute: number) {
  const [year, month, day] = sessionDate.split("-").map(Number);
  const hour = Math.floor(minute / 60);
  const localMinute = minute % 60;
  const guess = Date.UTC(year, month - 1, day, hour, localMinute, 0);
  const first = guess - timeZoneOffset(guess);
  return first - (timeZoneOffset(first) - timeZoneOffset(guess));
}

function previousWeekday(date: Date) {
  const candidate = new Date(date);
  do candidate.setUTCDate(candidate.getUTCDate() - 1);
  while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6);
  return candidate;
}

export function latestCompletedNewYorkSession(nowMs = Date.now()) {
  const current = zonedParts(nowMs);
  const date = new Date(`${current.date}T00:00:00.000Z`);
  const weekday = date.getUTCDay();
  if (weekday >= 1 && weekday <= 5 && current.minute >= GEX_VUE_REPLAY_CLOSE_MINUTE) return current.date;
  return previousWeekday(date).toISOString().slice(0, 10);
}

export function createGexVueReplayState(nowMs = Date.now()): GexVueReplayState {
  const sessionDate = latestCompletedNewYorkSession(nowMs);
  const startMs = newYorkSessionTimestamp(sessionDate, GEX_VUE_REPLAY_OPEN_MINUTE);
  const endMs = newYorkSessionTimestamp(sessionDate, GEX_VUE_REPLAY_CLOSE_MINUTE);
  return {
    active: false,
    sessionDate,
    startMs,
    endMs,
    timestampMs: startMs,
    playing: false,
    speed: 10,
  };
}

export function setGexVueReplaySession(state: GexVueReplayState, sessionDate: string): GexVueReplayState {
  const startMs = newYorkSessionTimestamp(sessionDate, GEX_VUE_REPLAY_OPEN_MINUTE);
  const endMs = newYorkSessionTimestamp(sessionDate, GEX_VUE_REPLAY_CLOSE_MINUTE);
  return { ...state, sessionDate, startMs, endMs, timestampMs: startMs, playing: false };
}

export function clampGexVueReplayTimestamp(state: GexVueReplayState, timestampMs: number) {
  return Math.max(state.startMs, Math.min(state.endMs, timestampMs));
}

