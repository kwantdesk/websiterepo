# KWANTY — 2026-10-18

Owner requested a new page from the local port4318 `gexpage#orderflow` prototype,
then explicitly changed the name from KWANT BOT to KWANTY. The existing AI
assistant and GEX BOX are preserved. GEX DATA from the preceding task is preserved.

Imported the owned prototype's UI/model source, not its server, secrets, Inter
font or independent theme. New persistent workspace route, navigation, Aleph and
live theme adapter, custom-colour flags, chart timezone and account preference
key. Default two Orderflow panels, up to three; Classic/State, sidebar/settings,
overlays, pan/zoom/reset/resize, observed-snapshot replay and image export retained.
Named templates flush fresh settings before saving, survive local reload, and
versioned JSON import/export use actual browser file controls. No database migration.

Backend is an authenticated, strict same-origin operation allowlist into the
existing shared gateway, with server-only credential loading and no native WS
negotiation or extra CME login process. Response bytes, compressed history output,
concurrency/cache/queue/retained selectors/rows/bytes are bounded. UI refresh30s,
error60s, paused for hidden/inactive workspace. This is not low-latency WS parity
and not certified for hundreds of customers. Redistribution licensing stays open.

Actual weekend checks: status authenticated; Classic/State/Orderflow SPX snapshots
have source time2026-10-16T19:59:59Z. Historical Orderflow returns403. One snapshot
stays one point; no synthetic full-session price candles or line. Classified State
call/put splits are web-only and explicitly unavailable. Native API units remain
native except source-defined display conversions covered by model tests.

Verification:185 tests pass (101 KWANTY/provider/integration plus84 GEX DATA
regressions). Full current gateway worktree suite408 pass; unrelated dirty native,
Socials and gateway-authorizer changes are not part of this release. Root TypeScript
and scoped lint pass (two existing img warnings). Browser QA: all three views,
settings SAVE, first template save/reopen/load/reload, immediate light/dark palette,
readable axes and error-free fresh console. Browser download-event verification
timed out; actual downloaded JSON roundtrip and cross-device cloud saves remain
unverified, not claimed as browser-tested. Market-open soak/parity remain open.
Optimized production build passed in the isolated release tree (82 static pages;
no QA route/auth bypass in the repository). Temporary one-time migration helpers
were removed after import; integrated source and tests are the maintained files.

Temporary operations: one checked old gateway process stopped and new hidden
gateway2164 started; existing tunnel20608 and URL unchanged. Private launcher
loads the adapter key via private `positioning.env`, not repository/Vercel. VPS
migration must configure server-only `GEXBOT_API_KEY`, transfer archives safely and
stop laptop ownership first. After restart CME itself rejected login13 permission
denied and entered existing bounded backoff. Do not call the live CME feed fixed;
earlier successful archived-candle probes do not prove current tape recording.
