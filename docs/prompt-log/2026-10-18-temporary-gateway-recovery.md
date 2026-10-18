# Temporary gateway restored after laptop processes stopped

Owner reported blank futures/options charts and asked to restore access.
Public diagnostics confirmed the configured quick-tunnel origin was unreachable;
no local 8793 listener or cloudflared process existed. This was the temporary
backend's downtime, not the Socials UI releases or a chart configuration change.

Restarted the existing private launch.mjs and Cloudflare QUIC tunnel as hidden
background processes, without copying credentials into Git or buying anything.
Gateway PID30716, tunnel PID29792 at recovery. Gateway health authenticated and
connected; recorder enabled, no reported drops. The computer must stay awake and
online. Stop this gateway before moving the same login to a replacement VPS.

Public tunnel checks: health HTTP200 connected/authenticated, NQZ6 historical
one-minute request HTTP200 with 6,900 bars in 430ms, QQQ October16 archive HTTP200
with 406 bars in 308ms. These are actual archived candles, not fabricated data or
proof of a complete month or full options-contract history. Updated only the four
production gateway URL aliases on websiterepo-yfmi to the newly verified origin.
Existing tokens/provider configuration unchanged. One normal main-only Git
deployment applies the env update; no direct Vercel redeploy or bypass.

No new continuous Vercel traffic or new paid infrastructure. Quick-tunnel live
SSE and market-open load remain unverified; do not call weekend history recovery
a verified live trading feed. Permanent VPS/backup recovery, month-long history
gaps and multi-user memory/capacity/cost validation remain in IMPORTANT-NOTES.md.
