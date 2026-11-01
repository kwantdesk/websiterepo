# Remove the archived Zyon journal from the website

Owner says Zyon is no longer on the website and its journal can be removed. Follow the existing reversible product archive: Zyon remains archived, hide its Journal launch/account surface and stop its background feed. Do not erase demo-account journals, trade histories, stored Gameplans or receipts.

Use the central archived-feature flag to exclude the automatic ZYON Journal account and mirrored Zyon trades from Overall Journal calculations. Stop outcome fetches and the30-second/focus polling effect while archived. Normalize any remembered Zyon account selection to Overall Journal at initial state and memory restore. Loading state no longer implies pending Zyon work. Existing reset/storage functions remain dormant for historical compatibility; no reset/delete request is issued and archived data is retained.

Verification: three new tests check archived selection fallback, actual production account/trade memo selectors (excluding mirrored and stored Zyon while preserving demo inputs), and fetch/timer guards. Four actual-component isolated Chrome checks: Overall/demo account visible with Zyon absent even if returned by cloud, demo controls still usable, focus sends no Socials/destructive requests, reload retains demo journal and hides Zyon. Zero browser errors. Eighteen paper-link/account-reset/account-deletion/Zyon-reset compatibility tests pass; scoped Journal/helper/test lint passes. Full production build required before release.

Full final production build exits0. No gateway restart/provider changes, new polling, account/drawing/trade/preference resets or ALGO directory changes. Preserve latest Algo isolation and unrelated dirty work. One scoped main-only release via `websiterepo-yfmi`, then verify exact live SHA.
