# Indicator library Favorites view

Date: 2026-09-05

## Prompt

Add Favorites directly below All in the indicator library. Favorites must no
longer be promoted to the top of All. All must be a strict alphabetical A–Z
list, and Favorites must show only indicators the user starred.

## Fix and outcome

- Added an explicit Favorites library category directly below All.
- All, Favorites and every ordinary category use the same case-insensitive
  alphabetical ordering rule.
- Removed favorite-first weighting from All and from equally ranked search
  results.
- Searching while Favorites is selected remains scoped to starred indicators;
  it cannot leak ordinary catalogue rows back into that view.
- Favorites filters against the user's existing persisted favorite IDs, so no
  migration or lost stars are introduced.
- Added a clear empty state when the user has not starred an indicator.
- Added a focused regression covering category placement, strict A–Z ordering,
  favorites-only filtering, ordinary category filtering and the absence of the
  old favorite-first sort.
