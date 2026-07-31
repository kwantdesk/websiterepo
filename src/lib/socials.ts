export type SocialObjectType =
  | "profile"
  | "post"
  | "precord"
  | "receipt"
  | "receipt-evidence"
  | "desk"
  | "desk-member"
  | "comment"
  | "reaction"
  | "follow"
  | "card"
  | "progress"
  | "consensus";

export type SocialScope = "private" | "friends" | "desk" | "community";
export type SocialProcessStatus = "PREPARING" | "MAPPING" | "WAITING" | "OBSERVING" | "REVIEWING" | "AWAY";
export type PrecordDirection = "LONG" | "SHORT" | "BOTH" | "NEUTRAL";
export type PrecordStatus =
  | "LOCKED"
  | "PRECORDED"
  | "LIVE"
  | "ENTRY TRIGGERED"
  | "EXECUTION ADDED"
  | "UNDER REVIEW"
  | "PROVEN"
  | "PARTIALLY PROVEN"
  | "ADAPTED"
  | "INVALIDATED"
  | "NO TRIGGER"
  | "NO TRADE"
  | "EXPIRED";

export type SocialLifecycleEvent = {
  status: PrecordStatus;
  at: string;
  source: "PLATFORM" | "TRADER" | "ZYON";
  note?: string;
};

export type SocialExecutionFill = {
  price: number | null;
  size: number | null;
  time: string | null;
};

export type SocialExecutionComparison = {
  dimension: "Entry" | "Stop" | "Target / exit" | "Size / risk" | "Confirmation" | "Timing";
  planned: string;
  actual: string;
  difference: string;
  status: "MATCHED" | "ADAPTED" | "DEVIATED" | "SAFER" | "RISKIER" | "MET" | "PARTIAL" | "UNMET" | "VALID" | "RETROSPECTIVE" | "NOT APPLICABLE";
};

export type SocialObject<TPayload = Record<string, unknown>> = {
  id: string;
  userId: string;
  authorLabel: string;
  objectType: SocialObjectType;
  scope: SocialScope;
  deskId: string | null;
  parentId: string | null;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
  cloudSaved?: boolean;
};

export type SocialProfilePayload = {
  displayName: string;
  handle: string;
  bio: string;
  location: string;
  occupation: string;
  interests: string;
  activeSince: string;
  markets: string[];
  session: string;
  timezone: string;
  experience: string;
  style: string;
  improvementObjective: string;
  favouriteTheme: string;
  processStatus: SocialProcessStatus;
  strongestDiscipline: string;
  currentBlindSpot: string;
  scores: {
    preparation: number;
    confirmation: number;
    review: number;
    calibration: number;
    patience: number;
    contribution: number;
    consistency: number;
    research: number;
  };
  visibility: {
    profile: SocialScope;
    activity: SocialScope;
    scores: SocialScope;
    cards: SocialScope;
    followers: "private" | "community";
    following: "private" | "community";
  };
  avatarUrl?: string;
  presenceStatus?: "online" | "dnd" | "away" | "sleeping" | "offline";
  presenceMessage?: string;
  lastSeenAt?: string;
  activityStreak: number;
  longestActivityStreak: number;
  lastActivityDate: string;
  blockedUserIds?: string[];
  dismissedFriendRequests?: Record<string, string>;
  friendReadAt?: Record<string, string>;
  contactEmail?: string;
  websiteUrl?: string;
  profileLinks?: Array<{ label: string; url: string }>;
  showContactEmail?: boolean;
  callingCardCode?: string;
};

export type SocialPrecordPayload = {
  instrument: string;
  session: string;
  direction: PrecordDirection;
  marketContext: string;
  plannedEntryTime?: string | null;
  plannedEntryLow: number | null;
  plannedEntryHigh: number | null;
  plannedStop: number | null;
  plannedTarget: number | null;
  plannedTargets?: number[];
  plannedSize: number | null;
  maximumRisk: number | null;
  riskUnit?: "DOLLARS" | "POINTS" | "TICKS" | "PERCENT";
  tradingAccount?: {
    mode: "LIVE" | "SIM" | "PROP";
    provider: string;
    program: string;
    phase: "LIVE" | "SIMULATION" | "EVALUATION" | "FUNDED";
    size: number | null;
    currency: "USD" | "AUD" | "GBP" | "EUR" | "CAD";
  } | null;
  plannedRiskReward: number | null;
  confluences?: string[];
  bullCondition: string;
  bearCondition: string;
  confirmation: string;
  invalidation: string;
  expiryAt: string | null;
  lockedAt: string;
  reasoningScore: number;
  status: PrecordStatus;
  source: "SOCIALS" | "GAMEPLAN" | "CHARTS" | "GEXMAP" | "JOURNAL" | "ZYON";
  sourceGameplanId?: string;
  sourceGameplanVersion?: string;
  sourceGeneratedAt?: string;
  gameplanSnapshot?: Record<string, unknown>;
  contentHash?: string;
  scoreModelVersion?: string;
  evidenceState?: "SELF REPORTED" | "PLATFORM TIMESTAMPED" | "BROKER VERIFIED";
  recordMode?: "LIVE" | "HISTORICAL";
  lifecycle?: SocialLifecycleEvent[];
};

