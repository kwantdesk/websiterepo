# Recurring Supabase Auth outage — 9 November 2026

## Restored service

The owner requested repair, not a status-only explanation. Used existing authorized project-restart scope. Only Supabase project wmkqvoeqeplnutkmrgim was restarted through its signed-in dashboard, in an isolated hidden browser tab. No owner trading tab was refreshed, no VPS/terminal/collector/provider subscription was restarted, no upgrade purchased and no account/order/workspace/journal rows edited.

Before restart, Auth health and JWKS exceeded25seconds locally. From the VPS, DNS completed in7ms and TLS in37ms but no first byte arrived within15seconds. This establishes dependency failure beyond the laptop connection; it does not identify a provider-wide outage. Supabase's global status endpoint reported operational.

Dashboard Auth report (last60minutes around05:17UTC): /user504 average93,955ms, refresh-token504 average76,787.5ms, successful refresh average30,501.33ms. Database logs showed repeated57014 statement timeouts and AccessShareLock waits on relation112306, held by PID245260. A bounded activity snapshot later had no active blockers; dashboard metadata/advisor queries were active for10–44seconds. The table-size query failed through the SQL UI with an upstream timeout. No repeated unbounded SQL loops were run.

After restart, dashboard status became Healthy. Auth health returned200 in707ms, JWKS200 in680ms with ES256. VPS JWKS returned200 in532ms. Anonymous preferences read correctly returned401/permission denied; that is expected privacy enforcement, not a missing-table failure. Noninteractive sign-in handshake returned303 from KwantDesk in427ms and302 from Supabase to accounts.google.com in521ms. Interactive Google account selection/consent and a real user's callback were not performed.

## Engineering repairs

1. public/auth-recovery.js previously stopped after three failed HEAD probes. A minutes-long dependency interruption stranded the existing page after Auth recovered. Recovery now keeps one verification in flight, exponentially backs off to30seconds, pauses while hidden, resumes on visible/online/manual retry, stops on page exit and reloads only after successful verification. No credentials are cleared and no auth decision is bypassed.
2. Exact GET routes /api/socials, /api/socials/notifications and /api/journal previously remotely verified the session in middleware and again in their handler. Logs showed paired Edge/node /user reads and source confirmed the duplicate. Removed only the middleware duplicate after existing site-access and Supabase configuration checks. All three handlers retain their fresh actor verification before database access. Writes and adjacent/unlisted paths retain middleware checks. This removes avoidable Auth load; it does not prove duplicate checks alone caused the database stall.

## Cause limits

Post-restart catalog lookup identified112306 as pg_toast.pg_toast_112300, owned by public.user_preferences. The exact SQL held by former PID245260 was not captured. No unsupported conclusion that autovacuum, a particular user write or a Nano capacity limit caused the entire outage is made. Nano compute, RAM70–75%, CPU13–49%, peak30/60 connections and isolated lock observations do not establish the need for an upgrade. No speculative database tuning or security changes were applied. A restart restores the current service; it is not certification that the underlying database/node fault can never recur.

## Verification

18 focused tests pass: recovery beyond the previous cutoff, backoff, visibility pause/resume, single in-flight manual retries, no late navigation, unchanged signature/expiry/timeout controls, exact middleware delegation, adjacent paths/writes/site-gate behavior, and actual delegated GET handlers rejecting anonymous actors before opening a DB client. Scoped ESLint and JS syntax pass. Full isolated webpack production build passes, including TypeScript and87 generated pages. Single main-only production deployment pending verification.

Evidence: observations.json and project-healthy.png. Screenshot is the observed post-restart Supabase status, not an app session or market-data validation. No private user rows or credential values are included.
