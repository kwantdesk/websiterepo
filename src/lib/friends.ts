export type PresenceStatus = "online" | "dnd" | "away" | "sleeping" | "offline";

export type FriendDesk = {
  id: string;
  name: string;
};

export type FriendSummary = {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  presenceStatus: PresenceStatus;
  presenceMessage: string;
  lastSeenAt: string | null;
  timeZone: string;
  activityStreak: number;
  longestActivityStreak: number;
  lastActivityDate: string;
  isOnline: boolean;
  desks: FriendDesk[];
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string | null;
};

export type FriendRequestSummary = FriendSummary & {
  requestedAt: string;
};

export type FriendMessageAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

export type FriendMessage = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  sentAt: string;
  groupId?: string;
  attachments?: FriendMessageAttachment[];
};

export type FriendGroupMember = FriendSummary & {
  role: "owner" | "member";
};

export type FriendGroupSummary = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  isOwner: boolean;
  allowMemberInvites: boolean;
  muted: boolean;
  members: FriendGroupMember[];
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string | null;
};

export type FriendsPayload = {
  cloud: boolean;
  groupsReady: boolean;
  viewer: FriendSummary | null;
  friends: FriendSummary[];
  groups: FriendGroupSummary[];
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
  blocked: FriendSummary[];
  directory: FriendSummary[];
  messages: FriendMessage[];
  groupMessages: FriendMessage[];
};

export const PRESENCE_OPTIONS: {
  value: PresenceStatus;
  label: string;
  helper: string;
  dotClassName: string;
}[] = [
  {
    value: "online",
    label: "Online",
    helper: "Available to chat",
    dotClassName: "bg-emerald-400",
  },
  {
    value: "dnd",
    label: "Do not disturb",
    helper: "Mute friend notifications",
    dotClassName: "bg-rose-500",
  },
  {
    value: "away",
    label: "Away",
    helper: "Temporarily away",
    dotClassName: "bg-amber-400",
  },
  {
    value: "sleeping",
    label: "Sleeping",
    helper: "Offline for the session",
    dotClassName: "bg-indigo-400",
  },
  {
    value: "offline",
    label: "Invisible",
    helper: "Appear offline",
    dotClassName: "bg-zinc-500",
  },
];

export function normalizePresenceStatus(value: unknown): PresenceStatus {
  return value === "dnd" || value === "away" || value === "sleeping" || value === "offline"
    ? value
    : "online";
}

export function presenceOption(status: PresenceStatus) {
  return PRESENCE_OPTIONS.find((option) => option.value === status) ?? PRESENCE_OPTIONS[0];
}

export function effectivePresenceStatus(
  status: PresenceStatus | null | undefined,
  lastSeenAt?: string | null,
  now = Date.now(),
): PresenceStatus {
  const normalized = normalizePresenceStatus(status);
  if (normalized !== "online") return normalized;
  const lastSeen = lastSeenAt ? Date.parse(lastSeenAt) : 0;
  return lastSeen > 0 && now - lastSeen < 150_000 ? "online" : "offline";
}
