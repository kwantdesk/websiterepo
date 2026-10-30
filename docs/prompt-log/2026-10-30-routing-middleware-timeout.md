# Routing middleware timeout — 30 October 2026 Brisbane

Owner reported slow/unusable website, then supplied504 MIDDLEWARE_INVOCATION_TIMEOUT (syd1). The previous Options release did not alter middleware; source requests alone had not established owner-browser end-to-end health.

## Diagnosis

Middleware performed an unbounded remote getUser for every protected page navigation. Supabase retry/refresh and signing-key/dependency stalls could therefore exceed Vercel's routing ceiling before application handlers ran. Read-only VPS checks found connected/authenticated feed, recent data, no current overload and about5.1GiB available RAM. QQQ provider reads returned200 in220/241/319ms; homepage returned200 in419ms. One Auth signing-key GET exceeded8s; later public-key-authenticated health/JWKS reads returned200 in1352/2736ms. This proves intermittent latency in the dependency path, not a certified provider-wide incident.

## Repair and security

- GET/HEAD navigation and exact /api/options-flow(/market-data) reads use installed SDK getClaims. Current project publishes ES256 keys. The SDK verifies signature/expiry and shares cached public keys across new request clients; older symmetric signatures keep its remote verification fallback.
- Other API calls and every write (including page/server-action POST) retain getUser; route-level authorization is untouched. Site-access checks, machine-protocol exclusions, OAuth callback recovery and active-cookie filtering remain.
- This changes page/read identity verification from a fresh account lookup to cryptographically verified JWT claims. Account deletion/revocation is reflected by fresh remote checks/token lifecycle, not a remote call on each navigation. No unsigned getSession identity is trusted.
- A5s total budget includes SDK initialization/lock waits, HTTP headers and body. It aborts outstanding native fetches and makes subsequent SDK refresh attempts terminal inside that budget. Timeout/network service errors fail closed with private503/Retry-After2; they do not delete cookies or falsely redirect the user as signed out.
- No provider connection, gateway restart, owner preferences, trades, journals, credentials or database schema changed.

## Validation

31 focused checks pass across middleware decisions, Options reads, private APIs/writes, valid/invalid identities, deadlines, body abort, SDK lock wait, cancellation, OAuth, desktop consent and cookie boundaries. Actual installed SDK test signs a synthetic ES256 session, verifies repeated navigation with exactly one JWK fetch/no user fetch, and rejects tampered and expired tokens. Scoped lint, full TypeScript and production build are required before main-only release. Production SHA must be verified before reporting deployed. Owner active account/browser was not manipulated.

## Separate queued request

Owner also requested a whole-site contrast audit, especially Mono's white-on-white GEX Data button. That remains active after this routing release; do not drop it or combine unverified visual changes into the emergency routing release. Standing history, parity, backups and unattended-execution launch gates remain open.
