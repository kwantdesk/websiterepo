# KWANTY favourite ticker shortcuts — 2026-10-20

Request: instead of hard-coded SPX/SPY/NDX/QQQ buttons, populate favourite tickers
next to Orderflow timeframes. Clicking updates right-hand ticker too and linked
charts should follow.

Reuse the existing account-scoped instruments favourites store across all modes.
Add preference subscription notifications after successful saves, unsubscribe on
pagehide, and an Orderflow-only horizontal shortcut row, alphabetical and without
a four-item cap. Missing/disabled catalogue options stay saved but not displayed.
Empty Favourites shortcut opens the existing picker. Active ticker highlighted;
star/unstar updates immediately; keyboard focus retained across updates.

Shortcut sets native ticker value and dispatches its existing change event once,
updating recents and existing workspace ticker/reset path. Same ticker is a no-op.
Current architecture has one ticker across Orderflow panels, linked or unlinked;
this existing behaviour was communicated, not silently presented as per-panel
ticker selection. No extra acquisition loops, subscriptions, API or polling.

125 focused KWANTY/theme/options-panel tests pass, including real preferences,
fake-DOM shortcut click/selection wiring, immediate changes, reopening, disposal,
quota safety and >4 favourites. Production receipt follows release locally.
