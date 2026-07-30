export type SocialFollowListKind = "followers" | "following";

export type SocialFollowSummary = {
  configured: boolean;
  profileUserId: string;
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
  followsViewer: boolean;
  notificationsEnabled: boolean;
  canViewFollowers: boolean;
  canViewFollowing: boolean;
};

export type SocialFollowListItem = {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  viewerFollows: boolean;
  followsViewer: boolean;
  notificationsEnabled: boolean;
  followedAt: string;
};

export type SocialFollowResponse = {
  summary?: SocialFollowSummary;
  list?: {
    kind: SocialFollowListKind;
    items: SocialFollowListItem[];
    offset: number;
    nextOffset: number | null;
  };
  error?: string;
  code?: string;
};
