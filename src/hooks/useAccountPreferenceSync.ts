"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { captureBrowserPreferences, isTrackedStorageKey, readScopedPreferences, receiveAccountPreferences } from "@/lib/userPreferences";
import { accountPreferenceFingerprint, mergeAccountPreferenceChanges, mergePaperTradingLedgerUpdate, paperValuationFingerprint } from "@/lib/accountPreferenceMerge";
import { retainInitialIndicatorEdits } from "@/lib/workspaceIndicatorPreferences";
import { normalizePaperTradingLedger } from "@/lib/paperTrading";
import { exchangeAccountPreferences, readAccountPreferenceRevision } from "@/lib/accountPreferenceCloud";

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
    let revisionBusy = false;
    let knownRevision: string | null | undefined;
    let publishMarks = false;
    const acknowledged = readScopedPreferences(userId);
    let needsInitialRead = !acknowledged;
    let base = acknowledged ?? captureBrowserPreferences();
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
      const markHandoff = publishMarks;
      const write = !needsInitialRead && (dirty || (markHandoff
        && paperValuationFingerprint(sent) !== paperValuationFingerprint(base)));
      try {
        // Focus/reconnect hints can repeat without a saved change. Compare
        // the tiny revision first instead of repeatedly loading the full
        // workspace/ledger document. Actual local edits and valuation handoffs
        // still go directly through the conflict-safe exchange.
        if (!write && !needsInitialRead && knownRevision !== undefined) {
          const revision = await readAccountPreferenceRevision(supabase, userId);
          if (!active || revision === knownRevision) return;
        }
        // Following failed initial hydration, this browser's defaults are not
        // an acknowledged account revision. Read the real account first; only
        // subsequent edits may be uploaded. Preserve edits during this read.
        const result = await exchangeAccountPreferences(supabase, userId, base, needsInitialRead ? base : sent, write);
        if (!active) return;
        // Preserve edits made while the request was in flight.
        const latest = captureBrowserPreferences();
        const received = needsInitialRead
          ? retainInitialIndicatorEdits(base, sent, result.snapshot)
          : result.snapshot;
        const applied = mergeAccountPreferenceChanges(sent, latest, received);
        // Local quote marking must not be rewound by an unchanged cloud ledger.
        const ledgerKey = 'kwantify-paper-trading-ledger-v1';
        if (latest.values[ledgerKey] && accountPreferenceFingerprint({ ...latest, values: { [ledgerKey]: latest.values[ledgerKey] } })
          === accountPreferenceFingerprint({ ...applied, values: { [ledgerKey]: applied.values[ledgerKey] } })) {
          applied.values[ledgerKey] = JSON.stringify(mergePaperTradingLedgerUpdate(
            normalizePaperTradingLedger(JSON.parse(latest.values[ledgerKey])),
            normalizePaperTradingLedger(JSON.parse(applied.values[ledgerKey])),
          ));
        }
        base = result.remote;
        knownRevision = result.revision;
        needsInitialRead = false;
        if (write) publishMarks = false;
        receiveAccountPreferences(userId, applied, result.remote);
        failures = 0; retryAfter = 0;
        window.dispatchEvent(new CustomEvent('kwantdesk:account-sync-status', { detail: { state: 'saved', userId } }));
        if (write && channelReady) void channel.send({ type: 'broadcast', event: 'changed', payload: {} });
        if (accountPreferenceFingerprint(applied) !== accountPreferenceFingerprint(base)) queued = true;
        if (publishMarks && paperValuationFingerprint(applied) !== paperValuationFingerprint(base)) queued = true;
      } catch {
        failures++;
        retryAfter = Date.now() + Math.min(60000, 2000 * 2 ** Math.min(failures - 1, 5));
        queued = true;
        window.dispatchEvent(new CustomEvent('kwantdesk:account-sync-status', { detail: { state: 'offline', userId } }));
      } finally {
        busy = false;
        if (queued && active) { queued = false; schedule(); }
      }
    };
    const schedule = (localOnly = false) => {
      if (!localOnly) refreshScheduled = true;
      // Bounded leading-edge coalescing: continuous trade/drawing events must
      // never postpone a saved workspace indefinitely.
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        const refresh = refreshScheduled;
        refreshScheduled = false;
        if (!refresh && accountPreferenceFingerprint(captureBrowserPreferences()) === accountPreferenceFingerprint(base)) return;
        void synchronize();
      }, Math.max(300, retryAfter - Date.now()));
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
    const reconnect = () => {
      retryAfter = 0;
      // A foreground/online return must replace a pending offline backoff,
      // while ordinary live events retain their original bounded deadline.
      if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; }
      schedule();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') reconnect(); };
    const onHidden = () => { if (document.visibilityState === 'hidden') { publishMarks = true; schedule(); } };
    channel.on('broadcast', { event: 'changed' }, (message) => {
      if (message?.payload?.requestMarks === true) publishMarks = true;
      schedule();
    })
      .subscribe(status => {
        channelReady = status === 'SUBSCRIBED';
        if (channelReady) {
          schedule();
          void channel.send({ type: 'broadcast', event: 'changed', payload: { requestMarks: true } });
        }
      });
    // Broadcasts are transient, not durable delivery. A visible phone can miss
    // the trade hint without ever regaining focus (and previously waited 30s).
    // Check just the private row revision; fetch/merge its payload only when it
    // changed. Never download the whole workspace every five seconds.
    const checkRevision = async () => {
      if (!active || document.visibilityState !== 'visible' || busy || revisionBusy || Date.now() < retryAfter) return;
      revisionBusy = true;
      try {
        const revision = await readAccountPreferenceRevision(supabase, userId);
        if (active && revision !== knownRevision) schedule();
      } catch {
        // The normal synchronizer owns bounded retries and retains local edits.
        if (active) schedule();
      } finally { revisionBusy = false; }
    };
    const interval = window.setInterval(() => void checkRevision(), 5000);
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
