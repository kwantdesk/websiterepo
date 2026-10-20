# KWANTY ticker order and search — 2026-10-20

Request: proper alphabetical ticker order and searchable ticker selection in
Classic, State and Orderflow.

Diagnosis: the existing searchable menu removed recently used and favourited
tickers from All options, moving them into separate groups. That made the main
alphabetical directory incomplete and appear randomly ordered.

Change: preserve those optional shortcuts, but give instrument menus a complete
All tickers (A–Z) directory. Explicit English case-insensitive, numeric-aware
sorting; search labelled Search tickers with one sorted, deduplicated result
list. Empty/no-match and favourites-only states remain supported. All modes use
the same ticker control and saved account preferences. No provider/API changes,
new polling or data requests. Shared adapter affects only opted-in instrument
menus; GEX DATA's non-opted-in native contract is preserved.

Validation: preference/search/adapter tests cover mixed case, unordered input,
recents/favourites, complete directory, trimmed queries, no matches and shared
mode contract. Browser production verification follows the existing main-only
Git release. No additional service or manual deployment.