export type SocialReceiptPayload = {
  actualDirection?: "LONG" | "SHORT" | null;
  actualEntry: number | null;
  entryTime: string | null;
  actualStop: number | null;
  actualExit: number | null;
  exitTime: string | null;
  size: number | null;
  partialExits: string;
  fees: number | null;
  confirmationsAppeared: string;
  deviationReason: string;
  deviationDetail: string;
  outcomeReview: string;
  nextTimeRule: string;
  evidenceName: string;
  evidenceDataUrl: string;
  hasEvidence?: boolean;
  noTrade: boolean;
  classification: "DISCIPLINED NO TRIGGER" | "JUSTIFIED ADAPTATION" | "PARTIALLY JUSTIFIED" | "UNJUSTIFIED DEVIATION" | "INSUFFICIENT EVIDENCE";
  scores: {
    confirmation: number;
    discipline: number;
    execution: number;
    review: number;
    evidenceConfidence: number;
    final: number;
  };
  addedAt: string;
  fills?: SocialExecutionFill[];
  exits?: SocialExecutionFill[];
  maximumActualRisk?: number | null;
  comparison?: SocialExecutionComparison[];
  retrospective?: boolean;
  evidenceState?: "SELF REPORTED" | "PLATFORM TIMESTAMPED" | "BROKER VERIFIED";
  assessment?: {
    classification: "DISCIPLINED NO TRIGGER" | "JUSTIFIED ADAPTATION" | "PARTIALLY JUSTIFIED" | "UNJUSTIFIED DEVIATION" | "INSUFFICIENT EVIDENCE";
    explanation: string;
    evidenceUsed: string[];
    evidenceMissing: string[];
    confidence: number;
    evaluator: "ZYON" | "RULES";
    modelVersion: string;
    rubricVersion: string;
    assessedAt: string;
    appealAvailable: boolean;
  };
  scoreSnapshot?: {
    reasoning: number;
    reasoningModelVersion: string;
    postExecutionModelVersion: string;
    createdAt: string;
  };
  pathMetrics?: SocialReasoningPathMetrics;
};

export type SocialReasoningPathMetrics = {
  status: "IN PROGRESS" | "TARGET HIT" | "STOP HIT" | "EXPIRED" | "COMPLETE";
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  pointsInDirection: number;
  adverseExcursion: number;
  favourableExcursion: number;
  ticksCaught: number;
  riskPoints: number;
  realisedR: number;
  plannedR: number | null;
  durationSeconds: number;
  targetsHit: number[];
  outcomeScore: number;
};

export type SocialReasoningCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SocialPostPayload = {
  kind: "MAP" | "LIVE OBSERVATION" | "REVIEW REQUEST" | "LESSON" | "QUESTION";
  instrument: string;
  title: string;
  body: string;
  context: string;
  condition: string;
  invalidation: string;
  relatedPrecordId: string | null;
  observedAt: string;
  isRepost?: boolean;
  repostOfUserId?: string;
};

export type SocialDeskPayload = {
  name: string;
  description: string;
  markets: string[];
  session: string;
  timezone: string;
  objective: string;
  privacy: "PUBLIC" | "PRIVATE" | "REQUEST";
  capacity: number;
  weeklyMission: string;
};

export type SocialDeskMemberPayload = {
  role: "OWNER" | "STEWARD" | "MEMBER";
  status: SocialProcessStatus;
  joinedAt: string;
};

export type SocialCommentPayload = {
  kind: "QUESTION" | "REVIEW" | "COUNTERCASE" | "LESSON" | "TRADER NOTE";
  body: string;
  helpful: boolean;
};

export type SocialReactionPayload = {
  kind: "USEFUL" | "CLEAR" | "EVIDENCE" | "SAVED" | "FIRE" | "TARGET" | "BRAIN" | "APPLAUSE";
};

export type SocialCardPayload = {
  code: string;
  name: string;
  family: "LEGACY" | "MASTERY" | "MOMENTUM" | "CONTRIBUTION" | "HIDDEN" | "TRANSFORMED";
  description: string;
  earnedAt: string;
  active: boolean;
  equipped: boolean;
  public: boolean;
};

export type SocialProgressPayload = {
  sessionDate: string;
  prepare: boolean;
  map: boolean;
  observe: boolean;
  review: boolean;
  improve: boolean;
  noTrade: boolean;
  graceDay: boolean;
};

export type SocialConsensusPayload = {
  sessionDate: string;
  instrument: string;
  level: string;
  interpretation: string;
  bullConfirmation: string;
  bearConfirmation: string;
  invalidation: string;
  enoughEvidence: boolean;
  committedAt: string;
};

export type SocialState = {
  version: 1;
  objects: SocialObject[];
  cloud: boolean;
  loadedAt: string;
};

export type CallingCardDefinition = {
  code: string;
  name: string;
  family: "LEGACY" | "MASTERY" | "MOMENTUM" | "CONTRIBUTION" | "HIDDEN" | "TRANSFORMED";
  description: string;
  requirement: string;
  accent: "gold" | "green" | "blue" | "violet" | "red" | "white";
};

