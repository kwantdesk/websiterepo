# GEX Map replay calendar styling — 2026-10-31

Replaced the bottom replay toolbar's native browser date input with the shared
KwantDatePicker. The calendar now uses the site's rounded themed popup, Aleph
typography, styled navigation and selected-day treatment instead of the
operating system date-picker UI. The trigger retains the footer's 36px height.

The existing maximum session date and date string handling remain. Selecting
a date still sets replayDate, resets cursor to zero and pauses playback.
The shared calendar also uses the normal weekday availability rule. No market
data, history loading, replay clocks, API calls or gateway services were changed.

Validation:

- Scoped ESLint: no errors; one existing ARIA slider warning on an unrelated line.
- Existing GEX Map replay-window checks: 8/8 passed.
- Actual footer picker JSX exercised with the real shared picker, compiled site
  CSS and shared navigation in isolated headless Chrome. Dark, light and purple
  popups use Aleph; no native date inputs remain in the fixture. Selection
  resets/pauses correctly, Escape closes it, and desktop/mobile positioning stays
  inside the viewport. No browser runtime errors.
- Full Next.js production build passed.

Release through the existing main-only integration and verify the production
commit. No direct Vercel deployment or trading-session automation.
