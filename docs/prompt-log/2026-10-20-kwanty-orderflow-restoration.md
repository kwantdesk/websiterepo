# KWANTY Orderflow missing metric visuals — 2026-10-20

Request: Orderflow shows no visuals; also failed during last New York session.

## Evidence

- Owner's NDX Orderflow had working underlying price candles but only one
  positioning observation. Latest snapshot contains genuine nonzero gexoflow,
  agg_dex, zgr and other native fields. A lone flow stem/metric dot at 16:00 was
  obscured at the exact right-hand plot edge. No full-session history was loaded.
- Authenticated native history for NDX/Orderflow/2026-10-19 returned
  UPSTREAM_ENTITLEMENT_REQUIRED. Existing older terminal history path failed401
  before returning archive data. Do not claim source history is recovered.
- Existing gexbot_orderflow_frames recorder was attached to the old flow poller
  for NQ_NDX only; it was not saving actual native NDX/QQQ/SPY selections.
  Production has Supabase service configuration; local development does not.
  Never print or copy its secret values into task logs.

## Scoped repair

- Keep latest-only real readings visible as metric labels and actual markers.
  Add default right time margin while preserving timestamps and manual views.
  Do not stretch a single reading into a made-up session curve.
- /api/kwanty/session is authenticated and bounded to valid exact ticker/date,
  max90days. Reads only existing recorded data, no vendor call. Eight cached
  sessions, coalesced reads, one-minute cache; response uses existing private
  conditional caching. Only whitelisted genuine numerical fields are returned.
- Existing authenticated native Orderflow snapshots record after response, not
  before chart paint, using existing archive/table/service configuration. At
  most one accepted sample per instrument/source minute; global minute identity
  deduplicates across instances while payload keeps exact source time. No timers,
  provider fan-out or additional market poller. Recording failures back off.
- Frontend restores once per instrument/session, shared by all its panels.
  Generation, selection, replay, source-session guards prevent stale restoration.
  Live observation wins over duplicate archived timestamp. Empty means empty.
- Explicit historical load can fall back to real recorded rows after upstream
  403/404, but never aliases a futures ticker into a cash-index session.

## Verification and limits

188 focused tests and full production build pass (see release receipt for final
status). Includes archive filtering, concurrency, minute deduplication, read/write
failure, session restore guards, current labels, exact timestamp and viewport.

No promise of uninterrupted collection while nobody requests a feed; that needs
the stable always-on gateway/VPS. A provider-denied/unrecorded New York session
cannot be reconstructed from one close snapshot. Licensed archive access and
the old terminal credential failure remain unresolved, separately from rendering.
