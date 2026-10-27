"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { captureBrowserPreferences, isTrackedStorageKey, readScopedPreferences, receiveAccountPreferences } from "@/lib/userPreferences";
import { accountPreferenceFingerprint, mergeAccountPreferenceChanges } from "@/lib/accountPreferenceMerge";
import { exchangeAccountPreferences } from "@/lib/accountPreferenceCloud";

export function useAccountPreferenceSync({ supabase, userId, enabled }: {
  supabase: SupabaseClient | null; userId: string; enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled || !supabase || !userId) return;
    const owner = window.localStorage.getItem('kwantdesk:active-preferences-owner:v1');
    if (owner && owner !== userId) return;
    let active = true, busy = false, queued = false, failures = 0;
    let retryAfter = 0, timer: number | undefined;
    let refreshScheduled = false;
    let base = readScopedPreferences(userId) ?? captureBrowserPreferences();
    // Broadcast is a change hint only. The authenticated, RLS-scoped database
    // read carries the data; no account/workspace/trade payload is broadcast.
    const channel = supabase.channel(`account-preference-hints:${userId}`, { config: { broadcast: { self: false } } });
    let channelReady = false;
    const synchronize = async () => {
      if (!active || Date.now() < retryAfter) return;
      if (busy) { queued = true; return; }
      busy = true;
      const sent = captureBrowserPreferences();
      const dirty = accountPreferenceFingerprint(sent) !== accountPreferenceFingerprint(base);
      try {
        const result = await exchangeAccountPreferences(supabase, userId, base, sent, dirty);
        if (!active) return;
        // Preserve edits made while the request was in flight.
        const latest = captureBrowserPreferences();
        const applied = mergeAccountPreferenceChanges(sent, latest, result.snapshot);
        // Local quote marking must not be rewound by an unchanged cloud ledger.
        const ledgerKey = 'kwantify-paper-trading-ledger-v1';
        if (latest.values[ledgerKey] && accountPreferenceFingerprint({ ...latest, values: { [ledgerKey]: latest.values[ledgerKey] } })
          === accountPreferenceFingerprint({ ...applied, values: { [ledgerKey]: applied.values[ledgerKey] } })) {
          applied.values[ledgerKey] = latest.values[ledgerKey];
        }
        base = result.remote;
        receiveAccountPreferences(userId, applied, result.remote);
        failures = 0; retryAfter = 0;
        window.dispatchEvent(new CustomEvent('kwantdesk:account-sync-status', { detail: { state: 'saved', userId } }));
        if (dirty && channelReady) void channel.send({ type: 'broadcast', event: 'changed', payload: {} });
        if (accountPreferenceFingerprint(applied) !== accountPreferenceFingerprint(base)) queued = true;
      } catch {
        failures++;
        retryAfter = Date.now() + Math.min(60000, 2000 * 2 ** Math.min(failures - 1, 5));
        window.dispatchEvent(new CustomEvent('kwantdesk:account-sync-status', { detail: { state: 'offline', userId } }));
      } finally {
        busy = false;
        if (queued && active) { queued = false; schedule(); }
      }
    };
    const schedule = (localOnly = false) => {
      if (!localOnly) refreshScheduled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        const refresh = refreshScheduled;
        refreshScheduled = false;
        if (!refresh && accountPreferenceFingerprint(captureBrowserPreferences()) === accountPreferenceFingerprint(base)) return;
        void synchronize();
      }, 300);
    };
    const onLocalChange = (event?: Event) => {
      // Cache/telemetry writes from another trading tab are not account edits.
      // Debounce BEFORE scanning storage or parsing the growing paper ledger.
      if (event?.type === "storage") {
        const key = (event as StorageEvent).key;
        if (key && !isTrackedStorageKey(key)) return;
      }
      schedule(true);
    };
    const reconnect = () => { retryAfter = 0; schedule(); };
    const onVisible = () => { if (document.visibilityState === 'visible') reconnect(); };
    const onHidden = () => { if (document.visibilityState === 'hidden') void synchronize(); };
    channel.on('broadcast', { event: 'changed' }, () => schedule())
      .subscribe(status => {
        channelReady = status === 'SUBSCRIBED';
        if (channelReady) {
          schedule();
          void channel.send({ type: 'broadcast', event: 'changed', payload: {} });
        }
      });
    // Missed notifications / suspended mobile tabs recover on focus and online.
    // This is bounded account-state traffic directly to storage, never tick data.
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void synchronize(); }, 30000);
    window.addEventListener('kwantdesk:preferences-changed', onLocalChange);
    window.addEventListener('storage', onLocalChange);
    window.addEventListener('focus', reconnect);
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('visibilitychange', onHidden);
    schedule();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('kwantdesk:preferences-changed', onLocalChange);
      window.removeEventListener('storage', onLocalChange);
      window.removeEventListener('focus', reconnect);
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('visibilitychange', onHidden);
      void supabase.removeChannel(channel);
    };
  }, [enabled, supabase, userId]);
}