export const EMPTY_SOCIAL_STATE: SocialState = {
  version: 1,
  objects: [],
  cloud: false,
  loadedAt: "",
};

export const SOCIAL_OBJECT_TYPES: SocialObjectType[] = [
  "profile",
  "post",
  "precord",
  "receipt",
  "receipt-evidence",
  "desk",
  "desk-member",
  "comment",
  "reaction",
  "follow",
  "card",
  "progress",
  "consensus",
];

export const SOCIAL_SCOPES: SocialScope[] = ["private", "friends", "desk", "community"];

export const PROCESS_STATUSES: Array<{ id: SocialProcessStatus; label: string }> = [
  { id: "PREPARING", label: "Preparing" },
  { id: "MAPPING", label: "Mapping" },
  { id: "WAITING", label: "Waiting" },
  { id: "OBSERVING", label: "Observing" },
  { id: "REVIEWING", label: "Reviewing" },
  { id: "AWAY", label: "Away" },
];

export const CALLING_CARD_CATALOG: CallingCardDefinition[] = [
  {
    code: "first-on-record",
    name: "First on Record",
    family: "LEGACY",
    description: "Published a first locked plan before the outcome.",
    requirement: "Lock one complete Decision Record.",
    accent: "gold",
  },
  {
    code: "waited-for-permission",
    name: "Waited for Permission",
    family: "MASTERY",
    description: "Completed the plan and correctly recorded no trade when confirmation never appeared.",
    requirement: "Verify one complete no-trigger receipt.",
    accent: "green",
  },
  {
    code: "five-straight",
    name: "Five Straight",
    family: "MOMENTUM",
    description: "Permanent record of the first five-session verified win streak.",
    requirement: "Five risk-normalized winning sessions.",
    accent: "red",
  },
  {
    code: "daily-architect",
    name: "Daily Architect",
    family: "HIDDEN",
    description: "Built complete plans across twenty scheduled sessions.",
    requirement: "Hidden until earned.",
    accent: "blue",
  },
  {
    code: "quiet-consistency",
    name: "Quiet Consistency",
    family: "HIDDEN",
    description: "Completed thirty plan-to-review cycles without chasing public attention.",
    requirement: "Hidden until earned.",
    accent: "white",
  },
  {
    code: "plan-reviewer",
    name: "Plan Reviewer",
    family: "CONTRIBUTION",
    description: "Provided repeatedly useful evidence-based peer reviews.",
    requirement: "Ten reviews accepted as helpful.",
    accent: "violet",
  },
  {
    code: "tempered-steel",
    name: "Tempered Steel",
    family: "TRANSFORMED",
    description: "Corrected unstable risk and produced a verified risk-normalized sample.",
    requirement: "Complete the private Glass Cannon correction track.",
    accent: "white",
  },
  {
    code: "zero-alpha-decay",
    name: "0α Decay",
    family: "MASTERY",
    description: "Reasoning and execution quality remained stable as evidence grew.",
    requirement: "Revalidated monthly after a qualifying multi-regime sample.",
    accent: "gold",
  },
];

