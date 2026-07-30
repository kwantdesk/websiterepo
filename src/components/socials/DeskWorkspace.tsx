"use client";

import {
  Activity,
  Archive,
  BellRing,
  Check,
  ChevronDown,
  Crown,
  DoorOpen,
  Gauge,
  Globe2,
  Hash,
  Image as ImageIcon,
  LockKeyhole,
  MessageCircle,
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
  Trophy,
  Upload,
  UserMinus,
  UserPlus,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import KwantSelect from "@/components/ui/KwantSelect";
import UserAvatar from "@/components/socials/UserAvatar";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase";
import {
  DESK_CREATED_EVENT,
  EMPTY_DESK_NETWORK,
  type CreatedDeskPayload,
  type DeskChannel,
  type DeskMember,
  type DeskMemberProfile,
  type DeskMessageAttachment,
  type DeskNetworkPayload,
  type DeskPrivacy,
  type DeskRole,
  type DeskWorkspace as DeskWorkspaceModel,
} from "@/lib/desks";
import { type SocialProfilePayload } from "@/lib/socials";
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
  name: string;
  description: string;
  channelType: "text" | "voice";
  isPrivate: boolean;
  readOnly: boolean;
  reactionOnly: boolean;
  showHistory: boolean;
  allowedUserIds: string[];
};

const REACTIONS = ["👍", "🔥", "🎯", "🧠", "✅"];

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

