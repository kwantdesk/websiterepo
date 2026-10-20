# Shared KWANTY dropdown preferences — 2026-10-20

Request: recent choices at the top, selectable favourites and a favourites-only
filter, shared across Classic, State and Orderflow.

Added an account-backed preference model and opt-in shared dropdown enhancement.
Each menu has search, All/Favourites only, Recents first and per-choice stars.
Recents retain the latest 16 unique selections. Favourites retain up to 200 per
choice group; saving failure is reported without blocking chart selections.
Ticker choices share one list across the three views. Orderflow metric and time
window controls share semantic groups across dynamic panels. Other settings do
not mix unrelated values. Missing source options are not invented or enabled.

Preferences use the existing KWANTY account store and survive switching workspace
templates without becoming part of a template. No new services, polling, API
requests, data subscriptions or market refresh changes. GEX DATA does not opt in.

Verification: 20 focused model, integration, dropdown and quiet-notice tests pass.
Browser QA uses the actual adapter/model with isolated local test accounts and
zero market requests: favourite toggles leave native selection unchanged; two
choices produce newest-first recents; favourites-only persists in State and
Orderflow; search/ArrowDown works; separate accounts do not leak favourites;
reload retains stars and the Recents first setting. Native change count matched
only the two explicit choices. This fixture is UI QA, not live market data.

Node syntax checks and scoped host ESLint pass. Full production build/typecheck
passes (84 pages). Production deployment verification follows the scoped main
push; no manual or preview deployment.
