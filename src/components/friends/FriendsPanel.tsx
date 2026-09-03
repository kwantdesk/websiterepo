"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronDown,
  Clock3,
  ImagePlus,
  LogOut,
  Loader2,
  MessageSquarePlus,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Settings2,
  ShieldOff,
  Smile,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
  UserRoundPlus,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import KwantLoader from "@/components/KwantLoader";
import ActivityStreakBadge from "@/components/socials/ActivityStreakBadge";
import UserAvatar from "@/components/socials/UserAvatar";
import SharedTradeMessageCard from "@/components/socials/SharedTradeMessageCard";
import LinkedMessageBody from "@/components/socials/LinkedMessageBody";
import EmojiPicker from "@/components/ui/EmojiPicker";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import { useFrequentEmojis } from "@/hooks/useFrequentEmojis";
import {
  PRESENCE_OPTIONS,
  presenceOption,
  type FriendGroupSummary,
  type FriendMessage,
  type FriendMessageAttachment,
  type FriendSummary,
  type FriendsPayload,
  type PresenceStatus,
} from "@/lib/friends";
import { storeSocialProfilePreview } from "@/lib/socialProfilePreview";
import { isSingleEmojiMessage } from "@/lib/messageText";

const EMPTY: FriendsPayload = {
  cloud: false,
  groupsReady: false,
  viewer: null,
  friends: [],
  groups: [],
  incoming: [],
  outgoing: [],
  blocked: [],
  directory: [],
  messages: [],
  groupMessages: [],
};

const MAX_CHAT_IMAGES = 2;
const MAX_CHAT_IMAGE_BYTES = 900_000;

type FriendsPanelProps = {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  onMessageUnreadCountChange?: (count: number) => void;
  initialFriendId?: string;
  onInitialFriendConsumed?: () => void;
  onViewProfile?: (handle: string) => void;
  mode?: "friends" | "messages";
};

type OptimisticFriendMessage = FriendMessage & {
  clientMessageId: string;
  conversationId: string;
  conversationType: "friend" | "group";
  deliveryStatus: "sending" | "sent" | "failed";
};

function isOptimisticFriendMessage(
  message: FriendMessage | OptimisticFriendMessage,
): message is OptimisticFriendMessage {
  return "deliveryStatus" in message && "clientMessageId" in message;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "K";
}

