# Liquidity-map settings audit and contract-size filters

Owner reports bubbles disappear at minimum trade size 1 and asks to check all map settings.

## Evidence and faults

An isolated headless Chrome instance loaded the actual map HTML/modules, blocking all external requests and using controlled execution fixtures. Before repair, saved `minimumTradeSize:0`/`minimumPixelVolume:0` left the model and output at 0 but both native range thumbs at 1: their HTML minimum was 1. The first keyboard increment consequently selected 2, not 1. Saved Trades/Heatmap/Profile=false still showed lit toolbar buttons. Saved Trails/Grid=false left checked checkboxes. Disabled CVD could retain a lit toolbar control and clicking it once could leave CVD hidden.

The contract comparison itself was already inclusive (`size >= minimum`); do not invent an arithmetic failure or claim the owner's exact state was observed. A read-only existing VPS snapshot contained 2,500 NQ executions: 2,459 size 1, 30 size 2, 5 size 3, 2 size 4, and one each of 5/6/10/15. This sample explains why inadvertently selecting 2 removes most prints; it does not establish all-trade/session coverage. Separate bubble-volume and differential settings can legitimately remove bubbles even at individual minimum 1.

## Repair

Both contract filters now have an explicit 0=all position; 1 includes one-contract executions. Labels distinguish contracts and tooltips distinguish pre-cluster individual filtering from post-cluster gross/net bubble filtering. No user-selected differential behavior was overridden. A shared control synchronizer validates saved numeric values against the actual input min/max/step, restores valid enum choices and boolean types, and synchronizes all controls and toolbar lights. It runs at initialization and Reset Display Defaults, without per-frame work. Invalid legacy values fall back/clamp to the displayed supported bounds. Numeric controls honor integer steps and restore their previous value when cleared and left blank. CVD's button reflects actual panel visibility and enables CVD on the first click when disabled. DOM button state also follows its checkbox.

## Control audit

All 30 actual settings controls were changed through native input/change events in the real isolated app and checked against the bound model. Existing renderer regressions cover projection/zoom, CVD, clustering, colors, geometry and history retention. These are functional bindings and focused rendering checks, not a blanket provider-parity or owner-browser acceptance claim.

| Controls | Contract checked |
| --- | --- |
| Palette | Valid palette enum restored and change bound to palette |
| Heat sensitivity; quick heat sensitivity | Same numeric setting, synchronized range values |
| Dimming; heatmap filter; Gaussian sigma | Supported bounds/enum; sigma enabled only in Gaussian mode |
| Bubble size; transparency; smart clustering | Bound numeric values; existing volume/identity/clustering checks retained |
| Minimum trade size; minimum bubble volume | Explicit 0=all; inclusive threshold; independent pre/post-cluster filtering |
| Auto-center; Best bid/ask; Grid | Saved boolean/control agreement (auto-center still intentionally resets true on opening) |
| DOM visibility | Checkbox, toolbar state, existing geometry checks |
| Resting sell; Resting buy; COB; Bid%; Ask%; SVP | Independent bound visibility and existing width-reclamation checks |
| Aggregate depth; Differential bubbles | Boolean restoration and native change binding; differential remains opt-in |
| CVD enable; Split; Range; Scale | Visibility/state agreement and bound valid choices; existing line-only/CVD checks |
| CVD minimum; CVD maximum; Weighted depth levels | Finite supported numbers and integer steps; empty edit does not silently become zero |
| Toolbar Heatmap/DOM/Trades/Profile/CVD; Reset | Saved/restored states and aria-pressed agree; reset re-synchronizes model and UI |

## Verification and limits

- 29 focused settings/clustering/dialog/presentation/anchor tests pass.
- Actual app browser fixture: sizes 1/2/15 yield total 18 for minimum 0, 18 for 1, 17 for 2, 0 for 16, and 18 immediately after returning to 1. Renderer cache rebuilds reflect settings changes; no source trades changed.
- Actual app browser fixture changes all 30 controls; CVD disable/enable works on the first toolbar click; no page errors. Before/after evidence: `tmp/bubble-settings-browser-after.log`, script `tmp/bubble-settings-browser.mjs` (external network blocked).
- Broader existing checks: 41/48 pass; the same seven obsolete source-contract failures reproduce using unmodified HEAD files through `tmp/smart-bubbles-controls-baseline.test.mjs`. They concern prior toolbar/loading/layout/close behavior, not new regressions. Do not claim the full legacy suite passes.
- JS syntax, scoped host lint and full production build required before main push; verify production SHA and index/main/settings module hashes after deployment. Revision `20261030-settings-contracts`.

No provider session/subscription/restart, recording, market-data arithmetic, book/heatmap coloring, quote coordinates, bubble clustering/anchors/sizing or trade/account changes. The explicit filters remain independent: high bubble minimum, Differential cancellation or Trades off can intentionally produce no bubbles.
