# GEX Map uses the shared indicator palettes

Owner request: replace GEX Map's scientific gradient buttons with the palettes
used by Bounce/profiles/other indicators; preserve colour placement, seed editable
stock colours, and allow tweaking and saving.

The Map/Bounce settings picker now reads all 12 schemes from the canonical
volume-profile/Footprint gradient catalogue. Their exact endpoints are sampled
into the existing ten signed-exposure positions, negative through positive.
Signed-exposure magnitude, Star selection, node roles, thresholds and dimming
are unchanged. The named buttons use the normal theme-linked rounded controls
with readable labels.

Choosing a scheme populates every editable stop and its Star colour. Below the
scheme list, select any exposure slot or the Star node, then use the normal
KwantDesk colour picker (including hex entry) or the existing drag bar. Save
uses the existing palette storage, account preference sync and Map/Bounce event.
Editing a slot updates its matching endpoint metadata too. Custom palettes
survive reload, and the preset catalogue cannot be mutated by editing copies.
Slot percentage labels now follow the actual ten evenly spaced signed positions.
Colour popover interactions and Escape keep the host settings open.

Old scientific buttons are removed from the Map/Bounce picker. The historical
catalogue remains internally for unchanged GEX Data/stats consumers and saved
colour compatibility; existing personal custom scales are not overwritten.

Validation:

- 12 canonical seed/endpoint/mapping/custom-save cases and saved-colour compatibility.
- 34 Bounce/Map parity checks, now enumerating the shared preset catalogue.
- Seven existing Map suites: defaults, Star, velocity, replay window, node
  detail, expiry scope and text contrast.
- 19 isolated Chrome checks using the actual Map, shared editor, twelve linked
  Bounce hooks and native primitive: all twelve buttons, exact stock colours,
  custom exposure/Star hex editing, popover/Escape, Save/reload, Bounce-to-Map
  propagation with unchanged source values, dark/light and 390px layouts.
- Visually inspected the mobile screenshot. No browser runtime errors.
- Scoped lint: zero errors; the pre-existing drag-bar aria-valuenow warning
  remains. Production build must pass before the single main-only push.

Local temporary screenshots and browser fixture are under tmp/gex-shared-palette-*.
No data routes, provider calls, gateway, recording, execution or account edits
were added. Verify production success and actual live SHA after pushing.
