"use client";

import { Bell, BellOff, CheckCheck, LoaderCircle, UserPlus } from "lucide-react";

import UserAvatar from "@/components/socials/UserAvatar";
import type { SocialNotificationItem } from "@/lib/socialNotifications";

type SocialNotificationsPanelProps = {
  items: SocialNotificationItem[];
  configured: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  nextOffset: number | null;
  onOpen: (item: SocialNotificationItem) => void;
  onLoadMore: () => void;
  onMarkAllRead: () => void;
};

function timeAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Now";
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(timestamp));
}

function notificationCopy(item: SocialNotificationItem) {
  if (item.kind === "new_follower") return "followed you";
  if (item.objectType === "receipt") return "completed a Gameplan review";
  if (item.objectType === "precord") return "posted a new Gameplan";
  return "shared a new record";
}

export default function SocialNotificationsPanel({
  items,
  configured,
  loading,
  loadingMore,
  error,
  nextOffset,
  onOpen,
  onLoadMore,
  onMarkAllRead,
}: SocialNotificationsPanelProps) {
  if (!configured) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
        <BellOff className="h-6 w-6 text-muted" />
        <div className="mt-3 text-[11px] font-semibold text-foreground">Social alerts are being connected</div>
        <p className="mt-2 max-w-xs text-[8px] leading-4 text-muted">Apply the profile follows migration in Supabase to activate follower and account notifications.</p>
      </div>
    );
  }

  if (loading && !items.length) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center text-primary">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        <span className="mt-3 text-[8px] text-muted">Loading notifications…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">People and records</span>
        {items.some((item) => !item.readAt) ? (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[8px] font-semibold text-muted hover:bg-surface hover:text-foreground"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length ? (
          <div className="divide-y divide-border/70">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item)}
                className={`relative flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-surface/60 ${
                  item.readAt ? "" : "bg-primary/[0.045]"
                }`}
              >
                {!item.readAt ? <span className="absolute left-0 top-0 h-full w-0.5 bg-primary shadow-[0_0_12px_var(--primary)]" /> : null}
                <span className="relative">
                  <UserAvatar
                    label={item.sourceDisplayName}
                    avatarUrl={item.sourceAvatarUrl}
                    size="sm"
                  />
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-panel bg-primary text-on-primary">
                    {item.kind === "new_follower" ? <UserPlus className="h-2.5 w-2.5" /> : <Bell className="h-2.5 w-2.5" />}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] leading-4 text-muted">
                    <strong className="font-semibold text-foreground">{item.sourceDisplayName}</strong>{" "}
                    {notificationCopy(item)}.
                  </span>
                  <span className="mt-1 block text-[7px] text-primary">
                    {item.sourceHandle ? `@${item.sourceHandle} · ` : ""}{timeAgo(item.createdAt)}
                  </span>
                </span>
                {!item.readAt ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_9px_var(--primary)]" /> : null}
              </button>
            ))}
            {nextOffset !== null ? (
              <div className="p-3 text-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="h-8 rounded-xl border border-border bg-surface px-4 text-[8px] font-semibold text-muted hover:text-foreground disabled:cursor-wait"
                >
                  {loadingMore ? "Loading…" : "Load older"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
            <Bell className="h-6 w-6 text-muted" />
            <div className="mt-3 text-[11px] font-semibold text-foreground">You’re all caught up</div>
            <p className="mt-2 max-w-xs text-[8px] leading-4 text-muted">New followers and updates from profiles you notify will appear here.</p>
          </div>
        )}
        {error ? <div className="border-t border-border p-3 text-center text-[8px] text-danger">{error}</div> : null}
      </div>
    </div>
  );
}
