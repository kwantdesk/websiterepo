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
  isOnline: boolean;
  desks: FriendDesk[];
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string | null;
};

export type FriendRequestSummary = FriendSummary & {
  requestedAt: string;
};

export type FriendMessage = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  sentAt: string;
};

export type FriendsPayload = {
  cloud: boolean;
  viewer: FriendSummary | null;
  friends: FriendSummary[];
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
  directory: FriendSummary[];
  messages: FriendMessage[];
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
