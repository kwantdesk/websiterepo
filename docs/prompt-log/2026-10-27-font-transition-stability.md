# Font transition stability — 2026-10-27

Owner reports brief old/different font flashes when navigating or opening settings.

Two code paths permitted this: canonical Aleph faces used font-display:swap (fallback text can paint before the actual face), and AppSidebar applied/removed cockpit typography in a passive effect after paint. Embedded GEX/Kwanty pages repeated independent swap faces and had no explicit weight preloads.

Changed canonical faces to font-display:block (standard bounded browser font blocking, no page visibility gate/loader); both Regular/Bold remain preloaded. Embedded GEX Data/Kwanty now load the same canonical stylesheet before app styles and preload both faces, removing duplicate declarations. Liquidity Map/recovery pages use a versioned canonical stylesheet. Updated iframe/site CSS revisions for embedded and chart-grid entry points. Existing family, font sizes/weights, public-page scrolling and theme settings preserved.

AppSidebar now acquires its typography scope in useLayoutEffect, before paint; reference-counted ownership prevents overlapping route shells from removing another shell's class. Forensics and theme migration stay in their original passive effect.

Validation:9 font tests pass, including real assets, existing migration metrics, preloads, canonical-face consistency and overlapping/idempotent ownership. Updated two stale Gamma typography assertions from pre-Aleph Rajdhani/JetBrains names to current Aleph. Scoped ESLint has zero errors and three existing warnings (two img warnings and an iframe-ref cleanup warning). Production build/typecheck pass. No feed, font-size preference, order or account changes. Browser acceptance recorded after release.
