# LIQ MAP pause and recent recorded history

Owner request: expose pause and drag-back navigation with at least several hours of real liquidity history.

## Cause and change

The transport controls existed inside a hidden compatibility container. Automatic price centering also called Go Live during horizontal dragging, pointer-up and page-show. The dense browser buffer intentionally retains only 1,800 real books (about 90 seconds at 20 Hz); increasing it to hours would reintroduce the prior heap/GC freezes.

- Visible themed bottom transport: Pause / Resume live, six-hour timestamp slider, back/forward one minute, LIVE. Space and L retain their existing shortcuts. Normal chart/CVD dragging works with price centering enabled. The shared full-session Replay transport remains authoritative when active; the local bar hides then.
- Pause freezes the display's selected book, rather than allowing incoming frames to evict it. Genuine live execution books and prints still flow to the parent. Archive books never enter the paper execution bridge.
- Recent buffered seeks reuse their original packed frames. Archive seeks page a bounded window from genuine two-second depth snapshots, retaining at most four downloaded chunks. Loaded-window drags change the visible end index without refetching or renormalizing all books. CVD and trade tape are clipped to the selected time.
- Chicago 17:00 session dates, including DST, select the actual recorded archive directory. No depth, prices, trades or gaps are invented. Six hours is a navigation range, not a promise that an instrument was recorded throughout every interval. First preparation of an unbuilt window can take minutes. Existing archive precision remains two seconds and the pack's per-frame print limit remains 256; this is not full execution-tick replay.

## VPS isolation and freshness

The previous replay store cached the first pack forever even if the current raw session kept growing. A new independent `heatmap-history` service serves existing replay paths plus `/liquidity-history`. It reuses covered packs and queues one worker refresh when a later requested clock needs newly recorded data. Raw reads stop at a captured byte boundary, rather than chasing a growing gzip indefinitely. Immutable generation files and atomic manifest publication keep in-flight readers consistent. Expired derived generations trigger a prompt index refresh rather than a thirty-second retry. Superseded files created by this code expire after 30 minutes on subsequent builds; raw recordings and legacy packs are not removed.

Production service: `/opt/kwantdesk/heatmap-history/`, merged into `/opt/kwantdesk/compose.yml`, using the existing local gateway image. Resources: 0.5 CPU, 768 MiB container cap, 384 MiB parent heap, one bounded worker; raw mount read-only with only the derived replay directory writable. `/etc/kwantdesk/heatmap-history.env` contains only the existing gateway bearer. No additional VPS purchase, provider login or QuantData/GEXBot fan-out.

Preserve this service when applying deferred gateway changes. The deployment fragment is `services/rithmic_gateway/deploy/heatmap-history.compose.yml`; stage the three heatmap modules, `browser-stream-edge.mjs` for ticket verification and the deployed `book-store.mjs`. The production Caddy route sends only archive paths to this service, and excludes signed `/liquidity-history` URLs from access logs.

The authenticated website returns a small five-minute exact-request HMAC lease. The browser then fetches JSON directly from the VPS with credentials omitted and no referrer. Large depth bodies and replay generation do not pass through Vercel. Ticket origin, path, clock, generation and expiry are checked; null origins are rejected. There is no paid proxy fallback or exposed gateway token. Existing execution leases retain their previous contract.

Only the new history service was restarted to activate its final handler. Caddy was validated and gracefully reloaded. The live gateway container remained `340a67fbe20a`, started `2026-10-27T14:43:25.818588938Z`; it was not restarted. Gateway health still reported connected.

## Verification

- 36 focused tests pass: actual pause/pan/seek methods, loaded-window frame reuse, small drag accumulation at wide zoom, causal tape, archive/contract/gap handling, old-session response isolation, raw-session refresh, immutable old generations, authenticated service routing, HMAC origin/expiry/scope checks, direct client leases and existing execution lease behavior.
- Full 1,536 MiB Next production build including TypeScript passes. Scoped ESLint passes. JavaScript syntax checks pass.
- Headless Chrome exercised the actual static app and cross-origin lease flow with fixture books: pause while live execution quotes keep advancing, three-hour seek, LIVE return, desktop 1280x800 and mobile 460x700. The transport is 38px high at the bottom and the slider fits both viewports; no page errors. This is not a signed-in physical owner-session acceptance claim.
- Real VPS/public HTTPS reads returned valid two-sided NQ and ES books from three hours earlier. NQ refreshed from the initial 18,789-frame pack to a new 19,643-frame generation; ES had 17,804 frames. Signed manifest/chunk reads returned HTTP 200 with the exact website CORS origin and `direct-vps`; null Origin returned 401. No bearer or ticket was printed.
- The broader old controls file retains seven pre-existing assertion failures. Running its HEAD source against HEAD file contents reproduces the same seven: DOM rail layout, embedded toolbar template, instrument sync assertion, old inspector dismissal, old inspector typography, old select typography and old staged-loading assertion. Unrelated assertions were not rewritten. The two obsolete tests requiring every drag to force live were replaced with the new independent time-navigation contract.

## Release and remaining scope

Frontend uses revision `20261028-history-transport`. Production SHA verification is appended after the scoped main push.

The separate reported live CVD/QuantStats freeze, original Footprint opening transient, deferred main gateway performance activation, vendor parity/archive completeness, off-box backups and unattended browser-owned demo execution remain separate open work. This task does not claim those are fixed.
