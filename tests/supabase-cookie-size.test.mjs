import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("workspace preferences are never persisted inside Supabase auth metadata", async () => {
  const [preferences, workspace, settings] = await Promise.all([
    readFile(new URL("src/lib/userPreferences.ts", root), "utf8"),
    readFile(new URL("src/components/KwantifyWorkspace.tsx", root), "utf8"),
    readFile(new URL("src/components/KwantifySettingsWorkspace.tsx", root), "utf8"),
  ]);

  assert.doesNotMatch(
    preferences,
    /\[USER_PREFERENCES_METADATA_KEY\]: metadataFallbackSnapshot/,
  );
  assert.doesNotMatch(workspace, /chartSettings:\s*settings,\s*chart_settings:\s*settings/);
  assert.doesNotMatch(settings, /chartSettings:\s*settings,\s*chart_settings:\s*settings/);
  assert.match(preferences, /compactLegacyAuthPreferenceMetadata/);
});

test("browser startup expires obsolete Supabase project cookie families", async () => {
  const [hygiene, primaryClient, secondaryClient] = await Promise.all([
    readFile(new URL("src/lib/supabaseCookieHygiene.ts", root), "utf8"),
    readFile(new URL("src/lib/supabase.ts", root), "utf8"),
    readFile(new URL("src/lib/supabase/client.ts", root), "utf8"),
  ]);

  assert.match(hygiene, /name\.startsWith\("sb-"\)/);
  assert.match(hygiene, /Max-Age=0/);
  assert.match(primaryClient, /clearObsoleteSupabaseCookies\(url\)/);
  assert.match(secondaryClient, /clearObsoleteSupabaseCookies\(url\)/);
});
