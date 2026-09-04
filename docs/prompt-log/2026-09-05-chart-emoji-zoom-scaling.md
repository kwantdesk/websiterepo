# Chart emoji zoom scaling — 2026-09-05

## Prompt

“Emojis need to be sized when you zoom out. They should shrink rather than stay the same visual size.”

## What was found

Emoji drawings stored only a pixel `fontSize`. Their chart position was anchored to time and price, but their dimensions were screen-fixed, so zooming compressed the candles while the emoji stayed visually enormous.

## Fix

- Capture each emoji's placed half-width in chart time and half-height in chart price.
- Resolve its displayed size from the current time and price transforms on every viewport update.
- Use the smaller transformed axis so zooming out either chart dimension shrinks the emoji.
- Keep manual resizing proportional by converting the dragged screen size back into the stored nominal size.
- Migrate previously saved emoji drawings once at their current viewport without moving their anchor.

## Outcome

Emoji position and size are both chart-relative. They shrink when zooming out, grow when zooming in, retain resize controls, and remain compatible with drawings saved before this change.
