# GEX DATA palette migration / GEX BOX page retirement

## Owner request

Move the top-right GEX BOX colour palette settings into GEX DATA settings, then
remove the redundant standalone GEX BOX page.

## Implementation

- Extract the existing 30-preset picker into a shared component. Preserve live
  preview, unsaved-change confirmation, Save and Discard; add Follow website theme.
- Settings → Colour palette opens it from the GEX DATA host. Persist the selected
  ID through the existing account-scoped workspace preference store, including
  normal workspace export/import. Do not overwrite site theme or old BOX layouts.
- Map calls/puts/net/header/strike roles across hosted tool frames. Repaint cached
  payloads through the existing theme pathway, with no new market-data requests,
  timers, services or gateway restarts. Keep site backgrounds/toolbars unchanged.
- Remove BOX navigation and standalone mounting/preloading. Legacy page URLs
  permanently redirect to GEX DATA, including old surface links. Shared chart-grid
  tools, storage and API endpoints remain compatible rather than being deleted.

## Verification

- Focused GEX DATA/reference, palette-picker, options-flow panel and live-theme tests: 181 pass.
- Full original palette contract: 9 pass (30 presets).
- Optimized production build: pass. Local legacy URL checks: all return 308 to
  /gex-data. Production/UI checks pending release verification.
- No changes to the outstanding KWANTY Orderflow archive/provider-history blockers.