export function socialId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}:${crypto.randomUUID()}`;
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeHandle(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
  return normalized || "trader";
}

export function buildDefaultProfile(label: string): SocialProfilePayload {
  const emailStem = label.includes("@") ? label.split("@")[0] : label;
  const displayName = emailStem
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim() || "Kwant Trader";
  return {
    displayName,
    handle: normalizeHandle(emailStem),
    bio: "",
    location: "",
    occupation: "",
    interests: "",
    activeSince: new Date().toISOString(),
    markets: ["NQ"],
    session: "New York",
    timezone: "Australia/Brisbane",
    experience: "Developing",
    style: "Options-aware discretionary",
    improvementObjective: "Wait for stated confirmation before acting.",
    favouriteTheme: "Kwant Desk",
    processStatus: "PREPARING",
    strongestDiscipline: "Scenario preparation",
    currentBlindSpot: "Premature confirmation",
    scores: {
      preparation: 0,
      confirmation: 0,
      review: 0,
      calibration: 0,
      patience: 0,
      contribution: 0,
      consistency: 0,
      research: 0,
    },
    visibility: {
      profile: "community",
      activity: "desk",
      scores: "friends",
      cards: "community",
      followers: "community",
      following: "community",
    },
    contactEmail: "",
    websiteUrl: "",
    profileLinks: [],
    showContactEmail: false,
    callingCardCode: "",
    activityStreak: 0,
    longestActivityStreak: 0,
    lastActivityDate: "",
  };
}

function profileText(value: unknown, fallback: string, maximum = 500) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maximum)
    : fallback;
}

function profileScope(value: unknown, fallback: SocialScope): SocialScope {
  return value === "private" || value === "friends" || value === "desk" || value === "community"
    ? value
    : fallback;
}

export function normalizeSocialProfile(value: unknown, label = "Kwant Trader"): SocialProfilePayload {
  const fallback = buildDefaultProfile(label);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<SocialProfilePayload>;
  const scores = candidate.scores && typeof candidate.scores === "object"
    ? candidate.scores
    : fallback.scores;
  const visibility = candidate.visibility && typeof candidate.visibility === "object"
    ? candidate.visibility
    : fallback.visibility;
  const processStatus = PROCESS_STATUSES.some((option) => option.id === candidate.processStatus)
    ? candidate.processStatus as SocialProcessStatus
    : fallback.processStatus;
  const presenceStatus = candidate.presenceStatus === "dnd"
    || candidate.presenceStatus === "away"
    || candidate.presenceStatus === "sleeping"
    || candidate.presenceStatus === "offline"
    || candidate.presenceStatus === "online"
    ? candidate.presenceStatus
    : undefined;
  const numberScore = (key: keyof SocialProfilePayload["scores"]) => {
    const score = Number(scores[key]);
    return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : fallback.scores[key];
  };
  const links = Array.isArray(candidate.profileLinks)
    ? candidate.profileLinks.flatMap((link) => {
        if (!link || typeof link !== "object") return [];
        const item = link as { label?: unknown; url?: unknown };
        const url = profileText(item.url, "", 400);
        if (!/^https?:\/\//i.test(url)) return [];
        return [{
          label: profileText(item.label, "Link", 32) || "Link",
          url,
        }];
      }).slice(0, 4)
    : [];
  return {
    ...fallback,
    displayName: profileText(candidate.displayName, fallback.displayName, 60) || fallback.displayName,
    handle: normalizeHandle(profileText(candidate.handle, fallback.handle, 24)),
    bio: profileText(candidate.bio, "", 800),
    location: profileText(candidate.location, "", 100),
    occupation: profileText(candidate.occupation, "", 100),
    interests: profileText(candidate.interests, "", 180),
    activeSince: typeof candidate.activeSince === "string" && Number.isFinite(Date.parse(candidate.activeSince))
      ? new Date(candidate.activeSince).toISOString()
      : fallback.activeSince,
    markets: Array.isArray(candidate.markets)
      ? [...new Set(candidate.markets.map((market) => profileText(market, "", 12).toUpperCase()).filter(Boolean))].slice(0, 8)
      : fallback.markets,
    session: profileText(candidate.session, fallback.session, 40),
    timezone: profileText(candidate.timezone, fallback.timezone, 80),
    experience: profileText(candidate.experience, fallback.experience, 60),
    style: profileText(candidate.style, fallback.style, 100),
    improvementObjective: profileText(candidate.improvementObjective, fallback.improvementObjective, 500),
    favouriteTheme: profileText(candidate.favouriteTheme, fallback.favouriteTheme, 60),
    processStatus,
    strongestDiscipline: profileText(candidate.strongestDiscipline, fallback.strongestDiscipline, 100),
    currentBlindSpot: profileText(candidate.currentBlindSpot, fallback.currentBlindSpot, 100),
    scores: {
      preparation: numberScore("preparation"),
      confirmation: numberScore("confirmation"),
      review: numberScore("review"),
      calibration: numberScore("calibration"),
      patience: numberScore("patience"),
      contribution: numberScore("contribution"),
      consistency: numberScore("consistency"),
      research: numberScore("research"),
    },
    visibility: {
      profile: profileScope(visibility.profile, fallback.visibility.profile),
      activity: profileScope(visibility.activity, fallback.visibility.activity),
      scores: profileScope(visibility.scores, fallback.visibility.scores),
      cards: profileScope(visibility.cards, fallback.visibility.cards),
      followers: visibility.followers === "private" ? "private" : "community",
      following: visibility.following === "private" ? "private" : "community",
    },
    avatarUrl: typeof candidate.avatarUrl === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(candidate.avatarUrl)
      ? candidate.avatarUrl.slice(0, 1_600_000)
      : typeof candidate.avatarUrl === "string" && /^https:\/\//i.test(candidate.avatarUrl)
        ? candidate.avatarUrl.slice(0, 2_000)
        : "",
    presenceStatus,
    presenceMessage: profileText(candidate.presenceMessage, "", 120),
    lastSeenAt: profileText(candidate.lastSeenAt, "", 60),
    activityStreak: Number.isFinite(Number(candidate.activityStreak))
      ? Math.max(0, Math.floor(Number(candidate.activityStreak)))
      : 0,
    longestActivityStreak: Number.isFinite(Number(candidate.longestActivityStreak))
      ? Math.max(0, Math.floor(Number(candidate.longestActivityStreak)))
      : 0,
    lastActivityDate: /^\d{4}-\d{2}-\d{2}$/.test(profileText(candidate.lastActivityDate, "", 10))
      ? profileText(candidate.lastActivityDate, "", 10)
      : "",
    blockedUserIds: Array.isArray(candidate.blockedUserIds)
      ? candidate.blockedUserIds.filter((item): item is string => typeof item === "string").slice(0, 500)
      : [],
    dismissedFriendRequests: candidate.dismissedFriendRequests && typeof candidate.dismissedFriendRequests === "object"
      ? candidate.dismissedFriendRequests
      : {},
    friendReadAt: candidate.friendReadAt && typeof candidate.friendReadAt === "object"
      ? candidate.friendReadAt
      : {},
    contactEmail: profileText(candidate.contactEmail, "", 180),
    websiteUrl: /^https?:\/\//i.test(profileText(candidate.websiteUrl, "", 400))
      ? profileText(candidate.websiteUrl, "", 400)
      : "",
    profileLinks: links,
    showContactEmail: Boolean(candidate.showContactEmail),
    callingCardCode: profileText(candidate.callingCardCode, "", 80).replace(/[^a-z0-9-]/gi, ""),
  };
}

export function calculateReasoningScore(payload: Omit<SocialPrecordPayload, "reasoningScore" | "lockedAt" | "status">) {
  const checks = [
    Boolean(payload.instrument),
    Boolean(payload.session),
    Boolean(payload.marketContext.trim()),
    payload.plannedEntryLow !== null,
    payload.plannedStop !== null,
    payload.plannedTarget !== null || Boolean(payload.plannedTargets?.length),
    Boolean(payload.bullCondition.trim()),
    Boolean(payload.bearCondition.trim()),
    Boolean(payload.confirmation.trim()),
    Boolean(payload.invalidation.trim()),
    payload.expiryAt !== null,
  ];
  const completeness = checks.filter(Boolean).length / checks.length;
  const bothSidedBonus = payload.bullCondition.trim() && payload.bearCondition.trim() ? 8 : 0;
  const neutralBonus = payload.direction === "BOTH" || payload.direction === "NEUTRAL" ? 4 : 0;
  return Math.min(96, Math.round(42 + completeness * 42 + bothSidedBonus + neutralBonus));
}

export function calculateTrackedReasoningScore(
  plan: Pick<SocialPrecordPayload, "reasoningScore" | "direction" | "plannedEntryLow" | "plannedEntryHigh" | "plannedStop" | "plannedTarget" | "plannedTargets" | "maximumRisk">,
  path: Omit<SocialReasoningPathMetrics, "outcomeScore">,
) {
  const entry = path.entryPrice;
  const stop = plan.plannedStop;
  const riskPoints = stop === null ? path.riskPoints : Math.abs(entry - stop);
  const directionSign = plan.direction === "SHORT" ? -1 : 1;
  const realisedPoints = (path.exitPrice - entry) * directionSign;
  const realisedR = riskPoints > 0 ? realisedPoints / riskPoints : 0;
  const maeRatio = riskPoints > 0 ? path.adverseExcursion / riskPoints : 1;
  const targets = plan.plannedTargets?.length
    ? plan.plannedTargets
    : plan.plannedTarget === null ? [] : [plan.plannedTarget];
  const targetProgress = targets.length ? Math.min(1, path.targetsHit.length / targets.length) : 0;
  const planQuality = Math.max(0, Math.min(100, plan.reasoningScore));
  const directionScore = Math.max(0, Math.min(100, 50 + realisedR * 28));
  const adverseControl = Math.max(0, Math.min(100, 100 - maeRatio * 70));
  const captureEfficiency = path.favourableExcursion > 0
    ? Math.max(0, Math.min(100, path.pointsInDirection / path.favourableExcursion * 100))
    : realisedPoints >= 0 ? 70 : 20;
  const outcomeScore = Math.round(
    planQuality * 0.35
    + directionScore * 0.25
    + adverseControl * 0.15
    + captureEfficiency * 0.15
    + targetProgress * 100 * 0.1,
  );
  return {
    ...path,
    riskPoints,
    realisedR: Number(realisedR.toFixed(2)),
    plannedR: plan.plannedTarget !== null && riskPoints > 0
      ? Number((Math.abs(plan.plannedTarget - entry) / riskPoints).toFixed(2))
      : null,
    outcomeScore: Math.max(0, Math.min(100, outcomeScore)),
  } satisfies SocialReasoningPathMetrics;
}

export function evaluateReasoningPath(
  plan: SocialPrecordPayload,
  candles: SocialReasoningCandle[],
): SocialReasoningPathMetrics | null {
  if (
    !["LONG", "SHORT"].includes(plan.direction)
    || plan.plannedEntryLow === null
    || plan.plannedStop === null
  ) return null;
  const entryLow = Math.min(plan.plannedEntryLow, plan.plannedEntryHigh ?? plan.plannedEntryLow);
  const entryHigh = Math.max(plan.plannedEntryLow, plan.plannedEntryHigh ?? plan.plannedEntryLow);
  const lockedAt = Date.parse(plan.lockedAt);
  const eligible = candles.filter((candle) =>
    candle.timestamp >= lockedAt
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low));
  const entryIndex = eligible.findIndex((candle) => candle.low <= entryHigh && candle.high >= entryLow);
  if (entryIndex < 0) return null;
  const entryCandle = eligible[entryIndex];
  const entryPrice = Math.max(entryLow, Math.min(entryHigh, entryCandle.open || (entryLow + entryHigh) / 2));
  const targets = (plan.plannedTargets?.length
    ? plan.plannedTargets
    : plan.plannedTarget === null ? [] : [plan.plannedTarget])
    .filter(Number.isFinite);
  const long = plan.direction === "LONG";
  let favourableExcursion = 0;
  let adverseExcursion = 0;
  let exitPrice = eligible.at(-1)?.close ?? entryPrice;
  let exitTime = eligible.at(-1)?.timestamp ?? entryCandle.timestamp;
  let status: SocialReasoningPathMetrics["status"] = "IN PROGRESS";
  const hitTargets: number[] = [];

  for (const candle of eligible.slice(entryIndex)) {
    favourableExcursion = Math.max(
      favourableExcursion,
      long ? candle.high - entryPrice : entryPrice - candle.low,
    );
    adverseExcursion = Math.max(
      adverseExcursion,
      long ? entryPrice - candle.low : candle.high - entryPrice,
    );
    const stopHit = long ? candle.low <= plan.plannedStop : candle.high >= plan.plannedStop;
    if (stopHit) {
      status = "STOP HIT";
      exitPrice = plan.plannedStop;
      exitTime = candle.timestamp;
      break;
    }
    for (const target of targets) {
      if (hitTargets.includes(target)) continue;
      const hit = long ? candle.high >= target : candle.low <= target;
      if (hit) hitTargets.push(target);
    }
    if (targets.length && hitTargets.length === targets.length) {
      status = "TARGET HIT";
      exitPrice = targets.at(-1) as number;
      exitTime = candle.timestamp;
      break;
    }
    exitPrice = candle.close;
    exitTime = candle.timestamp;
  }

  const riskPoints = Math.abs(entryPrice - plan.plannedStop);
  const directionSign = long ? 1 : -1;
  const pointsInDirection = (exitPrice - entryPrice) * directionSign;
  return calculateTrackedReasoningScore(plan, {
    status,
    entryPrice,
    exitPrice,
    entryTime: new Date(entryCandle.timestamp).toISOString(),
    exitTime: new Date(exitTime).toISOString(),
    pointsInDirection,
    adverseExcursion,
    favourableExcursion,
    ticksCaught: pointsInDirection / 0.25,
    riskPoints,
    realisedR: riskPoints > 0 ? pointsInDirection / riskPoints : 0,
    plannedR: null,
    durationSeconds: Math.max(0, Math.round((exitTime - entryCandle.timestamp) / 1_000)),
    targetsHit: hitTargets,
  });
}

export function buildAutomaticGameplanReceipt(
  plan: SocialPrecordPayload,
  metrics: SocialReasoningPathMetrics,
): SocialReceiptPayload {
  const trackedDirection = plan.direction as "LONG" | "SHORT";
  return {
    actualDirection: trackedDirection,
    actualEntry: metrics.entryPrice,
    entryTime: metrics.entryTime,
    actualStop: plan.plannedStop,
    actualExit: metrics.exitPrice,
    exitTime: metrics.exitTime,
    size: plan.plannedSize,
    partialExits: metrics.targetsHit.length ? `Targets reached: ${metrics.targetsHit.join(", ")}` : "",
    fees: null,
    confirmationsAppeared: plan.confirmation,
    deviationReason: "PLATFORM TRACKED",
    deviationDetail: "CME price path reconstructed from the immutable lock timestamp.",
    outcomeReview: metrics.status === "TARGET HIT"
      ? `The final planned target was reached after ${metrics.durationSeconds} seconds.`
      : `The planned stop was reached after ${metrics.durationSeconds} seconds.`,
    nextTimeRule: "Review the locked thesis against the recorded path before changing the next plan.",
    evidenceName: "",
    evidenceDataUrl: "",
    hasEvidence: true,
    noTrade: false,
    classification: "JUSTIFIED ADAPTATION",
    scores: {
      confirmation: plan.reasoningScore,
      discipline: metrics.status === "TARGET HIT" ? 94 : 72,
      execution: metrics.outcomeScore,
      review: metrics.outcomeScore,
      evidenceConfidence: 96,
      final: metrics.outcomeScore,
    },
    addedAt: metrics.exitTime,
    fills: [{ price: metrics.entryPrice, size: plan.plannedSize, time: metrics.entryTime }],
    exits: [{ price: metrics.exitPrice, size: plan.plannedSize, time: metrics.exitTime }],
    maximumActualRisk: metrics.adverseExcursion,
    comparison: buildExecutionComparison(plan, {
      actualDirection: trackedDirection,
      actualEntry: metrics.entryPrice,
      actualStop: plan.plannedStop,
      actualExit: metrics.exitPrice,
      size: plan.plannedSize,
      maximumActualRisk: metrics.adverseExcursion,
      confirmationsAppeared: plan.confirmation,
      entryTime: metrics.entryTime,
      noTrade: false,
    }),
    retrospective: false,
    evidenceState: "PLATFORM TIMESTAMPED",
    assessment: {
      classification: "JUSTIFIED ADAPTATION",
      explanation: `Platform path review: ${metrics.pointsInDirection.toFixed(2)} points in the planned direction, ${metrics.adverseExcursion.toFixed(2)} points adverse excursion, ${metrics.realisedR.toFixed(2)}R realised and ${metrics.targetsHit.length} target${metrics.targetsHit.length === 1 ? "" : "s"} reached.`,
      evidenceUsed: ["Immutable Gameplan", "CME 5-minute price path", "Target and stop geometry"],
      evidenceMissing: ["Broker fill and slippage"],
      confidence: 0.92,
      evaluator: "RULES",
      modelVersion: "kwant-path-v1",
      rubricVersion: "reasoning-path-v1",
      assessedAt: metrics.exitTime,
      appealAvailable: true,
    },
    scoreSnapshot: {
      reasoning: plan.reasoningScore,
      reasoningModelVersion: plan.scoreModelVersion ?? "kwant-process-v1",
      postExecutionModelVersion: "kwant-path-v1",
      createdAt: metrics.exitTime,
    },
    pathMetrics: metrics,
  };
}

export function reasoningScoreFromReceipts(
  receipts: SocialObject[],
  userId: string,
) {
  const completed = receipts
    .filter((object) => object.objectType === "receipt" && object.userId === userId)
    .map((object) => object.payload as SocialReceiptPayload)
    .map((payload) => payload.pathMetrics?.outcomeScore ?? payload.scores?.final)
    .filter((score): score is number => Number.isFinite(score));
  return completed.length
    ? Math.round(completed.reduce((sum, score) => sum + score, 0) / completed.length)
    : null;
}

export function calculateReceiptClassification(
  reason: string,
  detail: string,
  confirmations: string,
  hasEvidence: boolean,
  noTrade = false,
): SocialReceiptPayload["classification"] {
  if (noTrade) return "DISCIPLINED NO TRIGGER";
  if (reason === "IMPULSIVE DEVIATION") return "UNJUSTIFIED DEVIATION";
  if (!detail.trim() && !confirmations.trim() && !hasEvidence) return "INSUFFICIENT EVIDENCE";
  if (reason && detail.trim() && (confirmations.trim() || hasEvidence)) return "JUSTIFIED ADAPTATION";
  return "PARTIALLY JUSTIFIED";
}

export function calculateReceiptScores(args: {
  classification: SocialReceiptPayload["classification"];
  confirmations: string;
  review: string;
  nextTimeRule: string;
  hasEvidence: boolean;
  noTrade: boolean;
}) {
  const classificationScore = {
    "DISCIPLINED NO TRIGGER": 92,
    "JUSTIFIED ADAPTATION": 88,
    "PARTIALLY JUSTIFIED": 72,
    "UNJUSTIFIED DEVIATION": 42,
    "INSUFFICIENT EVIDENCE": 50,
  }[args.classification];
  const confirmation = Math.min(96, 48 + (args.confirmations.trim() ? 32 : 0) + (args.noTrade ? 10 : 0));
  const discipline = Math.min(98, classificationScore + (args.noTrade ? 8 : 0));
  const execution = args.noTrade ? 90 : classificationScore;
  const review = Math.min(96, 45 + (args.review.trim() ? 28 : 0) + (args.nextTimeRule.trim() ? 18 : 0));
  const evidenceConfidence = Math.min(98, 36 + (args.hasEvidence ? 45 : 0) + (args.confirmations.trim() ? 12 : 0));
  const final = Math.round(
    confirmation * 0.2
    + discipline * 0.25
    + execution * 0.2
    + review * 0.2
    + evidenceConfidence * 0.15,
  );
  return { confirmation, discipline, execution, review, evidenceConfidence, final };
}

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not recorded";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function numericDelta(actual: number | null | undefined, planned: number | null | undefined) {
  if (actual === null || actual === undefined || planned === null || planned === undefined) return "Not comparable";
  const delta = actual - planned;
  return `${delta >= 0 ? "+" : ""}${delta.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function buildExecutionComparison(
  plan: SocialPrecordPayload,
  execution: Pick<
    SocialReceiptPayload,
    "actualDirection" | "actualEntry" | "actualStop" | "actualExit" | "size" | "maximumActualRisk" | "confirmationsAppeared" | "entryTime" | "noTrade"
  >,
): SocialExecutionComparison[] {
  if (execution.noTrade) {
    return [
      {
        dimension: "Entry",
        planned: plan.plannedEntryLow === plan.plannedEntryHigh
          ? compactNumber(plan.plannedEntryLow)
          : `${compactNumber(plan.plannedEntryLow)} – ${compactNumber(plan.plannedEntryHigh)}`,
        actual: "No trade",
        difference: "Confirmation did not create an execution",
        status: "NOT APPLICABLE",
      },
      {
        dimension: "Confirmation",
        planned: plan.confirmation || "Not recorded",
        actual: execution.confirmationsAppeared || "Not observed",
        difference: execution.confirmationsAppeared ? "Evidence recorded without execution" : "Required evidence absent",
        status: execution.confirmationsAppeared ? "PARTIAL" : "UNMET",
      },
      {
        dimension: "Timing",
        planned: plan.expiryAt ? `Valid until ${plan.expiryAt}` : plan.session,
        actual: "No execution",
        difference: "Session completed without a trigger",
        status: "VALID",
      },
    ];
  }

  const snapshotTrade = (
    plan.gameplanSnapshot
    && typeof plan.gameplanSnapshot.oneTrade === "object"
    && plan.gameplanSnapshot.oneTrade
  ) ? plan.gameplanSnapshot.oneTrade as {
      zone?: [number, number];
      longSide?: { stop?: number; targets?: number[] };
      shortSide?: { stop?: number; targets?: number[] };
    } : null;
  const snapshotSide = execution.actualDirection === "SHORT" ? snapshotTrade?.shortSide : snapshotTrade?.longSide;
  const entryLow = snapshotTrade?.zone?.[0] ?? plan.plannedEntryLow;
  const entryHigh = snapshotTrade?.zone?.[1] ?? plan.plannedEntryHigh ?? entryLow;
  const plannedStop = snapshotSide?.stop ?? plan.plannedStop;
  const plannedTarget = snapshotSide?.targets?.[0] ?? plan.plannedTarget;
  const actualEntry = execution.actualEntry;
  const entryMatched = actualEntry !== null
    && actualEntry !== undefined
    && entryLow !== null
    && entryHigh !== null
    && actualEntry >= Math.min(entryLow, entryHigh)
    && actualEntry <= Math.max(entryLow, entryHigh);
  const entryReference = entryLow !== null && entryHigh !== null ? (entryLow + entryHigh) / 2 : entryLow;
  const retrospective = Boolean(
    execution.entryTime
    && plan.lockedAt
    && Date.parse(execution.entryTime) < Date.parse(plan.lockedAt),
  );
  const stopMatched = execution.actualStop !== null
    && plannedStop !== null
    && plannedStop !== undefined
    && Math.abs(execution.actualStop - plannedStop) <= 0.01;
  const targetMatched = execution.actualExit !== null
    && plannedTarget !== null
    && plannedTarget !== undefined
    && Math.abs(execution.actualExit - plannedTarget) <= 0.01;
  const sizeMatched = execution.size !== null
    && plan.plannedSize !== null
    && execution.size <= plan.plannedSize;
  const riskExceeded = execution.maximumActualRisk !== null
    && execution.maximumActualRisk !== undefined
    && plan.maximumRisk !== null
    && execution.maximumActualRisk > plan.maximumRisk;
  const hasPlannedRisk = plan.plannedSize !== null || plan.maximumRisk !== null;
  const confirmationMet = Boolean(execution.confirmationsAppeared.trim());

  return [
    {
      dimension: "Entry",
      planned: entryLow === entryHigh ? compactNumber(entryLow) : `${compactNumber(entryLow)} – ${compactNumber(entryHigh)}`,
      actual: compactNumber(actualEntry),
      difference: numericDelta(actualEntry, entryReference),
      status: entryMatched ? "MATCHED" : "DEVIATED",
    },
    {
      dimension: "Stop",
      planned: compactNumber(plannedStop),
      actual: compactNumber(execution.actualStop),
      difference: numericDelta(execution.actualStop, plannedStop),
      status: plannedStop === null || plannedStop === undefined ? "NOT APPLICABLE" : stopMatched ? "MATCHED" : execution.actualStop === null ? "DEVIATED" : "ADAPTED",
    },
    {
      dimension: "Target / exit",
      planned: compactNumber(plannedTarget),
      actual: compactNumber(execution.actualExit),
      difference: numericDelta(execution.actualExit, plannedTarget),
      status: plannedTarget === null || plannedTarget === undefined ? "NOT APPLICABLE" : targetMatched ? "MATCHED" : execution.actualExit === null ? "DEVIATED" : "ADAPTED",
    },
    {
      dimension: "Size / risk",
      planned: `${compactNumber(plan.plannedSize)} size · ${compactNumber(plan.maximumRisk)} max risk`,
      actual: `${compactNumber(execution.size)} size · ${compactNumber(execution.maximumActualRisk)} max risk`,
      difference: !hasPlannedRisk ? "No size or risk ceiling existed in the source plan" : riskExceeded ? "Maximum planned risk exceeded" : "Within stated risk ceiling",
      status: !hasPlannedRisk ? "NOT APPLICABLE" : riskExceeded ? "RISKIER" : sizeMatched || plan.plannedSize === null ? "MATCHED" : "ADAPTED",
    },
    {
      dimension: "Confirmation",
      planned: plan.confirmation || "Not recorded",
      actual: execution.confirmationsAppeared || "Not recorded",
      difference: confirmationMet ? "Evidence supplied" : "Required evidence not supplied",
      status: confirmationMet ? "MET" : "UNMET",
    },
    {
      dimension: "Timing",
      planned: plan.expiryAt ? `Valid until ${plan.expiryAt}` : plan.session,
      actual: execution.entryTime || "Not recorded",
      difference: !execution.entryTime ? "Execution time is required for proof status" : retrospective ? "Execution predates the plan lock" : "Execution follows the plan lock",
      status: !execution.entryTime ? "NOT APPLICABLE" : retrospective ? "RETROSPECTIVE" : "VALID",
    },
  ];
}

export function profileScoreAverage(profile: SocialProfilePayload) {
  const values = Object.values(profile.scores);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
