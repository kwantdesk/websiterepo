# Independent KWANTY Orderflow tickers — 2026-10-20

Request: sidebar/favourite ticker changes must affect selected chart only unless
linked; NDX, SPY and QQQ can occupy different panels simultaneously.

Root cause was shared workspace ticker, price series and snapshot history. Panels
now persist/migrate their ticker, and active-panel selection refreshes sidebar,
favourites, timeframe and style. Ticker/spot/futures controls use active/linked
targets. Other panel view/settings/data are retained. Template saves already
serialize panel fields, including closed/restored panels.

Distinct ticker resources are centrally coordinated and shared among panels with
the same ticker. One existing snapshot cadence with request coalescing/TTL, scoped
price controllers/session restoration, mismatch rejection and lifecycle cleanup.
No server/provider credentials or deployment topology changed. Multiple distinct
tickers necessarily require distinct data, but duplicate panels do not acquire
duplicate sources. Histories, price cache, overlays and thresholds are ticker
scoped; delayed old responses cannot populate another instrument. Historical
replay date/cutoffs remain explicit and no OHLC/positioning is fabricated.

Local real-application UI test (clearly synthetic fixture) confirmed different
NDX/SPY/QQQ prices and headers, selected-only switches, linked B+C switches without
changing A, and reload restoring those choices. 131 focused tests pass including
pool deduplication, staleness/cancellation, mismatches, historical scopes and
actual ticker handler isolation. Live production receipt follows release.

Live QA caught a second edge: linked auto-scaling could capture the renderer's
empty loading geometry before history arrived, retaining a blank range until
Reset. Follow-up gates auto-seeding and link-join viewport copying on genuine
loaded candle history, with ticker/session-stable identity (no per-quote reset).
Explicit group ticker changes clear every target view even if a peer already
has that ticker. Actual seed execution regression covers delayed history and
stable manual view after quote updates; focused suite now 132 tests.
