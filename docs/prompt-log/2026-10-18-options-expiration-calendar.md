# Cboe options expiration calendar — 2026-10-18

Owner requested an interactive, accurate colour-coded calendar in the new KWANTY
section from https://cdn.cboe.com/resources/options/Cboe2026OPTIONSCalendar.pdf,
with information and updates when Cboe updates its publication.

Added `/kwanty?view=calendar` and a visible Options Expiration Calendar button.
Year, month and upcoming/all agenda views; product, event-colour and text/date
filters; date explanations, overlap markers, Today/month/year controls and source
links. Account-bound preferences are tracked by the existing cloud preference
system; no migration. Existing positioning/AI/GEX BOX calculations are untouched.
Positioning activity stops while the calendar is open and is not initialised on a
direct calendar visit. All local timers/listeners/requests clean up on leaving.

Used the PDF skill to render and inspect the original page. The source has ten
colour swatches; quarter/month ends share purple. Parsed visible filled polygons
in paint order, not hidden base shapes, together with all365 printed dates. This
retains simultaneous markers and rejects unknown markers/geometry/date grids.
Legend semantics are matched to their adjacent text, even if legend order moves.
Two body inks differ from their legend inks in the 2026 file; explicit known
print-palette aliases map them without recolouring arbitrary unknown data.

Validated standard monthlies including June18 / June17 AM last trade / June19
holiday, twelve VIX standard expiries, five VIX exception dates (March3, May19,
June2, November24, December1), forty VIX weekly marks,227 SPX/XSP weekly marks,
twelve month ends, four quarter ends, ten holidays and September14 LEAPS listing
for2029. Dates remain New York exchange dates, not translated into local days.
Descriptions distinguish expiry, last trade and listing; annual schedule is not
an exact live contract chain or a complete new-product announcement feed.

Authenticated `/api/options-expiration-calendar` discovers published year links
only on the official Cboe hours page, downloads bounded allowlisted PDFs, hashes
and validates the new revision. Next's shared structured data cache revalidates
at six hours; per-process requests coalesce and the browser gets private ETags.
The UI checks only when open/visible; failures/stale revalidation retain a labelled
last-verified result, retried after15m. This is not immediate vendor push. No cron,
paid provider, new API key or gateway/VPS process change. PDF.js5.6.205 is pinned
server-only with explicit worker file tracing; the UI imports just the31KB facts
snapshot for immediate first paint while the latest source is checked.

Tests: thirteen calendar tests including real official PDF extraction (using a
local untracked downloaded file), independent expected dates/overlaps/colours,
synthetic original PDFs for parser/legend-order/unknown-ink/year failures, source
allowlisting/cache/concurrency/revision updates, stale fallback and authenticated
route/query gates. Combined198 calendar/KWANTY/GEX DATA/provider tests pass.
Root TypeScript and scoped ESLint pass. Browser: actual Cboe source HTTP200/current,
June17 overlapping events, June18 expiry/June19 holiday, VIX-only upcoming agenda,
filters survive reload, immediate light/dark, clean fresh error console, no
overlapping footer/date detail panels. Source and snapshotSHA421a0699… matched.
Optimized production build passed (83 static pages), with PDF package/worker
confirmed in the new route's deployment file trace. Browser QA used an isolated
local preview/auth bypass only; that preview file was removed and is not shipped.

Cloud cross-device preference saves, every mobile viewport and arbitrary future
PDF redesigns are not certified. Standing CME permission-denied / Orderflow
history403 / full-month archive / redistribution / VPS/capacity gates remain open.
