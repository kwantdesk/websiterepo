import type { GameplanPayload } from "@/lib/gameplan";
import type { GameplanSourceReceipt } from "@/lib/gameplanSource.server";
import {
  LAB_SNAPSHOT_VERSION,
  parseLabSnapshot,
  type LabCogStatus,
  type LabFilmDelta,
  type LabGateStatus,
  type LabMode,
  type LabPhase,
  type LabRoot,
  type LabSnapshot,
} from "@/lib/labSnapshot";

export type LabRunMarketSnapshot = {
  symbol: string;
  lastPrice: number;
  changePercent: number;
  timestamp: number;
  delayed: boolean;
  marketOpen: boolean;
  provider: string;
};

export type BuildLabRunOptions = {
  now?: Date;
  prior?: LabSnapshot | null;
  sources: GameplanSourceReceipt;
  referees?: LabRunMarketSnapshot[];
  commit: string;
};

const FILM_MAX_AGE_MS = 4 * 60 * 60_000;

function newYorkParts(at: Date) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at).map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    weekday: values.weekday,
    minute: Number(values.hour) * 60 + Number(values.minute),
  };
}

export function labRunPhase(at = new Date()): LabPhase {
  const parts = newYorkParts(at);
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return "CLOSED";
  if (parts.minute >= 9 * 60 + 30 && parts.minute < 16 * 60) return "LIVE";
  if (parts.minute >= 9 * 60 && parts.minute < 9 * 60 + 30) return "WAKE";
  if (parts.minute < 9 * 60) return "PREOPEN";
  return "CLOSED";
}

export function labTargetSessionDate(at = new Date()) {
  const parts = newYorkParts(at);
  const current = new Date(`${parts.date}T12:00:00.000Z`);
  const needsNextSession = parts.weekday === "Sat"
    || parts.weekday === "Sun"
    || parts.minute >= 16 * 60;
  if (needsNextSession) {
    do current.setUTCDate(current.getUTCDate() + 1);
    while (current.getUTCDay() === 0 || current.getUTCDay() === 6);
  }
  return current.toISOString().slice(0, 10);
}

function round(value: number) {
  return Number(value.toFixed(4));
}

function frameDirection(delta: number, spotDelta: number | null, isSpot = false): LabFilmDelta["direction"] {
  if (Math.abs(delta) < 0.0001) return "HOLDING";
  if (isSpot || spotDelta === null || Math.abs(spotDelta) < 0.0001) {
    return delta > 0 ? "CHASING_UP" : "CHASING_DOWN";
  }
  if (Math.sign(delta) !== Math.sign(spotDelta)) return "DIVERGING";
  return delta > 0 ? "CHASING_UP" : "CHASING_DOWN";
}

function filmFromFrames(
  current: { spot: number | null; flip: number | null; asOf: string },
  prior: LabSnapshot | null,
  sessionDate: string,
  now: Date,
): LabSnapshot["film"] {
  if (!prior || prior.sessionDate !== sessionDate || prior.root === undefined) {
    return { status: "NO_FILM", asOf: current.asOf, priorAsOf: null, deltas: [] };
  }
  const priorAge = now.getTime() - Date.parse(prior.updatedAt);
  if (!Number.isFinite(priorAge) || priorAge < 0 || priorAge > FILM_MAX_AGE_MS) {
    return { status: "STALE", asOf: current.asOf, priorAsOf: prior.updatedAt, deltas: [] };
  }
  if (current.spot === null || prior.mode.spot === null) {
    return { status: "NO_FILM", asOf: current.asOf, priorAsOf: prior.updatedAt, deltas: [] };
  }

  const spotDelta = round(current.spot - prior.mode.spot);
  const deltas: LabFilmDelta[] = [{
    id: "spot",
    label: "Futures spot",
    previous: prior.mode.spot,
    current: current.spot,
    delta: spotDelta,
    direction: frameDirection(spotDelta, spotDelta, true),
    interpretation: spotDelta === 0
      ? "Price held between the two repository frames."
      : `Price moved ${spotDelta > 0 ? "up" : "down"} between manual pulls.`,
  }];

  if (current.flip !== null && prior.mode.flip !== null) {
    const flipDelta = round(current.flip - prior.mode.flip);
    const direction = frameDirection(flipDelta, spotDelta);
    deltas.push({
      id: "flip",
      label: "Zero-gamma flip",
      previous: prior.mode.flip,
      current: current.flip,
      delta: flipDelta,
      direction,
      interpretation: direction === "DIVERGING"
        ? "The flip migrated against price; the board is diverging and needs extra caution."
        : direction === "HOLDING"
          ? "The flip held while price changed; treat it as a fixed mode boundary."
          : `The flip migrated ${flipDelta > 0 ? "up" : "down"} with price.`,
    });
  }

  return {
    status: current.flip !== null && prior.mode.flip !== null ? "READY" : "NO_FILM",
    asOf: current.asOf,
    priorAsOf: prior.updatedAt,
    deltas,
  };
}

