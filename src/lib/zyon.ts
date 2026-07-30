export const ZYON_MODELS = {
  "haiku-4-5": {
    label: "Haiku 4.5",
    apiId: "claude-haiku-4-5",
    description: "Fastest · lowest usage",
    tier: "FAST",
  },
  "sonnet-5": {
    label: "Sonnet 5",
    apiId: "claude-sonnet-5",
    description: "Fast, capable market analysis",
    tier: "BALANCED",
  },
  "opus-5": {
    label: "Opus 5",
    apiId: "claude-opus-5",
    description: "Deep trading reasoning",
    tier: "DEEP",
  },
  "fable-5": {
    label: "Fable 5",
    apiId: "claude-fable-5",
    description: "Highest available capability",
    tier: "MAX",
  },
} as const;

export type ZyonModelKey = keyof typeof ZYON_MODELS;
export type ZyonMarketRoot = "NQ" | "ES";
export type ZyonGameplanDirection = "LONG" | "SHORT";
export type ZyonGameplanRiskUnit = "DOLLARS" | "POINTS" | "TICKS" | "PERCENT";
export const ZYON_FOLDER_TAG = "zyon:folder";
export const ZYON_CONVERSATION_TAG = "zyon:conversation";
export const ZYON_DAILY_ROOT_FOLDER_ID = "zyon-folder-daily-conversations";
export const ZYON_CUSTOM_FOLDER_LIMIT = 20;
export const ZYON_RETRO_ENTRY_WINDOW_MS = 5 * 60 * 1_000;

export type ZyonFolder = {
  id: string;
  name: string;
  parentId: string | null;
  kind: "system" | "daily" | "custom";
  sessionDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ZyonAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

export type ZyonMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  model?: ZyonModelKey;
  attachments?: ZyonAttachment[];
};

export type ZyonJournalEntry = {
  id: string;
  sessionDate: string;
  root: ZyonMarketRoot;
  title: string;
  summary: string;
  body: string;
  kind: "TRADE" | "SETUP" | "REVIEW" | "LESSON" | "NOTE";
  tags: string[];
  attachments: Array<{
    name: string;
    type: string;
    size: number;
    dataUrl?: string;
    storagePath?: string;
  }>;
  createdAt: string;
  cloudSaved?: boolean;
};

export type ZyonGameplanDraft = {
  id: string;
  sessionDate: string;
  root: ZyonMarketRoot;
  instrument: string;
  title: string;
  direction: ZyonGameplanDirection;
  session: string;
  entryTime: string;
  entryLow: number;
  entryHigh: number;
  stop: number;
  targets: number[];
  riskAmount: number | null;
  riskUnit: ZyonGameplanRiskUnit;
  size: number | null;
  reasoning: string;
  confluences: string[];
  confirmation: string;
  invalidation: string;
  expiryAt: string | null;
  createdAt: string;
  updatedAt: string;
  cloudSaved?: boolean;
};

export type ZyonGameplanRequiredField =
  | "instrument"
  | "direction"
  | "entryTime"
  | "entry"
  | "stop"
  | "targets"
  | "risk"
  | "reasoning"
  | "confirmation"
  | "invalidation";

export type ZyonGameplanEntryTimingStatus =
  | "VALID"
  | "MISSING"
  | "INVALID"
  | "TOO_OLD";

export function zyonGameplanEntryTimingStatus(
  entryTime: unknown,
  referenceTime: string | number | Date = Date.now(),
): ZyonGameplanEntryTimingStatus {
  if (typeof entryTime !== "string" || !entryTime.trim()) return "MISSING";
  const entryTimestamp = Date.parse(entryTime);
  const referenceTimestamp = referenceTime instanceof Date
    ? referenceTime.getTime()
    : typeof referenceTime === "number"
      ? referenceTime
      : Date.parse(referenceTime);
  if (!Number.isFinite(entryTimestamp) || !Number.isFinite(referenceTimestamp)) return "INVALID";
  return entryTimestamp < referenceTimestamp - ZYON_RETRO_ENTRY_WINDOW_MS
    ? "TOO_OLD"
    : "VALID";
}

export function zyonGameplanMissingFields(
  draft: Partial<ZyonGameplanDraft> | null | undefined,
): ZyonGameplanRequiredField[] {
  if (!draft) {
    return [
      "instrument",
      "direction",
      "entryTime",
      "entry",
      "stop",
      "targets",
      "risk",
      "reasoning",
      "confirmation",
      "invalidation",
    ];
  }
  const missing: ZyonGameplanRequiredField[] = [];
  if (!draft.instrument?.trim()) missing.push("instrument");
  if (draft.direction !== "LONG" && draft.direction !== "SHORT") missing.push("direction");
  if (
    typeof draft.entryTime !== "string"
    || !draft.entryTime.trim()
    || !Number.isFinite(Date.parse(draft.entryTime))
  ) missing.push("entryTime");
  if (!Number.isFinite(draft.entryLow) || !Number.isFinite(draft.entryHigh)) missing.push("entry");
  if (!Number.isFinite(draft.stop)) missing.push("stop");
  if (!draft.targets?.some(Number.isFinite)) missing.push("targets");
  if (
    !Number.isFinite(draft.riskAmount)
    || Number(draft.riskAmount) <= 0
    || !["DOLLARS", "POINTS", "TICKS", "PERCENT"].includes(String(draft.riskUnit))
  ) {
    missing.push("risk");
  }
  if (!draft.reasoning?.trim()) missing.push("reasoning");
  if (!draft.confirmation?.trim()) missing.push("confirmation");
  if (!draft.invalidation?.trim()) missing.push("invalidation");
  return missing;
}

export function zyonFolderIdTag(folderId: string) {
  return `zyon:folder-id:${folderId}`;
}

export function zyonParentFolderTag(folderId: string | null) {
  return `zyon:parent:${folderId ?? "root"}`;
}

export function zyonFolderKindTag(kind: ZyonFolder["kind"]) {
  return `zyon:folder-kind:${kind}`;
}

export function zyonConversationRoleTag(role: ZyonMessage["role"]) {
  return `zyon:role:${role}`;
}

export function zyonTagValue(tags: string[], prefix: string) {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) ?? null;
}

export function zyonEntryFolderId(entry: Pick<ZyonJournalEntry, "tags">) {
  return zyonTagValue(entry.tags, "zyon:folder-id:");
}

export function zyonConversationRole(entry: Pick<ZyonJournalEntry, "tags">) {
  const role = zyonTagValue(entry.tags, "zyon:role:");
  return role === "user" || role === "assistant" ? role : null;
}

export function isZyonModelKey(value: unknown): value is ZyonModelKey {
  return typeof value === "string" && value in ZYON_MODELS;
}

export function isZyonMarketRoot(value: unknown): value is ZyonMarketRoot {
  return value === "NQ" || value === "ES";
}

export function zyonId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