function emptyChannelDraft(): ChannelDraft {
  return {
    channelId: "",
    name: "",
    description: "",
    channelType: "text",
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
    name: channel.name,
    description: channel.description,
    channelType: channel.channelType,
    isPrivate: channel.isPrivate,
    readOnly: channel.readOnly,
    reactionOnly: channel.reactionOnly,
    showHistory: channel.showHistory,
    allowedUserIds: channel.allowedUserIds,
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
  return <UserAvatar label={profile.displayName} avatarUrl={profile.avatarUrl} size={size} active={profile.processStatus !== "AWAY"} />;
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

export default function DeskWorkspace({
  viewerId,
  viewerProfile,
  onCreateDesk,
  onNotice,
}: DeskWorkspaceProps) {
  const [network, setNetwork] = useState<DeskNetworkPayload>(EMPTY_DESK_NETWORK);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [activeDeskId, setActiveDeskId] = useState("");
  const [activeChannelId, setActiveChannelId] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showChannel, setShowChannel] = useState(false);
  const [settings, setSettings] = useState<WorkspaceDraft | null>(null);
  const [channelEditor, setChannelEditor] = useState<ChannelDraft>(emptyChannelDraft);
  const [inviteHandle, setInviteHandle] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<DeskMessageAttachment | null>(null);
  const [imagePreview, setImagePreview] = useState<DeskMessageAttachment | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const settingsAvatarRef = useRef<HTMLInputElement>(null);
  const selectedDeskRef = useRef("");
  const refreshTimerRef = useRef<number | null>(null);
  const suppressRefreshUntilRef = useRef(0);

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
          },
          ...current.profiles.filter((profile) => profile.userId !== viewerId),
        ],
      }));
      setDiscovering(false);
      setActiveDeskId(created.workspace.deskId);
      setActiveChannelId(created.channels.find((channel) => channel.name === "general")?.id ?? created.channels[0]?.id ?? "");
    };
    window.addEventListener(DESK_CREATED_EVENT, handleDeskCreated);
    return () => window.removeEventListener(DESK_CREATED_EVENT, handleDeskCreated);
  }, [viewerId, viewerProfile]);

  const viewerMemberships = useMemo(
    () => network.members.filter((member) => member.userId === viewerId),
    [network.members, viewerId],
  );
  const memberDeskIds = useMemo(() => new Set(viewerMemberships.map((member) => member.deskId)), [viewerMemberships]);
  const myWorkspaces = useMemo(
    () => network.workspaces.filter((workspace) => memberDeskIds.has(workspace.deskId)),
    [memberDeskIds, network.workspaces],
  );
  const activeDesk = network.workspaces.find((workspace) => workspace.deskId === activeDeskId) ?? null;
  const activeMembership = viewerMemberships.find((member) => member.deskId === activeDeskId) ?? null;
  const leader = activeMembership?.role === "owner" || activeMembership?.role === "moderator";
  const owner = activeMembership?.role === "owner";
  const canInvite = Boolean(activeDesk && activeMembership && (leader || activeDesk.allowMemberInvites));
  const activeMembers = network.members.filter((member) => member.deskId === activeDeskId);
  const activeChannels = network.channels
    .filter((channel) => channel.deskId === activeDeskId)
    .sort((left, right) => left.position - right.position);
  const activeChannel = activeChannels.find((channel) => channel.id === activeChannelId) ?? activeChannels.find((channel) => channel.channelType === "text") ?? null;
  const channelMessages = network.messages.filter((entry) => entry.channelId === activeChannel?.id);
  const activeFocusLock = (network.focusLocks ?? []).find((lock) => lock.deskId === activeDeskId) ?? null;
  const canReleaseFocus = Boolean(activeFocusLock && (
    activeFocusLock.lockedBy === viewerId
    || leader
  ));

  const profileMap = useMemo(() => new Map(network.profiles.map((profile) => [profile.userId, profile])), [network.profiles]);
  const profileFor = useCallback((userId: string): DeskMemberProfile => profileMap.get(userId) ?? {
    userId,
    displayName: userId === viewerId ? viewerProfile.displayName : "Kwant Trader",
    handle: userId === viewerId ? viewerProfile.handle : "trader",
    avatarUrl: userId === viewerId ? viewerProfile.avatarUrl || "" : "",
    processStatus: userId === viewerId ? viewerProfile.processStatus : "AWAY",
    score: userId === viewerId ? Math.round(Object.values(viewerProfile.scores).reduce((sum, value) => sum + value, 0) / Math.max(1, Object.values(viewerProfile.scores).length)) : 0,
    lastSeenAt: null,
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
    if (!activeChannels.length) {
      setActiveChannelId("");
      return;
    }
    if (!activeChannels.some((channel) => channel.id === activeChannelId)) {
      setActiveChannelId(activeChannels.find((channel) => channel.name === "general")?.id ?? activeChannels[0].id);
    }
  }, [activeChannelId, activeChannels]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [channelMessages.length, activeChannel?.id]);

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
    setSettings(workspaceDraft(activeDesk));
    setShowSettings(true);
  };

  const saveSettings = async () => {
    if (!activeDesk || !settings) return;
    const saved = await perform({
      action: "update-settings",
      deskId: activeDesk.deskId,
      ...settings,
      markets: settings.markets.split(",").map((market) => market.trim().toUpperCase()).filter(Boolean),
      inactivityDays: settings.inactivityDays || null,
    }, "Desk settings saved.");
    if (saved) setShowSettings(false);
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

  const sendInvite = async () => {
    if (!activeDesk || !inviteHandle.trim()) return;
    const saved = await perform({
      action: "invite",
      deskId: activeDesk.deskId,
      handle: inviteHandle,
    }, `Invitation sent to @${inviteHandle.replace(/^@/, "")}.`);
    if (saved) {
      setInviteHandle("");
      setShowInvite(false);
    }
  };

  const openChannelEditor = (channel?: DeskChannel) => {
    setChannelEditor(channel ? channelDraft(channel) : emptyChannelDraft());
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
        : (activeChannels.at(-1)?.position ?? 0) + 10,
    }, channelEditor.channelId ? "Channel settings saved." : "Channel created.");
    if (saved) setShowChannel(false);
  };

  const sendMessage = async () => {
    if (!activeDesk || !activeChannel || (!message.trim() && !attachment) || working) return;
    if (activeFocusLock) {
      onNotice("This Desk is in trading focus mode. Messages are paused.");
      return;
    }
    const draftMessage = message;
    const draftAttachment = attachment;
    setMessage("");
    setAttachment(null);
    const saved = await perform({
      action: "send-message",
      deskId: activeDesk.deskId,
      channelId: activeChannel.id,
      message: draftMessage,
      attachments: draftAttachment ? [draftAttachment] : [],
    });
    if (!saved) {
      setMessage(draftMessage);
      setAttachment(draftAttachment);
    }
  };

  const handleMessageKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const loadAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 950_000) {
      onNotice("Desk images must be PNG, JPEG, WebP or GIF and no larger than 950 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setAttachment({
        id: `image:${crypto.randomUUID()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.readAsDataURL(file);
  };

  const loadDeskAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !settings) return;
    if (!file.type.startsWith("image/") || file.size > 950_000) {
      onNotice("Desk images must be under 950 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSettings((current) => current ? { ...current, avatarUrl: reader.result as string } : current);
    };
    reader.readAsDataURL(file);
  };

  const teamScores = activeMembers.map((member) => profileFor(member.userId).score).filter((score) => score > 0);
  const teamScore = teamScores.length ? Math.round(teamScores.reduce((sum, score) => sum + score, 0) / teamScores.length) : 0;
  const activeCutoff = Date.now() - 7 * 86_400_000;
  const activeThisWeek = activeMembers.filter((member) => Date.parse(member.lastActiveAt) >= activeCutoff).length;
  const participation = activeMembers.length ? Math.round(activeThisWeek / activeMembers.length * 100) : 0;
  const memberLeaderboard = [...activeMembers].sort((left, right) => profileFor(right.userId).score - profileFor(left.userId).score);
  const workspaceScores = network.workspaces.map((workspace) => {
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
  const available = network.workspaces.filter((workspace) => !memberDeskIds.has(workspace.deskId));
  const filteredAvailable = available.filter((workspace) => {
    const query = directoryQuery.trim().toLowerCase();
    return !query || [workspace.name, workspace.description, workspace.objective, workspace.markets.join(" ")].some((value) => value.toLowerCase().includes(query));
  });

  if (loading && !network.ready) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-3xl border border-border bg-panel">
        <div className="text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /><div className="mt-3 text-[9px] font-semibold">Opening your Desks</div><div className="mt-1 text-[7px] text-muted">Loading memberships, channels and permissions.</div></div>
      </div>
    );
  }

  if (!network.ready) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-3xl border border-border bg-panel p-6">
        <div className="max-w-lg text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Network className="h-5 w-5" /></span>
          <h2 className="mt-4 text-[15px] font-semibold">Multi-Desk storage is ready to connect</h2>
          <p className="mt-2 text-[8px] leading-5 text-muted">Apply migration <span className="font-mono text-foreground">202607300004_create_multi_desk_workspaces.sql</span> in Supabase. It preserves the Desk you already made and upgrades it with roles, channels, requests and chat history.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-border bg-panel shadow-[0_18px_70px_rgba(0,0,0,0.2)]">
        <div className="grid min-h-[680px] xl:h-[calc(100dvh-150px)] xl:min-h-[680px] xl:grid-cols-[68px_224px_minmax(0,1fr)] 2xl:grid-cols-[68px_224px_minmax(0,1fr)_286px]">
          <aside className="flex items-center gap-2 overflow-x-auto border-b border-border bg-background/65 p-2 xl:flex-col xl:overflow-x-visible xl:border-b-0 xl:border-r">
            <button type="button" onClick={() => { setDiscovering(false); if (myWorkspaces[0]) setActiveDeskId(myWorkspaces[0].deskId); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_12%,transparent)]" title="My Desks"><Network className="h-4 w-4" /></button>
            <span className="hidden h-px w-8 bg-border xl:block" />
            {myWorkspaces.map((workspace) => (
              <button key={workspace.deskId} type="button" onClick={() => { setActiveDeskId(workspace.deskId); setDiscovering(false); }} title={workspace.name}>
                <DeskMark workspace={workspace} active={!discovering && activeDeskId === workspace.deskId} />
              </button>
            ))}
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
                    <button type="button" onClick={() => setShowInvite(true)} disabled={!canInvite} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.05] text-[7px] font-semibold text-primary disabled:opacity-35"><UserPlus className="h-3 w-3" />Invite</button>
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
                  <div className="mb-2 flex items-center justify-between px-1.5"><span className="text-[6px] font-semibold uppercase tracking-[0.14em] text-muted">Text channels</span>{leader ? <button type="button" onClick={() => openChannelEditor()} className="text-muted hover:text-primary"><Plus className="h-3 w-3" /></button> : null}</div>
                  <div className="space-y-0.5">
                    {activeChannels.filter((channel) => channel.channelType === "text").map((channel) => (
                      <button key={channel.id} type="button" onClick={() => setActiveChannelId(channel.id)} className={`group flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left transition-colors ${activeChannel?.id === channel.id ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface/55 hover:text-foreground"}`}>
                        {channel.isPrivate ? <LockKeyhole className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
                        <span className="min-w-0 flex-1 truncate text-[8px] font-semibold">{channel.name}</span>
                        {channel.readOnly ? <ShieldCheck className="h-3 w-3 opacity-55" /> : null}
                        {leader ? <span onClick={(event) => { event.stopPropagation(); openChannelEditor(channel); }} className="hidden h-6 w-6 items-center justify-center rounded-md hover:bg-background group-hover:flex"><MoreHorizontal className="h-3 w-3" /></span> : null}
                      </button>
                    ))}
                  </div>
                  <div className="mb-2 mt-5 flex items-center justify-between px-1.5"><span className="text-[6px] font-semibold uppercase tracking-[0.14em] text-muted">Voice · later</span>{leader ? <button type="button" onClick={() => { const draft = emptyChannelDraft(); setChannelEditor({ ...draft, channelType: "voice" }); setShowChannel(true); }} className="text-muted hover:text-primary"><Plus className="h-3 w-3" /></button> : null}</div>
                  <div className="space-y-0.5">
                    {activeChannels.filter((channel) => channel.channelType === "voice").map((channel) => (
                      <button key={channel.id} type="button" onClick={() => setActiveChannelId(channel.id)} className={`flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left ${activeChannel?.id === channel.id ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface/55 hover:text-foreground"}`}>
                        <Mic2 className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate text-[8px] font-semibold">{channel.name}</span><span className="rounded-md border border-border px-1.5 py-0.5 text-[5px] uppercase tracking-[0.1em]">Soon</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border p-3">
                  <div className="rounded-xl border border-border bg-surface/30 p-2.5">
                    <div className="flex items-center gap-2"><ProfileAvatar profile={profileFor(viewerId)} size="sm" /><div className="min-w-0 flex-1"><div className="truncate text-[8px] font-semibold">{profileFor(viewerId).displayName}</div><div className="text-[6px] capitalize text-primary">{roleLabel(activeMembership?.role ?? "member")}</div></div><span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" /></div>
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
                  <button type="button" onClick={() => setShowInvite(true)} disabled={!canInvite} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted disabled:opacity-30"><UserPlus className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setShowMembers(true)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted"><UsersRound className="h-3.5 w-3.5" /></button>
                  {owner ? <button type="button" onClick={openSettings} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted"><Settings2 className="h-3.5 w-3.5" /></button> : null}
                </div>
                <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
                  {activeChannels.map((channel) => (
                    <button key={channel.id} type="button" onClick={() => setActiveChannelId(channel.id)} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[7px] font-semibold ${activeChannel?.id === channel.id ? "bg-primary/10 text-primary" : "bg-surface/30 text-muted"}`}>
                      {channel.channelType === "voice" ? <Mic2 className="h-3 w-3" /> : channel.isPrivate ? <LockKeyhole className="h-3 w-3" /> : <Hash className="h-3 w-3" />}{channel.name}
                    </button>
                  ))}
                  {leader ? <button type="button" onClick={() => openChannelEditor()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-primary/30 text-primary"><Plus className="h-3 w-3" /></button> : null}
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
            ) : activeChannel?.channelType === "voice" ? (
              <div className="flex min-h-[520px] flex-1 items-center justify-center p-6 text-center"><div><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Mic2 className="h-6 w-6" /></span><h2 className="mt-4 text-[14px] font-semibold">{activeChannel.name}</h2><p className="mx-auto mt-2 max-w-sm text-[8px] leading-5 text-muted">Voice channels are structured in the Desk now, but live audio is intentionally reserved for the next release. No fake connection state.</p></div></div>
            ) : (
              <div className="flex min-h-[520px] flex-1 flex-col">
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
                        const previous = channelMessages[index - 1];
                        const grouped = previous?.senderUserId === entry.senderUserId && Date.parse(entry.createdAt) - Date.parse(previous.createdAt) < 300_000;
                        const reactionGroups = REACTIONS.map((emoji) => ({
                          emoji,
                          users: network.reactions.filter((reaction) => reaction.messageId === entry.id && reaction.emoji === emoji),
                        })).filter((group) => group.users.length);
                        return (
                          <div key={entry.id} className={`group relative flex gap-3 rounded-xl px-2 py-2 hover:bg-surface/25 ${grouped ? "mt-0" : "mt-3"}`}>
                            <div className="w-9 shrink-0">{grouped ? <span className="block pt-1 text-center text-[5px] text-muted opacity-0 group-hover:opacity-100">{formatTime(entry.createdAt)}</span> : <ProfileAvatar profile={profile} />}</div>
                            <div className="min-w-0 flex-1">
                              {!grouped ? <div className="flex items-baseline gap-2"><span className="text-[8px] font-semibold">{profile.displayName}</span><span className="text-[6px] text-muted">{formatDateTime(entry.createdAt)}</span></div> : null}
                              {entry.body ? <p className="mt-1 whitespace-pre-wrap break-words text-[8px] leading-4 text-foreground/90">{entry.body}</p> : null}
                              {entry.attachments.map((item) => <button key={item.id} type="button" onClick={() => setImagePreview(item)} className="mt-2 block max-w-sm overflow-hidden rounded-xl border border-border bg-background/40"><img src={item.dataUrl} alt={item.name} className="max-h-64 w-full object-contain" /></button>)}
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
                    <div className="flex items-end gap-2 rounded-2xl border border-border bg-panel p-2 focus-within:border-primary/35">
                      <button type="button" onClick={() => attachmentInputRef.current?.click()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-primary" title="Attach image"><Plus className="h-4 w-4" /></button>
                      <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={handleMessageKey} rows={1} placeholder={`Message #${activeChannel?.name ?? "desk"}`} className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-1 py-2 text-[8px] leading-4 outline-none placeholder:text-muted" />
                      <button type="button" onClick={() => void sendMessage()} disabled={working || (!message.trim() && !attachment)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-background disabled:opacity-35"><Send className="h-3.5 w-3.5" /></button>
                      <input ref={attachmentInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={loadAttachment} />
                    </div>
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
                      return <button type="button" key={member.userId} onClick={() => setShowMembers(true)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-surface/40"><span className={`w-4 font-mono text-[7px] ${index < 3 ? "text-primary" : "text-muted"}`}>{String(index + 1).padStart(2, "0")}</span><ProfileAvatar profile={profile} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-[7px] font-semibold">{profile.displayName}</span><span className="block text-[6px] text-muted">{roleLabel(member.role)}</span></span><span className="font-mono text-[8px] font-semibold text-primary">{profile.score || "—"}</span></button>;
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
              </div>
            ) : (
              <div className="p-4"><div className="flex items-center gap-2 text-[8px] font-semibold"><Trophy className="h-3.5 w-3.5 text-primary" />Overall Desk rankings</div><div className="mt-3 space-y-1.5">{workspaceScores.slice(0, 10).map((entry, index) => <button key={entry.workspace.deskId} type="button" onClick={() => { if (memberDeskIds.has(entry.workspace.deskId)) { setActiveDeskId(entry.workspace.deskId); setDiscovering(false); } }} className="flex w-full items-center gap-2 rounded-xl border border-border bg-panel p-2 text-left hover:border-primary/25"><span className="w-4 font-mono text-[7px] text-primary">{String(index + 1).padStart(2, "0")}</span><DeskMark workspace={entry.workspace} compact /><span className="min-w-0 flex-1 truncate text-[7px] font-semibold">{entry.workspace.name}</span><span className="font-mono text-[8px] text-primary">{entry.score || "—"}</span></button>)}</div></div>
            )}
          </aside>
        </div>
      </div>

      {showSettings && activeDesk && settings ? (
        <Modal
          title={`${activeDesk.name} settings`}
          subtitle="Owner controls for identity, access, standards and inactivity."
          icon={<Settings2 className="h-4 w-4" />}
          onClose={() => setShowSettings(false)}
          wide
          footer={<><button type="button" onClick={() => setShowSettings(false)} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button><button type="button" onClick={() => void saveSettings()} disabled={working} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50"><Check className="h-3.5 w-3.5" />Save Desk</button></>}
        >
          <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
            <div>
              <div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">Desk identity</div>
              <button type="button" onClick={() => settingsAvatarRef.current?.click()} className="mt-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-primary/30 bg-primary/[0.05] text-primary">
                {settings.avatarUrl ? <img src={settings.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-center"><Upload className="mx-auto h-5 w-5" /><span className="mt-2 block text-[7px]">Upload Desk image</span></span>}
              </button>
              <input ref={settingsAvatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={loadDeskAvatar} />
              {settings.avatarUrl ? <button type="button" onClick={() => setSettings((current) => current ? { ...current, avatarUrl: "" } : current)} className="mt-2 w-full text-center text-[7px] text-muted hover:text-danger">Remove image</button> : null}
              <label className="mt-4 block"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Desk accent</span><div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2"><input type="color" value={settings.accentColor} onChange={(event) => setSettings((current) => current ? { ...current, accentColor: event.target.value } : current)} className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent" /><span className="font-mono text-[8px] text-muted">{settings.accentColor}</span></div></label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Desk name</span><input value={settings.name} onChange={(event) => setSettings((current) => current ? { ...current, name: event.target.value } : current)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Privacy</span><KwantSelect value={settings.privacy} onChange={(event) => setSettings((current) => current ? { ...current, privacy: event.target.value as DeskPrivacy } : current)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none"><option value="PUBLIC">Public · instant join</option><option value="REQUEST">Request · owner approval</option><option value="PRIVATE">Private · invite only</option></KwantSelect></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Markets</span><input value={settings.markets} onChange={(event) => setSettings((current) => current ? { ...current, markets: event.target.value } : current)} placeholder="NQ, ES" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Capacity · 2–50</span><input type="number" min={2} max={50} value={settings.capacity} onChange={(event) => setSettings((current) => current ? { ...current, capacity: event.target.value } : current)} className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[8px] outline-none focus:border-primary/40" /></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Session</span><input value={settings.session} onChange={(event) => setSettings((current) => current ? { ...current, session: event.target.value } : current)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Timezone</span><input value={settings.timezone} onChange={(event) => setSettings((current) => current ? { ...current, timezone: event.target.value } : current)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Description</span><textarea value={settings.description} onChange={(event) => setSettings((current) => current ? { ...current, description: event.target.value } : current)} rows={2} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] outline-none focus:border-primary/40" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Shared objective</span><textarea value={settings.objective} onChange={(event) => setSettings((current) => current ? { ...current, objective: event.target.value } : current)} rows={2} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] outline-none focus:border-primary/40" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Weekly mission</span><textarea value={settings.weeklyMission} onChange={(event) => setSettings((current) => current ? { ...current, weeklyMission: event.target.value } : current)} rows={2} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] outline-none focus:border-primary/40" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Desk rules</span><textarea value={settings.rules} onChange={(event) => setSettings((current) => current ? { ...current, rules: event.target.value } : current)} rows={5} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[8px] leading-4 outline-none focus:border-primary/40" /></label>
              <div className="md:col-span-2 grid gap-2 md:grid-cols-2">
                <Toggle checked={settings.allowMemberInvites} onChange={(checked) => setSettings((current) => current ? { ...current, allowMemberInvites: checked } : current)} label="Member invitations" detail="Allow ordinary members to invite people they already know." />
                <label className="rounded-xl border border-border bg-background/35 p-3"><span className="block text-[8px] font-semibold">Inactive member automation</span><span className="mt-0.5 block text-[7px] leading-3 text-muted">Non-owners are removed after this many inactive days. Leave blank to disable.</span><input type="number" min={7} max={365} value={settings.inactivityDays} onChange={(event) => setSettings((current) => current ? { ...current, inactivityDays: event.target.value } : current)} placeholder="Disabled" className="mt-2 h-8 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[8px] outline-none focus:border-primary/40" /></label>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {showInvite && activeDesk ? (
        <Modal title={`Invite to ${activeDesk.name}`} subtitle="Invite a trader by their unique Kwant handle." icon={<UserPlus className="h-4 w-4" />} onClose={() => setShowInvite(false)} footer={<><button type="button" onClick={() => setShowInvite(false)} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button><button type="button" onClick={() => void sendInvite()} disabled={!inviteHandle.trim() || working} className="h-9 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50">Send invitation</button></>}>
          <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Trader handle</span><div className="flex h-11 items-center rounded-xl border border-border bg-background px-3 focus-within:border-primary/40"><span className="text-[9px] text-muted">@</span><input autoFocus value={inviteHandle} onChange={(event) => setInviteHandle(event.target.value.replace(/^@/, ""))} onKeyDown={(event) => { if (event.key === "Enter") void sendInvite(); }} placeholder="trader_handle" className="h-full flex-1 bg-transparent px-1 text-[9px] outline-none" /></div></label>
          <div className="mt-3 rounded-xl border border-border bg-background/30 p-3 text-[7px] leading-4 text-muted">{activeDesk.privacy === "PRIVATE" ? "Private Desk invitations are the only route in. The trader must accept before channels become visible." : "The trader receives an invitation they can accept or decline from the Desk directory."}</div>
        </Modal>
      ) : null}

      {showMembers && activeDesk ? (
        <Modal title={`${activeDesk.name} members`} subtitle="Roles, activity and membership controls." icon={<UsersRound className="h-4 w-4" />} onClose={() => setShowMembers(false)} wide>
          <div className="space-y-2">
            {memberLeaderboard.map((member, index) => {
              const profile = profileFor(member.userId);
              const canRemove = member.role !== "owner" && (member.userId === viewerId || owner || (activeMembership?.role === "moderator" && member.role === "member"));
              return (
                <div key={member.userId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/30 p-3">
                  <span className="w-5 font-mono text-[8px] text-muted">{String(index + 1).padStart(2, "0")}</span><ProfileAvatar profile={profile} /><div className="min-w-[150px] flex-1"><div className="flex items-center gap-2"><span className="text-[9px] font-semibold">{profile.displayName}</span>{member.role === "owner" ? <Crown className="h-3 w-3 text-primary" /> : member.role === "moderator" ? <ShieldCheck className="h-3 w-3 text-primary" /> : null}</div><div className="mt-0.5 text-[7px] text-muted">@{profile.handle} · active {formatDateTime(member.lastActiveAt)}</div></div><div className="min-w-20"><div className="font-mono text-[11px] font-semibold text-primary">{profile.score || "—"}</div><div className="text-[6px] uppercase tracking-[0.1em] text-muted">Index</div></div>
                  {owner && member.role !== "owner" ? <KwantSelect value={member.role} onChange={(event) => void perform({ action: "change-role", deskId: activeDesk.deskId, userId: member.userId, role: event.target.value }, `${profile.displayName} is now a ${event.target.value}.`)} className="h-8 rounded-lg border border-border bg-panel px-2 text-[7px] outline-none"><option value="member">Member</option><option value="moderator">Moderator</option></KwantSelect> : <span className="rounded-lg border border-border bg-panel px-2.5 py-2 text-[7px] text-muted">{roleLabel(member.role)}</span>}
                  {canRemove ? <button type="button" onClick={() => void perform({ action: "remove-member", deskId: activeDesk.deskId, userId: member.userId }, member.userId === viewerId ? `You left ${activeDesk.name}.` : `${profile.displayName} was removed.`)} className="flex h-8 items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/[0.04] px-2.5 text-[7px] text-danger">{member.userId === viewerId ? <DoorOpen className="h-3 w-3" /> : <UserMinus className="h-3 w-3" />}{member.userId === viewerId ? "Leave" : "Remove"}</button> : null}
                </div>
              );
            })}
          </div>
          {owner ? <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-[7px] leading-4 text-muted"><Crown className="mr-2 inline h-3.5 w-3.5 text-primary" />The owner cannot leave their Desk. Ownership transfer and Desk deletion will be handled as explicit safety workflows rather than accidental menu actions.</div> : null}
        </Modal>
      ) : null}

      {showChannel && activeDesk ? (
        <Modal title={channelEditor.channelId ? `Edit #${channelEditor.name}` : "Create Desk channel"} subtitle="Control posting, history and exactly who can see this room." icon={channelEditor.channelType === "voice" ? <Mic2 className="h-4 w-4" /> : <Hash className="h-4 w-4" />} onClose={() => setShowChannel(false)} wide footer={<><button type="button" onClick={() => setShowChannel(false)} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button>{channelEditor.channelId ? <button type="button" onClick={async () => { const deleted = await perform({ action: "delete-channel", deskId: activeDesk.deskId, channelId: channelEditor.channelId }, "Channel removed."); if (deleted) setShowChannel(false); }} className="mr-auto flex h-9 items-center gap-2 rounded-xl border border-danger/20 px-4 text-[8px] font-semibold text-danger"><Archive className="h-3.5 w-3.5" />Delete</button> : null}<button type="button" onClick={() => void saveChannel()} disabled={!channelEditor.name.trim() || working} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50"><Check className="h-3.5 w-3.5" />Save channel</button></>}>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Channel name</span><input value={channelEditor.name} onChange={(event) => setChannelEditor((current) => ({ ...current, name: event.target.value }))} placeholder="market-structure" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
            <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Channel type</span><KwantSelect value={channelEditor.channelType} onChange={(event) => setChannelEditor((current) => ({ ...current, channelType: event.target.value as "text" | "voice" }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none"><option value="text">Text channel</option><option value="voice">Voice · structure now, audio later</option></KwantSelect></label>
            <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Description</span><input value={channelEditor.description} onChange={(event) => setChannelEditor((current) => ({ ...current, description: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>
            <Toggle checked={channelEditor.isPrivate} onChange={(checked) => setChannelEditor((current) => ({ ...current, isPrivate: checked }))} label="Private · invitation only" detail="Hidden completely from members who are not explicitly selected." />
            <Toggle checked={channelEditor.showHistory} onChange={(checked) => setChannelEditor((current) => ({ ...current, showHistory: checked }))} label="Show previous messages" detail="When off, new members only see messages sent after they joined." />
            <Toggle checked={channelEditor.readOnly} onChange={(checked) => setChannelEditor((current) => ({ ...current, readOnly: checked, reactionOnly: checked ? false : current.reactionOnly }))} label="Read only" detail="Only owners and moderators can publish." />
            <Toggle checked={channelEditor.reactionOnly} onChange={(checked) => setChannelEditor((current) => ({ ...current, reactionOnly: checked, readOnly: checked ? false : current.readOnly }))} label="Reaction only" detail="Members can react to existing posts but cannot send text." />
          </div>
          {channelEditor.isPrivate ? (
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