function modeFromFrame(spot: number | null, flip: number | null): LabMode {
  if (spot === null || flip === null) return "UNRESOLVED";
  return spot >= flip ? "FADE" : "FOLLOW";
}

function cogStatus(value: GameplanSourceReceipt["options"]["status"] | GameplanSourceReceipt["futures"]["status"]): LabCogStatus {
  return value;
}

function gateForSource(
  phase: LabPhase,
  sources: GameplanSourceReceipt,
): { status: LabGateStatus; value: string; rule: string } {
  const unusable = sources.options.status === "STALE"
    || sources.futures.status === "STALE"
    || sources.futures.status === "DOWN";
  const frozenLive = phase === "LIVE"
    && (sources.options.status !== "LIVE" || sources.futures.status !== "LIVE");
  if (unusable || frozenLive) {
    return {
      status: "STOP",
      value: unusable ? "COG UNUSABLE" : "FROZEN IN RTH",
      rule: "Live permission requires current options positioning and a current futures calibration.",
    };
  }
  if (sources.options.status === "FROZEN" || sources.futures.status === "FROZEN") {
    return {
      status: "WARN",
      value: "PRIOR / FROZEN",
      rule: "Out-of-hours structure is valid planning context; the wake must re-grade it before a live call.",
    };
  }
  return {
    status: "PASS",
    value: "CURRENT",
    rule: "The source receipts are current for this phase.",
  };
}

function refereeGate(
  snapshot: LabRunMarketSnapshot | undefined,
  label: string,
  phase: LabPhase,
  nowMs: number,
) {
  if (!snapshot) {
    return {
      id: label.toLowerCase().replaceAll(" ", "-"),
      label,
      value: "MISSING",
      status: "STOP" as const,
      asOf: null,
      rule: "A missing referee is announced and blocks live permission.",
    };
  }
  const current = !snapshot.delayed && nowMs - snapshot.timestamp <= 5 * 60_000;
  const liveRequired = phase === "LIVE";
  return {
    id: label.toLowerCase().replaceAll(" ", "-"),
    label,
    value: `${snapshot.lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })} · ${snapshot.changePercent >= 0 ? "+" : ""}${snapshot.changePercent.toFixed(2)}%`,
    status: current ? "PASS" as const : liveRequired ? "STOP" as const : "WARN" as const,
    asOf: new Date(snapshot.timestamp).toISOString(),
    rule: current
      ? `Current ${snapshot.provider} reading is available.`
      : "Delayed or closed-session referee data is context only; re-pull at the wake.",
  };
}

function safeId(value: string, index: number) {
  const id = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return id || `row-${index + 1}`;
}

