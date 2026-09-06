# Prompt / outcome — Chart emoji quick picks

## Prompt

Whenever an emoji is selected for a chart, put it in the top favourites row,
keep that row at 16 entries, and remove the oldest entry as new ones arrive.

## Fixed

- Replaced the fixed top row with a persisted 16-item recent/favourites list.
- Every selection moves to the front, duplicates are removed, and the oldest
  entry drops off when a new emoji is added.
- The list synchronizes across open charts and restores after reload.

## Outcome

The chart emoji picker now behaves as a rolling 16-item quick-pick history,
while retaining the original 16 emojis as first-run defaults.
