"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  SocialNotificationItem,
  SocialNotificationsResponse,
} from "@/lib/socialNotifications";

const REFRESH_INTERVAL_MS = 45_000;

export function useSocialNotifications() {
  const [items, setItems] = useState<SocialNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const fetchingRef = useRef(false);

  const load = useCallback(async (offset = 0, append = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/socials/notifications?offset=${offset}&limit=30`,
        { cache: "no-store" },
      );
      const result = await response.json() as SocialNotificationsResponse;
      if (!response.ok) {
        if (result.code === "FOLLOW_MIGRATION_REQUIRED") {
          setConfigured(false);
          setItems([]);
          setUnreadCount(0);
          setNextOffset(null);
          return;
        }
        throw new Error(result.error || "Notifications could not be loaded.");
      }
      setConfigured(result.configured !== false);
      setItems((current) => append
        ? [
            ...current,
            ...(result.items ?? []).filter((item) => !current.some((existing) => existing.id === item.id)),
          ]
        : result.items ?? []);
      setUnreadCount(Math.max(0, result.unreadCount ?? 0));
      setNextOffset(result.nextOffset ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Notifications could not be loaded.");
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const markRead = useCallback(async (ids: string[]) => {
    const unreadIds = new Set(ids);
    if (!unreadIds.size) return;
    const readAt = new Date().toISOString();
    const changed = items.filter((item) => unreadIds.has(item.id) && !item.readAt).length;
    setItems((current) => current.map((item) => {
      if (!unreadIds.has(item.id) || item.readAt) return item;
      return { ...item, readAt };
    }));
    setUnreadCount((current) => Math.max(0, current - changed));
    try {
      const response = await fetch("/api/socials/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", ids }),
      });
      const result = await response.json() as SocialNotificationsResponse;
      if (!response.ok) throw new Error(result.error || "Notification could not be marked as read.");
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Notification could not be marked as read.");
      void load();
    }
  }, [items, load]);

  const markAllRead = useCallback(async () => {
    const previousItems = items;
    const previousUnreadCount = unreadCount;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => item.readAt ? item : { ...item, readAt }));
    setUnreadCount(0);
    try {
      const response = await fetch("/api/socials/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read-all" }),
      });
      const result = await response.json() as SocialNotificationsResponse;
      if (!response.ok) throw new Error(result.error || "Notifications could not be marked as read.");
    } catch (markError) {
      setItems(previousItems);
      setUnreadCount(previousUnreadCount);
      setError(markError instanceof Error ? markError.message : "Notifications could not be marked as read.");
    }
  }, [items, unreadCount]);

  return {
    items,
    unreadCount,
    configured,
    loading,
    loadingMore,
    error,
    nextOffset,
    refresh: () => load(),
    loadMore: () => nextOffset === null ? Promise.resolve() : load(nextOffset, true),
    markRead,
    markAllRead,
  };
}
