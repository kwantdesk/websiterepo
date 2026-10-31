# GEX Map replay retains the configured surface

The owner configured four columns with specific settings, then entering Replay reset the map. Replay should change time, not the surface configuration.

## Root cause and correction

The cache-restoration effect depends on the replay cache key and requested session date. For a standalone map without an initial pane-saved configuration, every invocation called `initialPanelsForMarket`, replacing the active custom columns with the market's defaults. Model, expiry-scope and unit changes also changed that cache key and could produce the same reset.

Track the last linked market separately. Restore data against the existing current panel configurations on ordinary cache-scope changes. Apply market defaults only when the linked market genuinely changes, preserving the existing rule that a pane-saved configuration outranks market defaults. Reset loading/errors for every actual panel ID, including additional columns. The setters retain the existing panel array when the configuration is unchanged.

Replay entry, exit, date selection, scrubbing and external host replay keep the current column IDs/order, tickers, Greeks and settings. Edits/removals remain the current configuration rather than being replaced by an older live/default configuration. Date/model/expiry/unit cache identities and requests still change normally; no data is relabelled or silently carried across measurement/session boundaries. No new persistence key or extra requests, provider changes or gateway restarts.

## Verification

- Seven regression tests execute the actual production cache-restoration callback extracted using the TypeScript AST: four-column live/replay/date/live preservation, model/expiry/unit changes, genuine market changes once, saved-embed precedence, four-column cache/loading/error restoration, removed-column non-resurrection and location-market hydration followed by replay. All seven pass; the unchanged HEAD version reproduces six failures (only saved-embed precedence already passed).
- Seven isolated actual-component Chrome scenarios configure four columns, a custom SPY/Vanna column, Dealer model, all expiries, percent units, 2m interval, Full view, increased zoom and price lock. The complete configuration remains identical on replay entry, next frame, selecting another date, live exit, host-controlled replay and host exit. No page errors. Auth/preferences/feed responses are local controlled fixtures, not live-market verification. Evidence: ignored `tmp/gex-replay-settings-browser.log`.
- Run scoped lint, existing replay-window/defaults/expiry/range/Bounce checks and the full production build before the single main-only release. Verify deployment success and the actual live SHA. Keep unrelated social/native/document changes out of the commit.
