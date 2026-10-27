import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeSnapshot, type UserPreferenceSnapshot } from './userPreferences';
import { mergeAccountPreferenceChanges } from './accountPreferenceMerge';

const empty = (): UserPreferenceSnapshot => ({ version: 1, complete: true, updatedAt: new Date(0).toISOString(), values: {} });

/** Compare-and-swap prevents a stale phone from replacing a newer desktop row. */
export async function exchangeAccountPreferences(client: SupabaseClient, userId: string,
  base: UserPreferenceSnapshot, local: UserPreferenceSnapshot, write: boolean) {
  for (const table of ['user_preferences', 'social_objects'] as const) {
    for (let attempt = 0; attempt < 5; attempt++) {
      let query = client.from(table).select(table === 'user_preferences' ? 'preferences,updated_at' : 'payload,updated_at').eq('user_id', userId);
      if (table === 'social_objects') query = query.eq('id', 'account-preferences');
      const result = await query.maybeSingle();
      if (result.error) break;
      const row = result.data as unknown as { preferences?: unknown; payload?: { preferences?: unknown }; updated_at: string } | null;
      const raw = table === 'user_preferences' ? row?.preferences : row?.payload?.preferences;
      let remote = normalizeSnapshot(raw, row?.updated_at);
      if (row && !remote) break; // Corrupt cloud state is never permission to erase local work.
      if (!row && table === 'user_preferences') {
        const legacy = await client.from('social_objects').select('payload,updated_at')
          .eq('user_id', userId).eq('id', 'account-preferences').maybeSingle();
        remote = normalizeSnapshot(legacy.data?.payload?.preferences, legacy.data?.updated_at);
      }
      remote ??= row ? empty() : base;
      const snapshot = mergeAccountPreferenceChanges(base, local, remote);
      if (!write) return { remote, snapshot };
      // Monotonic revision even if two devices' clocks disagree.
      snapshot.updatedAt = new Date(Math.max(Date.now(), (Date.parse(row?.updated_at ?? '') || 0) + 1)).toISOString();
      const fields = table === 'user_preferences'
        ? { preferences: snapshot, updated_at: snapshot.updatedAt }
        : { payload: { preferences: snapshot }, updated_at: snapshot.updatedAt };
      if (row) {
        let update = client.from(table).update(fields).eq('user_id', userId).eq('updated_at', row.updated_at);
        if (table === 'social_objects') update = update.eq('id', 'account-preferences');
        const saved = await update.select('updated_at').maybeSingle();
        if (saved.error) break;
        if (!saved.data) {
          if (attempt === 4) throw new Error('Account changed concurrently; retrying.');
          continue; // A competing write won; rebase, never overwrite.
        }
      } else {
        const saved = table === 'user_preferences'
          ? await client.from('user_preferences').insert({ user_id: userId, preferences: snapshot, updated_at: snapshot.updatedAt })
          : await client.from('social_objects').insert({ user_id: userId, id: 'account-preferences', author_label: 'Kwant Desk account',
              object_type: 'progress', scope: 'private', desk_id: null, parent_id: null,
              payload: { preferences: snapshot }, updated_at: snapshot.updatedAt });
        if (saved.error?.code === '23505') {
          if (attempt === 4) throw new Error('Account changed concurrently; retrying.');
          continue;
        }
        if (saved.error) break;
      }
      return { remote: snapshot, snapshot };
    }
  }
  throw new Error('Account sync is unavailable; local changes have been retained.');
}
