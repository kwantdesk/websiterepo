# Indicator settings findings

Updated 4 November 2026. Audit remains in progress. No indicator has been signed off as fully end-to-end verified.

## Coverage

- 124 catalogue indicators in the requested category order.
- 4,302 default setting entries inventoried.
- 376 explicit dialog control nodes inventoried, including shared controls and dynamically selected sections.
- 49 studies produced calculation output under the common candle fixture. 340 setting mutations changed that output.
- 75 studies require dedicated renderer or additional data paths and cannot be judged from the common candle calculator.
- 237 initial existing commands executed. 182 passed and 55 failed.
- All counts refer to the initial sweep. See individual files for subsequent targeted verification.
- No provider outage, vendor entitlement or missing historical data has been established by this settings audit.

## Confirmed findings and changes

### F001 · Gamma Heatmap

fixed; source and regression checks.

The setting was persisted but the status banner rendered unconditionally.

The banner now obeys showStatus.

Controls — showStatus.

### F002 · Dark Pool (GEX)

fixed; source traced.

The switch was never read. Only combined confluence thresholds could produce a new-print alert.

New-print alerts obey their switch and minimum print notional independently.

Controls — alertNewPrint.

### F003 · Dark Pool (GEX)

fixed; source traced.

The switch was never read.

GEX confluence alerts now require this switch, actual confluence and the configured thresholds.

Controls — alertGexConfluence.

### F004 · Shared indicator alert delivery

fixed; behavioral hook tests.

Many indicators dispatched browser events without a receiver that displayed or played them.

A scoped receiver delivers events only to their enabled chart instance and instrument. Replay is muted. Explicit popup/sound choices are honored. Duplicate messages are suppressed. SuperTrend retains its existing delivery.

Controls — popup, sound, messagePopupEnabled, enablePopup, enableMessage, alertSoundEnabled, enableAlertSound, inAppSound, alertTone.

### F005 · GEX Interval Map, Bounce Levels, Dark Pool Map, Dark Pool (GEX)

fixed; source traced.

Their alert events used channels without visible in-chart delivery.

They now also dispatch to the common chart alert delivery path.

Controls — enableAlerts.

### F006 · Imbalance Tracker

fixed; source traced; live trigger verification pending.

The alert controls were persisted but no producer consumed them.

New current-bar zones with recent executions can emit the selected sound/popup with the configured text. Existing zones are seeded without historical alerts.

Controls — enableAlertSound, enablePopup, alertName, popupMessage.

### F007 · Big Contracts

fixed; source traced; live trigger verification pending.

The sound toggle was not consumed.

Fresh qualifying live executions emit sound once per print identity. Archive prints and replay remain silent.

Controls — enableAlertSound.

### F008 · Generated settings controls

fixed; source traced.

Internal migration/selection flags were eligible for generic visible checkboxes.

These internal fields are excluded from generated user controls.

Controls — stableFootprintRows, sessionSelectionArmed.

### O001 · Big Blocks

open; implementation needed.

No alert producer currently consumes these settings. The chart study itself has a separate live state machine.

Add a deduplicated live directional-bias transition producer and verify bar-close, intrabar and replay behavior before enabling delivery.

Controls — enableAlertSound, enableMessage, alertMessage.

### O002 · Bounce Levels

open; implementation needed.

This toggle is saved and exposed but no renderer consumes it.

Define and add alert-event markers in chart time/price coordinates. Existing exposure nodes are a separate renderer.

Controls — chartMarkers.

### O003 · DOM Pro

open; reconcile legacy controls with current DOM column settings.

Literal runtime reads are absent; current DOM columns have a separate domColumns contract.

Verify which generic legacy controls are exposed, then map to current columns or remove duplicate controls while preserving saved configurations.

Controls — showCumulative, showOrderCount, showPullStack, showRecentTrades, lastTradeColor.

### O004 · All categories

open; end-to-end verification.

Source references and calculation mutations cannot prove every visible control changes the intended live drawing.

Complete per-indicator dialog interaction, output, persistence, and live/replay verification. The checklist intentionally remains unchecked for this requirement.

Controls — cross-cutting audit work.

### O005 · Test suite

open; failure triage.

55 of 237 initial commands failed. Some are stale source assertions, some are loading/runner errors, and others need product triage.

Track each initial failure separately. Do not mark an indicator broken merely because one legacy test fails, or healthy merely because a source-reference assertion passes.

Controls — cross-cutting audit work.

## Initial failing commands

