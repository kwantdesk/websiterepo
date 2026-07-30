export const ZYON_MODELS = {
  "haiku-4-5": {
    label: "Haiku 4.5",
    apiId: "claude-3-5-haiku-20241022",
    description: "Fastest · lowest usage",
    tier: "FAST",
  },
  "sonnet-5": {
    label: "Sonnet 5",
    apiId: "claude-sonnet-4-20250514",
    description: "Fast, capable market analysis",
    tier: "BALANCED",
  },
  "opus-5": {
    label: "Opus 5",
    apiId: "claude-opus-4-20250514",
    description: "Deep trading reasoning",
    tier: "DEEP",
  },
  "fable-5": {
    label: "Fable 5",
    apiId: "claude-opus-4-20250514",
    description: "Highest available capability",
    tier: "MAX",
  },
} as const;

export type ZyonModelKey = keyof typeof ZYON_MODELS;
export type ZyonMarketRoot = "NQ" | "ES";
export type ZyonGameplanDirection = "LONG" | "SHORT";
export type ZyonGameplanRiskUnit = "DOLLARS" | "POINTS" | "TICKS" | "PERCENT";
export type ZyonTradingAccountMode = "LIVE" | "SIM" | "PROP";
export type ZyonTradingAccountPhase = "LIVE" | "SIMULATION" | "EVALUATION" | "FUNDED";
export type ZyonTradingAccountCurrency = "USD" | "AUD" | "GBP" | "EUR" | "CAD";
export type ZyonTradingAccount = {
  mode: ZyonTradingAccountMode;
  provider: string;
  program: string;
  phase: ZyonTradingAccountPhase;
  size: number | null;
  currency: ZyonTradingAccountCurrency;
};
export const ZYON_FOLDER_TAG = "zyon:folder";
export const ZYON_CONVERSATION_TAG = "zyon:conversation";
export const ZYON_CHAT_TAG = "zyon:chat";
export const ZYON_DEFAULT_CHAT_ID = "zyon-chat-primary";
export const ZYON_CHAT_LIMIT = 30;
export const ZYON_DAILY_ROOT_FOLDER_ID = "zyon-folder-daily-conversations";
export const ZYON_CUSTOM_FOLDER_LIMIT = 20;
export const ZYON_RETRO_ENTRY_WINDOW_MS = 5 * 60 * 1_000;

export type ZyonFolder = {
  id: string;
  chatId: string;
  name: string;
  parentId: string | null;
  kind: "system" | "daily" | "custom";
  sessionDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ZyonChat = {
  id: string;
  name: string;
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
  tradingAccount: ZyonTradingAccount | null;
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
  | "account"
  | "reasoning"
  | "confirmation"
  | "invalidation";

export type ZyonGameplanEntryTimingStatus =
  | "VALID"
  | "MISSING"
  | "INVALID"
  | "TOO_OLD";

const ZYON_TRADING_ACCOUNT_MODES = new Set<ZyonTradingAccountMode>(["LIVE", "SIM", "PROP"]);
const ZYON_TRADING_ACCOUNT_PHASES = new Set<ZyonTradingAccountPhase>(["LIVE", "SIMULATION", "EVALUATION", "FUNDED"]);
const ZYON_TRADING_ACCOUNT_CURRENCIES = new Set<ZyonTradingAccountCurrency>(["USD", "AUD", "GBP", "EUR", "CAD"]);

export function normalizeZyonTradingAccount(value: unknown): ZyonTradingAccount | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const account = value as Record<string, unknown>;
  const mode = String(account.mode ?? "").toUpperCase() as ZyonTradingAccountMode;
  const phase = String(account.phase ?? "").toUpperCase() as ZyonTradingAccountPhase;
  if (!ZYON_TRADING_ACCOUNT_MODES.has(mode) || !ZYON_TRADING_ACCOUNT_PHASES.has(phase)) return null;
  const size = typeof account.size === "number" ? account.size : Number(account.size);
  const currencyCandidate = String(account.currency ?? "USD").toUpperCase() as ZyonTradingAccountCurrency;
  return {
    mode,
    provider: typeof account.provider === "string"
      ? account.provider.replace(/\u0000/g, "").trim().slice(0, 80)
      : "",
    program: typeof account.program === "string"
      ? account.program.replace(/\u0000/g, "").trim().slice(0, 80)
      : "",
    phase,
    size: Number.isFinite(size) && size > 0 ? size : null,
    currency: ZYON_TRADING_ACCOUNT_CURRENCIES.has(currencyCandidate) ? currencyCandidate : "USD",
  };
}

function compactAccountSize(size: number, currency: ZyonTradingAccountCurrency) {
  const formatted = size >= 1_000 && size % 1_000 === 0
    ? `${size / 1_000}K`
    : size.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const symbol = currency === "USD"
    ? "$"
    : currency === "GBP"
      ? "£"
      : currency === "EUR"
        ? "€"
        : `${currency} `;
  return `${symbol}${formatted}`;
}

export function zyonTradingAccountLabel(value: unknown) {
  const account = normalizeZyonTradingAccount(value);
  if (!account || account.size === null) return "Account not set";
  const size = compactAccountSize(account.size, account.currency);
  if (account.mode === "LIVE") {
    return account.provider
      ? `${account.provider} · ${size} ${account.phase === "FUNDED" ? "Funded" : "Live"}`
      : `${account.phase === "FUNDED" ? "Funded" : "Live"} · ${size}`;
  }
  if (account.mode === "SIM") {
    return account.provider
      ? `${account.provider} · ${size} Simulation`
      : `Sim · ${size}`;
  }
  const provider = [account.provider, account.program].filter(Boolean).join(" ") || "Prop firm";
  const phase = account.phase === "EVALUATION" ? "Evaluation" : account.phase === "FUNDED" ? "Funded" : "Live";
  return `${provider} · ${size} ${phase}`;
}

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
      "account",
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
  const tradingAccount = normalizeZyonTradingAccount(draft.tradingAccount);
  const accountPhaseMatches = tradingAccount?.mode === "LIVE"
    ? tradingAccount.phase === "LIVE"
    : tradingAccount?.mode === "SIM"
      ? tradingAccount.phase === "SIMULATION"
      : tradingAccount?.mode === "PROP"
        ? tradingAccount.phase === "EVALUATION" || tradingAccount.phase === "FUNDED"
        : false;
  if (
    !tradingAccount
    || tradingAccount.size === null
    || !accountPhaseMatches
    || (tradingAccount.mode === "PROP" && !tradingAccount.provider)
  ) {
    missing.push("account");
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

export function zyonChatIdTag(chatId: string) {
  return `zyon:chat-id:${chatId}`;
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

export function zyonEntryChatId(entry: Pick<ZyonJournalEntry, "tags">) {
  return zyonTagValue(entry.tags, "zyon:chat-id:") ?? ZYON_DEFAULT_CHAT_ID;
}

export function zyonDailyRootFolderId(chatId: string) {
  return chatId === ZYON_DEFAULT_CHAT_ID
    ? ZYON_DAILY_ROOT_FOLDER_ID
    : `zyon-folder-daily-${chatId}`;
}

export function zyonDailyFolderId(chatId: string, sessionDate: string) {
  return chatId === ZYON_DEFAULT_CHAT_ID
    ? `zyon-folder-day-${sessionDate}`
    : `zyon-folder-day-${chatId}-${sessionDate}`;
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
