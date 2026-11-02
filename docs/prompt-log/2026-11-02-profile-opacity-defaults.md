# Profile opacity defaults — 2 November 2026

New volume profiles and TPO must enter the chart at 100% opacity.

Updated daily/weekly TPO defaults and missing-setting fallback, shared volume-profile defaults (including weekly/monthly/session/visible/composite/custom/bid-ask/delta), Deep Profile Swing defaults/fallback, fixed-range and anchored profile drawings, drawing style-panel fallback, standalone profile workspace defaults and chart-renderer fallback. Explicit saved opacity values remain authoritative. Profile data, grouping, palette, value-area/overlay alpha and session definitions are unchanged.

Validation: 13 existing drawing-profile/style-matrix tests and 20 TPO engine tests pass; inline runtime assertions cover all VOLUME_PROFILE_INDICATOR_IDS, both TPO variants, both drawing tools, and retained custom opacity. Focused lint is clean. Full final Next build is required before the scoped main-only release. No new test suite for this reversible defaults-only change.

Known baseline test issue: scripts/test-tpo-default-visuals.mjs reaches an unrelated static assertion expecting clamp(periodEndX - offset, 2, mediaSize.width - 2) in the TPO renderer. That exact assertion also fails against the unchanged HEAD renderer (confirmed byte-equivalent after newline normalization). The renderer/test were left untouched; runtime TPO engine checks pass.

No gateway restart, production user settings reset, API/provider changes or live data modifications. Preserve unrelated dirty/native/ALGO work. Verify exact live Git SHA after the one main push.
