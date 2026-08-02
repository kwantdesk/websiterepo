"use client";

import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowRight,
  BellRing,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  DoorOpen,
  FolderPlus,
  Gauge,
  Globe2,
  Hash,
  Image as ImageIcon,
  LockKeyhole,
  MessageCircle,
  Mic,
  Mic2,
  MoreHorizontal,
  Network,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Star,
  Trophy,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import ActivityStreakBadge from "@/components/socials/ActivityStreakBadge";
import UserAvatar from "@/components/socials/UserAvatar";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import {
  prepareSharedImage,
  prepareSquareImage,
} from "@/lib/clientImageProcessing";
import {
  DESK_CREATED_EVENT,
  DESK_NETWORK_CHANGED_EVENT,
  EMPTY_DESK_NETWORK,
  normalizeDeskDeletionConfirmation,
  type CreatedDeskPayload,
  type DeskBadgeIcon,
  type DeskCategory,
  type DeskChannel,
  type DeskMember,
  type DeskMemberProfile,
  type DeskMessage,
  type DeskMessageAttachment,
  type DeskNetworkPayload,
  type DeskPrivacy,
  type DeskRole,
  type DeskWorkspace as DeskWorkspaceModel,
} from "@/lib/desks";
import { type SocialProfilePayload } from "@/lib/socials";
import {
  effectivePresenceStatus,
  presenceOption,
  type FriendSummary,
  type FriendsPayload,
} from "@/lib/friends";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type DeskWorkspaceProps = {
  viewerId: string;
  viewerProfile: SocialProfilePayload;
  onCreateDesk: () => void;
  onNotice: (message: string) => void;
  onOpenProfile?: (handle: string) => void;
  onMessageProfile?: (userId: string) => void;
};

type WorkspaceDraft = {
  name: string;
  description: string;
  objective: string;
  weeklyMission: string;
  markets: string;
  session: string;
  timezone: string;
  privacy: DeskPrivacy;
  capacity: string;
  allowMemberInvites: boolean;
  inactivityDays: string;
  avatarUrl: string;
  accentColor: string;
  rules: string;
};

type ChannelDraft = {
  channelId: string;
  categoryId: string;
  name: string;
  description: string;
  channelType: "text" | "voice";
  syncPermissions: boolean;
  isPrivate: boolean;
  readOnly: boolean;
  reactionOnly: boolean;
  showHistory: boolean;
  allowedUserIds: string[];
};

type CategoryDraft = {
  categoryId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  readOnly: boolean;
  reactionOnly: boolean;
  showHistory: boolean;
  allowedUserIds: string[];
};

type MemberRoleDraft = {
  role: DeskRole;
  displayRole: string;
  badgeColor: string;
  badgeIcon: DeskBadgeIcon;
  responsibilities: string;
  importanceLevel: number;
};

type OptimisticDeskMessage = DeskMessage & {
  deliveryStatus: "sending" | "sent" | "failed";
};

function isOptimisticDeskMessage(message: DeskMessage): message is OptimisticDeskMessage {
  return "deliveryStatus" in message;
}

const REACTIONS = ["👍", "🔥", "🎯", "🧠", "✅"];
const DESK_ACCENTS = [
  { label: "Onyx Gold", value: "#d8b45c" },
  { label: "Kwant Green", value: "#b7ff3c" },
  { label: "Signal Blue", value: "#5271ff" },
  { label: "Ice", value: "#f2f5ef" },
  { label: "Cyan", value: "#20d7e7" },
  { label: "Violet", value: "#a878ff" },
  { label: "Rose", value: "#ff6f91" },
  { label: "Amber", value: "#ff9f1a" },
] as const;

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "KD";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function roleLabel(role: DeskRole) {
  return role === "owner" ? "Owner" : role === "moderator" ? "Moderator" : "Member";
}

function memberRoleLabel(member: DeskMember) {
  return member.displayRole || roleLabel(member.role);
}

function memberBadgeColor(member: DeskMember) {
  return member.badgeColor || (member.role === "owner" ? "#d8b45c" : member.role === "moderator" ? "#5271ff" : "#8b929e");
}

function memberIsOnline(profile: DeskMemberProfile) {
  return memberPresenceStatus(profile) === "online";
}

function memberPresenceStatus(profile: DeskMemberProfile) {
  return effectivePresenceStatus(profile.presenceStatus, profile.lastSeenAt);
}

function MemberRoleIcon({ icon, className = "h-3 w-3" }: { icon: DeskBadgeIcon; className?: string }) {
  if (icon === "crown") return <Crown className={className} />;
  if (icon === "star") return <Star className={className} />;
  if (icon === "spark") return <Sparkles className={className} />;
  if (icon === "chart") return <Gauge className={className} />;
  if (icon === "mentor") return <Trophy className={className} />;
  return <ShieldCheck className={className} />;
}

function MemberRoleBadge({ member, compact = false }: { member: DeskMember; compact?: boolean }) {
  const color = memberBadgeColor(member);
  return (
    <span
      title={member.responsibilities || memberRoleLabel(member)}
      className={`inline-flex max-w-[160px] items-center gap-1 rounded-lg border font-semibold ${compact ? "px-1.5 py-0.5 text-[5px]" : "px-2 py-1 text-[6px]"}`}
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}12`, boxShadow: member.importanceLevel >= 4 ? `0 0 12px ${color}28` : undefined }}
    >
      <MemberRoleIcon icon={member.badgeIcon} className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      <span className="truncate">{memberRoleLabel(member)}</span>
      {member.importanceLevel > 0 ? <span className="font-mono opacity-70">T{member.importanceLevel}</span> : null}
    </span>
  );
}

function workspaceDraft(workspace: DeskWorkspaceModel): WorkspaceDraft {
  return {
    name: workspace.name,
    description: workspace.description,
    objective: workspace.objective,
    weeklyMission: workspace.weeklyMission,
    markets: workspace.markets.join(", "),
    session: workspace.session,
    timezone: workspace.timezone,
    privacy: workspace.privacy,
    capacity: String(workspace.capacity),
    allowMemberInvites: workspace.allowMemberInvites,
    inactivityDays: workspace.inactivityDays ? String(workspace.inactivityDays) : "",
    avatarUrl: workspace.avatarUrl,
    accentColor: workspace.accentColor,
    rules: workspace.rules,
  };
}

function emptyChannelDraft(categoryId = ""): ChannelDraft {
  return {
    channelId: "",
    categoryId,
    name: "",
    description: "",
    channelType: "text",
    syncPermissions: true,
    isPrivate: false,
    readOnly: false,
    reactionOnly: false,
    showHistory: true,
    allowedUserIds: [],
  };
}

function channelDraft(channel: DeskChannel): ChannelDraft {
  return {
    channelId: channel.id,
    categoryId: channel.categoryId,
    name: channel.name,
    description: channel.description,
    channelType: channel.channelType,
    syncPermissions: channel.syncPermissions,
    isPrivate: channel.isPrivate,
    readOnly: channel.readOnly,
    reactionOnly: channel.reactionOnly,
    showHistory: channel.showHistory,
    allowedUserIds: channel.allowedUserIds,
  };
}

function emptyCategoryDraft(): CategoryDraft {
  return {
    categoryId: "",
    name: "",
    description: "",
    isPrivate: false,
    readOnly: false,
    reactionOnly: false,
    showHistory: true,
    allowedUserIds: [],
  };
}

function categoryDraft(category: DeskCategory): CategoryDraft {
  return {
    categoryId: category.id,
    name: category.name,
    description: category.description,
    isPrivate: category.isPrivate,
    readOnly: category.readOnly,
    reactionOnly: category.reactionOnly,
    showHistory: category.showHistory,
    allowedUserIds: category.allowedUserIds,
  };
}

function DeskMark({
  workspace,
  active = false,
  compact = false,
}: {
  workspace: DeskWorkspaceModel;
  active?: boolean;
  compact?: boolean;
}) {
  const size = compact ? "h-9 w-9 rounded-xl text-[9px]" : "h-11 w-11 rounded-2xl text-[11px]";
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border font-semibold transition-all ${size} ${
        active
          ? "border-primary/55 bg-primary/15 text-primary shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
          : "border-border bg-surface/55 text-muted hover:border-primary/30 hover:text-foreground"
      }`}
      style={{ borderColor: active ? workspace.accentColor : undefined }}
    >
      {workspace.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={workspace.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(workspace.name)
      )}
      {active ? <span className="absolute bottom-0 left-1/2 h-px w-5 -translate-x-1/2" style={{ background: workspace.accentColor }} /> : null}
    </span>
  );
}

function ProfileAvatar({
  profile,
  size = "md",
}: {
  profile: DeskMemberProfile;
  size?: "sm" | "md";
}) {
  return (
    <UserAvatar
      label={profile.displayName}
      avatarUrl={profile.avatarUrl}
      size={size}
      statusClassName={presenceOption(memberPresenceStatus(profile)).dotClassName}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail?: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/35 p-3 text-left">
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-surface"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[8px] font-semibold text-foreground">{label}</span>
        {detail ? <span className="mt-0.5 block text-[7px] leading-3 text-muted">{detail}</span> : null}
      </span>
    </button>
  );
}

