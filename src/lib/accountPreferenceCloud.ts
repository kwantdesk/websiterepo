import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeSnapshot, type UserPreferenceSnapshot } from './userPreferences';
import { accountPreferenceFingerprint, mergeAccountPreferenceChanges, paperValuationFingerprint } from './accountPreferenceMerge';
import { accountPreferenceReadUnavailable, isMissingPreferenceStore } from './accountPreferenceErrors';

const empty = (): UserPreferenceSnapshot => ({ version: 1, complete: true, updatedAt: new Date(0).toISOString(), values: {} });

/** A missed websocket hint must not strand an open trade on another device.
 * Read only the revision here, not the potentially large workspace/ledger. */
export async function readAccountPreferenceRevision(client: SupabaseClient, userId: string,
  signal = AbortSignal.timeout(8_000)): Promise<string | null> {
  for (const table of ['user_preferences', 'social_objects'] as const) {
    let query = client.from(table).select('updated_at').eq('user_id', userId);
    if (table === 'social_objects') query = query.eq('id', 'account-preferences');
    const result = await query.abortSignal(signal).maybeSingle();
    if (result.error) {
      if (isMissingPreferenceStore(result.error)) continue;
      throw accountPreferenceReadUnavailable();
    }
    if (result.data) return result.data.updated_at;
  }
  return null;
}

/** Compare-and-swap prevents a stale phone from replacing a newer desktop row. */
export async function exchangeAccountPreferences(client: SupabaseClient, userId: string,
  base: UserPreferenceSnapshot, local: UserPreferenceSnapshot, write: boolean, signal = AbortSignal.timeout(8_000)) {
  for (const table of ['user_preferences', 'social_objects'] as const) {
    for (let attempt = 0; attempt < 5; attempt++) {
      let query = client.from(table).select(table === 'user_preferences' ? 'preferences,updated_at' : 'payload,updated_at').eq('user_id', userId);
      if (table === 'social_objects') query = query.eq('id', 'account-preferences');
      const result = await query.abortSignal(signal).maybeSingle();
      if (result.error) {
        if (isMissingPreferenceStore(result.error)) break;
        throw accountPreferenceReadUnavailable();
      }
      const row = result.data as unknown as { preferences?: unknown; payload?: { preferences?: unknown }; updated_at: string } | null;
      const raw = table === 'user_preferences' ? row?.preferences : row?.payload?.preferences;
      let revision = row?.updated_at ?? null;
      let remote = normalizeSnapshot(raw, row?.updated_at);
      if (row && !remote) throw accountPreferenceReadUnavailable();
      if (!row && table === 'user_preferences') {
        const legacy = await client.from('social_objects').select('payload,updated_at')
          .eq('user_id', userId).eq('id', 'account-preferences').abortSignal(signal).maybeSingle();
        if (legacy.error && !isMissingPreferenceStore(legacy.error)) throw accountPreferenceReadUnavailable();
        remote = normalizeSnapshot(legacy.data?.payload?.preferences, legacy.data?.updated_at);
        revision = legacy.data?.updated_at ?? null;
        if (legacy.data && !remote) throw accountPreferenceReadUnavailable();
      }
      remote ??= row ? empty() : base;
      const snapshot = mergeAccountPreferenceChanges(base, local, remote);
      if (!write) return { remote, snapshot, revision };
      // A save/hydration or CAS retry may already be satisfied by a peer.
      // Rewriting the entire JSON document in that case creates needless
      // TOAST/WAL work and broadcasts another revision to every device.
      // Keep valuation handoffs even though ordinary quote ticks are excluded
      // from the execution fingerprint. A missing primary row must still be
      // inserted when migrating a legacy snapshot.
      if (row && accountPreferenceFingerprint(snapshot) === accountPreferenceFingerprint(remote)
        && paperValuationFingerprint(snapshot) === paperValuationFingerprint(remote)) {
        return { remote, snapshot, revision };
      }
      // Monotonic revision even if two devices' clocks disagree.
      snapshot.updatedAt = new Date(Math.max(Date.now(), (Date.parse(row?.updated_at ?? '') || 0) + 1)).toISOString();
      const fields = table === 'user_preferences'
        ? { preferences: snapshot, updated_at: snapshot.updatedAt }
        : { payload: { preferences: snapshot }, updated_at: snapshot.updatedAt };
      if (row) {
        let update = client.from(table).update(fields).eq('user_id', userId).eq('updated_at', row.updated_at);
        if (table === 'social_objects') update = update.eq('id', 'account-preferences');
        const saved = await update.select('updated_at').abortSignal(signal).maybeSingle();
        if (saved.error) throw accountPreferenceReadUnavailable();
        if (!saved.data) {
          if (attempt === 4) throw new Error('Account changed concurrently; retrying.');
          continue; // A competing write won; rebase, never overwrite.
        }
      } else {
        const saved = table === 'user_preferences'
          ? await client.from('user_preferences').insert({ user_id: userId, preferences: snapshot, updated_at: snapshot.updatedAt }).abortSignal(signal)
          : await client.from('social_objects').insert({ user_id: userId, id: 'account-preferences', author_label: 'Kwant Desk account',
              object_type: 'progress', scope: 'private', desk_id: null, parent_id: null,
              payload: { preferences: snapshot }, updated_at: snapshot.updatedAt }).abortSignal(signal);
        if (saved.error?.code === '23505') {
          if (attempt === 4) throw new Error('Account changed concurrently; retrying.');
          continue;
        }
        if (saved.error) throw accountPreferenceReadUnavailable();
      }
      return { remote: snapshot, snapshot, revision: snapshot.updatedAt };
    }
  }
  throw new Error('Account sync is unavailable; local changes have been retained.');
}
