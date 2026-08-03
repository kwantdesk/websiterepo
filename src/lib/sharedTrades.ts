import type { SocialTradeSnapshot } from "@/lib/socials";

export type SharedTradeMessage = {
  kind: "trade-share";
  version: 1;
  postId: string;
  ownerUserId: string;
  ownerHandle: string;
  ownerDisplayName: string;
  profilePath: string;
  trade: SocialTradeSnapshot;
};

function text(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function identifier(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, maximum)
    : "";
}

function finiteNumber(value: unknown, fallback: number | null = null) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateText(value: unknown) {
  const candidate = text(value, 48);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : "";
}

export function normalizeSharedTradeMessage(value: unknown): SharedTradeMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.kind !== "trade-share") return null;

  const rawTrade = source.trade;
  if (!rawTrade || typeof rawTrade !== "object" || Array.isArray(rawTrade)) return null;
  const tradeSource = rawTrade as Record<string, unknown>;
  const postId = identifier(source.postId, 180);
  const ownerUserId = identifier(source.ownerUserId, 100);
  const ownerHandle = text(source.ownerHandle, 24)
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const ownerDisplayName = text(source.ownerDisplayName, 60) || "Kwant Desk user";
  const openedAt = dateText(tradeSource.openedAt);
  const instrument = text(tradeSource.instrument, 32).toUpperCase();
  if (!postId || !ownerUserId || !ownerHandle || !openedAt || !instrument) return null;

  const side = tradeSource.side === "LONG" || tradeSource.side === "SHORT"
    ? tradeSource.side
    : "UNKNOWN";
  const trade: SocialTradeSnapshot = {
    journalTradeId: identifier(tradeSource.journalTradeId, 180) || `shared:${postId}`,
    instrument,
    side,
    entryPrice: finiteNumber(tradeSource.entryPrice),
    exitPrice: finiteNumber(tradeSource.exitPrice),
    openedAt,
    closedAt: dateText(tradeSource.closedAt) || null,
    netPnl: finiteNumber(tradeSource.netPnl, 0) ?? 0,
    initialRisk: finiteNumber(tradeSource.initialRisk),
    rMultiple: finiteNumber(tradeSource.rMultiple),
  };

  return {
    kind: "trade-share",
    version: 1,
    postId,
    ownerUserId,
    ownerHandle,
    ownerDisplayName,
    profilePath: `/socials/${encodeURIComponent(ownerHandle)}?post=${encodeURIComponent(postId)}`,
    trade,
  };
}

export function sharedTradeAttachment(value: SharedTradeMessage) {
  return value;
}
