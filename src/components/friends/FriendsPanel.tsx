"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  ShieldOff,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  PRESENCE_OPTIONS,
  presenceOption,
  type FriendMessage,
  type FriendSummary,
  type FriendsPayload,
  type PresenceStatus,
} from "@/lib/friends";

const EMPTY: FriendsPayload = {
  cloud: false,
  viewer: null,
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
  directory: [],
  messages: [],
};

type FriendsPanelProps = {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
};

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
  const dimensions = size === "lg" ? "h-11 w-11 text-[13px]" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-[11px]";
  return (
    <div className={`relative flex shrink-0 items-center justify-center rounded-full border border-border bg-surface font-semibold text-foreground ${dimensions}`}>
      {friend.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={friend.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : initials(friend.displayName)}
      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-panel ${option.dotClassName}`} />
    </div>
  );
}

export default function FriendsPanel({ onClose, onUnreadCountChange }: FriendsPanelProps) {
  const [payload, setPayload] = useState<FriendsPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showPresence, setShowPresence] = useState(false);
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [activeFriendId, setActiveFriendId] = useState("");
  const [draft, setDraft] = useState("");
  const [presenceDraft, setPresenceDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (friendId = "", quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/friends${friendId ? `?friendId=${encodeURIComponent(friendId)}` : ""}`, {
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
    const identifier = String(values.targetUserId ?? action);
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
    const supabase = createClient();
    if (!supabase) return;
    const channel = supabase
      .channel("kwantdesk-friends-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_objects" },
        () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(() => void load(activeFriendId, true), 350);
        },
      )
      .subscribe();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [activeFriendId, load]);

  useEffect(() => {
    const fallbackRefresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(activeFriendId, true);
    }, 25_000);
    return () => window.clearInterval(fallbackRefresh);
  }, [activeFriendId, load]);

  const unreadTotal = useMemo(
    () => payload.incoming.length + payload.friends.reduce((total, friend) => total + friend.unreadCount, 0),
    [payload.friends, payload.incoming.length],
  );

  useEffect(() => {
    onUnreadCountChange?.(unreadTotal);
  }, [onUnreadCountChange, unreadTotal]);

  const activeFriend = payload.friends.find((friend) => friend.userId === activeFriendId) ?? null;

  useEffect(() => {
    if (!activeFriendId) return;
    void load(activeFriendId, true);
    void runAction("mark-read", { targetUserId: activeFriendId }, true);
  }, [activeFriendId, load, runAction]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [payload.messages.length, activeFriendId]);

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
    await runAction("status", {
      presenceStatus,
      presenceMessage: presenceDraft || payload.viewer?.presenceMessage || "",
    });
  };

  const openChat = (friend: FriendSummary) => {
    setActiveFriendId(friend.userId);
    setShowAdd(false);
    setShowFriendMenu(false);
  };

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !activeFriend) return;
    setDraft("");
    const sent = await runAction("message", { targetUserId: activeFriend.userId, body });
    if (sent) await load(activeFriend.userId, true);
  };

  const updatePresenceMessage = async () => {
    const saved = await runAction("status", {
      presenceStatus: payload.viewer?.presenceStatus ?? "online",
      presenceMessage: presenceDraft,
    });
    if (saved) setShowPresence(false);
  };

  const closeFriendship = async (action: "remove" | "block") => {
    if (!activeFriend) return;
    const completed = await runAction(action, { targetUserId: activeFriend.userId });
    if (completed) {
      setShowFriendMenu(false);
      setActiveFriendId("");
    }
  };

  if (activeFriend) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <button onClick={() => setActiveFriendId("")} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Avatar friend={activeFriend} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{activeFriend.displayName}</div>
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
          {payload.messages.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
              <Avatar friend={activeFriend} size="lg" />
              <div className="mt-3 text-[13px] font-semibold">Connected with {activeFriend.displayName}</div>
              <div className="mt-1 max-w-48 text-[11px] leading-5 text-muted">Start a private conversation. Messages stay attached to your Kwant Desk account.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {payload.messages.map((message: FriendMessage) => {
                const mine = message.senderUserId === payload.viewer?.userId;
                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-md bg-primary text-background" : "rounded-bl-md border border-border bg-surface text-foreground"}`}>
                      <div className="whitespace-pre-wrap break-words text-[12px] leading-5">{message.body}</div>
                      <div className={`mt-1 text-right text-[8px] ${mine ? "text-background/60" : "text-muted"}`}>{messageTime(message.sentAt)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {error && <div className="mx-3 mb-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[10px] text-danger">{error}</div>}
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-1.5 focus-within:border-primary/40">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="Message..."
              className="max-h-28 min-h-8 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[12px] outline-none placeholder:text-muted"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!draft.trim() || busyId === activeFriend.userId}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-background disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busyId === activeFriend.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <div className="text-[14px] font-semibold">Friends</div>
          <div className="text-[10px] text-muted">{onlineFriends.length} online · {payload.friends.length} connected</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            title="Add a friend"
            onClick={() => {
              setShowPresence(false);
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
            setShowPresence((value) => !value);
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/30 px-3 py-2 text-left hover:bg-surface"
        >
          <span className={`h-2 w-2 rounded-full ${presenceOption(payload.viewer?.presenceStatus ?? "online").dotClassName}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium">{presenceOption(payload.viewer?.presenceStatus ?? "online").label}</span>
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
                {payload.viewer?.presenceStatus === option.value && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            <div className="mt-1 border-t border-border p-1.5">
              <input
                value={presenceDraft}
                onChange={(event) => setPresenceDraft(event.target.value.slice(0, 80))}
                onFocus={() => {
                  if (!presenceDraft) setPresenceDraft(payload.viewer?.presenceMessage ?? "");
                }}
                placeholder="Add a short status"
                className="h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-[10px] outline-none placeholder:text-muted focus:border-primary/40"
              />
              <button
                onClick={() => void updatePresenceMessage()}
                className="mt-1.5 w-full rounded-lg bg-primary px-2 py-1.5 text-[9px] font-semibold text-background"
              >
                Save status
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="shrink-0 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or @handle"
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
                  <div className="truncate text-[11px] font-medium">{person.displayName}</div>
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
          <div className="flex h-full min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
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
                        <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-medium">{person.displayName}</div><div className="truncate text-[9px] text-muted">@{person.handle}</div></div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button disabled={busyId === person.userId} onClick={() => void runAction("accept", { targetUserId: person.userId })} className="rounded-lg bg-primary px-2 py-1.5 text-[9px] font-semibold text-background disabled:opacity-40">Accept</button>
                        <button disabled={busyId === person.userId} onClick={() => void runAction("decline", { targetUserId: person.userId })} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-[9px] text-muted disabled:opacity-40">Decline</button>
                      </div>
                    </div>
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
                        <div className="flex items-center gap-1"><span className="truncate text-[11px] font-medium">{friend.displayName}</span>{friend.desks.length > 0 && <span className="rounded bg-primary/10 px-1 py-0.5 text-[7px] text-primary">{friend.desks.length} desk{friend.desks.length === 1 ? "" : "s"}</span>}</div>
                        <div className="truncate text-[9px] text-muted">{friend.presenceMessage || presenceOption(friend.presenceStatus).label}</div>
                      </div>
                      {friend.unreadCount > 0 ? <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-semibold text-background">{Math.min(99, friend.unreadCount)}</span> : <MessageCircle className="h-3.5 w-3.5 text-muted" />}
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
                        <div className="truncate text-[11px] font-medium">{friend.displayName}</div>
                        <div className="flex items-center gap-1 truncate text-[9px] text-muted"><Clock3 className="h-2.5 w-2.5" />{friend.lastSeenAt ? `Last seen ${timeLabel(friend.lastSeenAt)}` : "Offline"}{friend.desks.length > 0 ? ` · ${friend.desks.length} desks` : ""}</div>
                      </div>
                      {friend.unreadCount > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-semibold text-background">{Math.min(99, friend.unreadCount)}</span>}
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

            {payload.friends.length === 0 && payload.incoming.length === 0 && (
              <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface"><UsersRound className="h-5 w-5 text-primary" /></div>
                <div className="mt-3 text-[12px] font-medium">Your trading circle starts here</div>
                <div className="mt-1 text-[10px] leading-5 text-muted">Add a trader, see their presence and shared Desks, then message privately from this rail.</div>
                <button onClick={() => setShowAdd(true)} className="mt-3 rounded-xl bg-primary px-3 py-2 text-[10px] font-semibold text-background">Find friends</button>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <div className="m-3 mt-0 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[10px] text-danger">{error}</div>}
    </div>
  );
}