function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`max-h-[90dvh] w-full overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70 ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
        <div className="flex items-start gap-3 border-b border-border p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">{icon}</span>
          <div><h2 className="text-[14px] font-semibold">{title}</h2><p className="mt-1 text-[8px] text-muted">{subtitle}</p></div>
          <button type="button" onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[calc(90dvh-150px)] overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function DeskInviteButton({
  workspace,
  enabled,
  working,
  friends,
  friendsLoading,
  friendsError,
  memberUserIds,
  pendingInviteUserIds,
  iconOnly = false,
  onOpen,
  onInvite,
}: {
  workspace: DeskWorkspaceModel;
  enabled: boolean;
  working: boolean;
  friends: FriendSummary[];
  friendsLoading: boolean;
  friendsError: string;
  memberUserIds: ReadonlySet<string>;
  pendingInviteUserIds: ReadonlySet<string>;
  iconOnly?: boolean;
  onOpen: () => void;
  onInvite: (username: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [quickInvitingId, setQuickInvitingId] = useState("");
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(() => new Set());
  const busy = working || submitting || Boolean(quickInvitingId);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setUsername("");
    setInvitedUserIds(new Set());
  };

  const submit = async () => {
    const normalized = username.trim().replace(/^@/, "");
    if (!normalized || busy) return;
    setSubmitting(true);
    try {
      const saved = await onInvite(normalized);
      if (saved) {
        setOpen(false);
        setUsername("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inviteFriend = async (friend: FriendSummary) => {
    if (!friend.handle || busy || memberUserIds.has(friend.userId) || pendingInviteUserIds.has(friend.userId) || invitedUserIds.has(friend.userId)) return;
    setQuickInvitingId(friend.userId);
    try {
      const saved = await onInvite(friend.handle);
      if (saved) {
        setInvitedUserIds((current) => new Set(current).add(friend.userId));
      }
    } finally {
      setQuickInvitingId("");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onOpen();
        }}
        onMouseEnter={onOpen}
        onFocus={onOpen}
        disabled={!enabled}
        title="Invite a Kwant Desk user"
        className={iconOnly
          ? "flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-primary/25 hover:text-primary disabled:opacity-30"
          : "flex h-8 items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.05] text-[7px] font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/[0.08] disabled:opacity-35"}
      >
        <UserPlus className={iconOnly ? "h-3.5 w-3.5" : "h-3 w-3"} />
        {iconOnly ? null : "Invite"}
      </button>
      {open ? (
        <Modal
          title={`Invite to ${workspace.name}`}
          subtitle="Invite a friend instantly or search by their unique @username."
          icon={<UserPlus className="h-4 w-4" />}
          onClose={close}
          footer={(
            <>
              <button type="button" onClick={close} disabled={busy} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted disabled:opacity-40">Cancel</button>
              <button type="button" onClick={() => void submit()} disabled={!username.trim() || busy} className="flex h-9 min-w-[116px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50">
                {submitting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : null}
                {submitting ? "Inviting…" : "Send invitation"}
              </button>
            </>
          )}
        >
          <section>
            <div className="flex items-center gap-2">
              <UsersRound className="h-3.5 w-3.5 text-primary" />
              <span className="text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Your friends</span>
              {friends.length ? <span className="ml-auto rounded-lg border border-border bg-background/40 px-2 py-1 font-mono text-[6px] text-muted">{friends.length}</span> : null}
            </div>
            <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-background/25">
              {friendsLoading && !friends.length ? (
                <div className="flex h-24 items-center justify-center gap-2 text-[7px] text-muted">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  Loading friends
                </div>
              ) : friends.length ? (
                <div className="max-h-64 divide-y divide-border/55 overflow-y-auto">
                  {friends.map((friend) => {
                    const status = effectivePresenceStatus(friend.presenceStatus, friend.lastSeenAt);
                    const statusDetails = presenceOption(status);
                    const isMember = memberUserIds.has(friend.userId);
                    const isPending = pendingInviteUserIds.has(friend.userId) || invitedUserIds.has(friend.userId);
                    const isSending = quickInvitingId === friend.userId;
                    return (
                      <div key={friend.userId} className="flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface/30">
                        <UserAvatar
                          label={friend.displayName}
                          avatarUrl={friend.avatarUrl}
                          size="sm"
                          statusClassName={statusDetails.dotClassName}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[8px] font-semibold text-foreground">{friend.displayName}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[6px] text-muted">
                            <span className="truncate">@{friend.handle}</span>
                            <span className="opacity-40">&middot;</span>
                            <span className="truncate">{statusDetails.label}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void inviteFriend(friend)}
                          disabled={busy || isMember || isPending || !friend.handle}
                          className={`flex h-8 min-w-[78px] items-center justify-center gap-1.5 rounded-xl border px-3 text-[7px] font-semibold transition-colors ${
                            isMember
                              ? "border-border bg-surface/35 text-muted"
                              : isPending
                                ? "border-primary/20 bg-primary/[0.05] text-primary"
                                : "border-primary/25 bg-primary/[0.07] text-primary hover:border-primary/45 hover:bg-primary/[0.12]"
                          } disabled:cursor-default`}
                        >
                          {isSending ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                          ) : isMember || isPending ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <UserPlus className="h-3 w-3" />
                          )}
                          {isSending ? "Sending" : isMember ? "In Desk" : isPending ? "Pending" : "Invite"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-24 items-center justify-center p-4 text-center">
                  <div>
                    <UsersRound className="mx-auto h-5 w-5 text-muted/60" />
                    <div className="mt-2 text-[7px] font-semibold text-foreground">No friends to invite yet</div>
                    <div className="mt-1 text-[6px] leading-4 text-muted">You can still invite any Kwant Desk user below.</div>
                  </div>
                </div>
              )}
            </div>
            {friendsError ? <div className="mt-2 text-[6px] leading-4 text-warning">{friendsError}</div> : null}
          </section>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">Invite another user</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <label>
            <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Kwant Desk user</span>
            <div className="flex h-11 items-center rounded-xl border border-border bg-background px-3 focus-within:border-primary/40">
              <span className="text-[9px] text-muted">@</span>
              <input
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/^@/, ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
                placeholder="username"
                className="h-full flex-1 bg-transparent px-1 text-[9px] text-foreground outline-none placeholder:text-muted"
              />
            </div>
          </label>
          <div className="mt-3 rounded-xl border border-border bg-background/30 p-3 text-[7px] leading-4 text-muted">
            {workspace.privacy === "PRIVATE"
              ? "Private Desk invitations are the only route in. The Kwant Desk user must accept before channels become visible."
              : "The Kwant Desk user receives an invitation they can accept or decline from the Desk directory."}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function MemberRoleControl({
  member,
  profile,
  working,
  rolesReady,
  onSave,
}: {
  member: DeskMember;
  profile: DeskMemberProfile;
  working: boolean;
  rolesReady: boolean;
  onSave: (draft: MemberRoleDraft) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MemberRoleDraft>(() => ({
    role: member.role,
    displayRole: member.displayRole,
    badgeColor: memberBadgeColor(member),
    badgeIcon: member.badgeIcon,
    responsibilities: member.responsibilities,
    importanceLevel: member.importanceLevel,
  }));
  const validColor = /^#[0-9a-f]{6}$/i.test(draft.badgeColor);
  const busy = working || saving;

  const show = () => {
    setDraft({
      role: member.role,
      displayRole: member.displayRole,
      badgeColor: memberBadgeColor(member),
      badgeIcon: member.badgeIcon,
      responsibilities: member.responsibilities,
      importanceLevel: member.importanceLevel,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!validColor || busy) return;
    setSaving(true);
    try {
      const saved = await onSave(draft);
      if (saved) setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" onClick={show} className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.04] px-2.5 text-[7px] font-semibold text-primary hover:border-primary/40"><Settings2 className="h-3 w-3" />Role</button>
      {open ? (
        <Modal
          title={`Role · ${profile.displayName}`}
          subtitle="Visible importance is separate from protected Desk permissions."
          icon={<MemberRoleIcon icon={draft.badgeIcon} className="h-4 w-4" />}
          onClose={() => { if (!busy) setOpen(false); }}
          footer={(
            <>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted disabled:opacity-40">Cancel</button>
              <button type="button" onClick={() => void save()} disabled={!rolesReady || !validColor || busy} className="flex h-9 min-w-[116px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-40">{saving ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <Check className="h-3.5 w-3.5" />}{saving ? "Saving…" : "Save role"}</button>
            </>
          )}
        >
          {!rolesReady ? <div className="mb-4 rounded-xl border border-warning/25 bg-warning/[0.04] p-3 text-[7px] leading-4 text-warning">Desk member roles need the latest Supabase migration before they can be saved.</div> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Permission level</span>
              <KwantSelect value={draft.role} disabled={member.role === "owner"} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as DeskRole }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none disabled:opacity-55">
                {member.role === "owner" ? <option value="owner">Owner</option> : null}
                <option value="member">Member</option>
                <option value="moderator">Moderator</option>
              </KwantSelect>
              <span className="mt-1.5 block text-[6px] leading-3 text-muted">Moderators can manage channels and members. Display roles never grant permissions.</span>
            </label>
            <label>
              <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Visible Desk role</span>
              <input value={draft.displayRole} maxLength={40} onChange={(event) => setDraft((current) => ({ ...current, displayRole: event.target.value }))} placeholder={roleLabel(member.role)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" />
            </label>
            <label>
              <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Role icon</span>
              <KwantSelect value={draft.badgeIcon} onChange={(event) => setDraft((current) => ({ ...current, badgeIcon: event.target.value as DeskBadgeIcon }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none">
                <option value="crown">Crown</option>
                <option value="shield">Shield</option>
                <option value="star">Star</option>
                <option value="spark">Signal spark</option>
                <option value="chart">Market chart</option>
                <option value="mentor">Mentor trophy</option>
              </KwantSelect>
            </label>
            <label>
              <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Importance tier · 0–5</span>
              <input type="number" min={0} max={5} value={draft.importanceLevel} onChange={(event) => setDraft((current) => ({ ...current, importanceLevel: Math.max(0, Math.min(5, Number(event.target.value) || 0)) }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[8px] outline-none focus:border-primary/40" />
            </label>
            <div className="md:col-span-2">
              <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Role colour</span>
              <div className="flex flex-wrap items-center gap-2">
                {DESK_ACCENTS.map((accent) => <button key={accent.value} type="button" onClick={() => setDraft((current) => ({ ...current, badgeColor: accent.value }))} title={accent.label} className={`h-8 w-8 rounded-xl border transition-transform hover:scale-105 ${draft.badgeColor.toLowerCase() === accent.value.toLowerCase() ? "border-white/70 ring-2 ring-primary/25" : "border-border"}`} style={{ backgroundColor: accent.value }} />)}
                <div className={`flex h-9 items-center gap-2 rounded-xl border bg-background px-3 ${validColor ? "border-border" : "border-danger/45"}`}><span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: validColor ? draft.badgeColor : "transparent" }} /><input value={draft.badgeColor} onChange={(event) => setDraft((current) => ({ ...current, badgeColor: `#${event.target.value.replace(/#/g, "").replace(/[^0-9a-f]/gi, "").slice(0, 6)}` }))} className="w-20 bg-transparent font-mono text-[8px] uppercase outline-none" /></div>
              </div>
            </div>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Responsibilities</span>
              <textarea value={draft.responsibilities} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, responsibilities: event.target.value }))} rows={4} placeholder="What this person owns, maintains, reviews, or leads inside the Desk…" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] leading-4 outline-none focus:border-primary/40" />
            </label>
            <div className="md:col-span-2 rounded-2xl border border-border bg-background/30 p-3">
              <div className="text-[6px] uppercase tracking-[0.12em] text-muted">Preview</div>
              <div className="mt-2 flex items-center gap-3"><ProfileAvatar profile={profile} /><div><div className="text-[9px] font-semibold">{profile.displayName}</div><MemberRoleBadge member={{ ...member, ...draft }} /></div></div>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function DeskSettingsModal({
  workspace,
  working,
  onClose,
  onSave,
  onLifecycle,
  onNotice,
}: {
  workspace: DeskWorkspaceModel;
  working: boolean;
  onClose: () => void;
  onSave: (draft: WorkspaceDraft) => void;
  onLifecycle: (action: "archive" | "delete", workspace: DeskWorkspaceModel) => void;
  onNotice: (message: string) => void;
}) {
  const [draft, setDraft] = useState<WorkspaceDraft>(() => workspaceDraft(workspace));
  const avatarRef = useRef<HTMLInputElement>(null);
  const validAccent = /^#[0-9a-fA-F]{6}$/.test(draft.accentColor);
  const privacyDetail = draft.privacy === "PUBLIC"
    ? "Visible in discovery. Any trader can join immediately."
    : draft.privacy === "REQUEST"
      ? "Visible in discovery. Every new member needs owner or moderator approval."
      : "Hidden from discovery. Membership is available by direct invitation only.";

  const loadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const prepared = await prepareSquareImage(file, {
        size: 1080,
        maxBytes: 1_000_000,
      });
      setDraft((current) => ({ ...current, avatarUrl: prepared.dataUrl }));
      onNotice("Desk image prepared at 1080 × 1080. Save the Desk to publish it.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "That Desk image could not be prepared.");
    }
  };

  const updateHex = (value: string) => {
    const normalized = `#${value.replace(/#/g, "").replace(/[^0-9a-f]/gi, "").slice(0, 6)}`;
    setDraft((current) => ({ ...current, accentColor: normalized }));
  };

  return (
    <Modal
      title={`${workspace.name} settings`}
      subtitle="Owner controls for identity, access, standards and inactivity."
      icon={<Settings2 className="h-4 w-4" />}
      onClose={onClose}
      wide
      footer={(
        <>
          <button type="button" onClick={onClose} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button>
          <button type="button" onClick={() => onSave(draft)} disabled={working || !validAccent} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_14%,transparent)] transition hover:brightness-110 disabled:opacity-40"><Check className="h-3.5 w-3.5" />Save Desk</button>
        </>
      )}
    >
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div>
          <div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">Desk identity</div>
          <button type="button" onClick={() => avatarRef.current?.click()} className="mt-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-primary/30 bg-primary/[0.05] text-primary transition hover:border-primary/55 hover:bg-primary/[0.08]">
            {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-center"><Upload className="mx-auto h-5 w-5" /><span className="mt-2 block text-[7px]">Upload Desk image</span></span>}
          </button>
          <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={loadAvatar} />
          {draft.avatarUrl ? <button type="button" onClick={() => setDraft((current) => ({ ...current, avatarUrl: "" }))} className="mt-2 w-full text-center text-[7px] text-muted hover:text-danger">Remove image</button> : null}
          <p className="mt-2 text-center text-[7px] leading-4 text-muted">Published at 1080 × 1080 in high-quality WebP.</p>

          <div className="mt-5">
            <span className="block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Desk accent</span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {DESK_ACCENTS.map((accent) => {
                const selected = draft.accentColor.toLowerCase() === accent.value.toLowerCase();
                return (
                  <button
                    key={accent.value}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, accentColor: accent.value }))}
                    title={accent.label}
                    aria-label={accent.label}
                    className={`relative aspect-square rounded-xl border bg-background/50 p-1.5 transition-all ${selected ? "border-foreground/50 shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_18%,transparent)]" : "border-border hover:border-foreground/25"}`}
                  >
                    <span className="block h-full w-full rounded-lg" style={{ background: accent.value, boxShadow: `0 0 ${selected ? 16 : 8}px ${accent.value}35` }} />
                    {selected ? <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-black mix-blend-difference invert" /> : null}
                  </button>
                );
              })}
            </div>
            <label className={`mt-3 flex h-10 items-center gap-2 rounded-xl border bg-background px-3 transition-colors ${validAccent ? "border-border focus-within:border-primary/40" : "border-danger/50"}`}>
              <span className="h-4 w-4 shrink-0 rounded-full border border-white/15" style={{ background: validAccent ? draft.accentColor : "transparent", boxShadow: validAccent ? `0 0 10px ${draft.accentColor}55` : undefined }} />
              <span className="font-mono text-[9px] text-muted">#</span>
              <input value={draft.accentColor.replace(/^#/, "")} onChange={(event) => updateHex(event.target.value)} maxLength={6} spellCheck={false} aria-label="Custom Desk accent hex code" className="h-full min-w-0 flex-1 bg-transparent font-mono text-[9px] uppercase text-foreground outline-none" />
            </label>
            {!validAccent ? <div className="mt-1.5 text-[7px] text-danger">Enter a complete six-digit hex colour.</div> : null}
          </div>
        </div>

        <div className="grid content-start gap-3 md:grid-cols-2">
          <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Desk name</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
          <label>
            <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Privacy</span>
            <KwantSelect value={draft.privacy} menuLabel="Desk privacy" onChange={(event) => setDraft((current) => ({ ...current, privacy: event.target.value as DeskPrivacy }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none">
              <option value="PUBLIC">Public · instant access</option>
              <option value="REQUEST">Approval required</option>
              <option value="PRIVATE">Private · invite only</option>
            </KwantSelect>
            <span className="mt-1.5 block text-[7px] leading-3 text-muted">{privacyDetail}</span>
          </label>
          <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Markets</span><input value={draft.markets} onChange={(event) => setDraft((current) => ({ ...current, markets: event.target.value }))} placeholder="NQ, ES" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
          <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Capacity · 2–50</span><input type="number" min={2} max={50} value={draft.capacity} onChange={(event) => setDraft((current) => ({ ...current, capacity: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[8px] outline-none focus:border-primary/40" /></label>
          <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Session</span><input value={draft.session} onChange={(event) => setDraft((current) => ({ ...current, session: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
          <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Timezone</span><input value={draft.timezone} onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
          <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Description</span><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={2} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] outline-none focus:border-primary/40" /></label>
          <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Shared objective</span><textarea value={draft.objective} onChange={(event) => setDraft((current) => ({ ...current, objective: event.target.value }))} rows={2} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] outline-none focus:border-primary/40" /></label>
          <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Weekly mission</span><textarea value={draft.weeklyMission} onChange={(event) => setDraft((current) => ({ ...current, weeklyMission: event.target.value }))} rows={2} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] outline-none focus:border-primary/40" /></label>
          <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Desk rules</span><textarea value={draft.rules} onChange={(event) => setDraft((current) => ({ ...current, rules: event.target.value }))} rows={5} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] leading-4 outline-none focus:border-primary/40" /></label>
          <div className="md:col-span-2 grid gap-2 md:grid-cols-2">
            <Toggle checked={draft.allowMemberInvites} onChange={(checked) => setDraft((current) => ({ ...current, allowMemberInvites: checked }))} label="Member invitations" detail="Allow ordinary members to invite people they already know." />
            <label className="rounded-xl border border-border bg-background/35 p-3"><span className="block text-[8px] font-semibold">Inactive member automation</span><span className="mt-0.5 block text-[7px] leading-3 text-muted">Non-owners are removed after this many inactive days. Leave blank to disable.</span><input type="number" min={7} max={365} value={draft.inactivityDays} onChange={(event) => setDraft((current) => ({ ...current, inactivityDays: event.target.value }))} placeholder="Disabled" className="mt-2 h-8 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[8px] outline-none focus:border-primary/40" /></label>
          </div>
          <div className="md:col-span-2 rounded-2xl border border-danger/20 bg-danger/[0.025] p-4">
            <div className="text-[8px] font-semibold text-foreground">Desk lifecycle</div>
            <p className="mt-1 text-[7px] leading-4 text-muted">Archiving hides this Desk from members and discovery while preserving everything for you. Permanent deletion removes its channels, messages, membership and settings.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onLifecycle("archive", workspace)} className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.05] px-4 text-[8px] font-semibold text-primary"><Archive className="h-3.5 w-3.5" />Archive Desk</button>
              <button type="button" onClick={() => onLifecycle("delete", workspace)} className="flex h-9 items-center gap-2 rounded-xl border border-danger/25 bg-danger/[0.05] px-4 text-[8px] font-semibold text-danger"><Trash2 className="h-3.5 w-3.5" />Delete permanently</button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function DeskWorkspace({
  viewerId,
  viewerProfile,
  onCreateDesk,
  onNotice,
  onOpenProfile,
  onMessageProfile,
}: DeskWorkspaceProps) {
  const [network, setNetwork] = useState<DeskNetworkPayload>(EMPTY_DESK_NETWORK);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [activeDeskId, setActiveDeskId] = useState("");
  const [activeChannelId, setActiveChannelId] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [showCategory, setShowCategory] = useState(false);
  const [showChannel, setShowChannel] = useState(false);
  const [lifecycleTarget, setLifecycleTarget] = useState<{
    action: "archive" | "delete";
    workspace: DeskWorkspaceModel;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingDeskId, setDeletingDeskId] = useState("");
  const [categoryEditor, setCategoryEditor] = useState<CategoryDraft>(emptyCategoryDraft);
  const [channelEditor, setChannelEditor] = useState<ChannelDraft>(emptyChannelDraft);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticDeskMessage[]>([]);
  const [attachment, setAttachment] = useState<DeskMessageAttachment | null>(null);
  const [imagePreview, setImagePreview] = useState<DeskMessageAttachment | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [rosterFilter, setRosterFilter] = useState<"all" | "online" | "offline" | "inactive">("all");
  const [inviteFriends, setInviteFriends] = useState<FriendSummary[]>([]);
  const [inviteFriendsLoading, setInviteFriendsLoading] = useState(false);
  const [inviteFriendsError, setInviteFriendsError] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const selectedDeskRef = useRef("");
  const refreshTimerRef = useRef<number | null>(null);
  const suppressRefreshUntilRef = useRef(0);
  const inviteFriendsRequestRef = useRef(false);
  const inviteFriendsLoadedAtRef = useRef(0);
  const deliveryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  selectedDeskRef.current = activeDeskId;

  const loadNetwork = useCallback(async (silent = false, deskOverride?: string) => {
    if (!silent) setLoading(true);
    try {
      const deskId = deskOverride ?? selectedDeskRef.current;
      const response = await fetch(`/api/socials/desks${deskId ? `?deskId=${encodeURIComponent(deskId)}` : ""}`, { cache: "no-store" });
      const payload = await response.json() as DeskNetworkPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Desks could not be loaded.");
      setNetwork(payload);
    } catch (reason) {
      if (!silent) onNotice(reason instanceof Error ? reason.message : "Desks could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onNotice]);

  const loadInviteFriends = useCallback(async () => {
    if (
      inviteFriendsRequestRef.current
      || Date.now() - inviteFriendsLoadedAtRef.current < 30_000
    ) return;
    inviteFriendsRequestRef.current = true;
    setInviteFriendsLoading(true);
    try {
      const response = await fetch("/api/friends", { cache: "no-store" });
      const result = await response.json() as FriendsPayload & { error?: string };
      if (!response.ok) throw new Error(result.error || "Friends could not be loaded.");
      setInviteFriends(result.friends ?? []);
      setInviteFriendsError("");
      inviteFriendsLoadedAtRef.current = Date.now();
    } catch (reason) {
      setInviteFriendsError(reason instanceof Error
        ? reason.message
        : "Friends could not be loaded. You can still invite by username.");
    } finally {
      inviteFriendsRequestRef.current = false;
      setInviteFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNetwork(false);
  }, [loadNetwork]);

  useEffect(() => {
    const handleDeskCreated = (event: Event) => {
      const created = (event as CustomEvent<CreatedDeskPayload>).detail;
      if (!created?.workspace || created.member.userId !== viewerId) return;
      suppressRefreshUntilRef.current = Date.now() + 2_500;
      const viewerScore = Math.round(
        Object.values(viewerProfile.scores).reduce((sum, value) => sum + value, 0)
        / Math.max(1, Object.values(viewerProfile.scores).length),
      );
      setNetwork((current) => ({
        ...current,
        ready: true,
        viewerId,
        workspaces: [
          created.workspace,
          ...current.workspaces.filter((workspace) => workspace.deskId !== created.workspace.deskId),
        ],
        members: [
          created.member,
          ...current.members.filter((member) =>
            member.deskId !== created.member.deskId || member.userId !== created.member.userId),
        ],
        categories: [
          ...created.categories,
          ...current.categories.filter((category) => category.deskId !== created.workspace.deskId),
        ],
        channels: [
          ...created.channels,
          ...current.channels.filter((channel) => channel.deskId !== created.workspace.deskId),
        ],
        profiles: [
          {
            userId: viewerId,
            displayName: viewerProfile.displayName,
            handle: viewerProfile.handle,
            avatarUrl: viewerProfile.avatarUrl || "",
            processStatus: viewerProfile.processStatus,
            score: viewerScore,
            lastSeenAt: viewerProfile.lastSeenAt || null,
            activityStreak: viewerProfile.activityStreak,
            longestActivityStreak: viewerProfile.longestActivityStreak,
            lastActivityDate: viewerProfile.lastActivityDate,
            presenceStatus: viewerProfile.presenceStatus ?? "online",
          },
          ...current.profiles.filter((profile) => profile.userId !== viewerId),
        ],
      }));
      setDiscovering(false);
      setActiveDeskId(created.workspace.deskId);
      setActiveChannelId("");
    };
    window.addEventListener(DESK_CREATED_EVENT, handleDeskCreated);
    return () => window.removeEventListener(DESK_CREATED_EVENT, handleDeskCreated);
  }, [viewerId, viewerProfile]);

  const viewerMemberships = useMemo(
    () => network.members.filter((member) => member.userId === viewerId),
    [network.members, viewerId],
  );
  const memberDeskIds = useMemo(() => new Set(viewerMemberships.map((member) => member.deskId)), [viewerMemberships]);
  const activeWorkspaces = useMemo(
    () => network.workspaces.filter((workspace) => !workspace.archivedAt),
    [network.workspaces],
  );
  const archivedWorkspaces = useMemo(
    () => network.workspaces.filter((workspace) => workspace.ownerId === viewerId && Boolean(workspace.archivedAt)),
    [network.workspaces, viewerId],
  );
  const myWorkspaces = useMemo(
    () => activeWorkspaces.filter((workspace) => memberDeskIds.has(workspace.deskId)),
    [activeWorkspaces, memberDeskIds],
  );
  const activeDesk = activeWorkspaces.find((workspace) => workspace.deskId === activeDeskId) ?? null;
  const activeMembership = viewerMemberships.find((member) => member.deskId === activeDeskId) ?? null;
  const leader = activeMembership?.role === "owner" || activeMembership?.role === "moderator";
  const owner = activeMembership?.role === "owner";
  const canInvite = Boolean(activeDesk && activeMembership && (leader || activeDesk.allowMemberInvites));
  const activeMembers = network.members.filter((member) => member.deskId === activeDeskId);
  const activeMemberUserIds = useMemo(
    () => new Set(network.members
      .filter((member) => member.deskId === activeDeskId)
      .map((member) => member.userId)),
    [activeDeskId, network.members],
  );
  const pendingInviteUserIds = useMemo(
    () => new Set(network.requests
      .filter((request) => (
        request.deskId === activeDeskId
        && request.requestType === "invite"
        && request.status === "pending"
      ))
      .map((request) => request.userId)),
    [activeDeskId, network.requests],
  );
  const activeChannels = network.channels
    .filter((channel) => channel.deskId === activeDeskId)
    .sort((left, right) => left.position - right.position);
  const activeCategories = network.categories
    .filter((category) => category.deskId === activeDeskId)
    .sort((left, right) => left.position - right.position);
  const activeChannel = activeChannels.find((channel) => channel.id === activeChannelId) ?? null;
  const channelMessages = useMemo(() => {
    const byId = new Map<string, DeskMessage>();
    network.messages
      .filter((entry) => entry.channelId === activeChannel?.id)
      .forEach((entry) => byId.set(entry.id, entry));
    optimisticMessages
      .filter((entry) => entry.channelId === activeChannel?.id)
      .forEach((entry) => byId.set(entry.id, entry));
    return [...byId.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  }, [activeChannel?.id, network.messages, optimisticMessages]);
  const activeFocusLock = (network.focusLocks ?? []).find((lock) => lock.deskId === activeDeskId) ?? null;
  const canReleaseFocus = Boolean(activeFocusLock && (
    activeFocusLock.lockedBy === viewerId
    || leader
  ));
  const speechDictation = useSpeechDictation({
    value: message,
    onChange: setMessage,
    disabled: Boolean(activeFocusLock) || !activeDesk || !activeChannel || activeChannel.channelType !== "text",
    maxLength: 4_000,
  });

  const profileMap = useMemo(() => new Map(network.profiles.map((profile) => [profile.userId, profile])), [network.profiles]);
  const profileFor = useCallback((userId: string): DeskMemberProfile => profileMap.get(userId) ?? {
    userId,
    displayName: userId === viewerId ? viewerProfile.displayName : "Kwant Trader",
    handle: userId === viewerId ? viewerProfile.handle : "trader",
    avatarUrl: userId === viewerId ? viewerProfile.avatarUrl || "" : "",
    processStatus: userId === viewerId ? viewerProfile.processStatus : "AWAY",
    score: userId === viewerId ? Math.round(Object.values(viewerProfile.scores).reduce((sum, value) => sum + value, 0) / Math.max(1, Object.values(viewerProfile.scores).length)) : 0,
    lastSeenAt: null,
    activityStreak: userId === viewerId ? viewerProfile.activityStreak : 0,
    longestActivityStreak: userId === viewerId ? viewerProfile.longestActivityStreak : 0,
    lastActivityDate: userId === viewerId ? viewerProfile.lastActivityDate : "",
    presenceStatus: userId === viewerId ? viewerProfile.presenceStatus ?? "online" : "offline",
  }, [profileMap, viewerId, viewerProfile]);
  const focusOwnerProfile = activeFocusLock ? profileFor(activeFocusLock.lockedBy) : null;

  useEffect(() => {
    if (!network.ready || activeDeskId || !myWorkspaces.length) return;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("kwantdesk-active-desk") ?? "" : "";
    const initial = myWorkspaces.some((workspace) => workspace.deskId === saved) ? saved : myWorkspaces[0].deskId;
    setActiveDeskId(initial);
  }, [activeDeskId, myWorkspaces, network.ready]);

  useEffect(() => {
    if (!activeDeskId) return;
    window.localStorage.setItem("kwantdesk-active-desk", activeDeskId);
    setDiscovering(false);
    if (Date.now() < suppressRefreshUntilRef.current) return;
    void loadNetwork(true, activeDeskId);
  }, [activeDeskId, loadNetwork]);

  useEffect(() => {
    if (!network.ready) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const refresh = (delay = 180) => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      const suppressionDelay = Math.max(0, suppressRefreshUntilRef.current - Date.now());
      refreshTimerRef.current = window.setTimeout(() => {
        void loadNetwork(true, selectedDeskRef.current);
      }, Math.max(delay, suppressionDelay));
    };
    const channel = supabase
      .channel("kwantdesk-multi-desks")
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_workspaces" }, () => refresh(300))
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_members" }, () => refresh(220))
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_join_requests" }, () => refresh(220))
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_channel_categories" }, () => refresh(180))
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_channels" }, () => refresh(180))
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_messages" }, () => refresh(120))
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_message_reactions" }, () => refresh(120))
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_focus_locks" }, () => refresh(80))
      .subscribe();
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [loadNetwork, network.ready]);

  useEffect(() => {
    if (!network.ready) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNetwork(true, selectedDeskRef.current);
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [loadNetwork, network.ready]);

  useEffect(() => {
    if (!activeDeskId || !activeMembership) return;
    const touch = () => {
      void fetch("/api/socials/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "touch", deskId: activeDeskId }),
      });
    };
    touch();
    const timer = window.setInterval(touch, 120_000);
    return () => window.clearInterval(timer);
  }, [activeDeskId, activeMembership]);

  useEffect(() => {
    if (activeChannelId && !activeChannels.some((channel) => channel.id === activeChannelId)) setActiveChannelId("");
  }, [activeChannelId, activeChannels]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [channelMessages.length, activeChannel?.id]);

  useEffect(() => () => {
    for (const timer of deliveryTimersRef.current.values()) clearTimeout(timer);
    deliveryTimersRef.current.clear();
  }, []);

  const perform = useCallback(async (body: Record<string, unknown>, success?: string) => {
    setWorking(true);
    try {
      const response = await fetch("/api/socials/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { error?: string; result?: string };
      if (!response.ok) throw new Error(payload.error || "That Desk action could not be completed.");
      if (success) onNotice(success);
      await loadNetwork(true, selectedDeskRef.current || body.deskId as string | undefined);
      window.dispatchEvent(new CustomEvent(DESK_NETWORK_CHANGED_EVENT));
      return true;
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : "That Desk action could not be completed.");
      return false;
    } finally {
      setWorking(false);
    }
  }, [loadNetwork, onNotice]);

  const openSettings = () => {
    if (!activeDesk) return;
    setShowSettings(true);
  };

  const saveSettings = async (draft: WorkspaceDraft) => {
    if (!activeDesk) return;
    const previousWorkspace = activeDesk;
    const optimisticWorkspace: DeskWorkspaceModel = {
      ...activeDesk,
      name: draft.name.trim() || activeDesk.name,
      description: draft.description.trim(),
      objective: draft.objective.trim(),
      weeklyMission: draft.weeklyMission.trim(),
      markets: draft.markets.split(",").map((market) => market.trim().toUpperCase()).filter(Boolean),
      session: draft.session.trim() || "New York",
      timezone: draft.timezone.trim() || "UTC",
      privacy: draft.privacy,
      capacity: Math.max(2, Math.min(50, Math.floor(Number(draft.capacity) || 12))),
      allowMemberInvites: draft.allowMemberInvites,
      inactivityDays: draft.inactivityDays ? Math.max(7, Math.min(365, Math.floor(Number(draft.inactivityDays) || 30))) : null,
      avatarUrl: draft.avatarUrl,
      accentColor: draft.accentColor,
      rules: draft.rules.trim(),
      updatedAt: new Date().toISOString(),
    };
    setShowSettings(false);
    setNetwork((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.deskId === optimisticWorkspace.deskId ? optimisticWorkspace : workspace),
    }));
    const saved = await perform({
      action: "update-settings",
      deskId: activeDesk.deskId,
      ...draft,
      markets: optimisticWorkspace.markets,
      inactivityDays: draft.inactivityDays || null,
    }, "Desk settings saved.");
    if (!saved) {
      setNetwork((current) => ({
        ...current,
        workspaces: current.workspaces.map((workspace) =>
          workspace.deskId === previousWorkspace.deskId ? previousWorkspace : workspace),
      }));
      setShowSettings(true);
    }
  };

  const openLifecycle = (action: "archive" | "delete", workspace: DeskWorkspaceModel) => {
    setShowSettings(false);
    setShowArchived(false);
    setDeleteConfirmation("");
    setLifecycleTarget({ action, workspace });
  };

  const archiveDesk = async () => {
    if (!lifecycleTarget || lifecycleTarget.action !== "archive" || working) return;
    const workspace = lifecycleTarget.workspace;
    const nextDesk = myWorkspaces.find((candidate) => candidate.deskId !== workspace.deskId) ?? null;
    const previousActiveDeskId = activeDeskId;
    const previousActiveChannelId = activeChannelId;
    const archivedAt = new Date().toISOString();

    suppressRefreshUntilRef.current = Date.now() + 5_000;
    setLifecycleTarget(null);
    setWorking(true);
    setNetwork((current) => ({
      ...current,
      workspaces: current.workspaces.map((candidate) =>
        candidate.deskId === workspace.deskId
          ? { ...candidate, archivedAt, updatedAt: archivedAt }
          : candidate),
    }));
    setActiveDeskId(nextDesk?.deskId ?? "");
    setActiveChannelId("");
    if (typeof window !== "undefined") {
      if (nextDesk) window.localStorage.setItem("kwantdesk-active-desk", nextDesk.deskId);
      else window.localStorage.removeItem("kwantdesk-active-desk");
    }

    try {
      const response = await fetch("/api/socials/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive-desk", deskId: workspace.deskId }),
      });
      const payload = await response.json() as { error?: string; archivedAt?: string | null };
      if (!response.ok) throw new Error(payload.error || "That Desk could not be archived.");
      if (payload.archivedAt && payload.archivedAt !== archivedAt) {
        setNetwork((current) => ({
          ...current,
          workspaces: current.workspaces.map((candidate) =>
            candidate.deskId === workspace.deskId
              ? { ...candidate, archivedAt: payload.archivedAt ?? archivedAt, updatedAt: payload.archivedAt ?? archivedAt }
              : candidate),
        }));
      }
      onNotice(`${workspace.name} was archived.`);
      window.dispatchEvent(new CustomEvent(DESK_NETWORK_CHANGED_EVENT));
    } catch (reason) {
      suppressRefreshUntilRef.current = Date.now() + 1_000;
      setNetwork((current) => ({
        ...current,
        workspaces: current.workspaces.map((candidate) =>
          candidate.deskId === workspace.deskId ? workspace : candidate),
      }));
      setActiveDeskId(previousActiveDeskId);
      setActiveChannelId(previousActiveChannelId);
      setLifecycleTarget({ action: "archive", workspace });
      if (typeof window !== "undefined") {
        if (previousActiveDeskId) window.localStorage.setItem("kwantdesk-active-desk", previousActiveDeskId);
        else window.localStorage.removeItem("kwantdesk-active-desk");
      }
      onNotice(reason instanceof Error ? reason.message : "That Desk could not be archived.");
      void loadNetwork(true, previousActiveDeskId);
    } finally {
      setWorking(false);
    }
  };

  const restoreDesk = async (workspace: DeskWorkspaceModel) => {
    const restored = await perform(
      { action: "restore-desk", deskId: workspace.deskId },
      `${workspace.name} is active again.`,
    );
    if (!restored) return;
    setShowArchived(false);
    setActiveDeskId(workspace.deskId);
    setActiveChannelId("");
  };

  const deleteDesk = async () => {
    if (!lifecycleTarget || lifecycleTarget.action !== "delete" || deletingDeskId) return;
    const workspace = lifecycleTarget.workspace;
    const confirmation = deleteConfirmation;
    const expectedName = normalizeDeskDeletionConfirmation(workspace.name);
    if (!expectedName || normalizeDeskDeletionConfirmation(confirmation) !== expectedName) return;
    const nextDesk = myWorkspaces.find((candidate) => candidate.deskId !== workspace.deskId) ?? null;
    const previousNetwork = network;
    const previousActiveDeskId = activeDeskId;
    const previousActiveChannelId = activeChannelId;

    suppressRefreshUntilRef.current = Date.now() + 5_000;
    setDeletingDeskId(workspace.deskId);
    setLifecycleTarget(null);
    setDeleteConfirmation("");
    setNetwork((current) => ({
      ...current,
      workspaces: current.workspaces.filter((candidate) => candidate.deskId !== workspace.deskId),
      members: current.members.filter((member) => member.deskId !== workspace.deskId),
      requests: current.requests.filter((request) => request.deskId !== workspace.deskId),
      categories: current.categories.filter((category) => category.deskId !== workspace.deskId),
      channels: current.channels.filter((channel) => channel.deskId !== workspace.deskId),
      messages: current.messages.filter((entry) => entry.deskId !== workspace.deskId),
      focusLocks: current.focusLocks.filter((lock) => lock.deskId !== workspace.deskId),
    }));
    if (activeDeskId === workspace.deskId) {
      setActiveDeskId(nextDesk?.deskId ?? "");
      setActiveChannelId("");
      if (typeof window !== "undefined") {
        if (nextDesk) window.localStorage.setItem("kwantdesk-active-desk", nextDesk.deskId);
        else window.localStorage.removeItem("kwantdesk-active-desk");
      }
    }

    try {
      const response = await fetch("/api/socials/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-desk",
          deskId: workspace.deskId,
          confirmation: workspace.name,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "That Desk could not be permanently deleted.");
      onNotice(`${workspace.name} was permanently deleted.`);
      window.dispatchEvent(new CustomEvent(DESK_NETWORK_CHANGED_EVENT));
    } catch (reason) {
      suppressRefreshUntilRef.current = Date.now() + 1_000;
      setNetwork(previousNetwork);
      setActiveDeskId(previousActiveDeskId);
      setActiveChannelId(previousActiveChannelId);
      setDeleteConfirmation(confirmation);
      setLifecycleTarget({ action: "delete", workspace });
      if (typeof window !== "undefined") {
        if (previousActiveDeskId) window.localStorage.setItem("kwantdesk-active-desk", previousActiveDeskId);
        else window.localStorage.removeItem("kwantdesk-active-desk");
      }
      onNotice(reason instanceof Error ? reason.message : "That Desk could not be permanently deleted.");
      void loadNetwork(true, previousActiveDeskId);
    } finally {
      setDeletingDeskId("");
    }
  };

  const requestAccess = async (workspace: DeskWorkspaceModel) => {
    const label = workspace.privacy === "PUBLIC" ? `Joined ${workspace.name}.` : `Request sent to ${workspace.name}.`;
    await perform({ action: "request-access", deskId: workspace.deskId }, label);
  };

  const toggleDeskFocus = async () => {
    if (!activeDesk || working) return;
    if (activeFocusLock && !canReleaseFocus) {
      onNotice("Only the trader who silenced this Desk or a Desk leader can reopen it.");
      return;
    }
    await perform({
      action: "toggle-focus",
      deskId: activeDesk.deskId,
      locked: !activeFocusLock,
    }, activeFocusLock
      ? `${activeDesk.name} is open again.`
      : `${activeDesk.name} is now silent for trading focus.`);
  };

  const resolveRequest = async (requestId: string, resolution: "accepted" | "declined" | "cancelled", deskId: string) => {
    await perform({ action: "resolve-request", deskId, requestId, resolution }, resolution === "accepted" ? "Desk access approved." : "Request updated.");
  };

  const sendInvite = async (username: string) => {
    if (!activeDesk || !username.trim()) return false;
    return perform({
      action: "invite",
      deskId: activeDesk.deskId,
      handle: username,
    }, `Invitation sent to @${username.replace(/^@/, "")}.`);
  };

  const openCategoryEditor = (category?: DeskCategory) => {
    setCategoryEditor(category ? categoryDraft(category) : emptyCategoryDraft());
    setShowCategory(true);
  };

  const saveCategory = async () => {
    if (!activeDesk) return;
    const saved = await perform({
      action: categoryEditor.categoryId ? "update-category" : "create-category",
      deskId: activeDesk.deskId,
      ...categoryEditor,
      position: categoryEditor.categoryId
        ? activeCategories.find((category) => category.id === categoryEditor.categoryId)?.position ?? 100
        : (activeCategories.at(-1)?.position ?? 0) + 10,
    }, categoryEditor.categoryId ? "Category settings saved." : "Category created. Add a text or voice channel inside it.");
    if (saved) setShowCategory(false);
  };

  const openChannelEditor = (channel?: DeskChannel, categoryId = "") => {
    setChannelEditor(channel ? channelDraft(channel) : emptyChannelDraft(categoryId));
    setShowChannel(true);
  };

  const saveChannel = async () => {
    if (!activeDesk) return;
    const saved = await perform({
      action: channelEditor.channelId ? "update-channel" : "create-channel",
      deskId: activeDesk.deskId,
      ...channelEditor,
      position: channelEditor.channelId
        ? activeChannels.find((channel) => channel.id === channelEditor.channelId)?.position ?? 100
        : (activeChannels.filter((channel) => channel.categoryId === channelEditor.categoryId).at(-1)?.position ?? 0) + 10,
    }, channelEditor.channelId ? "Channel settings saved." : "Channel created.");
    if (saved) setShowChannel(false);
  };

  const deliverDeskMessage = useCallback(async (outgoing: OptimisticDeskMessage) => {
    const existingTimer = deliveryTimersRef.current.get(outgoing.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      deliveryTimersRef.current.delete(outgoing.id);
    }
    setOptimisticMessages((current) => current.map((entry) => entry.id === outgoing.id
      ? { ...entry, deliveryStatus: "sending" }
      : entry));
    try {
      const response = await fetch("/api/socials/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-message",
          deskId: outgoing.deskId,
          channelId: outgoing.channelId,
          clientMessageId: outgoing.id,
          message: outgoing.body,
          attachments: outgoing.attachments,
        }),
      });
      const payload = await response.json() as { error?: string; messageId?: string };
      if (!response.ok) throw new Error(payload.error || "The Desk message could not be sent.");
      setOptimisticMessages((current) => current.map((entry) => entry.id === outgoing.id
        ? { ...entry, deliveryStatus: "sent" }
        : entry));
      void loadNetwork(true, outgoing.deskId);
      const timer = setTimeout(() => {
        setOptimisticMessages((current) => current.filter((entry) => entry.id !== outgoing.id));
        deliveryTimersRef.current.delete(outgoing.id);
      }, 1_500);
      deliveryTimersRef.current.set(outgoing.id, timer);
    } catch (reason) {
      setOptimisticMessages((current) => current.map((entry) => entry.id === outgoing.id
        ? { ...entry, deliveryStatus: "failed" }
        : entry));
      onNotice(reason instanceof Error ? reason.message : "The Desk message could not be sent.");
    }
  }, [loadNetwork, onNotice]);

  const sendMessage = () => {
    if (!activeDesk || !activeChannel || (!message.trim() && !attachment)) return;
    if (activeFocusLock) {
      onNotice("This Desk is in trading focus mode. Messages are paused.");
      return;
    }
    const outgoing: OptimisticDeskMessage = {
      id: crypto.randomUUID(),
      deskId: activeDesk.deskId,
      channelId: activeChannel.id,
      senderUserId: viewerId,
      body: message.trim(),
      attachments: attachment ? [attachment] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliveryStatus: "sending",
    };
    speechDictation.stop();
    setMessage("");
    setAttachment(null);
    setOptimisticMessages((current) => [...current, outgoing]);
    void deliverDeskMessage(outgoing);
  };

  const handleMessageKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const loadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const prepared = await prepareSharedImage(file, {
        maximumEdge: 1920,
        maxBytes: 900_000,
      });
      setAttachment({
        id: `image:${crypto.randomUUID()}`,
        name: prepared.name,
        type: prepared.type,
        size: prepared.size,
        dataUrl: prepared.dataUrl,
      });
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "That Desk image could not be prepared.");
    }
  };

  const teamScores = activeMembers.map((member) => profileFor(member.userId).score).filter((score) => score > 0);
  const teamScore = teamScores.length ? Math.round(teamScores.reduce((sum, score) => sum + score, 0) / teamScores.length) : 0;
  const activeCutoff = Date.now() - 7 * 86_400_000;
  const activeThisWeek = activeMembers.filter((member) => Date.parse(member.lastActiveAt) >= activeCutoff).length;
  const participation = activeMembers.length ? Math.round(activeThisWeek / activeMembers.length * 100) : 0;
  const memberLeaderboard = [...activeMembers].sort((left, right) => profileFor(right.userId).score - profileFor(left.userId).score);
  const memberByUserId = new Map(activeMembers.map((member) => [member.userId, member]));
  const selectedMember = selectedMemberId ? memberByUserId.get(selectedMemberId) ?? null : null;
  const selectedMemberProfile = selectedMember ? profileFor(selectedMember.userId) : null;
  const selectedMemberRank = selectedMember
    ? memberLeaderboard.findIndex((member) => member.userId === selectedMember.userId) + 1
    : 0;
  const selectedMemberPresence = selectedMemberProfile
    ? presenceOption(memberPresenceStatus(selectedMemberProfile))
    : null;
  const inactiveDays = activeDesk?.inactivityDays ?? 14;
  const inactiveCutoff = Date.now() - inactiveDays * 86_400_000;
  const roster = activeMembers.map((member) => {
    const profile = profileFor(member.userId);
    const inactive = Date.parse(member.lastActiveAt) < inactiveCutoff;
    const online = !inactive && memberIsOnline(profile);
    return { member, profile, inactive, online };
  });
  const onlineRoster = roster.filter((entry) => entry.online);
  const inactiveRoster = roster.filter((entry) => entry.inactive);
  const offlineRoster = roster.filter((entry) => !entry.online && !entry.inactive);
  const visibleRoster = rosterFilter === "online"
    ? onlineRoster
    : rosterFilter === "offline"
      ? offlineRoster
      : rosterFilter === "inactive"
        ? inactiveRoster
        : [...onlineRoster, ...offlineRoster, ...inactiveRoster];
  const workspaceScores = activeWorkspaces.map((workspace) => {
    const members = network.members.filter((member) => member.deskId === workspace.deskId);
    const scores = members.map((member) => profileFor(member.userId).score).filter((score) => score > 0);
    return {
      workspace,
      score: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      members: members.length,
    };
  }).sort((left, right) => right.score - left.score);
  const deskRank = activeDesk ? workspaceScores.findIndex((entry) => entry.workspace.deskId === activeDesk.deskId) + 1 : 0;

  const pendingForDesk = network.requests.filter((request) => request.deskId === activeDeskId && request.status === "pending");
  const incomingInvites = network.requests.filter((request) => request.userId === viewerId && request.requestType === "invite" && request.status === "pending");
  const ownPendingRequests = new Set(network.requests
    .filter((request) => request.userId === viewerId && request.requestType === "request" && request.status === "pending")
    .map((request) => request.deskId));
  const available = activeWorkspaces.filter((workspace) => !memberDeskIds.has(workspace.deskId));
  const filteredAvailable = available.filter((workspace) => {
    const query = directoryQuery.trim().toLowerCase();
    return !query || [workspace.name, workspace.description, workspace.objective, workspace.markets.join(" ")].some((value) => value.toLowerCase().includes(query));
  });

  const openMemberCard = (userId: string, closeMembers = false) => {
    if (closeMembers) setShowMembers(false);
    setSelectedMemberId(userId);
  };

  const openSelectedMemberProfile = () => {
    if (!selectedMemberProfile?.handle) return;
    setSelectedMemberId("");
    onOpenProfile?.(selectedMemberProfile.handle);
  };

  const messageSelectedMember = () => {
    if (!selectedMember || selectedMember.userId === viewerId) return;
    setSelectedMemberId("");
    onMessageProfile?.(selectedMember.userId);
  };

  if (loading && !network.ready) {
    return (
      <KwantLoader
        className="h-full min-h-0 rounded-3xl border border-border"
        icon={UsersRound}
        title="Opening your Desks"
        detail="Loading memberships, channels and permissions."
      />
    );
  }

  if (!network.ready) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-3xl border border-border bg-panel p-6">
        <div className="max-w-lg text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Network className="h-5 w-5" /></span>
          <h2 className="mt-4 text-[15px] font-semibold">Multi-Desk storage is ready to connect</h2>
          <p className="mt-2 text-[8px] leading-5 text-muted">Apply migration <span className="font-mono text-foreground">202607300004_create_multi_desk_workspaces.sql</span> in Supabase. It preserves the Desk you already made and upgrades it with roles, channels, requests and chat history.</p>
        </div>
      </div>
    );
  }

  const expectedDeleteConfirmation = lifecycleTarget?.action === "delete"
    ? normalizeDeskDeletionConfirmation(lifecycleTarget.workspace.name)
    : "";
  const deleteConfirmationMatches = Boolean(
    expectedDeleteConfirmation
    && normalizeDeskDeletionConfirmation(deleteConfirmation) === expectedDeleteConfirmation,
  );

  return (
    <>
      <div className="h-full min-h-0 overflow-hidden rounded-3xl border border-border bg-panel shadow-[0_18px_70px_rgba(0,0,0,0.2)]">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[68px_224px_minmax(0,1fr)] xl:grid-rows-1 2xl:grid-cols-[68px_224px_minmax(0,1fr)_286px]">
          <aside className="flex items-center gap-2 overflow-x-auto border-b border-border bg-background/65 p-2 xl:flex-col xl:overflow-x-visible xl:border-b-0 xl:border-r">
            <button type="button" onClick={() => { setDiscovering(false); if (myWorkspaces[0]) setActiveDeskId(myWorkspaces[0].deskId); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_12%,transparent)]" title="My Desks"><Network className="h-4 w-4" /></button>
            <span className="hidden h-px w-8 bg-border xl:block" />
            {myWorkspaces.map((workspace) => (
              <button key={workspace.deskId} type="button" onClick={() => { setActiveDeskId(workspace.deskId); setDiscovering(false); }} title={workspace.name}>
                <DeskMark workspace={workspace} active={!discovering && activeDeskId === workspace.deskId} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface/25 text-muted transition-colors hover:border-primary/30 hover:text-primary"
              title="Archived Desks"
            >
              <Archive className="h-4 w-4" />
              {archivedWorkspaces.length ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 font-mono text-[6px] font-semibold text-background">{archivedWorkspaces.length}</span> : null}
            </button>
            <button type="button" onClick={() => setDiscovering(true)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors ${discovering ? "border-primary/45 bg-primary/10 text-primary" : "border-border bg-surface/40 text-muted hover:text-foreground"}`} title="Discover Desks"><Search className="h-4 w-4" /></button>
            <button type="button" onClick={onCreateDesk} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-dashed border-primary/35 text-primary hover:bg-primary/10" title="Create a Desk"><Plus className="h-4 w-4" /></button>
            <div className="hidden flex-1 xl:block" />
            <div className="hidden rounded-xl border border-border bg-surface/30 px-2 py-2 text-center xl:block"><div className="font-mono text-[10px] font-semibold text-primary">{myWorkspaces.length}</div><div className="text-[6px] uppercase tracking-[0.12em] text-muted">Desks</div></div>
          </aside>

          <aside className="hidden min-h-0 flex-col border-r border-border bg-background/35 xl:flex">
            {activeDesk && !discovering ? (
              <>
                <div className="border-b border-border p-3">
                  <div className="flex items-center gap-2">
                    <DeskMark workspace={activeDesk} compact active />
                    <div className="min-w-0 flex-1"><div className="truncate text-[10px] font-semibold">{activeDesk.name}</div><div className="mt-0.5 flex items-center gap-1.5 text-[6px] uppercase tracking-[0.1em] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{activeMembers.length} members</div></div>
                    <button type="button" onClick={openSettings} disabled={!owner} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-30" title="Desk settings"><Settings2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <DeskInviteButton
                      workspace={activeDesk}
                      enabled={canInvite}
                      working={working}
                      friends={inviteFriends}
                      friendsLoading={inviteFriendsLoading}
                      friendsError={inviteFriendsError}
                      memberUserIds={activeMemberUserIds}
                      pendingInviteUserIds={pendingInviteUserIds}
                      onOpen={() => void loadInviteFriends()}
                      onInvite={sendInvite}
                    />
                    <button type="button" onClick={() => setShowMembers(true)} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface/35 text-[7px] font-semibold text-muted hover:text-foreground"><UsersRound className="h-3 w-3" />Members</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleDeskFocus()}
                    disabled={working}
                    className={`mt-1.5 flex h-9 w-full items-center justify-center gap-2 rounded-xl border text-[7px] font-semibold transition disabled:opacity-50 ${
                      activeFocusLock
                        ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_10%,transparent)]"
                        : "border-border bg-surface/25 text-muted hover:border-primary/30 hover:text-foreground"
                    }`}
                    title={activeFocusLock
                      ? canReleaseFocus ? "Reopen this Desk for messages and reactions" : "Trading focus is controlled by the trader who enabled it or a Desk leader"
                      : "Silence this Desk so every member can only view"}
                  >
                    {activeFocusLock && canReleaseFocus ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    {activeFocusLock ? canReleaseFocus ? "Reopen Desk" : "Desk silenced" : "Silence Desk"}
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                  <button type="button" onClick={() => setActiveChannelId("")} className={`mb-3 flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left transition-colors ${!activeChannel ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface/55 hover:text-foreground"}`}>
                    <Network className="h-3.5 w-3.5" />
                    <span className="text-[8px] font-semibold">Desk overview</span>
                    <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[5px] uppercase tracking-[0.1em]">View only</span>
                  </button>
                  <div className="mb-2 flex items-center justify-between px-1.5">
                    <span className="text-[6px] font-semibold uppercase tracking-[0.14em] text-muted">Categories</span>
                    {leader ? <button type="button" onClick={() => openCategoryEditor()} className="flex items-center gap-1 text-[6px] font-semibold text-muted hover:text-primary"><FolderPlus className="h-3 w-3" />Add category</button> : null}
                  </div>
                  {!network.categoryStructureReady ? (
                    <div className="rounded-xl border border-warning/25 bg-warning/[0.04] p-3 text-[7px] leading-4 text-warning">Apply the Desk categories migration in Supabase to create categories and channels.</div>
                  ) : !activeCategories.length ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center">
                      <FolderPlus className="mx-auto h-5 w-5 text-muted" />
                      <div className="mt-2 text-[8px] font-semibold">No categories yet</div>
                      <p className="mt-1 text-[6px] leading-4 text-muted">Create a category first. Text and voice channels can only live inside one.</p>
                      {leader ? <button type="button" onClick={() => openCategoryEditor()} className="mt-3 h-8 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 text-[7px] font-semibold text-primary">Add first category</button> : null}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeCategories.map((category) => {
                        const collapsed = collapsedCategoryIds.includes(category.id);
                        const categoryChannels = activeChannels.filter((channel) => channel.categoryId === category.id);
                        return (
                          <div key={category.id}>
                            <div className="group flex h-8 items-center gap-1 rounded-lg px-1.5 text-muted hover:bg-surface/35 hover:text-foreground">
                              <button type="button" onClick={() => setCollapsedCategoryIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                                <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                                {category.isPrivate ? <LockKeyhole className="h-3 w-3 shrink-0" /> : null}
                                <span className="truncate text-[6px] font-bold uppercase tracking-[0.13em]">{category.name}</span>
                              </button>
                              {leader ? <button type="button" onClick={() => openChannelEditor(undefined, category.id)} title={`Add a channel to ${category.name}`} className="hidden h-6 w-6 items-center justify-center rounded-md hover:bg-background group-hover:flex"><Plus className="h-3 w-3" /></button> : null}
                              {leader ? <button type="button" onClick={() => openCategoryEditor(category)} title={`${category.name} settings`} className="hidden h-6 w-6 items-center justify-center rounded-md hover:bg-background group-hover:flex"><MoreHorizontal className="h-3 w-3" /></button> : null}
                            </div>
                            {!collapsed ? (
                              <div className="mt-0.5 space-y-0.5 pl-2">
                                {categoryChannels.map((channel) => (
                                  <button key={channel.id} type="button" onClick={() => setActiveChannelId(channel.id)} className={`group flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left transition-colors ${activeChannel?.id === channel.id ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface/55 hover:text-foreground"}`}>
                                    {channel.channelType === "voice" ? <Mic2 className="h-3.5 w-3.5 shrink-0" /> : channel.isPrivate ? <LockKeyhole className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
                                    <span className="min-w-0 flex-1 truncate text-[8px] font-semibold">{channel.name}</span>
                                    {channel.syncPermissions ? <ShieldCheck className="h-3 w-3 opacity-45" /> : <Settings2 className="h-3 w-3 opacity-45" />}
                                    {leader ? <span onClick={(event) => { event.stopPropagation(); openChannelEditor(channel); }} className="hidden h-6 w-6 items-center justify-center rounded-md hover:bg-background group-hover:flex"><MoreHorizontal className="h-3 w-3" /></span> : null}
                                  </button>
                                ))}
                                {!categoryChannels.length ? <button type="button" disabled={!leader} onClick={() => openChannelEditor(undefined, category.id)} className="flex h-8 w-full items-center gap-2 rounded-lg border border-dashed border-border px-2.5 text-[6px] text-muted hover:border-primary/30 hover:text-primary disabled:pointer-events-none"><Plus className="h-3 w-3" />Add text or voice channel</button> : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="border-t border-border p-3">
                  <div className="rounded-xl border border-border bg-surface/30 p-2.5">
                    <div className="flex items-center gap-2"><ProfileAvatar profile={profileFor(viewerId)} size="sm" /><div className="min-w-0 flex-1"><div className="truncate text-[8px] font-semibold">{profileFor(viewerId).displayName}</div>{activeMembership ? <MemberRoleBadge member={activeMembership} compact /> : null}</div></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4"><div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-primary">Desk network</div><h3 className="mt-2 text-[12px] font-semibold">Find your floor.</h3><p className="mt-2 text-[7px] leading-4 text-muted">Join public Desks, request access to curated rooms or accept a private invitation.</p></div>
            )}
          </aside>

          <main className="flex min-h-0 min-w-0 flex-col bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_38%)]">
            {activeDesk && !discovering ? (
              <div className="border-b border-border bg-background/45 p-2.5 xl:hidden">
                <div className="flex items-center gap-2">
                  <DeskMark workspace={activeDesk} compact active />
                  <div className="min-w-0 flex-1"><div className="truncate text-[9px] font-semibold">{activeDesk.name}</div><div className="mt-0.5 text-[6px] text-muted">{activeMembers.length} members · index {teamScore || "—"}</div></div>
                  <button
                    type="button"
                    onClick={() => void toggleDeskFocus()}
                    disabled={working}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                      activeFocusLock ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted"
                    } disabled:opacity-40`}
                    title={activeFocusLock ? canReleaseFocus ? "Reopen Desk" : "Desk silenced for trading focus" : "Silence Desk"}
                    aria-label={activeFocusLock ? canReleaseFocus ? "Reopen Desk" : "Desk silenced for trading focus" : "Silence Desk"}
                  >
                    {activeFocusLock && canReleaseFocus ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  </button>
                  <DeskInviteButton
                    workspace={activeDesk}
                    enabled={canInvite}
                    working={working}
                    friends={inviteFriends}
                    friendsLoading={inviteFriendsLoading}
                    friendsError={inviteFriendsError}
                    memberUserIds={activeMemberUserIds}
                    pendingInviteUserIds={pendingInviteUserIds}
                    iconOnly
                    onOpen={() => void loadInviteFriends()}
                    onInvite={sendInvite}
                  />
                  <button type="button" onClick={() => setShowMembers(true)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted"><UsersRound className="h-3.5 w-3.5" /></button>
                  {owner ? <button type="button" onClick={openSettings} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted"><Settings2 className="h-3.5 w-3.5" /></button> : null}
                </div>
                <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
                  <button type="button" onClick={() => setActiveChannelId("")} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[7px] font-semibold ${!activeChannel ? "bg-primary/10 text-primary" : "bg-surface/30 text-muted"}`}>
                    <Network className="h-3 w-3" />Overview
                  </button>
                  {activeCategories.map((category) => (
                    <div key={category.id} className="flex shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-background/30 p-0.5 pl-2">
                      <span className="mr-1 text-[5px] font-bold uppercase tracking-[0.11em] text-muted">{category.name}</span>
                      {activeChannels.filter((channel) => channel.categoryId === category.id).map((channel) => (
                        <button key={channel.id} type="button" onClick={() => setActiveChannelId(channel.id)} className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[7px] font-semibold ${activeChannel?.id === channel.id ? "bg-primary/10 text-primary" : "text-muted"}`}>
                          {channel.channelType === "voice" ? <Mic2 className="h-3 w-3" /> : channel.isPrivate ? <LockKeyhole className="h-3 w-3" /> : <Hash className="h-3 w-3" />}{channel.name}
                        </button>
                      ))}
                      {leader ? <button type="button" onClick={() => openChannelEditor(undefined, category.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-primary/10 hover:text-primary" title={`Add channel to ${category.name}`}><Plus className="h-3 w-3" /></button> : null}
                    </div>
                  ))}
                  {leader ? <button type="button" onClick={() => openCategoryEditor()} className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/30 px-2.5 text-[7px] font-semibold text-primary"><FolderPlus className="h-3 w-3" />Category</button> : null}
                </div>
              </div>
            ) : null}
            {discovering || !activeDesk ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="mx-auto max-w-5xl">
                  <div className="relative overflow-hidden rounded-3xl border border-border bg-background/45 p-5">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_42%)]" />
                    <div className="relative flex flex-wrap items-end gap-4">
                      <div className="max-w-2xl"><div className="text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">Multiple Desks · one identity</div><h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">Trade alone. Improve together.</h2><p className="mt-2 text-[8px] leading-5 text-muted">Every Desk has its own standards, channels, leaderboard and permissions. Your reasoning remains yours.</p></div>
                      <button type="button" onClick={onCreateDesk} className="ml-auto flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"><Plus className="h-3.5 w-3.5" />Create Desk</button>
                    </div>
                  </div>

                  {incomingInvites.length ? (
                    <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
                      <div className="flex items-center gap-2 text-[8px] font-semibold text-primary"><BellRing className="h-3.5 w-3.5" />Private invitations</div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {incomingInvites.map((request) => {
                          const workspace = network.workspaces.find((entry) => entry.deskId === request.deskId);
                          if (!workspace) return null;
                          return <div key={request.id} className="flex items-center gap-3 rounded-xl border border-border bg-panel p-3"><DeskMark workspace={workspace} compact /><div className="min-w-0 flex-1"><div className="truncate text-[9px] font-semibold">{workspace.name}</div><div className="mt-0.5 text-[7px] text-muted">Private invitation</div></div><button type="button" onClick={() => void resolveRequest(request.id, "declined", workspace.deskId)} className="h-8 rounded-lg px-2.5 text-[7px] text-muted">Decline</button><button type="button" onClick={() => void resolveRequest(request.id, "accepted", workspace.deskId)} className="h-8 rounded-lg bg-primary px-3 text-[7px] font-semibold text-background">Accept</button></div>;
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-background/45 p-3"><Search className="h-4 w-4 text-muted" /><input value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="Search by Desk, market or objective" className="h-8 flex-1 bg-transparent text-[8px] outline-none placeholder:text-muted" /><span className="rounded-lg border border-border px-2 py-1 text-[6px] uppercase tracking-[0.1em] text-muted">{filteredAvailable.length} available</span></div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {filteredAvailable.map((workspace) => {
                      const members = network.members.filter((member) => member.deskId === workspace.deskId).length;
                      const requested = ownPendingRequests.has(workspace.deskId);
                      const invited = incomingInvites.find((entry) => entry.deskId === workspace.deskId);
                      return (
                        <div key={workspace.deskId} className="group rounded-2xl border border-border bg-panel p-4 transition-colors hover:border-primary/30">
                          <div className="flex items-start gap-3"><DeskMark workspace={workspace} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[11px] font-semibold">{workspace.name}</h3><span className="rounded-md border border-border bg-surface/35 px-1.5 py-0.5 text-[5px] uppercase tracking-[0.1em] text-muted">{workspace.privacy}</span></div><div className="mt-1 text-[7px] text-muted">{workspace.markets.join(" · ") || "Multi-market"} · {workspace.session}</div></div><span className="font-mono text-[8px] text-primary">{members}/{workspace.capacity}</span></div>
                          <p className="mt-3 min-h-10 text-[8px] leading-4 text-muted">{workspace.description || workspace.objective}</p>
                          <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3"><span className="text-[7px] text-muted">{workspace.privacy === "PUBLIC" ? "Open entry" : workspace.privacy === "REQUEST" ? "Owner approval" : "Invite only"}</span>
                            {invited ? <button type="button" onClick={() => void resolveRequest(invited.id, "accepted", workspace.deskId)} className="ml-auto h-8 rounded-lg bg-primary px-3 text-[7px] font-semibold text-background">Accept invite</button>
                              : workspace.privacy === "PRIVATE" ? <span className="ml-auto flex items-center gap-1 text-[7px] text-muted"><LockKeyhole className="h-3 w-3" />Private</span>
                                : <button type="button" disabled={requested || working} onClick={() => void requestAccess(workspace)} className="ml-auto h-8 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 text-[7px] font-semibold text-primary disabled:opacity-50">{requested ? "Request pending" : workspace.privacy === "PUBLIC" ? "Join Desk" : "Request access"}</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!filteredAvailable.length ? <div className="mt-3 rounded-2xl border border-dashed border-border p-12 text-center"><UsersRound className="mx-auto h-7 w-7 text-muted" /><div className="mt-3 text-[10px] font-semibold">No other Desks match this search.</div><div className="mt-1 text-[7px] text-muted">Create one and define the standard you want to trade around.</div></div> : null}
                </div>
              </div>
            ) : !activeChannel ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="mx-auto max-w-4xl">
                  <div className="relative overflow-hidden rounded-3xl border border-border bg-panel p-5 lg:p-7">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_42%)]" />
                    <div className="relative flex flex-wrap items-start gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><Network className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1"><div className="text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">Desk overview · view only</div><h2 className="mt-2 text-[17px] font-semibold tracking-[-0.03em]">{activeDesk.name}</h2><p className="mt-2 max-w-2xl text-[8px] leading-5 text-muted">{activeDesk.objective || activeDesk.description || "The shared operating floor for this Desk."}</p></div>
                      <button type="button" onClick={() => setShowMembers(true)} className="flex h-9 items-center gap-2 rounded-xl border border-border bg-surface/30 px-3 text-[8px] text-muted hover:text-foreground"><UsersRound className="h-3.5 w-3.5" />{activeMembers.length} members</button>
                    </div>
                    <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-background/35 p-4"><div className="font-mono text-[16px] font-semibold text-primary">{activeCategories.length}</div><div className="mt-1 text-[6px] uppercase tracking-[0.13em] text-muted">Categories</div></div>
                      <div className="rounded-2xl border border-border bg-background/35 p-4"><div className="font-mono text-[16px] font-semibold text-primary">{activeChannels.filter((channel) => channel.channelType === "text").length}</div><div className="mt-1 text-[6px] uppercase tracking-[0.13em] text-muted">Text channels</div></div>
                      <div className="rounded-2xl border border-border bg-background/35 p-4"><div className="font-mono text-[16px] font-semibold text-primary">{activeChannels.filter((channel) => channel.channelType === "voice").length}</div><div className="mt-1 text-[6px] uppercase tracking-[0.13em] text-muted">Voice channels</div></div>
                    </div>
                  </div>
                  {!activeCategories.length ? <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center"><FolderPlus className="mx-auto h-6 w-6 text-muted" /><h3 className="mt-3 text-[11px] font-semibold">Build the first category</h3><p className="mx-auto mt-2 max-w-md text-[7px] leading-4 text-muted">Overview never accepts messages. Create a category, then add a text or voice channel inside it to begin.</p>{leader ? <button type="button" onClick={() => openCategoryEditor()} className="mt-4 h-9 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background">Add category</button> : null}</div> : null}
                </div>
              </div>
            ) : activeChannel.channelType === "voice" ? (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6 text-center"><div><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Mic2 className="h-6 w-6" /></span><h2 className="mt-4 text-[14px] font-semibold">{activeChannel.name}</h2><p className="mx-auto mt-2 max-w-sm text-[8px] leading-5 text-muted">Voice channels are structured in the Desk now, but live audio is intentionally reserved for the next release. No fake connection state.</p></div></div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-border bg-background/35 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">{activeChannel?.isPrivate ? <LockKeyhole className="h-4 w-4" /> : <Hash className="h-4 w-4" />}</span>
                  <div className="min-w-0"><h2 className="text-[11px] font-semibold">{activeChannel?.name ?? "Desk overview"}</h2><p className="mt-0.5 truncate text-[7px] text-muted">{activeChannel?.description || activeDesk.objective}</p></div>
                  <div className="ml-auto flex items-center gap-2">
                    {activeFocusLock ? <span className="flex items-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-2 py-1 text-[6px] font-semibold uppercase tracking-[0.1em] text-primary"><VolumeX className="h-3 w-3" />Trading focus</span> : null}
                    {activeChannel?.readOnly ? <span className="rounded-lg border border-border bg-surface/30 px-2 py-1 text-[6px] uppercase tracking-[0.1em] text-muted">Read only</span> : null}
                    {activeChannel?.reactionOnly ? <span className="rounded-lg border border-border bg-surface/30 px-2 py-1 text-[6px] uppercase tracking-[0.1em] text-muted">Reactions only</span> : null}
                    <button type="button" onClick={() => setShowMembers(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface/30 px-2.5 text-[7px] text-muted hover:text-foreground"><UsersRound className="h-3 w-3" />{activeMembers.length}</button>
                  </div>
                </header>

                {activeFocusLock ? (
                  <div className="flex flex-wrap items-center gap-3 border-b border-primary/20 bg-primary/[0.045] px-4 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                      <VolumeX className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[8px] font-semibold text-foreground">Desk silenced for trading focus</div>
                      <div className="mt-0.5 truncate text-[6px] text-muted">
                        {focusOwnerProfile?.displayName ?? "A Desk member"} paused messages, attachments and reactions at {formatTime(activeFocusLock.lockedAt)}. Everyone remains able to view.
                      </div>
                    </div>
                    {canReleaseFocus ? (
                      <button type="button" onClick={() => void toggleDeskFocus()} disabled={working} className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-[7px] font-semibold text-primary disabled:opacity-40">
                        <Volume2 className="h-3 w-3" />Reopen Desk
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:px-5">
                  {!channelMessages.length ? (
                    <div className="flex min-h-full items-center justify-center py-12 text-center"><div><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.07] text-primary"><MessageCircle className="h-5 w-5" /></span><h3 className="mt-4 text-[11px] font-semibold">This is the start of #{activeChannel?.name}.</h3><p className="mx-auto mt-2 max-w-sm text-[7px] leading-4 text-muted">{activeChannel?.showHistory ? "Messages remain with the Desk so the shared context is not lost." : "History starts when each member gains access to this channel."}</p></div></div>
                  ) : (
                    <div className="space-y-1">
                      {channelMessages.map((entry, index) => {
                        const profile = profileFor(entry.senderUserId);
                        const deskMember = memberByUserId.get(entry.senderUserId);
                        const previous = channelMessages[index - 1];
                        const grouped = previous?.senderUserId === entry.senderUserId && Date.parse(entry.createdAt) - Date.parse(previous.createdAt) < 300_000;
                        const optimistic = isOptimisticDeskMessage(entry) ? entry : null;
                        const reactionGroups = REACTIONS.map((emoji) => ({
                          emoji,
                          users: network.reactions.filter((reaction) => reaction.messageId === entry.id && reaction.emoji === emoji),
                        })).filter((group) => group.users.length);
                        return (
                          <div key={entry.id} className={`group relative flex gap-3 rounded-xl px-2 py-2 hover:bg-surface/25 ${grouped ? "mt-0" : "mt-3"}`}>
                            <div className="w-9 shrink-0">{grouped ? <span className="block pt-1 text-center text-[5px] text-muted opacity-0 group-hover:opacity-100">{formatTime(entry.createdAt)}</span> : <ProfileAvatar profile={profile} />}</div>
                            <div className="min-w-0 flex-1">
                              {!grouped ? <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onOpenProfile?.(profile.handle)} className="text-[8px] font-semibold hover:text-primary">{profile.displayName}</button>{deskMember ? <MemberRoleBadge member={deskMember} compact /> : null}<span className="text-[6px] text-muted">{formatDateTime(entry.createdAt)}</span></div> : null}
                              {entry.body ? <p className="mt-1 whitespace-pre-wrap break-words text-[8px] leading-4 text-foreground/90">{entry.body}</p> : null}
                              {entry.attachments.map((item) => <button key={item.id} type="button" onClick={() => setImagePreview(item)} className="mt-2 block max-w-sm overflow-hidden rounded-xl border border-border bg-background/40"><img src={item.dataUrl} alt={item.name} className="max-h-64 w-full object-contain" /></button>)}
                              {optimistic ? (
                                <div className={`mt-1 flex items-center gap-1 text-[6px] ${optimistic.deliveryStatus === "failed" ? "text-danger" : "text-muted"}`}>
                                  {optimistic.deliveryStatus === "sending" ? <><Clock3 className="h-2.5 w-2.5" />Sendingâ€¦</> : null}
                                  {optimistic.deliveryStatus === "sent" ? <><Check className="h-2.5 w-2.5 text-primary" />Sent</> : null}
                                  {optimistic.deliveryStatus === "failed" ? <button type="button" onClick={() => void deliverDeskMessage(optimistic)} className="font-semibold underline underline-offset-2">Not sent Â· Retry</button> : null}
                                </div>
                              ) : null}
                              {reactionGroups.length ? <div className="mt-2 flex flex-wrap gap-1">{reactionGroups.map((group) => <button key={group.emoji} type="button" disabled={Boolean(activeFocusLock)} onClick={() => void perform({ action: "react", deskId: activeDesk.deskId, messageId: entry.id, emoji: group.emoji })} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[7px] disabled:cursor-default ${group.users.some((reaction) => reaction.userId === viewerId) ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-surface/30 text-muted"}`}><span>{group.emoji}</span><span className="font-mono">{group.users.length}</span></button>)}</div> : null}
                            </div>
                            {!activeFocusLock ? <div className="absolute -top-4 right-2 hidden rounded-xl border border-border bg-panel p-1 shadow-xl group-hover:flex">{REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => void perform({ action: "react", deskId: activeDesk.deskId, messageId: entry.id, emoji })} className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] hover:bg-surface">{emoji}</button>)}</div> : null}
                          </div>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-border bg-background/35 p-3">
                  {attachment && !activeFocusLock ? <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-panel p-2"><img src={attachment.dataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /><div className="min-w-0 flex-1"><div className="truncate text-[7px] font-semibold">{attachment.name}</div><div className="mt-0.5 text-[6px] text-muted">{Math.round(attachment.size / 1024)} KB</div></div><button type="button" onClick={() => setAttachment(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface"><X className="h-3.5 w-3.5" /></button></div> : null}
                  {activeFocusLock ? (
                    <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.045] text-[7px] text-muted"><VolumeX className="h-3.5 w-3.5 text-primary" />Trading focus is active. This Desk is view only.</div>
                  ) : (activeChannel?.readOnly || activeChannel?.reactionOnly) && !leader ? (
                    <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface/25 text-[7px] text-muted"><ShieldCheck className="h-3.5 w-3.5 text-primary" />{activeChannel.reactionOnly ? "This channel accepts reactions only." : "Only Desk leaders can post in this channel."}</div>
                  ) : (
                    <>
                    {speechDictation.error ? <div className="mb-2 text-[7px] text-danger">{speechDictation.error}</div> : null}
                    <div className="flex items-end gap-2 rounded-2xl border border-border bg-panel p-2 focus-within:border-primary/35">
                      <button type="button" onClick={() => attachmentInputRef.current?.click()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-primary" title="Attach image"><Plus className="h-4 w-4" /></button>
                      <textarea value={message} maxLength={4_000} onChange={(event) => setMessage(event.target.value)} onKeyDown={handleMessageKey} rows={1} placeholder={`Message #${activeChannel?.name ?? "desk"}`} className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-1 py-2 text-[8px] leading-4 outline-none placeholder:text-muted" />
                      <button
                        type="button"
                        onClick={() => { speechDictation.clearError(); speechDictation.toggle(); }}
                        disabled={!speechDictation.supported}
                        aria-label={speechDictation.listening ? "Stop dictating Desk message" : "Dictate Desk message"}
                        aria-pressed={speechDictation.listening}
                        title={!speechDictation.supported ? "Speech input is not supported by this browser" : speechDictation.listening ? "Stop dictation" : "Dictate a message"}
                        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${speechDictation.listening ? "bg-primary/15 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_16%,transparent)]" : "text-muted hover:bg-surface hover:text-primary"}`}
                      >
                        {speechDictation.listening ? <span className="absolute inset-2 animate-ping rounded-full bg-primary/25" /> : null}
                        <Mic className="relative h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={sendMessage} disabled={!message.trim() && !attachment} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-background disabled:opacity-35"><Send className="h-3.5 w-3.5" /></button>
                      <input ref={attachmentInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={loadAttachment} />
                    </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </main>

          <aside className="hidden min-h-0 flex-col border-l border-border bg-background/30 2xl:flex">
            {activeDesk && !discovering ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="overflow-hidden rounded-2xl border border-border bg-panel">
                  <div className="relative p-4">
                    <div className="absolute inset-x-0 top-0 h-20 opacity-15" style={{ background: `radial-gradient(circle at 70% 0%, ${activeDesk.accentColor}, transparent 70%)` }} />
                    <div className="relative flex items-center justify-between"><div><div className="text-[6px] font-semibold uppercase tracking-[0.14em] text-muted">Combined Desk index</div><div className="mt-1 font-mono text-[26px] font-semibold tracking-[-0.05em] text-foreground">{teamScore}<span className="ml-1 text-[9px] text-muted">/ 100</span></div></div><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Gauge className="h-4 w-4" /></span></div>
                    <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary shadow-[0_0_12px_var(--primary)] transition-[width] duration-700" style={{ width: `${teamScore}%` }} /></div>
                    <div className="relative mt-2 flex items-center justify-between text-[6px] text-muted"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Live team average</span><span>{participation}% active this week</span></div>
                  </div>
                  <div className="grid grid-cols-2 border-t border-border"><div className="border-r border-border p-3 text-center"><div className="font-mono text-[12px] font-semibold text-primary">#{deskRank || "—"}</div><div className="mt-0.5 text-[6px] uppercase tracking-[0.1em] text-muted">Overall rank</div></div><div className="p-3 text-center"><div className="font-mono text-[12px] font-semibold text-foreground">{activeMembers.length}</div><div className="mt-0.5 text-[6px] uppercase tracking-[0.1em] text-muted">Members</div></div></div>
                </div>

                <div className="mt-3 rounded-2xl border border-border bg-panel p-3">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[8px] font-semibold"><Trophy className="h-3.5 w-3.5 text-primary" />Desk leaderboard</div><span className="text-[6px] text-muted">Reasoning index</span></div>
                  <div className="mt-3 space-y-1">
                    {memberLeaderboard.slice(0, 8).map((member, index) => {
                      const profile = profileFor(member.userId);
                      return <button type="button" key={member.userId} onClick={() => openMemberCard(member.userId)} className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"><span className={`w-4 font-mono text-[7px] ${index < 3 ? "text-primary" : "text-muted"}`}>{String(index + 1).padStart(2, "0")}</span><ProfileAvatar profile={profile} size="sm" /><span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-1"><span className="truncate text-[7px] font-semibold group-hover:text-primary">{profile.displayName}</span><ActivityStreakBadge streak={profile.activityStreak} compact /></span><MemberRoleBadge member={member} compact /></span><span className="font-mono text-[8px] font-semibold text-primary">{profile.score || "—"}</span><MoreHorizontal className="h-3 w-3 text-muted opacity-0 transition-opacity group-hover:opacity-100" /></button>;
                    })}
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-border bg-panel p-3">
                  <div className="flex items-center gap-2 text-[8px] font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" />Weekly mission</div>
                  <p className="mt-3 text-[7px] leading-4 text-foreground">{activeDesk.weeklyMission || "The owner has not set this week’s mission."}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${participation}%` }} /></div>
                </div>

                {leader && pendingForDesk.filter((request) => request.requestType === "request").length ? (
                  <div className="mt-3 rounded-2xl border border-warning/25 bg-warning/[0.04] p-3">
                    <div className="flex items-center gap-2 text-[8px] font-semibold text-warning"><UserPlus className="h-3.5 w-3.5" />Join requests</div>
                    <div className="mt-2 space-y-2">{pendingForDesk.filter((request) => request.requestType === "request").map((request) => { const profile = profileFor(request.userId); return <div key={request.id} className="flex items-center gap-2 rounded-xl border border-border bg-panel p-2"><ProfileAvatar profile={profile} size="sm" /><div className="min-w-0 flex-1"><div className="truncate text-[7px] font-semibold">@{profile.handle}</div><div className="text-[6px] text-muted">{formatDateTime(request.createdAt)}</div></div><button type="button" onClick={() => void resolveRequest(request.id, "declined", activeDesk.deskId)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface"><X className="h-3 w-3" /></button><button type="button" onClick={() => void resolveRequest(request.id, "accepted", activeDesk.deskId)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-background"><Check className="h-3 w-3" /></button></div>; })}</div>
                  </div>
                ) : null}

                <div className="mt-3 rounded-2xl border border-border bg-panel p-3">
                  <div className="flex items-center gap-2 text-[8px] font-semibold"><Activity className="h-3.5 w-3.5 text-primary" />Desk standard</div>
                  <p className="mt-3 whitespace-pre-wrap text-[7px] leading-4 text-muted">{activeDesk.rules}</p>
                </div>

                <div className="mt-3 rounded-2xl border border-border bg-panel p-3">
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-3.5 w-3.5 text-primary" />
                    <div className="text-[8px] font-semibold">Desk users</div>
                    <button type="button" onClick={() => setShowMembers(true)} className="ml-auto text-[6px] font-semibold text-muted hover:text-primary">Manage</button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-background/30">
                    <button type="button" onClick={() => setRosterFilter("all")} className={`p-2 text-center ${rosterFilter === "all" ? "bg-primary/[0.06]" : ""}`}><span className="block font-mono text-[10px] font-semibold text-foreground">{roster.length}</span><span className="mt-0.5 block text-[5px] uppercase tracking-[0.1em] text-muted">Overall</span></button>
                    <button type="button" onClick={() => setRosterFilter("online")} className={`p-2 text-center ${rosterFilter === "online" ? "bg-primary/[0.06]" : ""}`}><span className="block font-mono text-[10px] font-semibold text-primary">{onlineRoster.length}</span><span className="mt-0.5 block text-[5px] uppercase tracking-[0.1em] text-muted">Online</span></button>
                    <button type="button" onClick={() => setRosterFilter("inactive")} className={`p-2 text-center ${rosterFilter === "inactive" ? "bg-primary/[0.06]" : ""}`}><span className="block font-mono text-[10px] font-semibold text-muted">{inactiveRoster.length}</span><span className="mt-0.5 block text-[5px] uppercase tracking-[0.1em] text-muted">Inactive</span></button>
                  </div>
                  <KwantSelect value={rosterFilter} onChange={(event) => setRosterFilter(event.target.value as typeof rosterFilter)} className="mt-2 h-8 w-full rounded-xl border border-border bg-background px-2 text-[7px] outline-none">
                    <option value="all">All users · {roster.length}</option>
                    <option value="online">Online · {onlineRoster.length}</option>
                    <option value="offline">Offline · {offlineRoster.length}</option>
                    <option value="inactive">Inactive · {inactiveRoster.length}</option>
                  </KwantSelect>
                  <div className="mt-2 space-y-1">
                    {visibleRoster.slice(0, 12).map(({ member, profile, inactive }) => {
                      const presence = presenceOption(memberPresenceStatus(profile));
                      return (
                        <button key={member.userId} type="button" onClick={() => openMemberCard(member.userId)} className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50">
                          <ProfileAvatar profile={profile} size="sm" />
                          <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-1"><span className="truncate text-[7px] font-semibold group-hover:text-primary">{profile.displayName}</span><ActivityStreakBadge streak={profile.activityStreak} compact /></span><MemberRoleBadge member={member} compact /></span>
                          <span className="text-[5px] uppercase tracking-[0.08em] text-muted">{inactive ? "Inactive" : presence.label}</span>
                          <MoreHorizontal className="h-3 w-3 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      );
                    })}
                    {!visibleRoster.length ? <div className="rounded-xl border border-dashed border-border p-4 text-center text-[6px] text-muted">No users in this status.</div> : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4"><div className="flex items-center gap-2 text-[8px] font-semibold"><Trophy className="h-3.5 w-3.5 text-primary" />Overall Desk rankings</div><div className="mt-3 space-y-1.5">{workspaceScores.slice(0, 10).map((entry, index) => <button key={entry.workspace.deskId} type="button" onClick={() => { if (memberDeskIds.has(entry.workspace.deskId)) { setActiveDeskId(entry.workspace.deskId); setDiscovering(false); } }} className="flex w-full items-center gap-2 rounded-xl border border-border bg-panel p-2 text-left hover:border-primary/25"><span className="w-4 font-mono text-[7px] text-primary">{String(index + 1).padStart(2, "0")}</span><DeskMark workspace={entry.workspace} compact /><span className="min-w-0 flex-1 truncate text-[7px] font-semibold">{entry.workspace.name}</span><span className="font-mono text-[8px] text-primary">{entry.score || "—"}</span></button>)}</div></div>
            )}
          </aside>
        </div>
      </div>

      {selectedMember && selectedMemberProfile && activeDesk ? (
        <Modal
          title={selectedMemberProfile.displayName}
          subtitle={`@${selectedMemberProfile.handle} · ${activeDesk.name}`}
          icon={<UsersRound className="h-4 w-4" />}
          onClose={() => setSelectedMemberId("")}
          footer={(
            <>
              <button type="button" onClick={() => setSelectedMemberId("")} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted hover:text-foreground">Close</button>
              {owner ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMemberId("");
                    setShowMembers(true);
                  }}
                  className="flex h-9 items-center gap-2 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted hover:border-primary/25 hover:text-foreground"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Manage member
                </button>
              ) : null}
              {selectedMember.userId !== viewerId && onMessageProfile ? (
                <button
                  type="button"
                  onClick={messageSelectedMember}
                  className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.05] px-4 text-[8px] font-semibold text-primary hover:bg-primary/[0.09]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Message
                </button>
              ) : null}
              <button
                type="button"
                onClick={openSelectedMemberProfile}
                className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
              >
                View profile &amp; Gameplans
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        >
          <div className="relative overflow-hidden rounded-2xl border border-border bg-background/40 p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_45%)]" />
            <div className="relative flex items-center gap-4">
              <UserAvatar
                label={selectedMemberProfile.displayName}
                avatarUrl={selectedMemberProfile.avatarUrl}
                size="lg"
                statusClassName={selectedMemberPresence?.dotClassName}
                className="ring-1 ring-primary/20"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-[13px] font-semibold text-foreground">{selectedMemberProfile.displayName}</div>
                  <MemberRoleBadge member={selectedMember} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[7px] text-muted">
                  <span>@{selectedMemberProfile.handle}</span>
                  <span className="opacity-40">&middot;</span>
                  <span>{selectedMemberPresence?.label ?? "Offline"}</span>
                  <span className="opacity-40">&middot;</span>
                  <span>Active {formatDateTime(selectedMember.lastActiveAt)}</span>
                </div>
                {selectedMemberProfile.processStatus ? (
                  <div className="mt-2 text-[7px] font-semibold uppercase tracking-[0.1em] text-primary">{selectedMemberProfile.processStatus}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
              <div className="font-mono text-[14px] font-semibold text-primary">{selectedMemberRank ? `#${selectedMemberRank}` : "—"}</div>
              <div className="mt-1 text-[6px] uppercase tracking-[0.1em] text-muted">Desk rank</div>
            </div>
            <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
              <div className="font-mono text-[14px] font-semibold text-primary">{selectedMemberProfile.score || "—"}</div>
              <div className="mt-1 text-[6px] uppercase tracking-[0.1em] text-muted">Reasoning index</div>
            </div>
            <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
              <div className="font-mono text-[14px] font-semibold text-primary">T{selectedMember.importanceLevel}</div>
              <div className="mt-1 text-[6px] uppercase tracking-[0.1em] text-muted">Desk tier</div>
            </div>
          </div>

          {selectedMember.responsibilities ? (
            <div className="mt-3 rounded-xl border border-border bg-background/30 p-3">
              <div className="text-[6px] font-semibold uppercase tracking-[0.11em] text-muted">Desk responsibilities</div>
              <div className="mt-2 text-[8px] leading-5 text-foreground">{selectedMember.responsibilities}</div>
            </div>
          ) : null}

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-[7px] leading-5 text-muted">
            <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Open the full profile to see this user&apos;s published Gameplans, reasoning outcomes, activity and public trader identity.</span>
          </div>
        </Modal>
      ) : null}

      {showSettings && activeDesk ? (
        <DeskSettingsModal
          key={activeDesk.deskId}
          workspace={activeDesk}
          working={working}
          onClose={() => setShowSettings(false)}
          onSave={(draft) => void saveSettings(draft)}
          onLifecycle={openLifecycle}
          onNotice={onNotice}
        />
      ) : null}

      {showArchived ? (
        <Modal
          title="Archived Desks"
          subtitle="Only you can see these Desks. Restore one at any time or remove it permanently."
          icon={<Archive className="h-4 w-4" />}
          onClose={() => setShowArchived(false)}
        >
          {archivedWorkspaces.length ? (
            <div className="space-y-2">
              {archivedWorkspaces.map((workspace) => (
                <div key={workspace.deskId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/35 p-3 opacity-70 transition-opacity hover:opacity-100">
                  <DeskMark workspace={workspace} compact />
                  <div className="min-w-[160px] flex-1">
                    <div className="text-[9px] font-semibold text-foreground">{workspace.name}</div>
                    <div className="mt-1 text-[7px] text-muted">Archived {workspace.archivedAt ? formatDateTime(workspace.archivedAt) : "recently"} · hidden from every member</div>
                  </div>
                  <button type="button" onClick={() => void restoreDesk(workspace)} disabled={working} className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.05] px-3 text-[7px] font-semibold text-primary disabled:opacity-40"><ArchiveRestore className="h-3 w-3" />Restore</button>
                  <button type="button" onClick={() => openLifecycle("delete", workspace)} disabled={working} className="flex h-8 items-center gap-1.5 rounded-lg border border-danger/25 bg-danger/[0.04] px-3 text-[7px] font-semibold text-danger disabled:opacity-40"><Trash2 className="h-3 w-3" />Delete</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Archive className="mx-auto h-6 w-6 text-muted" />
              <div className="mt-3 text-[10px] font-semibold text-foreground">No archived Desks</div>
              <div className="mt-1 text-[8px] text-muted">Desks you archive will remain recoverable here.</div>
            </div>
          )}
        </Modal>
      ) : null}

      {lifecycleTarget ? (
        <Modal
          title={lifecycleTarget.action === "archive" ? `Archive ${lifecycleTarget.workspace.name}?` : `Delete ${lifecycleTarget.workspace.name}?`}
          subtitle={lifecycleTarget.action === "archive" ? "This is reversible and keeps the complete Desk record." : "This cannot be undone."}
          icon={lifecycleTarget.action === "archive" ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4 text-danger" />}
          onClose={() => { setLifecycleTarget(null); setDeleteConfirmation(""); }}
          footer={(
            <>
              <button type="button" onClick={() => { setLifecycleTarget(null); setDeleteConfirmation(""); }} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button>
              {lifecycleTarget.action === "archive" ? (
                <button type="button" onClick={() => void archiveDesk()} disabled={working} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-40"><Archive className="h-3.5 w-3.5" />Archive Desk</button>
              ) : (
                <button type="button" onClick={() => void deleteDesk()} disabled={Boolean(deletingDeskId) || !deleteConfirmationMatches} className="flex h-9 items-center gap-2 rounded-xl bg-danger px-4 text-[8px] font-semibold text-white transition-all enabled:shadow-[0_0_18px_color-mix(in_srgb,var(--color-danger)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5" />Delete forever</button>
              )}
            </>
          )}
        >
          {lifecycleTarget.action === "archive" ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 text-[8px] leading-5 text-muted">
              <span className="font-semibold text-foreground">{lifecycleTarget.workspace.name}</span> will disappear from member sidebars, Desk discovery, rankings and live channels. Its complete history remains intact in your Archived Desks.
            </div>
          ) : (
            <div>
              <div className="rounded-2xl border border-danger/25 bg-danger/[0.04] p-4 text-[8px] leading-5 text-muted">
                Permanent deletion removes the Desk, every channel, message, reaction, member and pending invitation. This record cannot be restored.
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Enter <span className="font-semibold text-danger">{lifecycleTarget.workspace.name}</span> to confirm</span>
                <input
                  autoFocus
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && deleteConfirmationMatches && !working) {
                      event.preventDefault();
                      void deleteDesk();
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={lifecycleTarget.workspace.name}
                  className={`h-11 w-full rounded-xl border bg-background px-3 text-[9px] text-foreground outline-none transition-colors ${deleteConfirmationMatches ? "border-primary/55" : "border-danger/25 focus:border-danger/55"}`}
                />
                <span className={`mt-1.5 flex items-center gap-1.5 text-[7px] ${deleteConfirmationMatches ? "text-primary" : "text-muted"}`}>
                  {deleteConfirmationMatches ? <Check className="h-3 w-3" /> : null}
                  {deleteConfirmationMatches ? "Desk name confirmed — deletion is enabled." : deleteConfirmation ? "That does not match the Desk name yet." : "Capitalisation, punctuation and surrounding spaces are ignored."}
                </span>
              </label>
            </div>
          )}
        </Modal>
      ) : null}

      {showMembers && activeDesk ? (
        <Modal title={`${activeDesk.name} members`} subtitle="Roles, activity and membership controls." icon={<UsersRound className="h-4 w-4" />} onClose={() => setShowMembers(false)} wide>
          <div className="space-y-2">
            {memberLeaderboard.map((member, index) => {
              const profile = profileFor(member.userId);
              const canRemove = member.role !== "owner" && (member.userId === viewerId || owner || (activeMembership?.role === "moderator" && member.role === "member"));
              const presence = presenceOption(memberPresenceStatus(profile));
              return (
                <div key={member.userId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/30 p-3">
                  <span className="w-5 font-mono text-[8px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                  <button type="button" onClick={() => openMemberCard(member.userId, true)} className="rounded-full outline-none ring-primary/50 focus-visible:ring-2" title={`Open ${profile.displayName}`}>
                    <ProfileAvatar profile={profile} />
                  </button>
                  <div className="min-w-[180px] flex-1">
                    <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => openMemberCard(member.userId, true)} className="text-[9px] font-semibold hover:text-primary">{profile.displayName}</button><MemberRoleBadge member={member} /><span title={presence.label} className={`h-1.5 w-1.5 rounded-full ${presence.dotClassName}`} /></div>
                    <div className="mt-1 text-[7px] text-muted">@{profile.handle} · active {formatDateTime(member.lastActiveAt)}</div>
                    {member.responsibilities ? <div className="mt-1.5 max-w-xl text-[7px] leading-4 text-muted">{member.responsibilities}</div> : null}
                  </div>
                  <div className="min-w-20"><div className="font-mono text-[11px] font-semibold text-primary">{profile.score || "—"}</div><div className="text-[6px] uppercase tracking-[0.1em] text-muted">Index</div></div>
                  {owner ? <MemberRoleControl member={member} profile={profile} working={working} rolesReady={network.memberRolesReady} onSave={(draft) => perform({ action: "update-member-role", deskId: activeDesk.deskId, userId: member.userId, ...draft }, `${profile.displayName}'s Desk role was updated.`)} /> : <MemberRoleBadge member={member} />}
                  {canRemove ? <button type="button" onClick={() => void perform({ action: "remove-member", deskId: activeDesk.deskId, userId: member.userId }, member.userId === viewerId ? `You left ${activeDesk.name}.` : `${profile.displayName} was removed.`)} className="flex h-8 items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/[0.04] px-2.5 text-[7px] text-danger">{member.userId === viewerId ? <DoorOpen className="h-3 w-3" /> : <UserMinus className="h-3 w-3" />}{member.userId === viewerId ? "Leave" : "Remove"}</button> : null}
                </div>
              );
            })}
          </div>
          {owner ? <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-[7px] leading-4 text-muted"><Crown className="mr-2 inline h-3.5 w-3.5 text-primary" />Permission levels control access. Visible Desk roles, colours, icons, tiers and responsibilities communicate identity without silently granting power.</div> : null}
        </Modal>
      ) : null}

      {showCategory && activeDesk ? (
        <Modal title={categoryEditor.categoryId ? `Edit ${categoryEditor.name}` : "Create category"} subtitle="Categories organise channels and can supply one permission policy to everything inside." icon={<FolderPlus className="h-4 w-4" />} onClose={() => setShowCategory(false)} wide footer={<><button type="button" onClick={() => setShowCategory(false)} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button>{categoryEditor.categoryId ? <button type="button" onClick={async () => { const deleted = await perform({ action: "delete-category", deskId: activeDesk.deskId, categoryId: categoryEditor.categoryId }, "Category and its channels were removed."); if (deleted) { setShowCategory(false); setActiveChannelId(""); } }} className="mr-auto flex h-9 items-center gap-2 rounded-xl border border-danger/20 px-4 text-[8px] font-semibold text-danger"><Archive className="h-3.5 w-3.5" />Delete category</button> : null}<button type="button" onClick={() => void saveCategory()} disabled={!categoryEditor.name.trim() || working} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50"><Check className="h-3.5 w-3.5" />Save category</button></>}>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Category name</span><input value={categoryEditor.name} onChange={(event) => setCategoryEditor((current) => ({ ...current, name: event.target.value }))} placeholder="New York session" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
            <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Description</span><input value={categoryEditor.description} onChange={(event) => setCategoryEditor((current) => ({ ...current, description: event.target.value }))} placeholder="Shared permissions for this group" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
            <Toggle checked={categoryEditor.isPrivate} onChange={(checked) => setCategoryEditor((current) => ({ ...current, isPrivate: checked }))} label="Private category" detail="Hidden from members who are not explicitly selected." />
            <Toggle checked={categoryEditor.showHistory} onChange={(checked) => setCategoryEditor((current) => ({ ...current, showHistory: checked }))} label="Show previous messages" detail="The default history policy for synced channels." />
            <Toggle checked={categoryEditor.readOnly} onChange={(checked) => setCategoryEditor((current) => ({ ...current, readOnly: checked, reactionOnly: checked ? false : current.reactionOnly }))} label="Read only" detail="The default posting policy for synced channels." />
            <Toggle checked={categoryEditor.reactionOnly} onChange={(checked) => setCategoryEditor((current) => ({ ...current, reactionOnly: checked, readOnly: checked ? false : current.readOnly }))} label="Reaction only" detail="Members can react but cannot send text in synced channels." />
          </div>
          {categoryEditor.isPrivate ? (
            <div className="mt-5">
              <div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">Category access</div>
              <p className="mt-1 text-[7px] text-muted">Owners and moderators retain access. Synced private channels inherit this member list.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">{activeMembers.filter((member) => member.role === "member").map((member) => { const profile = profileFor(member.userId); const selected = categoryEditor.allowedUserIds.includes(member.userId); return <button type="button" key={member.userId} onClick={() => setCategoryEditor((current) => ({ ...current, allowedUserIds: selected ? current.allowedUserIds.filter((id) => id !== member.userId) : [...current.allowedUserIds, member.userId] }))} className={`flex items-center gap-2 rounded-xl border p-2.5 text-left ${selected ? "border-primary/35 bg-primary/[0.06]" : "border-border bg-background/30"}`}><ProfileAvatar profile={profile} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-[8px] font-semibold">{profile.displayName}</span><span className="block text-[6px] text-muted">@{profile.handle}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-background" : "border-border"}`}>{selected ? <Check className="h-3 w-3" /> : null}</span></button>; })}</div>
            </div>
          ) : null}
          {categoryEditor.categoryId ? <div className="mt-5 rounded-xl border border-warning/20 bg-warning/[0.04] p-3 text-[7px] leading-4 text-muted">Deleting a category also deletes every channel and message inside it. Moving a channel first keeps that channel.</div> : null}
        </Modal>
      ) : null}

      {showChannel && activeDesk ? (
        <Modal title={channelEditor.channelId ? `Edit #${channelEditor.name}` : "Create Desk channel"} subtitle="Every channel belongs to a category. Inherit its permissions or set a deliberate exception." icon={channelEditor.channelType === "voice" ? <Mic2 className="h-4 w-4" /> : <Hash className="h-4 w-4" />} onClose={() => setShowChannel(false)} wide footer={<><button type="button" onClick={() => setShowChannel(false)} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button>{channelEditor.channelId ? <button type="button" onClick={async () => { const deleted = await perform({ action: "delete-channel", deskId: activeDesk.deskId, channelId: channelEditor.channelId }, "Channel removed."); if (deleted) setShowChannel(false); }} className="mr-auto flex h-9 items-center gap-2 rounded-xl border border-danger/20 px-4 text-[8px] font-semibold text-danger"><Archive className="h-3.5 w-3.5" />Delete</button> : null}<button type="button" onClick={() => void saveChannel()} disabled={!channelEditor.name.trim() || !channelEditor.categoryId || working} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50"><Check className="h-3.5 w-3.5" />Save channel</button></>}>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Channel name</span><input value={channelEditor.name} onChange={(event) => setChannelEditor((current) => ({ ...current, name: event.target.value }))} placeholder="market-structure" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
            <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Channel type</span><KwantSelect value={channelEditor.channelType} onChange={(event) => setChannelEditor((current) => ({ ...current, channelType: event.target.value as "text" | "voice" }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none"><option value="text">Text channel</option><option value="voice">Voice · structure now, audio later</option></KwantSelect></label>
            <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Category</span><KwantSelect value={channelEditor.categoryId} onChange={(event) => setChannelEditor((current) => ({ ...current, categoryId: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none"><option value="">Select a category</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</KwantSelect><span className="mt-1.5 block text-[6px] text-muted">Changing this moves the channel and its message history into another category.</span></label>
            <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Description</span><input value={channelEditor.description} onChange={(event) => setChannelEditor((current) => ({ ...current, description: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
            <div className="md:col-span-2"><Toggle checked={channelEditor.syncPermissions} onChange={(checked) => setChannelEditor((current) => ({ ...current, syncPermissions: checked }))} label="Sync category permissions" detail="Future category permission changes automatically apply to this channel." /></div>
            {!channelEditor.syncPermissions ? <>
              <Toggle checked={channelEditor.isPrivate} onChange={(checked) => setChannelEditor((current) => ({ ...current, isPrivate: checked }))} label="Private · invitation only" detail="Hidden completely from members who are not explicitly selected." />
              <Toggle checked={channelEditor.showHistory} onChange={(checked) => setChannelEditor((current) => ({ ...current, showHistory: checked }))} label="Show previous messages" detail="When off, new members only see messages sent after they joined." />
              <Toggle checked={channelEditor.readOnly} onChange={(checked) => setChannelEditor((current) => ({ ...current, readOnly: checked, reactionOnly: checked ? false : current.reactionOnly }))} label="Read only" detail="Only owners and moderators can publish." />
              <Toggle checked={channelEditor.reactionOnly} onChange={(checked) => setChannelEditor((current) => ({ ...current, reactionOnly: checked, readOnly: checked ? false : current.readOnly }))} label="Reaction only" detail="Members can react to existing posts but cannot send text." />
            </> : <div className="md:col-span-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-[7px] leading-4 text-muted"><ShieldCheck className="mr-2 inline h-3.5 w-3.5 text-primary" />This channel follows its category visibility, history and posting rules. Turn sync off to customise only this channel.</div>}
          </div>
          {!channelEditor.syncPermissions && channelEditor.isPrivate ? (
            <div className="mt-5">
              <div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">Private channel access</div>
              <p className="mt-1 text-[7px] text-muted">Owners and moderators always retain access. Selected members cannot request their own way in.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">{activeMembers.filter((member) => member.role === "member").map((member) => { const profile = profileFor(member.userId); const selected = channelEditor.allowedUserIds.includes(member.userId); return <button type="button" key={member.userId} onClick={() => setChannelEditor((current) => ({ ...current, allowedUserIds: selected ? current.allowedUserIds.filter((id) => id !== member.userId) : [...current.allowedUserIds, member.userId] }))} className={`flex items-center gap-2 rounded-xl border p-2.5 text-left ${selected ? "border-primary/35 bg-primary/[0.06]" : "border-border bg-background/30"}`}><ProfileAvatar profile={profile} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-[8px] font-semibold">{profile.displayName}</span><span className="block text-[6px] text-muted">@{profile.handle}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-background" : "border-border"}`}>{selected ? <Check className="h-3 w-3" /> : null}</span></button>; })}</div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {imagePreview ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/90 p-5 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setImagePreview(null); }}>
          <button type="button" onClick={() => setImagePreview(null)} className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/50 text-white"><X className="h-4 w-4" /></button>
          <a href={imagePreview.dataUrl} download={imagePreview.name} className="absolute right-20 top-5 flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-3 text-[8px] text-white"><ImageIcon className="h-3.5 w-3.5" />Download</a>
          <img src={imagePreview.dataUrl} alt={imagePreview.name} className="max-h-[88dvh] max-w-[92vw] rounded-2xl object-contain shadow-2xl" />
        </div>
      ) : null}
    </>
  );
}
