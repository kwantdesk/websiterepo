# Match the new pages' dropdown visuals to KwantDesk

Owner reported Windows-standard dropdown menus on the recently added pages.
Calendar year/month/product and Financial Info category now reuse KwantSelect.
GEX DATA and KWANTY use a shared themed popup adapter while keeping original
select values, options, form fields and change handlers as the data contract.
Dynamic settings, saved values, disabled options, keyboard arrows/Escape/Tab,
outside close, scroll dismissal and native-dialog top-layer placement supported.
Multi-instrument checkbox menus use matching themed popup chrome. Shared Aleph,
site tokens, original selection defaults and market/provider behaviour retained.

No provider calls, timer, per-frame reconciliation or feed restart added. Detached
controls are removed from the registry. Iframe versions updated to avoid stale
entry documents. Browser fixture is test-only, not part of the public bundle.

Verified locally: native source hidden, QQQ updates the real form/change output,
programmatically replaced ES/NQ options update trigger/menu, modal timezone
selection to Brisbane, and live light/dark menu colours. KWANTY actual interval
and settings menus also opened/selected. Production build (84 pages) and scoped
ESLint pass; integration/regression results recorded with release verification.
Full signed-in cross-device workflows and the separate temporary live-stream
tunnel issue are not claimed fixed by this appearance change.
