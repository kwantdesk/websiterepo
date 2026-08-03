"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  captureBrowserPreferences,
  preferenceSnapshotFingerprint,
  saveUserPreferences,
} from "@/lib/userPreferences";

export function useAccountPreferenceSync({
  supabase,
  userId,
  enabled,
}: {
  supabase: SupabaseClient | null;
  userId: string;
  enabled: boolean;
}) {
  const lastSavedFingerprintRef = useRef("");

  useEffect(() => {
    if (!enabled || !supabase || !userId) return;
    let active = true;
    let saving = false;
    let pending = false;
    let consecutiveFailures = 0;
    let retryAfter = 0;
    let eventTimer: number | null = null;

    const persist = async (force = false) => {
      if (!active) return;
      if (!force && Date.now() < retryAfter) return;
      if (saving) {
        pending = true;
        return;
      }
      const snapshot = captureBrowserPreferences();
      const fingerprint = preferenceSnapshotFingerprint(snapshot);
      if (fingerprint === lastSavedFingerprintRef.current) return;

      saving = true;
      try {
        await saveUserPreferences(supabase, userId, snapshot);
        if (active) {
          lastSavedFingerprintRef.current = fingerprint;
          consecutiveFailures = 0;
          retryAfter = 0;
        }
      } catch {
        if (active) {
          consecutiveFailures += 1;
          retryAfter = Date.now() + Math.min(
            60_000,
            5_000 * (2 ** Math.min(consecutiveFailures - 1, 4)),
          );
        }
      } finally {
        saving = false;
        if (pending && active) {
          pending = false;
          void persist();
        }
      }
    };

    lastSavedFingerprintRef.current = preferenceSnapshotFingerprint(captureBrowserPreferences());
    // Preference writes are event-driven. The old 1.5-second poll repeatedly
    // enumerated and serialised all localStorage chart state even when nothing
    // changed, and a failed Supabase write could turn it into a retry storm.
    const interval = window.setInterval(() => void persist(), 60_000);
    const handlePreferenceChange = () => {
      if (eventTimer !== null) window.clearTimeout(eventTimer);
      eventTimer = window.setTimeout(() => {
        eventTimer = null;
        void persist();
      }, 750);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") void persist(true);
    };
    window.addEventListener("kwantdesk:preferences-changed", handlePreferenceChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (eventTimer !== null) window.clearTimeout(eventTimer);
      void persist(true);
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("kwantdesk:preferences-changed", handlePreferenceChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, supabase, userId]);
}
