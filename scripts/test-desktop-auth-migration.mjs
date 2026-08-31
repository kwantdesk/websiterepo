import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../supabase/migrations/202608280001_create_desktop_auth.sql", import.meta.url),
  "utf8",
);
const scopeExpansion = await readFile(
  new URL("../supabase/migrations/202608300001_expand_desktop_scopes_for_native_workspaces.sql", import.meta.url),
  "utf8",
);
const socialsMutation = await readFile(
  new URL("../supabase/migrations/202608300002_create_desktop_social_follow_mutations.sql", import.meta.url),
  "utf8",
);
const socialsReactionMutation = await readFile(
  new URL("../supabase/migrations/202608300003_create_desktop_social_reaction_mutations.sql", import.meta.url),
  "utf8",
);

for (const table of [
  "desktop_access_entitlements",
  "desktop_authorization_codes",
  "desktop_sessions",
  "desktop_refresh_handles",
  "desktop_revoked_ticket_ids",
]) {
  assert.match(source, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(source, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, "i"));
}

for (const routine of [
  "desktop_exchange_authorization_code",
  "desktop_rotate_refresh_handle",
  "desktop_revoke_session",
  "desktop_ticket_is_revoked",
  "desktop_auth_cleanup",
]) {
  assert.match(source, new RegExp(`security definer[\\s\\S]*?set search_path = ''`, "i"));
  assert.match(source, new RegExp(`grant execute on function public\\.${routine}`, "i"));
}

assert.match(source, /expires_at <= created_at \+ interval '60 seconds'/i);
assert.match(source, /code_hash ~ '\^\[a-f0-9\]\{64\}\$'/i);
assert.match(source, /handle_hash ~ '\^\[a-f0-9\]\{64\}\$'/i);
assert.match(source, /desktop_sessions_last_ticket_shape[\s\S]*?last_ticket_jti ~\* '\^\[0-9a-f\]/i);
assert.match(source, /desktop_revoked_ticket_ids_jti_shape[\s\S]*?jti ~\* '\^\[0-9a-f\]/i);
assert.match(source, /desktop_sessions_revoked_idx[\s\S]*?where revoked_at is not null/i);
assert.match(source, /if handle_row\.consumed_at is not null then[\s\S]*?'refresh_replay'/i);
assert.match(source, /for update;/i);
assert.match(source, /least\(next_refresh_expires_at, session_row\.expires_at\)/i);
assert.match(source, /select not exists \([\s\S]*?revoked_at is null[\s\S]*?expires_at > statement_timestamp\(\)/i);
assert.doesNotMatch(source, /insert into public\.desktop_access_entitlements/i);
assert.doesNotMatch(source, /service_role_key|private_key|gateway_token/i);
for (const scope of [
  "options.analytics:read", "assistant.zyon:read", "assistant.zyon:write",
  "news.intelligence:read", "news.intelligence:write", "socials.account:read",
]) {
  assert.match(scopeExpansion, new RegExp(scope.replace(".", "\\."), "i"));
}
assert.doesNotMatch(scopeExpansion, /insert into public\.desktop_access_entitlements/i);
assert.match(scopeExpansion, /never grants a new scope to an account/i);

assert.match(socialsMutation, /socials\.account:write/i);
assert.doesNotMatch(socialsMutation, /insert into public\.desktop_access_entitlements/i);
assert.match(socialsMutation, /never grants a new scope to an account/i);
assert.match(socialsMutation, /desktop_socials_mutation_receipts[\s\S]*?enable row level security/i);
assert.match(socialsMutation, /revoke all on table public\.desktop_socials_mutation_receipts from public, anon, authenticated/i);
assert.match(socialsMutation, /desktop_socials_apply_follow_mutation[\s\S]*?security definer[\s\S]*?set search_path = ''/i);
assert.match(socialsMutation, /pg_advisory_xact_lock/i);
assert.match(socialsMutation, /applied_at := clock_timestamp\(\)/i);
assert.match(socialsMutation, /request_hash ~ '\^\[a-f0-9\]\{64\}\$'/i);
assert.match(socialsMutation, /interval '90 days'/i);
assert.match(socialsMutation, /offset 5000/i);
assert.match(socialsMutation, /grant execute on function public\.desktop_socials_apply_follow_mutation[\s\S]*?to service_role/i);

assert.doesNotMatch(socialsReactionMutation, /insert into public\.desktop_access_entitlements/i);
assert.match(socialsReactionMutation, /desktop_socials_mutation_receipts_operation_check[\s\S]*?'reaction'/i);
assert.match(socialsReactionMutation, /desktop_socials_reaction_summary[\s\S]*?security definer[\s\S]*?set search_path = ''/i);
assert.match(socialsReactionMutation, /desktop_socials_apply_reaction_mutation[\s\S]*?security definer[\s\S]*?set search_path = ''/i);
assert.match(socialsReactionMutation, /pg_advisory_xact_lock/i);
assert.match(socialsReactionMutation, /p_request_hash !~ '\^\[a-f0-9\]\{64\}\$'/i);
assert.match(socialsReactionMutation, /interval '90 days'/i);
assert.match(socialsReactionMutation, /offset 5000/i);
assert.match(socialsReactionMutation, /grant execute on function public\.desktop_socials_reaction_summary[\s\S]*?to service_role/i);
assert.match(socialsReactionMutation, /grant execute on function public\.desktop_socials_apply_reaction_mutation[\s\S]*?to service_role/i);

console.log("desktop auth migration structural contract: pass");
