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
  | "EXPIRED";

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
  };
  avatarUrl?: string;
  presenceStatus?: "online" | "dnd" | "away" | "sleeping" | "offline";
  presenceMessage?: string;
  lastSeenAt?: string;
  blockedUserIds?: string[];
  dismissedFriendRequests?: Record<string, string>;
  friendReadAt?: Record<string, string>;
};

export type SocialPrecordPayload = {
  instrument: string;
  session: string;
  direction: PrecordDirection;
  marketContext: string;
  plannedEntryLow: number | null;
  plannedEntryHigh: number | null;
  plannedStop: number | null;
  plannedTarget: number | null;
  plannedSize: number | null;
  maximumRisk: number | null;
  plannedRiskReward: number | null;
  bullCondition: string;
  bearCondition: string;
  confirmation: string;
  invalidation: string;
  expiryAt: string | null;
  lockedAt: string;
  reasoningScore: number;
  status: PrecordStatus;
  source: "SOCIALS" | "GAMEPLAN" | "CHARTS" | "GEXMAP" | "JOURNAL";
};

export type SocialReceiptPayload = {
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
};

export type SocialDeskPayload = {
  name: string;
  description: string;
  markets: string[];
  session: string;
  timezone: string;
  objective: string;
  privacy: "PRIVATE" | "REQUEST";
  capacity: number;
  weeklyMission: string;
};

export type SocialDeskMemberPayload = {
  role: "OWNER" | "STEWARD" | "MEMBER";
  status: SocialProcessStatus;
  joinedAt: string;
};

export type SocialCommentPayload = {
  kind: "QUESTION" | "REVIEW" | "COUNTERCASE" | "LESSON";
  body: string;
  helpful: boolean;
};

export type SocialReactionPayload = {
  kind: "USEFUL" | "CLEAR" | "EVIDENCE";
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
    requirement: "Publish one complete Precord.",
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
    },
  };
}

export function calculateReasoningScore(payload: Omit<SocialPrecordPayload, "reasoningScore" | "lockedAt" | "status">) {
  const checks = [
    Boolean(payload.instrument),
    Boolean(payload.session),
    Boolean(payload.marketContext.trim()),
    payload.plannedEntryLow !== null,
    payload.plannedStop !== null,
    payload.plannedTarget !== null,
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

export function profileScoreAverage(profile: SocialProfilePayload) {
  const values = Object.values(profile.scores);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