function timeLabel(value: string | null) {
  if (!value) return "";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

function messageTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function Avatar({ friend, size = "md" }: { friend: FriendSummary; size?: "sm" | "md" | "lg" }) {
  const option = presenceOption(friend.presenceStatus);
  return <UserAvatar label={friend.displayName} avatarUrl={friend.avatarUrl} size={size === "lg" ? "lg" : size === "sm" ? "sm" : "md"} statusClassName={option.dotClassName} />;
}

function FriendName({ friend, className = "" }: { friend: FriendSummary; className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="truncate">{friend.displayName}</span>
      <ActivityStreakBadge streak={friend.activityStreak} lastSeenAt={friend.lastSeenAt} timeZone={friend.timeZone} compact />
    </span>
  );
}

function GroupAvatar({ group, size = "md" }: { group: FriendGroupSummary; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-11 w-11 text-[13px]" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-[11px]";
  return (
    <div className={`relative flex shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-semibold text-primary ${dimensions}`}>
      {initials(group.name)}
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border-2 border-panel bg-primary px-0.5 text-[6px] font-bold text-on-primary">
        {Math.min(99, group.members.length)}
      </span>
    </div>
  );
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function imageAttachment(file: File): Promise<FriendMessageAttachment> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} is larger than 12 MB.`);

  let source: Blob = file;
  if (file.size > MAX_CHAT_IMAGE_BYTES) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1_600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("That image could not be prepared.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    source = await canvasBlob(canvas, 0.8) ?? file;
    if (source.size > MAX_CHAT_IMAGE_BYTES) {
      source = await canvasBlob(canvas, 0.6) ?? source;
    }
  }
  if (source.size > MAX_CHAT_IMAGE_BYTES) {
    throw new Error(`${file.name} could not be reduced below 900 KB.`);
  }
  return {
    id: `friend-image:${crypto.randomUUID()}`,
    name: file.name.slice(0, 120) || "Chart image",
    type: source.type || file.type || "image/webp",
    size: source.size,
    dataUrl: await readFileAsDataUrl(source),
  };
}

function MessageImages({
  attachments,
  onPreview,
}: {
  attachments?: FriendMessageAttachment[];
  onPreview: (attachment: FriendMessageAttachment) => void;
}) {
  if (!attachments?.length) return null;
  return (
    <div className={`mb-1.5 grid gap-1.5 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          onClick={() => onPreview(attachment)}
          className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
          title={`Open ${attachment.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.dataUrl} alt={attachment.name} className="max-h-48 w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

export default function FriendsPanel({ onClose, onUnreadCountChange, onMessageUnreadCountChange, initialFriendId = "", onInitialFriendConsumed, onViewProfile, mode = "friends" }: FriendsPanelProps) {
  const [payload, setPayload] = useState<FriendsPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showPresence, setShowPresence] = useState(false);
  const [optimisticPresenceStatus, setOptimisticPresenceStatus] = useState<PresenceStatus | null>(null);
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [activeFriendId, setActiveFriendId] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<FriendMessageAttachment[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticFriendMessage[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [imagePreview, setImagePreview] = useState<FriendMessageAttachment | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupSettingsName, setGroupSettingsName] = useState("");
  const [groupSettingsDescription, setGroupSettingsDescription] = useState("");
  const [groupSettingsInvite, setGroupSettingsInvite] = useState(false);
  const { frequentEmojis, recordEmojiUse } = useFrequentEmojis(payload.viewer?.userId ?? "local");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const speechDictation = useSpeechDictation({
    value: draft,
    onChange: setDraft,
    disabled: chatLoading || (!activeFriendId && !activeGroupId),
    maxLength: 2_000,
  });

  const load = useCallback(async (friendId = "", quiet = false, groupId = "") => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (friendId) params.set("friendId", friendId);
      if (groupId) params.set("groupId", groupId);
      const response = await fetch(`/api/friends${params.size ? `?${params.toString()}` : ""}`, {
        cache: "no-store",
      });
      const next = await response.json() as FriendsPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "Friends could not be loaded.");
      setPayload(next);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Friends could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = useCallback(async (
    action: string,
    values: Record<string, unknown> = {},
    quiet = false,
  ) => {
    const identifier = String(values.targetUserId ?? values.groupId ?? action);
    if (!quiet) setBusyId(identifier);
    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      });
      const next = await response.json() as FriendsPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "That action could not be completed.");
      if ("friends" in next) setPayload(next);
      setError("");
      return true;
    } catch (reason) {
      if (!quiet) setError(reason instanceof Error ? reason.message : "That action could not be completed.");
      return false;
    } finally {
      if (!quiet) setBusyId("");
    }
  }, []);

  useEffect(() => {
    void load("", true);
  }, [load]);

  useEffect(() => {
    const handlePresenceUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ presenceStatus?: PresenceStatus }>).detail;
      if (!detail?.presenceStatus) return;
      setPayload((current) => current.viewer ? {
        ...current,
        viewer: { ...current.viewer, presenceStatus: detail.presenceStatus as PresenceStatus },
      } : current);
    };
    window.addEventListener("kwantdesk:presence-updated", handlePresenceUpdated);
    return () => window.removeEventListener("kwantdesk:presence-updated", handlePresenceUpdated);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let channel = supabase
      .channel("kwantdesk-friends-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_objects" },
        () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(() => void load(activeFriendId, true, activeGroupId), 350);
        },
      );
    if (payload.groupsReady) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: "friend_chats" }, () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => void load(activeFriendId, true, activeGroupId), 250);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_chat_members" }, () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => void load(activeFriendId, true, activeGroupId), 250);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_chat_messages" }, () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => void load(activeFriendId, true, activeGroupId), 150);
      });
    }
    channel.subscribe();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [activeFriendId, activeGroupId, load, payload.groupsReady]);

  useEffect(() => {
    const fallbackRefresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(activeFriendId, true, activeGroupId);
    }, 25_000);
    return () => window.clearInterval(fallbackRefresh);
  }, [activeFriendId, activeGroupId, load]);

  const unreadTotal = useMemo(
    () =>
      payload.incoming.length
      + payload.friends.reduce((total, friend) => total + friend.unreadCount, 0)
      + payload.groups.reduce((total, group) => total + (group.muted ? 0 : group.unreadCount), 0),
    [payload.friends, payload.groups, payload.incoming.length],
  );
  const messageUnreadTotal = useMemo(
    () => payload.friends.reduce((total, friend) => total + friend.unreadCount, 0)
      + payload.groups.reduce((total, group) => total + (group.muted ? 0 : group.unreadCount), 0),
    [payload.friends, payload.groups],
  );

  useEffect(() => {
    onUnreadCountChange?.(unreadTotal);
  }, [onUnreadCountChange, unreadTotal]);

  useEffect(() => {
    onMessageUnreadCountChange?.(messageUnreadTotal);
  }, [messageUnreadTotal, onMessageUnreadCountChange]);

  const activeFriend = payload.friends.find((friend) => friend.userId === activeFriendId) ?? null;
  const activeGroup = payload.groups.find((group) => group.id === activeGroupId) ?? null;
  const viewerPresenceStatus = optimisticPresenceStatus ?? payload.viewer?.presenceStatus ?? "online";

  useEffect(() => {
    if (!initialFriendId || activeFriendId === initialFriendId) return;
    const friend = payload.friends.find((candidate) => candidate.userId === initialFriendId);
    if (!friend) return;
    setChatLoading(true);
    setActiveGroupId("");
    setActiveFriendId(friend.userId);
    setAttachments([]);
    setShowEmoji(false);
    onInitialFriendConsumed?.();
    void load(friend.userId, true).finally(() => setChatLoading(false));
  }, [activeFriendId, initialFriendId, load, onInitialFriendConsumed, payload.friends]);

  useEffect(() => {
    if (!activeFriendId) {
      setChatLoading(false);
      return;
    }
    let cancelled = false;
    setChatLoading(true);
    setPayload((current) => ({
      ...current,
      friends: current.friends.map((friend) => friend.userId === activeFriendId ? { ...friend, unreadCount: 0 } : friend),
    }));
    void load(activeFriendId, true).finally(() => {
      if (!cancelled) setChatLoading(false);
    });
    void runAction("mark-read", { targetUserId: activeFriendId }, true);
    return () => {
      cancelled = true;
    };
  }, [activeFriendId, load, runAction]);

  useEffect(() => {
    if (!activeGroupId) return;
    let cancelled = false;
    setChatLoading(true);
    setPayload((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id === activeGroupId ? { ...group, unreadCount: 0 } : group),
    }));
    void load("", true, activeGroupId).finally(() => {
      if (!cancelled) setChatLoading(false);
    });
    void runAction("group-mark-read", { groupId: activeGroupId }, true);
    return () => {
      cancelled = true;
    };
  }, [activeGroupId, load, runAction]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [payload.groupMessages.length, payload.messages.length, optimisticMessages, activeFriendId, activeGroupId]);

  useEffect(() => () => {
    for (const timer of deliveryTimersRef.current.values()) clearTimeout(timer);
    deliveryTimersRef.current.clear();
  }, []);

  const searchResults = useMemo(() => {
    const clean = query.trim().toLowerCase().replace(/^@/, "");
    if (!clean) return payload.directory.slice(0, 12);
    return payload.directory.filter(
      (person) =>
        person.displayName.toLowerCase().includes(clean)
        || person.handle.toLowerCase().includes(clean),
    ).slice(0, 20);
  }, [payload.directory, query]);

  const onlineFriends = payload.friends.filter((friend) => friend.isOnline);
  const offlineFriends = payload.friends.filter((friend) => !friend.isOnline);

  const selectPresence = async (presenceStatus: PresenceStatus) => {
    setShowPresence(false);
    if (presenceStatus === viewerPresenceStatus && optimisticPresenceStatus === null) return;
    setOptimisticPresenceStatus(presenceStatus);
    const saved = await runAction("status", {
      presenceStatus,
      presenceMessage: payload.viewer?.presenceMessage || "",
    });
    if (saved) {
      setPayload((current) => current.viewer ? {
        ...current,
        viewer: { ...current.viewer, presenceStatus },
      } : current);
    }
    setOptimisticPresenceStatus(null);
  };

  const openChat = (friend: FriendSummary) => {
    setChatLoading(true);
    setActiveGroupId("");
    setActiveFriendId(friend.userId);
    setAttachments([]);
    setAttachmentError("");
    setShowEmoji(false);
    setShowAdd(false);
    setShowGroupCreate(false);
    setShowFriendMenu(false);
  };

  const openGroupChat = (group: FriendGroupSummary) => {
    setChatLoading(true);
    setActiveFriendId("");
    setActiveGroupId(group.id);
    setAttachments([]);
    setAttachmentError("");
    setShowEmoji(false);
    setShowAdd(false);
    setShowGroupCreate(false);
    setShowGroupSettings(false);
    setGroupSettingsName(group.name);
    setGroupSettingsDescription(group.description);
    setGroupSettingsInvite(group.allowMemberInvites);
  };

  const handleImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    const remaining = MAX_CHAT_IMAGES - attachments.length;
    if (remaining <= 0) {
      setAttachmentError("Remove an image before attaching another.");
      return;
    }
    try {
      const next = await Promise.all(files.slice(0, remaining).map(imageAttachment));
      setAttachments((current) => [...current, ...next].slice(0, MAX_CHAT_IMAGES));
      setAttachmentError(files.length > remaining ? "You can attach two images to one message." : "");
    } catch (reason) {
      setAttachmentError(reason instanceof Error ? reason.message : "That image could not be attached.");
    }
  };

  const deliverOptimisticMessage = useCallback(async (message: OptimisticFriendMessage) => {
    const existingTimer = deliveryTimersRef.current.get(message.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      deliveryTimersRef.current.delete(message.id);
    }
    setOptimisticMessages((current) => current.map((candidate) =>
      candidate.id === message.id
        ? { ...candidate, deliveryStatus: "sending" }
        : candidate));

    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message.conversationType === "group"
          ? {
              action: "group-message",
              groupId: message.conversationId,
              body: message.body,
              attachments: message.attachments ?? [],
              sharedTrade: message.sharedTrade,
              clientMessageId: message.clientMessageId,
            }
          : {
              action: "message",
              targetUserId: message.conversationId,
              body: message.body,
              attachments: message.attachments ?? [],
              sharedTrade: message.sharedTrade,
              clientMessageId: message.clientMessageId,
            }),
      });
      const next = await response.json() as FriendsPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "The message could not be sent.");
      if ("friends" in next) setPayload(next);
      setError("");
      setOptimisticMessages((current) => current.map((candidate) =>
        candidate.id === message.id
          ? { ...candidate, deliveryStatus: "sent" }
          : candidate));
      const timer = setTimeout(() => {
        setOptimisticMessages((current) => current.filter((candidate) => candidate.id !== message.id));
        deliveryTimersRef.current.delete(message.id);
      }, 1_400);
      deliveryTimersRef.current.set(message.id, timer);
    } catch (reason) {
      setOptimisticMessages((current) => current.map((candidate) =>
        candidate.id === message.id
          ? { ...candidate, deliveryStatus: "failed" }
          : candidate));
      setError(reason instanceof Error ? reason.message : "The message could not be sent.");
    }
  }, []);

  const sendMessage = () => {
    const body = draft.trim();
    if ((!body && !attachments.length) || (!activeFriend && !activeGroup)) return;
    const senderUserId = payload.viewer?.userId;
    if (!senderUserId) return;
    const clientMessageId = crypto.randomUUID();
    const conversationType = activeGroup ? "group" : "friend";
    const conversationId = activeGroup?.id ?? activeFriend?.userId ?? "";
    const outgoingAttachments = attachments;
    const optimisticMessage: OptimisticFriendMessage = {
      id: conversationType === "group"
        ? clientMessageId
        : `friend-message:${clientMessageId}`,
      clientMessageId,
      conversationId,
      conversationType,
      deliveryStatus: "sending",
      senderUserId,
      recipientUserId: activeFriend?.userId ?? "",
      groupId: activeGroup?.id,
      body,
      sentAt: new Date().toISOString(),
      attachments: outgoingAttachments.length ? outgoingAttachments : undefined,
    };

    speechDictation.stop();
    setDraft("");
    setAttachments([]);
    setAttachmentError("");
    setShowEmoji(false);
    setOptimisticMessages((current) => [...current, optimisticMessage]);
    void deliverOptimisticMessage(optimisticMessage);
  };

  const createGroup = async () => {
    const created = await runAction("create-group", {
      name: groupName,
      description: groupDescription,
      memberUserIds: groupMemberIds,
    });
    if (!created) return;
    setGroupName("");
    setGroupDescription("");
    setGroupMemberIds([]);
    setShowGroupCreate(false);
    await load("", true);
  };

  const saveGroupSettings = async () => {
    if (!activeGroup) return;
    const saved = await runAction("group-settings", {
      groupId: activeGroup.id,
      name: groupSettingsName,
      description: groupSettingsDescription,
      allowMemberInvites: groupSettingsInvite,
    });
    if (saved) await load("", true, activeGroup.id);
  };

  const leaveOrDeleteGroup = async () => {
    if (!activeGroup) return;
    const action = activeGroup.isOwner ? "group-delete" : "group-leave";
    const completed = await runAction(action, { groupId: activeGroup.id });
    if (!completed) return;
    setShowGroupSettings(false);
    setActiveGroupId("");
    await load("", true);
  };

  const closeFriendship = async (action: "remove" | "block") => {
    if (!activeFriend) return;
    const completed = await runAction(action, { targetUserId: activeFriend.userId });
    if (completed) {
      setShowFriendMenu(false);
      setActiveFriendId("");
    }
  };

  const renderConversation = (messages: FriendMessage[], group: FriendGroupSummary | null) => {
    if (chatLoading) {
      return (
        <KwantLoader
          className="h-full min-h-48"
          compact
          icon={MessageCircle}
          title="Loading conversation"
          detail="Restoring the latest messages."
        />
      );
    }
    const conversationType = group ? "group" : "friend";
    const conversationId = group?.id ?? activeFriend?.userId ?? "";
    const byId = new Map<string, FriendMessage | OptimisticFriendMessage>(
      messages.map((message) => [message.id, message]),
    );
    for (const message of optimisticMessages) {
      if (
        message.conversationType === conversationType
        && message.conversationId === conversationId
      ) {
        byId.set(message.id, message);
      }
    }
    const renderedMessages = [...byId.values()].sort(
      (left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt),
    );

    if (renderedMessages.length === 0) {
      return (
        <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
          {group ? <GroupAvatar group={group} size="lg" /> : activeFriend ? <Avatar friend={activeFriend} size="lg" /> : null}
          <div className="mt-3 text-[13px] font-semibold">
            {group ? group.name : `Connected with ${activeFriend?.displayName ?? "your friend"}`}
          </div>
          <div className="mt-1 max-w-52 text-[11px] leading-5 text-muted">
            {group
              ? "Start the group conversation. Messages and images stay attached to each member's Kwant Desk account."
              : "Start a private conversation. Messages stay attached to your Kwant Desk account."}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {renderedMessages.map((message) => {
          const mine = message.senderUserId === payload.viewer?.userId;
          const sender = group?.members.find((member) => member.userId === message.senderUserId);
          const optimisticMessage = isOptimisticFriendMessage(message) ? message : null;
          const deliveryStatus = optimisticMessage?.deliveryStatus ?? null;
          const sharedOneLiner = !message.sharedTrade
            && message.body.includes("/socials/")
            && message.body.includes("?post=");
          const sharedCard = Boolean(message.sharedTrade || sharedOneLiner);
          const standaloneEmoji = !sharedCard
            && (message.attachments?.length ?? 0) === 0
            && isSingleEmojiMessage(message.body);
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[84%] ${sharedCard || standaloneEmoji ? "bg-transparent p-0 text-foreground" : `rounded-2xl px-3 py-2 ${mine ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md border border-border bg-surface text-foreground"}`} ${deliveryStatus === "failed" ? "ring-1 ring-danger" : ""}`}>
                {group && !mine ? (
                  <div className="mb-1 text-[8px] font-semibold text-primary">{sender?.displayName ?? "Group member"}</div>
                ) : null}
                <MessageImages attachments={message.attachments} onPreview={setImagePreview} />
                {message.sharedTrade ? <SharedTradeMessageCard sharedTrade={message.sharedTrade} /> : null}
                {message.body ? standaloneEmoji
                  ? <div className="select-text px-1 py-1 text-[56px] leading-none" aria-label={message.body.trim()}>{message.body.trim()}</div>
                  : <LinkedMessageBody body={message.body} className={`${sharedOneLiner ? "rounded-xl border border-primary/25 bg-panel px-3 py-2.5 shadow-[inset_0_0_16px_color-mix(in_srgb,var(--primary)_3%,transparent)]" : ""} text-[12px] leading-5`} />
                  : null}
                <div className={`mt-1 flex items-center justify-end gap-1 text-right text-[8px] ${sharedCard || standaloneEmoji ? "px-1 text-muted" : mine ? "text-on-primary/65" : "text-muted"}`}>
                  <span>{messageTime(message.sentAt)}</span>
                  {deliveryStatus === "sending" ? (
                    <span className="inline-flex items-center gap-0.5"><Clock3 className="h-2.5 w-2.5" /> Sending…</span>
                  ) : null}
                  {deliveryStatus === "sent" ? (
                    <span className="inline-flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> Sent</span>
                  ) : null}
                  {deliveryStatus === "failed" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (optimisticMessage) void deliverOptimisticMessage(optimisticMessage);
                      }}
                      className={`font-semibold underline underline-offset-2 ${sharedCard ? "text-danger" : "text-on-primary"}`}
                    >
                      Not sent · Retry
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  const renderComposer = (conversationId: string) => (
    <div className="shrink-0 border-t border-border p-3">
      {attachments.length ? (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.dataUrl} alt={attachment.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white"
                aria-label={`Remove ${attachment.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {attachmentError ? <div className="mb-2 text-[9px] text-danger">{attachmentError}</div> : null}
      {speechDictation.error ? <div className="mb-2 text-[9px] text-danger">{speechDictation.error}</div> : null}
      <div className="relative flex items-end gap-1.5 rounded-2xl border border-border bg-surface p-1.5 focus-within:border-primary/40">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event) => void handleImages(event)}
        />
        <button
          type="button"
          title="Attach images"
          onClick={() => imageInputRef.current?.click()}
          disabled={chatLoading || attachments.length >= MAX_CHAT_IMAGES}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-panel hover:text-primary disabled:opacity-30"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>
        <div className="relative">
          <button
            type="button"
            title="Add emoji"
            onClick={() => setShowEmoji((value) => !value)}
            disabled={chatLoading}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${showEmoji ? "bg-panel text-primary" : "text-muted hover:bg-panel hover:text-primary"}`}
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          {showEmoji ? (
            <EmojiPicker
              frequentEmojis={frequentEmojis}
              onSelect={(emoji) => {
                recordEmojiUse(emoji);
                setDraft((current) => `${current}${emoji}`);
              }}
              className="absolute bottom-10 left-0 z-40"
            />
          ) : null}
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={chatLoading}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
          rows={1}
          placeholder={chatLoading ? "Loading conversation..." : "Message..."}
          className="max-h-28 min-h-8 min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-[12px] outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() => {
            speechDictation.clearError();
            speechDictation.toggle();
          }}
          disabled={chatLoading || !speechDictation.supported}
          aria-label={speechDictation.listening ? "Stop dictating message" : "Dictate message"}
          aria-pressed={speechDictation.listening}
          title={!speechDictation.supported
            ? "Speech input is not supported by this browser"
            : speechDictation.listening
              ? "Stop dictation"
              : "Dictate a message"}
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-30 ${
            speechDictation.listening
              ? "bg-primary/15 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
              : "text-muted hover:bg-panel hover:text-primary"
          }`}
        >
          {speechDictation.listening ? <span className="absolute inset-2 animate-ping rounded-full bg-primary/25" /> : null}
          <Mic className="relative h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={sendMessage}
          disabled={chatLoading || (!draft.trim() && !attachments.length)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const imagePreviewOverlay = imagePreview ? (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/90 p-6" onClick={() => setImagePreview(null)}>
      <button
        type="button"
        onClick={() => setImagePreview(null)}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white"
        aria-label="Close image"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imagePreview.dataUrl}
        alt={imagePreview.name}
        className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  ) : null;

  if (activeGroup) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <button
            type="button"
            onClick={() => {
              setChatLoading(false);
              setActiveGroupId("");
              setAttachments([]);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <GroupAvatar group={activeGroup} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{activeGroup.name}</div>
            <div className="truncate text-[10px] text-muted">{activeGroup.members.length} members</div>
          </div>
          <button
            type="button"
            title="Group settings"
            onClick={() => setShowGroupSettings((value) => !value)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${showGroupSettings ? "bg-surface text-foreground" : "text-muted hover:bg-surface hover:text-foreground"}`}
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {showGroupSettings ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="rounded-2xl border border-border bg-surface/40 p-3">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Group settings</div>
              <input
                value={groupSettingsName}
                onChange={(event) => setGroupSettingsName(event.target.value)}
                disabled={!activeGroup.isOwner}
                placeholder="Group name"
                className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2.5 text-[11px] outline-none focus:border-primary/40 disabled:opacity-60"
              />
              <textarea
                value={groupSettingsDescription}
                onChange={(event) => setGroupSettingsDescription(event.target.value)}
                disabled={!activeGroup.isOwner}
                placeholder="What is this group for?"
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-border bg-panel px-3 py-2.5 text-[11px] outline-none focus:border-primary/40 disabled:opacity-60"
              />
              {activeGroup.isOwner ? (
                <label className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2.5 text-[10px] text-muted">
                  <input
                    type="checkbox"
                    checked={groupSettingsInvite}
                    onChange={(event) => setGroupSettingsInvite(event.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  Members can add connected friends
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => void runAction("group-mute", { groupId: activeGroup.id, muted: !activeGroup.muted })}
                className="mt-2 flex w-full items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2.5 text-left text-[10px] text-muted hover:text-foreground"
              >
                {activeGroup.muted ? <Volume2 className="h-3.5 w-3.5 text-primary" /> : <VolumeX className="h-3.5 w-3.5" />}
                {activeGroup.muted ? "Turn notifications on" : "Mute this group"}
              </button>
              {activeGroup.isOwner ? (
                <button
                  type="button"
                  onClick={() => void saveGroupSettings()}
                  disabled={!groupSettingsName.trim() || busyId === activeGroup.id}
                  className="mt-2 w-full rounded-xl bg-primary px-3 py-2.5 text-[10px] font-semibold text-on-primary disabled:opacity-40"
                >
                  Save group settings
                </button>
              ) : null}
            </div>

            <div className="mt-3 rounded-2xl border border-border p-2">
              <div className="px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Members</div>
              {activeGroup.members.map((member) => (
                <div key={member.userId} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface">
                  <Avatar friend={member} size="sm" />
                  <div className="min-w-0 flex-1">
                    <FriendName friend={member} className="text-[11px] font-medium" />
                    <div className="truncate text-[9px] text-muted">@{member.handle} {member.role === "owner" ? "\u00b7 Owner" : ""}</div>
                  </div>
                  {activeGroup.isOwner && member.role !== "owner" ? (
                    <button
                      type="button"
                      onClick={() => void runAction("group-remove-member", { groupId: activeGroup.id, targetUserId: member.userId })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                      title="Remove member"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {(activeGroup.isOwner || activeGroup.allowMemberInvites) ? (
              <div className="mt-3 rounded-2xl border border-border p-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold"><UserRoundPlus className="h-3.5 w-3.5 text-primary" /> Add members</div>
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {payload.friends
                    .filter((friend) => !activeGroup.members.some((member) => member.userId === friend.userId))
                    .map((friend) => (
                      <button
                        key={friend.userId}
                        type="button"
                        onClick={() => void runAction("group-add-members", { groupId: activeGroup.id, memberUserIds: [friend.userId] })}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-surface"
                      >
                        <Avatar friend={friend} size="sm" />
                        <FriendName friend={friend} className="min-w-0 flex-1 text-[10px]" />
                        <UserPlus className="h-3.5 w-3.5 text-primary" />
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void leaveOrDeleteGroup()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[10px] font-semibold text-danger"
            >
              {activeGroup.isOwner ? <Trash2 className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
              {activeGroup.isOwner ? "Delete group chat" : "Leave group chat"}
            </button>
          </div>
        ) : (
          <>
            {activeGroup.description ? (
              <div className="shrink-0 border-b border-border px-3 py-2 text-[9px] leading-4 text-muted">{activeGroup.description}</div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              {renderConversation(payload.groupMessages, activeGroup)}
            </div>
            {error ? <div className="mx-3 mb-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[10px] text-danger">{error}</div> : null}
            {renderComposer(activeGroup.id)}
          </>
        )}
        {imagePreviewOverlay}
      </div>
    );
  }

  if (activeFriend) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <button
            onClick={() => {
              setChatLoading(false);
              setActiveFriendId("");
              setAttachments([]);
              setShowEmoji(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Avatar friend={activeFriend} size="sm" />
          <div className="min-w-0 flex-1">
            <FriendName friend={activeFriend} className="text-[13px] font-semibold" />
            <div className="truncate text-[10px] text-muted">
              {activeFriend.isOnline ? presenceOption(activeFriend.presenceStatus).label : `Last seen ${timeLabel(activeFriend.lastSeenAt) || "recently"}`}
            </div>
          </div>
          <div className="relative">
            <button
              title="Friend options"
              onClick={() => setShowFriendMenu((value) => !value)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${showFriendMenu ? "bg-surface text-foreground" : "text-muted hover:bg-surface hover:text-foreground"}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showFriendMenu && (
              <div className="absolute right-0 top-10 z-40 w-40 rounded-xl border border-border bg-panel p-1.5 shadow-2xl">
                <button
                  onClick={() => {
                    setShowFriendMenu(false);
                    storeSocialProfilePreview({
                      userId: activeFriend.userId,
                      displayName: activeFriend.displayName,
                      handle: activeFriend.handle,
                      avatarUrl: activeFriend.avatarUrl,
                      isOnline: activeFriend.isOnline,
                    });
                    onViewProfile?.(activeFriend.handle);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-muted hover:bg-surface hover:text-foreground"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  View profile
                </button>
                <button
                  onClick={() => void closeFriendship("remove")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-muted hover:bg-surface hover:text-foreground"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  Remove friend
                </button>
                <button
                  onClick={() => void closeFriendship("block")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-danger hover:bg-danger/10"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Block account
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {activeFriend.desks.length > 0 && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
            {activeFriend.desks.map((desk) => (
              <span key={desk.id} className="whitespace-nowrap rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[9px] font-medium text-primary">
                {desk.name}
              </span>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {renderConversation(payload.messages, null)}
        </div>

        {error && <div className="mx-3 mb-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[10px] text-danger">{error}</div>}
        {renderComposer(activeFriend.userId)}
        {imagePreviewOverlay}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <div className="text-[14px] font-semibold">{mode === "messages" ? "Messages" : "Friends"}</div>
          <div className="text-[10px] text-muted">
            {mode === "messages"
              ? `${messageUnreadTotal} unread · ${payload.friends.length + payload.groups.length} conversations`
              : `${onlineFriends.length} online · ${payload.friends.length} connected`}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            title="Start a group chat"
            onClick={() => {
              setShowPresence(false);
              setShowAdd(false);
              setShowGroupCreate((value) => !value);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${showGroupCreate ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            title="Add a friend"
            onClick={() => {
              setShowPresence(false);
              setShowGroupCreate(false);
              setShowAdd((value) => !value);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${showAdd ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}
          >
            <UserPlus className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative shrink-0 border-b border-border px-3 py-2.5">
        <button
          onClick={() => {
            setShowAdd(false);
            setShowGroupCreate(false);
            setShowPresence((value) => !value);
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/30 px-3 py-2 text-left hover:bg-surface"
        >
          <span className={`h-2 w-2 rounded-full ${presenceOption(viewerPresenceStatus).dotClassName}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium">{presenceOption(viewerPresenceStatus).label}</span>
            <span className="block truncate text-[9px] text-muted">{payload.viewer?.presenceMessage || "Set your status in Identity"}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </button>
        {showPresence && (
          <div className="absolute left-3 right-3 top-[58px] z-30 rounded-xl border border-border bg-panel p-1.5 shadow-2xl">
            {PRESENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => void selectPresence(option.value)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-surface"
              >
                <span className={`h-2 w-2 rounded-full ${option.dotClassName}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium">{option.label}</span>
                  <span className="block text-[9px] text-muted">{option.helper}</span>
                </span>
                {viewerPresenceStatus === option.value && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {showGroupCreate && (
        <div className="shrink-0 border-b border-border p-3">
          {!payload.groupsReady ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-[10px] leading-5 text-muted">
              Group chat storage is being connected. Existing one-to-one chats continue to work normally.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-[11px] font-semibold">New group chat</div>
                  <div className="text-[9px] text-muted">Name it and choose your trading circle.</div>
                </div>
              </div>
              <input
                autoFocus
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={60}
                placeholder="Group name"
                className="mt-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[11px] outline-none placeholder:text-muted focus:border-primary/40"
              />
              <input
                value={groupDescription}
                onChange={(event) => setGroupDescription(event.target.value)}
                maxLength={240}
                placeholder="Purpose (optional)"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[11px] outline-none placeholder:text-muted focus:border-primary/40"
              />
              <div className="mt-3 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
                Members {"\u00b7"} {groupMemberIds.length} selected
              </div>
              <div className="mt-1 max-h-44 space-y-1 overflow-y-auto">
                {payload.friends.length ? payload.friends.map((friend) => {
                  const selected = groupMemberIds.includes(friend.userId);
                  return (
                    <button
                      key={friend.userId}
                      type="button"
                      onClick={() => setGroupMemberIds((current) => selected
                        ? current.filter((userId) => userId !== friend.userId)
                        : [...current, friend.userId])}
                      className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left ${selected ? "border-primary/25 bg-primary/10" : "border-transparent hover:bg-surface"}`}
                    >
                      <Avatar friend={friend} size="sm" />
                      <span className="min-w-0 flex-1">
                        <FriendName friend={friend} className="text-[10px] font-medium" />
                        <span className="block truncate text-[8px] text-muted">@{friend.handle}</span>
                      </span>
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-on-primary" : "border-border"}`}>
                        {selected ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                    </button>
                  );
                }) : (
                  <div className="px-3 py-5 text-center text-[10px] text-muted">Connect with a friend before starting a group.</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void createGroup()}
                disabled={!groupName.trim() || !groupMemberIds.length || busyId === "create-group"}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-[10px] font-semibold text-on-primary disabled:opacity-35"
              >
                {busyId === "create-group" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
                Create group chat
              </button>
            </>
          )}
        </div>
      )}

      {showAdd && (
        <div className="shrink-0 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Kwant Desk users"
              className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-[11px] outline-none placeholder:text-muted focus:border-primary/40"
            />
          </div>
          <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="px-3 py-5 text-center text-[10px] text-muted">No matching Kwant Desk accounts yet.</div>
            ) : searchResults.map((person) => (
              <div key={person.userId} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface">
                <Avatar friend={person} size="sm" />
                <div className="min-w-0 flex-1">
                  <FriendName friend={person} className="text-[11px] font-medium" />
                  <div className="truncate text-[9px] text-muted">@{person.handle}</div>
                </div>
                <button
                  onClick={() => void runAction("request", { targetUserId: person.userId })}
                  disabled={busyId === person.userId}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[9px] font-semibold text-primary disabled:opacity-40"
                >
                  {busyId === person.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && payload.friends.length === 0 ? (
          <KwantLoader
            className="h-full min-h-48 rounded-xl"
            compact
            icon={UsersRound}
            title="Loading friends"
            detail="Restoring presence and conversations."
          />
        ) : !payload.cloud ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <UsersRound className="h-7 w-7 text-muted" />
            <div className="mt-3 text-[12px] font-medium">Friends storage is not connected</div>
            <div className="mt-1 text-[10px] leading-5 text-muted">Apply the Socials migration in Supabase to enable account-backed friends and messages.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {payload.incoming.length > 0 && (
              <section>
                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">Requests · {payload.incoming.length}</div>
                <div className="mt-1 space-y-1">
                  {payload.incoming.map((person) => (
                    <div key={person.userId} className="rounded-xl border border-primary/15 bg-primary/5 p-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar friend={person} size="sm" />
                        <div className="min-w-0 flex-1"><FriendName friend={person} className="text-[11px] font-medium" /><div className="truncate text-[9px] text-muted">@{person.handle}</div></div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button disabled={busyId === person.userId} onClick={() => void runAction("accept", { targetUserId: person.userId })} className="rounded-lg bg-primary px-2 py-1.5 text-[9px] font-semibold text-on-primary disabled:opacity-40">Accept</button>
                        <button disabled={busyId === person.userId} onClick={() => void runAction("decline", { targetUserId: person.userId })} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-[9px] text-muted disabled:opacity-40">Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {payload.groups.length > 0 && (
              <section>
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Groups {"\u00b7"} {payload.groups.length}</span>
                  <MessageSquarePlus className="h-3 w-3 text-primary" />
                </div>
                <div className="mt-1 space-y-0.5">
                  {payload.groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => openGroupChat(group)}
                      className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-surface"
                    >
                      <GroupAvatar group={group} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-medium">{group.name}</span>
                          {group.muted ? <VolumeX className="h-2.5 w-2.5 shrink-0 text-muted" /> : null}
                        </div>
                        <div className="truncate text-[9px] text-muted">
                          {group.lastMessage || `${group.members.length} members`}
                        </div>
                      </div>
                      {group.unreadCount > 0 && !group.muted ? (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-semibold text-on-primary">{Math.min(99, group.unreadCount)}</span>
                      ) : <MessageCircle className="h-3.5 w-3.5 text-muted" />}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {onlineFriends.length > 0 && (
              <section>
                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Online · {onlineFriends.length}</div>
                <div className="mt-1 space-y-0.5">
                  {onlineFriends.map((friend) => (
                    <button key={friend.userId} onClick={() => openChat(friend)} className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-surface">
                      <Avatar friend={friend} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1"><FriendName friend={friend} className="text-[11px] font-medium" />{friend.desks.length > 0 && <span className="rounded bg-primary/10 px-1 py-0.5 text-[7px] text-primary">{friend.desks.length} desk{friend.desks.length === 1 ? "" : "s"}</span>}</div>
                        <div className="truncate text-[9px] text-muted">{friend.presenceMessage || presenceOption(friend.presenceStatus).label}</div>
                      </div>
                      {friend.unreadCount > 0 ? <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-semibold text-on-primary">{Math.min(99, friend.unreadCount)}</span> : <MessageCircle className="h-3.5 w-3.5 text-muted" />}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {offlineFriends.length > 0 && (
              <section>
                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Offline · {offlineFriends.length}</div>
                <div className="mt-1 space-y-0.5">
                  {offlineFriends.map((friend) => (
                    <button key={friend.userId} onClick={() => openChat(friend)} className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-surface">
                      <Avatar friend={friend} />
                      <div className="min-w-0 flex-1">
                        <FriendName friend={friend} className="text-[11px] font-medium" />
                        <div className="flex items-center gap-1 truncate text-[9px] text-muted"><Clock3 className="h-2.5 w-2.5" />{friend.lastSeenAt ? `Last seen ${timeLabel(friend.lastSeenAt)}` : "Offline"}{friend.desks.length > 0 ? ` · ${friend.desks.length} desks` : ""}</div>
                      </div>
                      {friend.unreadCount > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-semibold text-on-primary">{Math.min(99, friend.unreadCount)}</span>}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {payload.outgoing.length > 0 && (
              <section>
                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Pending · {payload.outgoing.length}</div>
                <div className="mt-1 space-y-1">
                  {payload.outgoing.map((person) => (
                    <div key={person.userId} className="flex items-center gap-2 rounded-xl px-2 py-2">
                      <Avatar friend={person} size="sm" />
                      <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-medium">{person.displayName}</div><div className="truncate text-[9px] text-muted">@{person.handle}</div></div>
                      <button
                        disabled={busyId === person.userId}
                        onClick={() => void runAction("cancel", { targetUserId: person.userId })}
                        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-[8px] font-medium text-muted hover:text-foreground disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {payload.blocked.length > 0 && (
              <section>
                <button
                  onClick={() => setShowBlocked((value) => !value)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted hover:bg-surface"
                >
                  <span>Blocked · {payload.blocked.length}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showBlocked ? "rotate-180" : ""}`} />
                </button>
                {showBlocked && (
                  <div className="mt-1 space-y-1">
                    {payload.blocked.map((person) => (
                      <div key={person.userId} className="flex items-center gap-2 rounded-xl px-2 py-2">
                        <Avatar friend={person} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium">{person.displayName}</div>
                          <div className="truncate text-[9px] text-muted">@{person.handle}</div>
                        </div>
                        <button
                          disabled={busyId === person.userId}
                          onClick={() => void runAction("unblock", { targetUserId: person.userId })}
                          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-[8px] text-muted hover:text-foreground disabled:opacity-40"
                        >
                          <ShieldOff className="h-3 w-3" />
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {payload.friends.length === 0 && payload.groups.length === 0 && payload.incoming.length === 0 && (
              <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface"><UsersRound className="h-5 w-5 text-primary" /></div>
                <div className="mt-3 text-[12px] font-medium">Your trading circle starts here</div>
                <div className="mt-1 text-[10px] leading-5 text-muted">Add a trader, see their presence and shared Desks, then message privately from this rail.</div>
                <button onClick={() => setShowAdd(true)} className="mt-3 rounded-xl bg-primary px-3 py-2 text-[10px] font-semibold text-on-primary">Find friends</button>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <div className="m-3 mt-0 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[10px] text-danger">{error}</div>}
    </div>
  );
}
