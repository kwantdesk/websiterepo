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

    const persist = async () => {
      if (!active) return;
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
        if (active) lastSavedFingerprintRef.current = fingerprint;
      } catch {
        if (active) lastSavedFingerprintRef.current = "";
      } finally {
        saving = false;
        if (pending && active) {
          pending = false;
          void persist();
        }
      }
    };

    lastSavedFingerprintRef.current = preferenceSnapshotFingerprint(captureBrowserPreferences());
    const interval = window.setInterval(() => void persist(), 1_500);
    const handlePreferenceChange = () => void persist();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") void persist();
    };
    window.addEventListener("kwantdesk:preferences-changed", handlePreferenceChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      void persist();
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("kwantdesk:preferences-changed", handlePreferenceChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, supabase, userId]);
}
