# Volume Profile: rename only the existing Asia; add independent Tokyo

Owner's corrected instruction: the restored profile starting at Globex open must be labelled Globex, with every existing calculation left unchanged. Add a separate Asia/Tokyo selection starting at 10:00 Brisbane. Do not reapply the rejected partitioning or later Splitted redesign.

The original overnight profile retains internal id `asia`, stored flag `sessionAsiaEnabled`, and exactly the original 17:00–02:00 Chicago calculation window. Only its displayed label becomes Globex. Existing London/New York, custom/RTH/ETH windows, mode switching, date ownership and settings remain unchanged. Persisted ids deliberately do not follow the renamed visible label.

The new visible Asia profile has independent id `tokyo` and flag `sessionTokyoEnabled`. It starts at 00:00 UTC = 09:00 Tokyo = 10:00 Brisbane, independently of US daylight saving, and ends at the existing overnight cutoff. This is an overlapping additional profile: adding it never partitions, subtracts trades from, or shortens Globex. Tokyo is weekday-only. It defaults off, including when an old saved workspace has no flag, preserving existing visible selections. Explicit new selections survive normalization/reload.

Shared descriptors drive the settings buttons, session resolver, request/prune identities and session variants. The daily planner includes the new flag in both selection and refresh dependencies. First-pick arming, independent toggle, last-selection protection, levels and existing Splitted/custom controls keep their previous semantics.

Verification:

- Eight executable regressions in `scripts/test-volume-profile-tokyo.mjs`: differential comparison against restored commit `cf7ff1c1` for every old mode/window including both US DST boundaries; Tokyo fixed local start/cutoff/weekends; all old selection combinations and normalization; identical controlled Globex volume/POC/value area; stable original session request keys/bounds with Tokyo enabled; actual daily planner extracted from production source; and independent pruning.
- Nine existing suites: session windows, selection, toggles, filter adapter, split identity, settings/live levels, data settings, composite and replay profiles. Update only expectations affected by the additive fourth descriptor, new opt-in default and renamed label.
- Eight isolated Chrome checks using the actual ChartIndicatorsControl: old saved Globex/New York selection with missing Tokyo flag, independent Asia activation/removal, Asia-only selection, last-session protection, reload, original Splitted/custom controls and first-pick arming. Zero browser errors. Controlled fixtures do not claim owner-account inspection or live vendor-data validation.
- Final production build exits0. Library/test lint at1536MiB and large-control lint separately at2304MiB exit0. Never standalone lint the large workspace/chart files.

No remote preference/trade/account/drawing/template reset, provider/recording change, new polling or gateway restart. Preserve unrelated dirty work and ALGO. One scoped main push through existing `websiterepo-yfmi` integration; verify actual live SHA.
