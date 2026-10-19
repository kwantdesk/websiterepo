# Restore the existing temporary gateway

Owner explicitly requested starting the stopped gateway after the site showed
"Market-data gateway unreachable". Initial checks found no listener on8793,
no supervisor/tunnel processes and no planned-cutover STOP marker. The prior
public origin was unreachable. A first background-start attempt was blocked by
the execution policy; renewed explicit user authorization allowed startup.

Started one existing hidden supervisor26452, preserving its launcher, private
credentials, source copy and recordings. Its first child26576 exited with native
code3221226505; the existing bounded supervisor recovered with child8020, which
owns loopback8793. Do not infer the native-crash cause or claim it fixed.

Started one existing-kind hidden temporary QUIC tunnel18752. New origin:
https://courts-operates-compliant-campus.trycloudflare.com. Local and public
health report connected/authenticated; options snapshots configured/connected.
Authenticated public history checks: NQ week6900rows HTTP200/541ms; QQQ
Oct19minute history509rows HTTP200/365ms. These are retrieval checks, NOT proof
of complete tick/VAP/footprint/CVD history or a reliable public execution stream.

Vercel's saved access token had expired; the first URL update failed, despite
the non-terminating PowerShell pipeline printing a misleading success object.
No update was accepted then. Official cached CLI whoami refreshed the existing
session, and a second fail-fast API call successfully updated only the four
production gateway URL aliases on websiterepo-yfmi. Provider keys, gateway
bearer tokens, auth policies and preview/deployment settings unchanged.

Ten gateway environment regressions pass. One normal scoped main Git push
applies the environment change; production READY/exact SHA and actual hosted
reachability must be verified afterward. No manual deploy, paid service, new
account, DNS change, direct-provider Vercel fallback or gateway source rollout.

Standing issues: unsupported Quick Tunnel execution SSE, stable VPS/Vultr
transport, offline recording gaps/month-long history, missing Asia tape and
weekly/footprint/CVD live acceptance remain OPEN. The laptop must stay awake
and online; process-exit supervision does not provide reboot/tunnel uptime.
