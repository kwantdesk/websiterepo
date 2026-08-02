"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Bookmark,
  Briefcase,
  CalendarDays,
  Check,
  ExternalLink,
  Grid3X3,
  Heart,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Repeat2,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  CALLING_CARD_CATALOG,
  type SocialCardPayload,
  type SocialObject,
  type SocialPrecordPayload,
  type SocialPostPayload,
  type SocialProfilePayload,
} from "@/lib/socials";
import type {
  SocialFollowListItem,
  SocialFollowListKind,
  SocialFollowResponse,
  SocialFollowSummary,
} from "@/lib/socialFollows";
import ReasoningOutcomeChart from "@/components/socials/ReasoningOutcomeChart";
import ActivityStreakBadge from "@/components/socials/ActivityStreakBadge";
import CallingCardVisual from "@/components/socials/CallingCardVisual";
import UserAvatar from "@/components/socials/UserAvatar";
import { effectivePresenceStatus, presenceOption, type FriendsPayload } from "@/lib/friends";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

const SOCIAL_FOLLOW_CHANGED_EVENT = "kwantdesk:social-follow-changed";
const SOCIAL_FOLLOW_BROADCAST_CHANNEL = "kwantdesk-social-follows";

function announceFollowChange(targetUserId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SOCIAL_FOLLOW_CHANGED_EVENT, {
    detail: { targetUserId },
  }));
  if (!("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel(SOCIAL_FOLLOW_BROADCAST_CHANNEL);
  channel.postMessage({ type: "follow-changed", targetUserId });
  channel.close();
}

type SocialProfileViewProps = {
  profileObject: SocialObject;
  profile: SocialProfilePayload;
  gameplans: SocialObject[];
  receipts: SocialObject[];
  cards: SocialObject[];
  comments: SocialObject[];
  collections: {
    posts: SocialObject[];
    liked: SocialObject[];
    reposts: SocialObject[];
    saved: SocialObject[];
  };
  reasoningScore: number | null;
  isOwnProfile: boolean;
  savedIds: Set<string>;
  repostedIds: Set<string>;
  onBack?: () => void;
  backLabel?: string;
  onEdit: () => void;
  onMessage: () => void;
  onOpenGameplan: (record: SocialObject) => void;
  onSave: (record: SocialObject) => void;
  onRepost: (record: SocialObject) => void;
  onShareGameplan: (record: SocialObject) => void;
  onShareProfile: () => void;
  onOpenProfile?: (handle: string) => void;
  onCollectionVisibilityChange: (key: "likes" | "reposts" | "saves", visibility: "private" | "community") => void;
};

type ProfileCollectionTab = "gameplans" | "posts" | "liked" | "reposts" | "saved";

function payloadOf<T>(object: SocialObject | undefined) {
  return (object?.payload ?? null) as T | null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatActiveSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(date);
}

function zoneLabel(payload: SocialPrecordPayload) {
  if (payload.plannedEntryLow === null && payload.plannedEntryHigh === null) return "Decision map";
  const low = payload.plannedEntryLow?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—";
  const high = payload.plannedEntryHigh?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? low;
  return low === high ? low : `${low}–${high}`;
}

export default function SocialProfileView({
  profileObject,
  profile,
  gameplans,
  receipts,
  cards,
  comments,
  collections,
  reasoningScore,
  isOwnProfile,
  savedIds,
  repostedIds,
  onBack,
  backLabel = "Back to Socials",
  onEdit,
  onMessage,
  onOpenGameplan,
  onSave,
  onRepost,
  onShareGameplan,
  onShareProfile,
  onOpenProfile,
  onCollectionVisibilityChange,
}: SocialProfileViewProps) {
  const [profileCollectionTab, setProfileCollectionTab] = useState<ProfileCollectionTab>("gameplans");
  const [followSummary, setFollowSummary] = useState<SocialFollowSummary | null>(null);
  const [followLoading, setFollowLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState("");
  const [openFollowList, setOpenFollowList] = useState<SocialFollowListKind | null>(null);
  const [followList, setFollowList] = useState<SocialFollowListItem[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListError, setFollowListError] = useState("");
  const [followListNextOffset, setFollowListNextOffset] = useState<number | null>(null);
  const [friendState, setFriendState] = useState<"loading" | "friend" | "incoming" | "outgoing" | "none" | "unavailable">("loading");
  const [friendBusy, setFriendBusy] = useState(false);
  const followListRequestRef = useRef(0);

  const loadFriendState = useCallback(async (signal?: AbortSignal) => {
    if (isOwnProfile) return;
    try {
      const response = await fetch("/api/friends", { cache: "no-store", signal });
      const result = await response.json() as FriendsPayload & { error?: string };
      if (!response.ok) throw new Error(result.error || "Friends could not be loaded.");
      if (result.friends.some((item) => item.userId === profileObject.userId)) setFriendState("friend");
      else if (result.incoming.some((item) => item.userId === profileObject.userId)) setFriendState("incoming");
      else if (result.outgoing.some((item) => item.userId === profileObject.userId)) setFriendState("outgoing");
      else setFriendState("none");
    } catch {
      if (!signal?.aborted) setFriendState("unavailable");
    }
  }, [isOwnProfile, profileObject.userId]);

  useEffect(() => {
    if (isOwnProfile) return;
    const controller = new AbortController();
    setFriendState("loading");
    void loadFriendState(controller.signal);
    return () => controller.abort();
  }, [isOwnProfile, loadFriendState]);

  const updateFriend = async () => {
    if (friendBusy || isOwnProfile || friendState === "friend" || friendState === "outgoing") return;
    setFriendBusy(true);
    const previous = friendState;
    setFriendState(friendState === "incoming" ? "friend" : "outgoing");
    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: previous === "incoming" ? "accept" : "request",
          targetUserId: profileObject.userId,
        }),
      });
      const result = await response.json() as FriendsPayload & { error?: string };
      if (!response.ok) throw new Error(result.error || "The friend request could not be saved.");
      await loadFriendState();
    } catch {
      setFriendState(previous);
    } finally {
      setFriendBusy(false);
    }
  };

  const loadFollowSummary = useCallback(async (signal?: AbortSignal) => {
    setFollowLoading(true);
    setFollowError("");
    try {
      const response = await fetch(
        `/api/socials/follows?profileUserId=${encodeURIComponent(profileObject.userId)}`,
        { cache: "no-store", signal },
      );
      const result = await response.json() as SocialFollowResponse;
      if (!response.ok || !result.summary) {
        throw new Error(result.error || "Follow information could not be loaded.");
      }
      setFollowSummary(result.summary);
    } catch (error) {
      if (signal?.aborted) return;
      setFollowError(error instanceof Error ? error.message : "Follow information could not be loaded.");
    } finally {
      if (!signal?.aborted) setFollowLoading(false);
    }
  }, [profileObject.userId]);

  useEffect(() => {
    const controller = new AbortController();
    setOpenFollowList(null);
    setFollowList([]);
    void loadFollowSummary(controller.signal);
    return () => controller.abort();
  }, [loadFollowSummary]);

  useEffect(() => {
    if (isOwnProfile) return;
    const controller = new AbortController();
    void fetch("/api/socials/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "profile_view", targetUserId: profileObject.userId }),
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [isOwnProfile, profileObject.userId]);

  const updateFollow = async (
    action: "follow" | "unfollow" | "notifications",
    enabled?: boolean,
  ) => {
    if (followBusy || isOwnProfile) return;
    const previous = followSummary;
    setFollowBusy(true);
    setFollowError("");
    if (previous) {
      setFollowSummary({
        ...previous,
        viewerFollows: action === "follow"
          ? true
          : action === "unfollow"
            ? false
            : previous.viewerFollows,
        followerCount: action === "follow" && !previous.viewerFollows
          ? previous.followerCount + 1
          : action === "unfollow" && previous.viewerFollows
            ? Math.max(0, previous.followerCount - 1)
            : previous.followerCount,
        notificationsEnabled: action === "notifications"
          ? Boolean(enabled)
          : action === "unfollow"
            ? false
            : previous.notificationsEnabled,
      });
    }
    try {
      const response = await fetch("/api/socials/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetUserId: profileObject.userId,
          enabled,
        }),
      });
      const result = await response.json() as SocialFollowResponse;
      if (!response.ok || !result.summary) {
        throw new Error(result.error || "The follow setting could not be saved.");
      }
      setFollowSummary(result.summary);
      announceFollowChange(profileObject.userId);
    } catch (error) {
      setFollowSummary(previous);
      setFollowError(error instanceof Error ? error.message : "The follow setting could not be saved.");
    } finally {
      setFollowBusy(false);
    }
  };

  const loadFollowList = useCallback(async (kind: SocialFollowListKind, offset = 0) => {
    const requestId = ++followListRequestRef.current;
    setFollowListLoading(true);
    setFollowListError("");
    try {
      const response = await fetch(
        `/api/socials/follows?profileUserId=${encodeURIComponent(profileObject.userId)}&list=${kind}&offset=${offset}&limit=50`,
        { cache: "no-store" },
      );
      const result = await response.json() as SocialFollowResponse;
      if (!response.ok || !result.summary || !result.list) {
        throw new Error(result.error || "The account list could not be loaded.");
      }
      if (requestId !== followListRequestRef.current) return;
      setFollowSummary(result.summary);
      setFollowList((current) => offset === 0 ? result.list!.items : [...current, ...result.list!.items]);
      setFollowListNextOffset(result.list.nextOffset);
    } catch (error) {
      if (requestId !== followListRequestRef.current) return;
      setFollowListError(error instanceof Error ? error.message : "The account list could not be loaded.");
    } finally {
      if (requestId === followListRequestRef.current) setFollowListLoading(false);
    }
  }, [profileObject.userId]);

  const showFollowList = (kind: SocialFollowListKind) => {
    setOpenFollowList(kind);
    setFollowList([]);
    setFollowListNextOffset(null);
    void loadFollowList(kind, 0);
  };

  useEffect(() => {
    let disposed = false;
    let refreshTimer: number | null = null;
    let broadcastChannel: BroadcastChannel | null = null;
    let realtimeChannel: ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]> | null = null;

    const refresh = () => {
      if (disposed || refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (disposed) return;
        void loadFollowSummary();
        if (openFollowList) void loadFollowList(openFollowList, 0);
      }, 100);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener(SOCIAL_FOLLOW_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);

    if ("BroadcastChannel" in window) {
      broadcastChannel = new BroadcastChannel(SOCIAL_FOLLOW_BROADCAST_CHANNEL);
      broadcastChannel.addEventListener("message", refresh);
    }

    try {
      const supabase = createSupabaseBrowserClient();
      realtimeChannel = supabase
        .channel(`profile-follows:${profileObject.userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "social_profile_follows" },
          (payload) => {
            const next = payload.new as Record<string, unknown>;
            const previous = payload.old as Record<string, unknown>;
            const followerId = String(next.follower_id ?? previous.follower_id ?? "");
            const followingId = String(next.following_id ?? previous.following_id ?? "");
            if (followerId === profileObject.userId || followingId === profileObject.userId) refresh();
          },
        )
        .subscribe();
    } catch {
      // Focus, visibility and cross-tab events remain as the no-realtime fallback.
    }

    return () => {
      disposed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener(SOCIAL_FOLLOW_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      broadcastChannel?.removeEventListener("message", refresh);
      broadcastChannel?.close();
      if (realtimeChannel) void realtimeChannel.unsubscribe();
    };
  }, [loadFollowList, loadFollowSummary, openFollowList, profileObject.userId]);

  const earnedCards = cards
    .filter((card) => card.userId === profileObject.userId)
    .map((card) => payloadOf<SocialCardPayload>(card))
    .filter((card): card is SocialCardPayload => Boolean(card));
  const selectedCard = earnedCards.find((card) => card.code === profile.callingCardCode && card.public !== false)
    ?? earnedCards.find((card) => card.equipped && card.public !== false)
    ?? earnedCards.find((card) => card.public !== false);
  const cardDefinition = CALLING_CARD_CATALOG.find((definition) => definition.code === (profile.callingCardCode || selectedCard?.code))
    ?? CALLING_CARD_CATALOG.find((definition) => definition.starter)
    ?? CALLING_CARD_CATALOG[0];
  const receivedComments = comments.filter((comment) => gameplans.some((record) => record.id === comment.parentId)).length;
  const links = [
    ...(profile.websiteUrl ? [{ label: "Website", url: profile.websiteUrl }] : []),
    ...(profile.profileLinks ?? []),
  ].slice(0, 5);
  const scoreTone = reasoningScore === null
    ? "var(--warning)"
    : reasoningScore < 25
      ? "var(--danger)"
      : reasoningScore < 65
        ? "var(--warning)"
        : "var(--accent)";
  const selectedCollection = profileCollectionTab === "gameplans" ? gameplans : collections[profileCollectionTab];
  const selectedPrivacyKey = profileCollectionTab === "liked"
    ? "likes"
    : profileCollectionTab === "reposts"
      ? "reposts"
      : profileCollectionTab === "saved" ? "saves" : null;
  const selectedCollectionIsPrivate = selectedPrivacyKey ? profile.visibility[selectedPrivacyKey] === "private" : false;
  const canSeeSelectedCollection = isOwnProfile || !selectedCollectionIsPrivate;

  return (
    <div className="mx-auto w-full max-w-6xl p-3 sm:p-4">
      {onBack ? (
        <button type="button" onClick={onBack} className="mb-3 flex h-8 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[8px] font-semibold text-muted hover:text-foreground">
          ← {backLabel}
        </button>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-border bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="relative h-40 overflow-hidden border-b border-border sm:h-48">
          <CallingCardVisual definition={cardDefinition} ownerName={profile.displayName} earnedLabel={selectedCard ? `EARNED ${formatDate(selectedCard.earnedAt).toUpperCase()}` : "FOUNDING ISSUE"} banner />
        </div>

        <div className="relative px-4 pb-5 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <UserAvatar
              label={profile.displayName}
              avatarUrl={profile.avatarUrl}
              size="xl"
              statusClassName={presenceOption(effectivePresenceStatus(profile.presenceStatus, profile.lastSeenAt)).dotClassName}
              statusPositionClassName="!-bottom-1.5 !-right-1.5"
              className="-mt-12 rounded-full border-[5px] border-panel shadow-2xl"
            />

            <div className="min-w-0 flex-1 pb-1 sm:pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.03em] text-foreground">{profile.displayName}</h1>
                <span className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary"><ShieldCheck className="h-3 w-3" />On record</span>
                <ActivityStreakBadge streak={profile.activityStreak} />
              </div>
              <div className="mt-1 text-[10px] text-primary">@{profile.handle}</div>
              <div className="mt-2 flex items-center gap-4 text-[8px]">
                <button
                  type="button"
                  onClick={() => showFollowList("followers")}
                  disabled={followLoading}
                  className="text-muted transition-colors hover:text-foreground disabled:cursor-wait"
                >
                  <span className="font-mono text-[10px] font-semibold text-foreground">{followSummary?.followerCount ?? "—"}</span>{" "}
                  followers
                </button>
                <button
                  type="button"
                  onClick={() => showFollowList("following")}
                  disabled={followLoading}
                  className="text-muted transition-colors hover:text-foreground disabled:cursor-wait"
                >
                  <span className="font-mono text-[10px] font-semibold text-foreground">{followSummary?.followingCount ?? "—"}</span>{" "}
                  following
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pb-1 sm:pt-5">
              {isOwnProfile ? (
                <button type="button" onClick={onEdit} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background"><Pencil className="h-3.5 w-3.5" />Edit profile</button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void updateFollow(followSummary?.viewerFollows ? "unfollow" : "follow")}
                    disabled={followBusy || followLoading || !followSummary}
                    className={`flex h-9 items-center gap-2 rounded-xl px-4 text-[9px] font-semibold disabled:cursor-wait disabled:opacity-50 ${
                      followSummary?.viewerFollows
                        ? "border border-primary/25 bg-primary/10 text-primary"
                        : "bg-primary text-background"
                    }`}
                  >
                    {followBusy ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : followSummary?.viewerFollows ? (
                      <UserCheck className="h-3.5 w-3.5" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    {followSummary?.viewerFollows
                      ? "Following"
                      : followSummary?.followsViewer
                        ? "Follow back"
                        : "Follow"}
                  </button>
                  {followSummary?.viewerFollows ? (
                    <button
                      type="button"
                      onClick={() => void updateFollow("notifications", !followSummary.notificationsEnabled)}
                      disabled={followBusy}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors disabled:cursor-wait disabled:opacity-50 ${
                        followSummary.notificationsEnabled
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-border bg-surface text-muted hover:text-foreground"
                      }`}
                      title={followSummary.notificationsEnabled ? "Turn off profile notifications" : "Turn on profile notifications"}
                      aria-label={followSummary.notificationsEnabled ? "Turn off profile notifications" : "Turn on profile notifications"}
                    >
                      {followSummary.notificationsEnabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void updateFriend()} disabled={friendBusy || friendState === "loading" || friendState === "outgoing" || friendState === "friend" || friendState === "unavailable"} className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[9px] font-semibold disabled:cursor-default ${friendState === "friend" ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground disabled:opacity-60"}`}><UsersRound className="h-3.5 w-3.5" />{friendBusy ? "Saving…" : friendState === "friend" ? "Friends" : friendState === "incoming" ? "Accept friend" : friendState === "outgoing" ? "Request sent" : "Add friend"}</button>
                  {friendState === "friend" ? <button type="button" onClick={onMessage} className="flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-[9px] font-semibold text-muted hover:text-foreground"><Send className="h-3.5 w-3.5" />Message</button> : null}
                </>
              )}
              <button type="button" onClick={onShareProfile} className="flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-[9px] font-semibold text-muted hover:text-foreground"><Share2 className="h-3.5 w-3.5" />Share profile</button>
            </div>
          </div>
          {followError ? <div className="mt-3 text-[7px] text-danger">{followError}</div> : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <p className="max-w-2xl text-[10px] leading-5 text-muted">{profile.bio || `${profile.session} · ${profile.style}`}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[8px] text-muted">
                {profile.location ? <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />Lives in {profile.location}</span> : null}
                {profile.occupation ? <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-primary" />{profile.occupation}</span> : null}
                <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" />Active since {formatActiveSince(profile.activeSince || profileObject.createdAt)}</span>
              </div>
              {profile.interests ? <p className="mt-2 max-w-2xl text-[8px] leading-4 text-muted"><span className="font-semibold text-foreground">Interests:</span> {profile.interests}</p> : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.markets.map((market) => <span key={market} className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary">{market}</span>)}
                <span className="rounded-lg border border-border bg-surface px-2 py-1 text-[7px] text-muted">{profile.session}</span>
                <span className="rounded-lg border border-border bg-surface px-2 py-1 text-[7px] text-muted">{profile.timezone}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                {profile.showContactEmail && profile.contactEmail ? <a href={`mailto:${profile.contactEmail}`} className="flex items-center gap-1.5 text-[8px] text-muted hover:text-primary"><Mail className="h-3.5 w-3.5" />{profile.contactEmail}</a> : null}
                {links.map((link) => <a key={`${link.label}:${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[8px] text-muted hover:text-primary"><Link2 className="h-3.5 w-3.5" />{link.label}<ExternalLink className="h-3 w-3" /></a>)}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-background/35">
              <div className="p-3 text-center"><div className="font-mono text-[18px] font-semibold text-foreground">{gameplans.length}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Gameplans</div></div>
              <div className="p-3 text-center"><div className="font-mono text-[18px] font-semibold text-foreground">{receivedComments}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Reviews</div></div>
              <div className="p-3 text-center"><div className="font-mono text-[18px] font-semibold" style={{ color: scoreTone }}>{reasoningScore === null ? "—" : `${reasoningScore}%`}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Reasoning</div></div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-background/35 p-3">
            <div className="flex items-center justify-between text-[8px]"><span className="font-semibold uppercase tracking-[0.13em] text-muted">Reasoning score</span><span className="font-mono font-semibold" style={{ color: scoreTone }}>{reasoningScore === null ? "Waiting for a completed Gameplan" : `${reasoningScore}%`}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${reasoningScore === null ? 42 : Math.max(3, reasoningScore)}%`, background: scoreTone, boxShadow: `0 0 18px ${scoreTone}` }} /></div>
          </div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-panel">
        <div className="grid grid-cols-3 gap-1 border-b border-border bg-background/20 p-2 sm:grid-cols-5">
          {([
            ["gameplans", "Gameplans", Grid3X3],
            ["posts", "Posts", MessageCircle],
            ["liked", "Liked", Heart],
            ["reposts", "Reposts", Repeat2],
            ["saved", "Saved", Bookmark],
          ] as Array<[ProfileCollectionTab, string, typeof Grid3X3]>).map(([tab, label, Icon]) => (
            <button key={tab} type="button" onClick={() => setProfileCollectionTab(tab)} className={`flex h-10 items-center justify-center gap-2 rounded-xl px-2 text-[8px] font-semibold transition-colors ${profileCollectionTab === tab ? "bg-primary/12 text-primary shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_12%,transparent)]" : "text-muted hover:bg-surface hover:text-foreground"}`}>
              <Icon className={`h-3.5 w-3.5 ${tab === "liked" && profileCollectionTab === tab ? "fill-current" : ""}`} />{label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[11px] font-semibold capitalize text-foreground">{profileCollectionTab === "gameplans" ? "Gameplan record" : profileCollectionTab}</h2>
            <p className="mt-0.5 text-[7px] text-muted">{profileCollectionTab === "gameplans" ? "Only timestamped Gameplans appear on the profile grid." : selectedCollectionIsPrivate ? "This collection is visible only to its owner." : `@${profile.handle}'s ${profileCollectionTab} collection.`}</p>
          </div>
          {isOwnProfile && selectedPrivacyKey ? (
            <button type="button" onClick={() => onCollectionVisibilityChange(selectedPrivacyKey, selectedCollectionIsPrivate ? "community" : "private")} className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-[7px] font-semibold ${selectedCollectionIsPrivate ? "border-border bg-surface text-muted" : "border-primary/25 bg-primary/10 text-primary"}`}>
              {selectedCollectionIsPrivate ? <LockKeyhole className="h-3 w-3" /> : <UsersRound className="h-3 w-3" />}{selectedCollectionIsPrivate ? "Only me" : "Public"}
            </button>
          ) : null}
          <span className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[7px] text-muted">{canSeeSelectedCollection ? selectedCollection.length : 0}</span>
        </div>

        {profileCollectionTab === "gameplans" ? (gameplans.length ? (
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {gameplans.map((record) => {
              const payload = payloadOf<SocialPrecordPayload>(record);
              if (!payload) return null;
              const commentCount = comments.filter((comment) => comment.parentId === record.id).length;
              const complete = receipts.some((receipt) => receipt.parentId === record.id);
              const saved = savedIds.has(record.id);
              const reposted = repostedIds.has(record.id);
              return (
                <article key={`${record.userId}:${record.id}`} className={`group relative flex min-h-[255px] flex-col overflow-hidden bg-panel p-4 ${complete ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_18%,transparent)]" : "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--warning)_22%,transparent)]"}`}>
                  <button type="button" onClick={() => onOpenGameplan(record)} className="absolute inset-0 z-0 text-left" aria-label={`Open ${payload.instrument} Gameplan`} />
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_48%)]" />
                  <div className="relative z-10 flex items-start justify-between pointer-events-none">
                    <span className="rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[9px] font-semibold text-primary">{payload.instrument}</span>
                    <div className="text-right">
                      <span className={`block rounded-md border px-1.5 py-0.5 text-[6px] font-semibold uppercase tracking-[0.1em] ${complete ? "border-accent/25 bg-accent/[0.08] text-accent" : "border-warning/25 bg-warning/[0.08] text-warning"}`}>{complete ? "Complete" : "Live ranking"}</span>
                      <span className="mt-1 block text-[7px] text-muted">{formatDate(record.createdAt)}</span>
                    </div>
                  </div>
                  <div className="relative z-10 mt-9 pointer-events-none">
                    <div className="text-[7px] font-semibold uppercase tracking-[0.16em] text-muted">{payload.session} · {payload.direction}</div>
                    <div className="mt-2 font-mono text-[24px] font-semibold tracking-[-0.04em] text-foreground">{zoneLabel(payload)}</div>
                    <p className="mt-3 line-clamp-3 text-[9px] leading-5 text-muted">{payload.marketContext}</p>
                  </div>
                  <div className="relative z-10 mt-3">
                    <ReasoningOutcomeChart
                      instrument={payload.instrument}
                      lockedAt={payload.lockedAt}
                      entryLow={payload.plannedEntryLow}
                      entryHigh={payload.plannedEntryHigh}
                      stop={payload.plannedStop}
                      targets={payload.plannedTargets?.length ? payload.plannedTargets : payload.plannedTarget === null ? [] : [payload.plannedTarget]}
                      height={105}
                    />
                  </div>
                  <div className="relative z-20 mt-auto flex items-center gap-1 border-t border-border/70 pt-3">
                    <button type="button" onClick={() => onOpenGameplan(record)} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] text-muted hover:bg-surface hover:text-foreground"><MessageCircle className="h-3.5 w-3.5" />{commentCount}</button>
                    <button type="button" onClick={() => onRepost(record)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] hover:bg-surface ${reposted ? "text-primary" : "text-muted hover:text-foreground"}`}><Repeat2 className="h-3.5 w-3.5" />{reposted ? <Check className="h-3 w-3" /> : "Repost"}</button>
                    <button type="button" onClick={() => onSave(record)} className={`ml-auto flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface ${saved ? "text-primary" : "text-muted hover:text-foreground"}`} title={saved ? "Saved" : "Save Gameplan"}><Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} /></button>
                    <button type="button" onClick={() => onShareGameplan(record)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground" title="Share Gameplan"><Share2 className="h-3.5 w-3.5" /></button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <Grid3X3 className="h-7 w-7 text-muted" />
            <div className="mt-3 text-[10px] font-semibold text-foreground">No public Gameplans yet</div>
            <p className="mt-2 max-w-sm text-[8px] leading-4 text-muted">When this trader places a Gameplan on the Social record, it will appear here automatically.</p>
          </div>
        )) : !canSeeSelectedCollection ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <LockKeyhole className="h-7 w-7 text-muted" />
            <div className="mt-3 text-[10px] font-semibold text-foreground">This collection is private</div>
            <p className="mt-2 max-w-sm text-[8px] leading-4 text-muted">@{profile.handle} has chosen to keep {profileCollectionTab} visible only to themselves.</p>
          </div>
        ) : selectedCollection.length ? (
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {selectedCollection.map((object) => {
              const post = object.objectType === "post" ? payloadOf<SocialPostPayload>(object) : null;
              const plan = object.objectType === "precord" ? payloadOf<SocialPrecordPayload>(object) : null;
              const isOneLiner = post?.kind === "ONE-LINER";
              return (
                <article key={`${object.userId}:${object.id}`} className="group relative flex min-h-[190px] flex-col overflow-hidden bg-panel p-4">
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-[radial-gradient(circle_at_85%_0%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_52%)]" />
                  <div className="relative flex items-center gap-2">
                    <UserAvatar label={object.authorLabel} size="sm" />
                    <div className="min-w-0 flex-1"><div className="truncate text-[8px] font-semibold text-foreground">{object.authorLabel}</div><div className="mt-0.5 text-[7px] text-muted">{formatDate(object.createdAt)}</div></div>
                    {post?.isRepost ? <Repeat2 className="h-3.5 w-3.5 text-primary" /> : null}
                  </div>
                  {plan ? (
                    <button type="button" onClick={() => onOpenGameplan(object)} className="relative mt-5 flex flex-1 flex-col text-left">
                      <span className="w-fit rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[8px] font-semibold text-primary">{plan.instrument}</span>
                      <div className="mt-3 text-[10px] font-semibold text-foreground">{plan.direction} · {plan.session}</div>
                      <p className="mt-2 line-clamp-3 text-[8px] leading-4 text-muted">{plan.marketContext}</p>
                    </button>
                  ) : (
                    <div className={`relative mt-5 flex flex-1 flex-col ${isOneLiner ? "justify-center rounded-2xl border border-primary/20 bg-primary/[0.04] p-4" : ""}`}>
                      {!isOneLiner && post?.title ? <div className="text-[10px] font-semibold text-foreground">{post.title}</div> : null}
                      <p className={`${isOneLiner ? "text-[13px] font-medium leading-6 text-foreground" : "mt-2 text-[8px] leading-4 text-muted"}`}>{post?.body || "Social post"}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <Grid3X3 className="h-7 w-7 text-muted" />
            <div className="mt-3 text-[10px] font-semibold text-foreground">No {profileCollectionTab} yet</div>
            <p className="mt-2 max-w-sm text-[8px] leading-4 text-muted">Items will appear here automatically as @{profile.handle} uses the Social feed.</p>
          </div>
        )}
      </section>

      {openFollowList ? (
        <div
          className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenFollowList(null);
          }}
        >
          <section className="flex max-h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70">
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <UsersRound className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[11px] font-semibold capitalize text-foreground">{openFollowList}</h2>
                <p className="mt-0.5 text-[7px] text-muted">
                  {openFollowList === "followers"
                    ? `${followSummary?.followerCount ?? 0} people follow @${profile.handle}`
                    : `@${profile.handle} follows ${followSummary?.followingCount ?? 0} people`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenFollowList(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {(openFollowList === "followers" ? followSummary?.canViewFollowers : followSummary?.canViewFollowing) === false ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface text-muted"><LockKeyhole className="h-5 w-5" /></span>
                  <div className="mt-4 text-[10px] font-semibold text-foreground">This list is private</div>
                  <p className="mt-2 max-w-xs text-[8px] leading-4 text-muted">The count stays public, but @{profile.handle} has hidden who is in this list.</p>
                </div>
              ) : followList.length ? (
                <div className="divide-y divide-border/70">
                  {followList.map((item) => (
                    <button
                      key={item.userId}
                      type="button"
                      onClick={() => {
                        if (!item.handle || !onOpenProfile) return;
                        setOpenFollowList(null);
                        onOpenProfile(item.handle);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60"
                    >
                      <UserAvatar label={item.displayName} avatarUrl={item.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[9px] font-semibold text-foreground">{item.displayName}</span>
                        <span className="mt-0.5 block truncate text-[7px] text-muted">@{item.handle || "kwant-user"}</span>
                      </span>
                      {item.followsViewer ? <span className="rounded-lg bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary">Follows you</span> : null}
                    </button>
                  ))}
                  {followListNextOffset !== null ? (
                    <div className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => void loadFollowList(openFollowList, followListNextOffset)}
                        disabled={followListLoading}
                        className="h-8 rounded-xl border border-border bg-surface px-4 text-[8px] font-semibold text-muted hover:text-foreground disabled:cursor-wait"
                      >
                        {followListLoading ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : followListLoading ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-primary">
                  <LoaderCircle className="h-6 w-6 animate-spin" />
                  <span className="mt-3 text-[8px] text-muted">Loading {openFollowList}…</span>
                </div>
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
                  <UsersRound className="h-7 w-7 text-muted" />
                  <div className="mt-3 text-[10px] font-semibold text-foreground">No accounts here yet</div>
                </div>
              )}
              {followListError ? <div className="border-t border-border p-4 text-center text-[8px] text-danger">{followListError}</div> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
