# 2026-09-03 — 03 — Save for every indicator settings dialog

## Prompt (verbatim)

> with indicators like volume profile, when you click off it says do you want to save which is good, make sure this is on all indicators and all indicatoers that we add, they also need the option to click save before, so some eg, volume profile doesnt even have an option to save naturally so you need to fix this in all indicators then when you click away, you dont get the popup as you have saved already

## Answer

The settings dialog already had a shared footer, but its Save action closed the
window immediately. That did not support saving a known-good state, continuing
to inspect or edit, and then clicking away without a false unsaved warning.
Its dirty baseline also omitted the indicator's Visible switch.

The lifecycle now lives in one shared utility and one shared settings footer,
above every individual indicator panel:

- Save persists the current settings, establishes a fresh clean baseline and
  leaves the settings window open.
- Clicking away or pressing Escape after Save closes silently.
- Any edit made after Save is dirty again and restores the confirmation prompt.
- Save in the leave-confirmation prompt saves and closes.
- Cancel/Discard restores settings and the saved Visible state.
- Opening another indicator captures that indicator's own baseline rather than
  inheriting the previous dialog's state.
- New catalogue indicators inherit this automatically; no per-indicator Save
  button is required.

The footprint's additional template and local-settings controls remain intact,
but its normal dialog lifecycle now follows the same shared contract.

### Verified

- Shared indicator save lifecycle: 10/10 checks.
- Indicator visibility: 4/4 checks.
- Indicator templates: 13/13 checks.
- Footprint chart types, bar window, profile rows, replay, bar width, palette,
  flow coverage and hysteresis all pass.
- Scoped ESLint and `tsc --noEmit` pass.
- Full production `npm run build` passes.

### Deployment

Committed and pushed to `main`; Vercel production deployment to the active
`websiterepo-yfmi` project was verified from the exact commit status.

### Unfinished

None for this prompt.
