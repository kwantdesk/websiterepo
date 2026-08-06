import "server-only";

import {
  GEXBOT_FLOW_POLL_MS,
  GEXBOT_FLOW_TICKER,
  GEXBOT_FLOW_WINDOW_SIZE,
  buildGexBotFlowPayload,
  detectRestrikes,
  isGexBotFlowRth,
  newYorkSessionKey,
  nextGexBotFlowBackoffMs,
  normalizeGexBotFlowMajors,
  normalizeGexBotFlowSample,
  type GexBotFlowMajors,
  type GexBotFlowPayload,
  type GexBotFlowSample,
  type GexBotRestrikeNotice,
  type GexBotSponsorshipVerdict,
} from "@/lib/gexBotFlow";

const GEXBOT_FLOW_URL = `https://api.gex.bot/v2/${GEXBOT_FLOW_TICKER}/orderflow/orderflow`;
const GEXBOT_MAJORS_URL = `https://api.gex.bot/v2/${GEXBOT_FLOW_TICKER}/classic/gex_zero/majors`;
const DEFAULT_STRIKE_INTERVAL = 25;
const MAJORS_FRESH_MS = 5 * 60_000;

type PollerState = {
  sessionKey: string | null;
  sample: GexBotFlowSample | null;
  majors: GexBotFlowMajors | null;
  window: GexBotFlowSample[];
  verdicts: GexBotSponsorshipVerdict[];
  restrikes: GexBotRestrikeNotice[];
  emittedRestrikes: Set<string>;
  lastAttemptAt: number;
  nextAttemptAt: number;
  consecutiveFailures: number;
  lastRequestFailed: boolean;
  lastError: string | null;
};

const state: PollerState = {
  sessionKey: null,
  sample: null,
  majors: null,
  window: [],
  verdicts: [],
  restrikes: [],
  emittedRestrikes: new Set(),
  lastAttemptAt: 0,
  nextAttemptAt: 0,
  consecutiveFailures: 0,
  lastRequestFailed: false,
  lastError: null,
};

let inFlight: Promise<GexBotFlowPayload> | null = null;

function configuredApiKey() {
  return process.env.GEXBOT_API_KEY?.trim() ?? "";
}

function sponsorshipConfig() {
  const threshold = Number(process.env.GEXBOT_FLOW_PUSH_THRESHOLD_PERCENT);
  const floor = Number(process.env.GEXBOT_FLOW_DEX_FLOOR);
  return {
    thresholdPercent: Number.isFinite(threshold) && threshold > 0 ? threshold : 0.0015,
    dexFloor: Number.isFinite(floor) && floor >= 0 ? floor : 1_000_000,
  };
}

function strikeInterval() {
  const configured = Number(process.env.GEXBOT_FLOW_STRIKE_INTERVAL);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STRIKE_INTERVAL;
}

function resetForSession(sessionKey: string) {
  if (state.sessionKey === sessionKey) return;
  state.sessionKey = sessionKey;
  state.window = [];
  state.verdicts = [];
  state.restrikes = [];
  state.emittedRestrikes = new Set();
  state.consecutiveFailures = 0;
  state.lastRequestFailed = false;
  state.lastError = null;
  state.nextAttemptAt = 0;
}

function freshMajors(now: number, marketOpen: boolean): GexBotFlowMajors | null {
  if (!marketOpen || !state.majors) return null;
  return now - state.majors.fetchedAtMs <= MAJORS_FRESH_MS ? state.majors : null;
}

function currentPayload(now: number, marketOpen: boolean) {
  return buildGexBotFlowPayload({
    sample: state.sample,
    window: state.window,
    recentVerdicts: state.verdicts,
    restrikes: state.restrikes,
    now,
    marketOpen,
    requestFailed: state.lastRequestFailed,
    error: state.lastError ?? undefined,
    sponsorship: sponsorshipConfig(),
    majors: freshMajors(now, marketOpen),
  });
}

