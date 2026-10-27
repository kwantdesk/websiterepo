# Button/navigation responsiveness — 2026-10-27

Request: slow Settings and general button response.

Root findings: Settings used plain anchors in both sidebar orientations, causing a document reload and omitting onNavigateStart/pointer-down chart-work handoff used by other navigation links. PrivateTerminologyGuard recursively rescanned all descendant DOM on any observed attribute change; duplicate inserted nodes could be repeatedly traversed in one MutationObserver batch.

Changes: Settings uses Next Link with prefetch disabled by default, bounded intent prefetch on hover/focus (at most once per 30 seconds per mounted sidebar), and existing modifier-safe pointer/click handoff. Server Settings auth remains unchanged. Terminology mutation dispatcher scans only changed text/attribute values, deduplicates changes and scans highest inserted ancestors once, retaining synchronous copy sanitization and initial/iframe scans.

Validation: 16 focused tests (mutation cost/privacy/font/theme), lint zero errors/two existing img warnings. Stress fixtures cover a 10,000-descendant chart attribute update with zero subtree scans, 1,000 repeated text records with one scrub, nested insertion ordering and independent attribute retention. Existing persistent-liquidity-map-navigation test has a stale old iframe version assertion in unchanged LiquidityMapWorkspace.tsx. Build pending. Baseline browser Settings navigation exceeded the 3s automation wait but diagnostic already saw a visible heading; not a reliable latency benchmark or claimed before/after ratio. No owner settings/trades changed.

Production build passed, including TypeScript.
Live follow-up: Settings sections changed in 307ms in one automated sample. Chart-to-Settings still waited for server auth; page and middleware each called getUser serially. SettingsPage now uses installed Supabase getClaims for the redundant page verification: package source GoTrueClient.ts validates expiry and signature through cached JWK, falls back to getUser for HS signing/no WebCrypto. Middleware getUser is unchanged, retaining per-request remote identity check and revocation behavior. Missing/error/sub/email cases fail closed. 19 focused checks pass, page lint clean; final build pending. Initial live heading waits sometimes targeted Identity when the preserved active section was Theme & Colors, so they are not valid navigation timing numbers.

Final claims-verification production build/TypeScript passed.