- test:vwap-family — exit 1 — vwap-family.log
- test:mini-dom — exit 1 — mini-dom.log
- test:delta-ladder — exit 1 — delta-ladder.log
- test:candle-visibility — exit 1 — candle-visibility.log
- test:deploy-cost — exit 1 — deploy-cost.log
- test:quantdata-coalescing — exit 1 — quantdata-coalescing.log
- test:draw-layer-anchoring — exit 1 — draw-layer-anchoring.log
- test:index-history-timeout — exit 1 — index-history-timeout.log
- test:right-rail-drag — exit 1 — right-rail-drag.log
- test:indicator-plot-colors — exit 1 — indicator-plot-colors.log
- test:indicator-history-depth — exit 1 — indicator-history-depth.log
- test:toolbar-single-source — exit 1 — toolbar-single-source.log
- test:chart-emoji-zoom-scale — exit 1 — chart-emoji-zoom-scale.log
- test:preference-hydration — exit 1 — preference-hydration.log
- test:volume-profile-split — exit 1 — volume-profile-split.log
- test:volume-profile-grouping — exit 1 — volume-profile-grouping.log
- test:volume-profile-gradients — exit 1 — volume-profile-gradients.log
- test:volume-profile-labels — exit 1 — volume-profile-labels.log
- test:overlay-in-frame — exit 1 — overlay-in-frame.log
- test:profile-fold — exit 1 — profile-fold.log
- test:drawing-selection — exit 1 — drawing-selection.log
- test:draw-tool-theme — exit 1 — draw-tool-theme.log
- test:position-tool-behaviour — exit 1 — position-tool-behaviour.log
- test:initial-balance-timeframe — exit 1 — initial-balance-timeframe.log
- test:profile-indicator-parity — exit 1 — profile-indicator-parity.log
- test:tpo-default-visuals — exit 1 — tpo-default-visuals.log
- test:live-chart-memory — exit 1 — live-chart-memory.log
- test:live-overlay-lifetimes — exit 1 — live-overlay-lifetimes.log
- test:weekly-profile-window — exit 1 — weekly-profile-window.log
- test:big-trade-levels — exit 1 — big-trade-levels.log
- test:rithmic-bar-source — exit 1 — rithmic-bar-source.log
- test:chart-watermark — exit 1 — chart-watermark.log
- test:gex-map-velocity — exit 1 — gex-map-velocity.log
- test:gex-map-v2-first-paint — exit 1 — gex-map-v2-first-paint.log
- test:gex-map-v2-wiring — exit 1 — gex-map-v2-wiring.log
- test:liq-cache-busting — exit 1 — liq-cache-busting.log
- test:indicator-palettes — exit 1 — indicator-palettes.log
- test:indicator-visibility — exit 1 — indicator-visibility.log
- test:news-provider-surface — exit 1 — news-provider-surface.log
- test:indicator-settings-save — exit 1 — indicator-settings-save.log
- test:candle-style — exit 1 — candle-style.log
- test:chart-history-state — exit 1 — chart-history-state.log
- test:chart-hydration-cover — exit 1 — chart-hydration-cover.log
- test:weekly-profile-week — exit 1 — weekly-profile-week.log
- test:indicator-opacity — exit 1 — indicator-opacity.log
- test:indicator-colour-controls — exit 1 — indicator-colour-controls.log
- test:index-history-cache — exit 1 — index-history-cache.log
- test:page-loaders — exit 1 — page-loaders.log
- test:indicator-both-sides — exit 1 — indicator-both-sides.log
- test:value-area-rows — exit 1 — value-area-rows.log
- test:theme-account-sync — exit 1 — theme-account-sync.log
- test:session-boundaries — exit 1 — session-boundaries.log
- test:indicator-side-colours — exit 1 — indicator-side-colours.log
- test:value-area-percent — exit 1 — value-area-percent.log
- test:chart-emoji-tool — exit 1 — chart-emoji-tool.log

## Evidence limits

The inventory detects source references across the application. A shared key may belong to another indicator, a settings-only component, or a dynamic lookup. A reference is a search lead, not a runtime certificate.

A mutation that leaves output unchanged may be conditional on a different mode, may style a dedicated primitive, or may need data absent from the fixture. These rows remain unresolved. Numeric normalization can intentionally clamp invalid values.

The browser pass inspected Bounce Levels General, Inputs and Style tabs on the live website. Every explicit button in the static dialog inventory has an event handler, but handler presence does not prove its downstream effect. The full 124-indicator browser matrix has not been completed.

No genuinely irreparable control has been established. The open issues above are engineering or verification work.

## Subsequent targeted verification

The alert delivery hook tests verify matching instance/instrument delivery, replay muting, disabled popups, duplicate suppression and listener cleanup. Gamma Heatmap tests passed. Dark Pool (GEX) precision/replay checks passed. Imbalance Tracker fixtures passed seven scenarios plus live edge and saved settings. Production live-trigger interaction remains pending.

## F009 · Sessions midpoint

The exposed Show Midline checkbox had no runtime consumer. SessionWindowRenderer now renders the midpoint of each session high and low when this setting is enabled. Visual verification remains pending.

## Candidate dispositions

Each literal-reference candidate has a row in candidate-dispositions.json. Dynamic source paths are identified separately from behavioral verification.
