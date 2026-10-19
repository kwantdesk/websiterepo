# Big Blocks (Options) — 2026-10-19

Owner requests an options-flow equivalent of Big Blocks, using short bars
extending from the right edge instead of circles on candles. Combine orders
at each price, scale length by size, show numbers and react to incoming flow.

## Implemented

- Separate Options Flow library indicator big-blocks-options, registered in
  settings and renderer gates. Chart-native paired call/put bars with numeric
  labels; viewport price-coordinate anchoring, proportional shared scale.
  Tight zoom reduces bar height/hides crowded text rather than stacking it.
- Price means the print's reported underlying price by default; strike grouping
  is an explicit alternative. Calls and puts never cancel into a misleading
  net. Call/put alone does not establish aggressor or directional intent.
- Contracts or dollar-premium scaling; minimum contracts/premium per order,
  bins, rolling window, max levels, widths/heights/opacity, sides, multi-leg
  toggle and theme/custom colours. Existing settings/template persistence used.
- Consolidated parents only; duplicate IDs replace, corrections move/update
  contributions. Missing type/price/size and future trades do not fabricate bars.
  New session resets; bounded5K compact retained records/200 levels.
-The observed ledger survives chart-native theme/precision reconstruction;
  only source symbol/session changes reset it. Replay suppresses live bars.
- Shared one snapshot request/ticker across panes;3s minimum/provider cadence,
  hidden-tab pause, closed-market60s interval, timeout/backoff, unsubscribe abort.
  Failure retains last observed data with disclosure. No new server endpoint,
  provider connection or infrastructure/resource changes. Uses existing
  access-controlled GEX Flow analytical snapshot service, not per-tick polling.
- Underlying charts supported. Replay and unverified options-to-futures/
  single-option-premium mapping unavailable. Existing futures Big Blocks untouched.

## Limits that must not be hidden

- Latest100 consolidated prints per snapshot, not a guaranteed complete session
  or every exchange trade.5K retained cap is disclosed; no fabricated history.
  Full licensed capture/stream delivery still needs permanent backend work.
- Orders means executed prints/consolidated orders, NOT resting orders, open
  positions or inferred call-buy/put-buy direction.
- Public live probe returned SITE_ACCESS_REQUIRED. Signed-in provider/visual
  acceptance and true arrival latency are not verified by deterministic tests.
- Missing Asia opening tape, full month futures/options history, public stream,
  weekly/footprint reliability and permanent gateway remain OPEN.

## Verification

-16 new tests plus15 existing futures Big Blocks lifecycle/underlay tests pass.
-Scoped ESLint and incremental TypeScript pass.
-Broader settings-window suite has one pre-existing footprint regex failure:
  expects saveFootprintSettings(settingsInstance.instanceId, validated), absent
  also in the unmodified HEAD version. Two other settings-window tests pass.
-Final-source full production build passes: TypeScript and84 static pages.
-Production release verification pending.