export function buildLabSnapshotFromGameplan(
  gameplan: GameplanPayload,
  options: BuildLabRunOptions,
): LabSnapshot {
  const now = options.now ?? new Date();
  const at = now.toISOString();
  const phase = labRunPhase(now);
  const plan = gameplan.plan;
  // The settled positioning fence can still be dated yesterday before the
  // cash open. The card belongs to the target New York trading session, while
  // edition.data_basis preserves the actual source date.
  const sessionDate = labTargetSessionDate(now);
  const prior = options.prior?.root === gameplan.instrument ? options.prior : null;
  const spot = gameplan.current_price;
  const flip = plan.environment.tape.flip_price;
  const mode = modeFromFrame(spot, flip);
  const film = filmFromFrames({ spot, flip, asOf: options.sources.futures.asOf || at }, prior, sessionDate, now);
  const sourceGate = gateForSource(phase, options.sources);
  const vix = options.referees?.find((item) => item.symbol === "VIX");
  const primarySymbol = gameplan.instrument === "NQ" ? "NDX" : "SPX";
  const crossSymbol = gameplan.instrument === "NQ" ? "SPX" : "NDX";
  const primary = options.referees?.find((item) => item.symbol === primarySymbol);
  const cross = options.referees?.find((item) => item.symbol === crossSymbol);
  const crossAvailable = Boolean(primary && cross);
  const crossAgreement = crossAvailable
    ? Math.sign(primary!.changePercent) === Math.sign(cross!.changePercent)
      || Math.abs(primary!.changePercent) < 0.05
      || Math.abs(cross!.changePercent) < 0.05
    : false;
  const crossCurrent = crossAvailable
    && !primary!.delayed
    && !cross!.delayed
    && now.getTime() - primary!.timestamp <= 5 * 60_000
    && now.getTime() - cross!.timestamp <= 5 * 60_000;
  const crossStatus: LabGateStatus = !crossAvailable
    ? "STOP"
    : phase === "LIVE" && !crossCurrent
      ? "STOP"
      : crossAgreement
        ? "PASS"
        : "WARN";

  const gates: LabSnapshot["gates"] = [
    {
      id: "source-completeness",
      label: "Source completeness",
      value: sourceGate.value,
      status: sourceGate.status,
      asOf: options.sources.futures.asOf || null,
      rule: sourceGate.rule,
    },
    {
      id: "mode",
      label: "Mode word",
      value: mode,
      status: mode === "UNRESOLVED" ? "STOP" : "PASS",
      asOf: options.sources.futures.asOf || null,
      rule: "FADE requires spot at or above the zero-gamma flip; below the flip is FOLLOW.",
    },
    {
      id: "film",
      label: "Film rule",
      value: film.status,
      status: film.status === "READY" ? "PASS" : "STOP",
      asOf: film.asOf,
      rule: "One frame is not Film. Pull again before any live call; frames older than four hours are refused.",
    },
    refereeGate(vix, "VIX referee", phase, now.getTime()),
    {
      id: "cross-index",
      label: `${primarySymbol} / ${crossSymbol} agreement`,
      value: crossAvailable
        ? `${primary!.changePercent >= 0 ? "+" : ""}${primary!.changePercent.toFixed(2)}% / ${cross!.changePercent >= 0 ? "+" : ""}${cross!.changePercent.toFixed(2)}%`
        : "MISSING",
      status: crossStatus,
      asOf: crossAvailable ? new Date(Math.min(primary!.timestamp, cross!.timestamp)).toISOString() : null,
      rule: crossAvailable
        ? crossAgreement
          ? "The cash-index referees agree on direction."
          : "The cash-index referees diverge; reduce narrative confidence and demand stronger tape proof."
        : "Cross-index agreement is required and cannot be inferred from the primary instrument alone.",
    },
  ];

  const levels: LabSnapshot["levels"] = plan.ladder.map((level, index) => {
    const midpoint = (level.zone[0] + level.zone[1]) / 2;
    const containsFlip = flip !== null && flip >= level.zone[0] && flip <= level.zone[1];
    const kind = containsFlip
      ? "FLIP" as const
      : level.order_character.balance > 0.1
        ? "BUY" as const
        : level.order_character.balance < -0.1
          ? "SELL" as const
          : spot !== null && midpoint < spot
            ? "BUY" as const
            : spot !== null && midpoint > spot
              ? "SELL" as const
              : "REFERENCE" as const;
    return {
      id: safeId(`${level.name}-${midpoint}`, index),
      label: level.name,
      kind,
      low: Math.min(level.zone[0], level.zone[1]),
      high: Math.max(level.zone[0], level.zone[1]),
      strength: Math.max(1, Math.min(100, level.strength * 20)),
      status: "PROVISIONAL" as const,
      action: `${level.if_visit} ${level.if_hold}`,
      invalidation: level.if_break,
      sources: level.sources.map((source) => `KwantData · ${source}`),
      witnesses: [],
      career: level.career.length
        ? level.career.join(" · ")
        : `${level.role} · ${level.terrain} · not yet audited this session`,
    };
  });

  const scenarios: LabSnapshot["scenarios"] = plan.scenarios.map((scenario, index) => ({
    id: safeId(scenario.name, index),
    name: scenario.name,
    weight: Math.max(0, Math.min(100, scenario.weight <= 1 ? Math.round(scenario.weight * 100) : Math.round(scenario.weight))),
    status: "WATCHING",
    trigger: scenario.trigger,
    path: scenario.path,
    kill: scenario.kill,
  }));

  const modeSetup = mode === "FOLLOW"
    ? plan.one_trade.short_side
    : mode === "FADE"
      ? [plan.one_trade.long_side, plan.one_trade.short_side]
        .sort((left, right) => right.quality_score - left.quality_score)[0]
      : null;
  const stoppedGate = gates.find((gate) => gate.status === "STOP");
  const confidencePenalty = (gameplan.status === "PARTIAL" ? 20 : 0)
    + (film.status !== "READY" ? 15 : 0)
    + (crossStatus !== "PASS" ? 8 : 0);
  const confidence = Math.max(0, Math.min(90, Math.round((modeSetup?.quality_score ?? 45) - confidencePenalty)));
  const modeReason = mode === "UNRESOLVED"
    ? "Spot or the zero-gamma flip is unavailable, so August V1 refuses to name a mode."
    : `${mode}: futures spot is ${spot! >= flip! ? "above" : "below"} the zero-gamma flip by ${Math.abs(spot! - flip!).toLocaleString("en-US", { maximumFractionDigits: 2 })}. ${film.status === "READY" ? "Film is available from the prior manual pull." : "One frame — no Film; re-run before any live call."}`;
  const deltaEvidence = film.deltas.map((delta) => `${delta.label} ${delta.delta === null ? "—" : `${delta.delta >= 0 ? "+" : ""}${delta.delta}`}`);
  const updateKind = film.status === "READY" ? "FILM" as const : phase === "WAKE" ? "WAKE" as const : "PLAN" as const;
  const previousUpdates = prior?.sessionDate === sessionDate ? prior.updates.slice(-199) : [];
  const update = {
    id: `manual-${at.replace(/[^0-9]/g, "")}`,
    at,
    kind: updateKind,
    title: film.status === "READY" ? "Manual re-run updated Film" : "Manual run captured the baseline frame",
    body: film.status === "READY"
      ? `${modeReason} The structural ladder and referee gates were rebuilt from the current VPS source receipts.`
      : `${modeReason} The plan is visible now for preparation, but the Film and live-permission gates remain closed.`,
    evidence: [
      `${options.sources.options.source} ${options.sources.options.status}`,
      `${options.sources.futures.source} ${options.sources.futures.status}`,
      ...deltaEvidence,
    ].slice(0, 12),
    price: spot,
  };

  const snapshot: LabSnapshot = {
    version: LAB_SNAPSHOT_VERSION,
    environment: "LIVE",
    root: gameplan.instrument as LabRoot,
    sessionDate,
    phase,
    publishedAt: prior?.sessionDate === sessionDate ? prior.publishedAt : at,
    updatedAt: at,
    refreshAfterMs: Math.max(5_000, Math.min(60_000, Math.round(gameplan.refresh_after_ms))),
    receipt: {
      repository: "kesxalerebo/QUANT-DESK- · VPS runtime",
      commit: options.commit,
      artifact: `AUGUST_V1_QUANT_DESK_FRAMEWORK/runtime/${gameplan.instrument}/current.json`,
    },
    mode: {
      value: mode,
      spot,
      flip,
      asOf: options.sources.futures.asOf || at,
      prior: options.sources.options.status !== "LIVE" || options.sources.futures.status !== "LIVE",
      reason: modeReason,
    },
    summary: {
      oneLiner: film.status === "READY"
        ? plan.one_liner
        : `${plan.one_liner} One frame — no Film; re-run before any live call.`,
      dayType: `${plan.environment.tape.state === "calm" ? "Rotation" : plan.environment.tape.state === "snowball" ? "Expansion" : "Mixed"} · ${mode}`,
      confidence,
      evidenceGrade: gameplan.status === "LIVE" && film.status === "READY" && gates.every((gate) => gate.status === "PASS") ? "CORE" : "PROVISIONAL",
      sampleSize: levels.length,
      killCondition: modeSetup?.invalidation ?? "The mode remains unresolved; no trade thesis exists.",
    },
    film,
    cogs: [
      {
        id: "options-positioning",
        label: "Options positioning",
        status: cogStatus(options.sources.options.status),
        source: options.sources.options.source,
        asOf: options.sources.options.asOf,
        detail: options.sources.options.detail,
      },
      {
        id: "futures-calibration",
        label: "Futures calibration",
        status: cogStatus(options.sources.futures.status),
        source: options.sources.futures.source,
        asOf: options.sources.futures.asOf,
        detail: options.sources.futures.detail,
      },
      {
        id: "volatility-referee",
        label: "Volatility referee",
        status: vix ? vix.delayed ? "FROZEN" : "LIVE" : "DOWN",
        source: vix?.provider ?? "VPS market-index cache",
        asOf: vix ? new Date(vix.timestamp).toISOString() : null,
        detail: vix ? "VIX is carried as a referee reading, not a standalone direction signal." : "No VIX receipt was available; the referee gate is closed.",
      },
      {
        id: "cross-index",
        label: "Cross-index tape",
        status: !crossAvailable ? "DOWN" : crossCurrent ? "LIVE" : "FROZEN",
        source: crossAvailable ? `${primary!.provider} / ${cross!.provider}` : "VPS market-index cache",
        asOf: crossAvailable ? new Date(Math.min(primary!.timestamp, cross!.timestamp)).toISOString() : null,
        detail: crossAvailable ? `${primarySymbol} and ${crossSymbol} are compared from the same shared gateway boundary.` : "One or both cash-index receipts are missing.",
      },
    ],
    gates,
    levels,
    scenarios,
    trade: {
      status: modeSetup ? "WAIT" : "NO_TRADE",
      side: modeSetup?.side ?? null,
      name: modeSetup?.setup_name ?? "No setup issued",
      zone: modeSetup?.zone ?? null,
      permission: modeSetup
        ? `${stoppedGate ? `BLOCKED BY ${stoppedGate.label.toUpperCase()}. ` : ""}${modeSetup.permission} Location alone is never permission.`
        : "The mode is unresolved, so August V1 issues no trade card.",
      entryTrigger: modeSetup?.permission ?? "Not issued",
      stop: modeSetup?.stop ?? null,
      coreTarget: modeSetup?.targets[0] ?? null,
      runnerTarget: modeSetup?.targets[1] ?? modeSetup?.targets[2] ?? null,
      invalidation: modeSetup?.invalidation ?? "Missing mode or setup invalidates the card.",
      announce: ["model", "stop", "size", "core target door", "runner plan"],
    },
    noTrade: plan.belly_zones.map((zone, index) => ({
      id: `belly-${index + 1}`,
      label: `No-trade belly ${index + 1}`,
      low: Math.min(zone[0], zone[1]),
      high: Math.max(zone[0], zone[1]),
      reason: plan.one_trade.not_a_trade_if,
    })),
    updates: [...previousUpdates, update],
  };

  return parseLabSnapshot(snapshot);
}