function appendSample(sample: GexBotFlowSample, now: number) {
  // The rolling window is session-scoped. Do not compare the first sample of
  // a new RTH session with yesterday's close or emit a false re-strike.
  const previous = state.window.at(-1) ?? null;
  const duplicate = previous
    && previous.timestamp === sample.timestamp
    && previous.spot === sample.spot
    && previous.aggDex === sample.aggDex;
  if (duplicate) {
    state.sample = sample;
    return;
  }
  const notices = detectRestrikes(previous, sample, strikeInterval(), state.emittedRestrikes);
  for (const notice of notices) state.emittedRestrikes.add(notice.id);
  state.restrikes = [...notices, ...state.restrikes].slice(0, 5);
  state.window = [...state.window, sample].slice(-GEXBOT_FLOW_WINDOW_SIZE);
  state.sample = sample;
  const payload = currentPayload(now, true);
  if (payload.sponsorship.active) {
    state.verdicts = [
      payload.sponsorship.active,
      ...state.verdicts.filter((item) => item.id !== payload.sponsorship.active?.id),
    ].slice(0, 5);
  }
}

async function requestFlowSample(now: number) {
  const key = configuredApiKey();
  if (!key) throw new Error("GEX Bot flow is not configured on this deployment.");
  const response = await fetch(GEXBOT_FLOW_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      "User-Agent": "KwantDesk/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const detail = [payload.detail, payload.error, payload.message]
      .find((value) => typeof value === "string" && value.trim());
    throw new Error(typeof detail === "string" ? detail : `GEX Bot flow request failed (${response.status}).`);
  }
  return normalizeGexBotFlowSample(payload, now);
}

async function requestMajors(now: number) {
  const key = configuredApiKey();
  if (!key) return null;
  const response = await fetch(GEXBOT_MAJORS_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      "User-Agent": "KwantDesk/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  return payload ? normalizeGexBotFlowMajors(payload, now) : null;
}

async function poll(now: number, marketOpen: boolean) {
  state.lastAttemptAt = now;
  // Majors ride the same cadence but must never take the flow sample down
  // with them; a failed majors request just keeps the previous fresh value.
  const majorsRequest = requestMajors(now).catch(() => null);
  try {
    const sample = await requestFlowSample(now);
    appendSample(sample, now);
    state.consecutiveFailures = 0;
    state.lastRequestFailed = false;
    state.lastError = null;
    state.nextAttemptAt = now + GEXBOT_FLOW_POLL_MS;
  } catch (error) {
    state.consecutiveFailures += 1;
    state.lastRequestFailed = true;
    state.lastError = error instanceof Error ? error.message : "GEX Bot flow request failed.";
    state.nextAttemptAt = now + nextGexBotFlowBackoffMs(state.consecutiveFailures);
  }
  const majors = await majorsRequest;
  if (majors) state.majors = majors;
  return currentPayload(Date.now(), marketOpen);
}

export async function getGexBotFlowSnapshot(now = Date.now(), force = false): Promise<GexBotFlowPayload> {
  const marketOpen = isGexBotFlowRth(now);
  if (!marketOpen) {
    // The provider keeps returning the close indefinitely. Never poll it outside
    // RTH; the last verified session sample remains visible with a frozen badge.
    return currentPayload(now, false);
  }
  resetForSession(newYorkSessionKey(now));
  if (!force && now < state.nextAttemptAt) return currentPayload(now, true);
  if (inFlight) return inFlight;
  inFlight = poll(now, true).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function __resetGexBotFlowPollerForTests() {
  state.sessionKey = null;
  state.sample = null;
  state.window = [];
  state.verdicts = [];
  state.restrikes = [];
  state.emittedRestrikes = new Set();
  state.lastAttemptAt = 0;
  state.nextAttemptAt = 0;
  state.consecutiveFailures = 0;
  state.lastRequestFailed = false;
  state.lastError = null;
  inFlight = null;
}
