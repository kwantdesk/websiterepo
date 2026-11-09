"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hydrateUserPreferences } from '@/lib/userPreferences';
import { useAccountPreferenceSync } from '@/hooks/useAccountPreferenceSync';

/** Home and Accounts are outside the persistent chart/settings shells. */
export default function StandaloneAccountSync() {
  const path = usePathname();
  const active = path === '/' || path === '/accounts';
  const client = useMemo(() => { try { return createClient(); } catch { return null; } }, []);
  const [owner, setOwner] = useState('');
  useEffect(() => {
    if (!active || !client) return;
    let alive = true;
    let busy = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const restore = async () => {
      if (!alive || busy) return;
      busy = true;
      if (retry !== undefined) { clearTimeout(retry); retry = undefined; }
      try {
        const { data, error } = await client.auth.getUser();
        if (!alive) return;
        if (error) throw error;
        if (!data.user) { setOwner(''); return; }
        await hydrateUserPreferences(client, data.user);
        if (alive) { failures = 0; setOwner(data.user.id); }
      } catch {
        // A failed first read is not an empty account. Keep local data and
        // retry rather than leaving a phone permanently outside the sync loop.
        if (alive) retry = setTimeout(() => { retry = undefined; void restore(); },
          Math.min(30_000, 2_000 * 2 ** Math.min(failures++, 4)));
      } finally { busy = false; }
    };
    const reconnect = () => { if (document.visibilityState === 'visible') void restore(); };
    void restore();
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    const subscription = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') setOwner('');
      else if (event === 'SIGNED_IN') queueMicrotask(() => { if (alive) void restore(); });
    });
    return () => {
      alive = false;
      if (retry !== undefined) clearTimeout(retry);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('focus', reconnect);
      document.removeEventListener('visibilitychange', reconnect);
      subscription.data.subscription.unsubscribe();
    };
  }, [active, client]);
  useAccountPreferenceSync({ supabase: client, userId: owner, enabled: active && Boolean(owner) });
  return null;
}
