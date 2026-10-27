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
    const restore = async () => {
      const { data } = await client.auth.getUser();
      if (!alive) return;
      if (!data.user) { setOwner(''); return; }
      try { await hydrateUserPreferences(client, data.user); } catch { return; }
      if (alive) setOwner(data.user.id);
    };
    void restore();
    const subscription = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') setOwner('');
      else if (event === 'SIGNED_IN') queueMicrotask(() => { if (alive) void restore(); });
    });
    return () => { alive = false; subscription.data.subscription.unsubscribe(); };
  }, [active, client]);
  useAccountPreferenceSync({ supabase: client, userId: owner, enabled: active && Boolean(owner) });
  return null;
}
