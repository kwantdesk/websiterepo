export type DeskPrivacy = "PUBLIC" | "REQUEST" | "PRIVATE";
export type DeskRole = "owner" | "moderator" | "member";
export type DeskBadgeIcon = "crown" | "shield" | "star" | "spark" | "chart" | "mentor";
export type DeskRequestType = "request" | "invite";
export type DeskRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export type DeskChannelType = "text" | "voice";

export type DeskWorkspace = {
  deskId: string;
  ownerId: string;
  name: string;
  description: string;
  objective: string;
  weeklyMission: string;
  markets: string[];
  session: string;
  timezone: string;
  privacy: DeskPrivacy;
  capacity: number;
  allowMemberInvites: boolean;
  inactivityDays: number | null;
  avatarUrl: string;
  accentColor: string;
  rules: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeskMember = {
  deskId: string;
  userId: string;
  role: DeskRole;
  displayRole: string;
  badgeColor: string;
  badgeIcon: DeskBadgeIcon;
  responsibilities: string;
  importanceLevel: number;
  joinedAt: string;
  lastActiveAt: string;
};

export type DeskJoinRequest = {
  id: string;
  deskId: string;
  userId: string;
  requestType: DeskRequestType;
  requestedBy: string;
  status: DeskRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type DeskChannel = {
  id: string;
  deskId: string;
  name: string;
  description: string;
  channelType: DeskChannelType;
  position: number;
  isPrivate: boolean;
  readOnly: boolean;
  reactionOnly: boolean;
  showHistory: boolean;
  allowedUserIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DeskMessageAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

export type DeskMessage = {
  id: string;
  deskId: string;
  channelId: string;
  senderUserId: string;
  body: string;
  attachments: DeskMessageAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type DeskReaction = {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
};

export type DeskFocusLock = {
  deskId: string;
  lockedBy: string;
  lockedAt: string;
};

export type DeskMemberProfile = {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  processStatus: string;
  score: number;
  lastSeenAt: string | null;
  activityStreak: number;
  longestActivityStreak: number;
  lastActivityDate: string;
  presenceStatus: "online" | "dnd" | "away" | "sleeping" | "offline";
};

export type DeskNetworkPayload = {
  ready: boolean;
  viewerId: string | null;
  workspaces: DeskWorkspace[];
  members: DeskMember[];
  requests: DeskJoinRequest[];
  channels: DeskChannel[];
  messages: DeskMessage[];
  reactions: DeskReaction[];
  focusLocks: DeskFocusLock[];
  profiles: DeskMemberProfile[];
  memberRolesReady: boolean;
};

export type CreatedDeskPayload = {
  workspace: DeskWorkspace;
  member: DeskMember;
  channels: DeskChannel[];
};

export const DESK_CREATED_EVENT = "kwantdesk:desk-created";
export const DESK_NETWORK_CHANGED_EVENT = "kwantdesk:desk-network-changed";

export function normalizeDeskDeletionConfirmation(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export const EMPTY_DESK_NETWORK: DeskNetworkPayload = {
  ready: false,
  viewerId: null,
  workspaces: [],
  members: [],
  requests: [],
  channels: [],
  messages: [],
  reactions: [],
  focusLocks: [],
  profiles: [],
  memberRolesReady: false,
};
