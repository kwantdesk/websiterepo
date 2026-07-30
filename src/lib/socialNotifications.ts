export type SocialNotificationKind =
  | "new_follower"
  | "followed_account_update";

export type SocialNotificationItem = {
  id: string;
  kind: SocialNotificationKind;
  sourceUserId: string;
  sourceObjectId: string;
  sourceDisplayName: string;
  sourceHandle: string;
  sourceAvatarUrl: string;
  objectType: string;
  readAt: string | null;
  createdAt: string;
};

export type SocialNotificationsResponse = {
  configured?: boolean;
  items?: SocialNotificationItem[];
  unreadCount?: number;
  offset?: number;
  nextOffset?: number | null;
  error?: string;
  code?: string;
};
