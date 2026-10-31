# Owner-requested rollback before the Globex/Asia change

Owner rejects the later Splitted fix and explicitly requests the version before the earlier change where Asia was meant to be labelled Globex. Restore the earlier implementation; do not redesign the sessions or add another corrective layer.

Rollback target: `5c9701c3777708342a4dcc3e9f9c27205fc6b5bf`, parent of `a80ef3c5`. Reverse runtime changes from `995b3526` (Splitted/full Globex) then `a80ef3c5` (Globex/Asia separation). Four files match the target exactly after newline normalization: ChartIndicatorsControl, chartIndicatorConfig, volumeProfileSessions and volumeProfileVariants. The daily workspace receives only the inverse profile hunks; all three actual session-planner function initializers match the target exactly.

The pre-change session names, boundaries, clock implementation, selection callbacks, defaults, normalization and mode interpretation are restored, including the original three named-session controls. No partial rename or newer full-Globex mode remains. Withdraw the two feature-only tests and return the session-contract tests to the three-session contract. Keep unrelated pre-existing test maintenance (current render-group helper, current daily identity helper, schema bookkeeping and exact Chart source selection); those edits do not affect runtime behaviour.

Verification:

- Four whole-file and three actual-function source comparisons prove the requested pre-change code is restored.
- Exact comparisons also prove Chart's newer link fixes, GEX Map workspace timezone and its formatter remain unchanged. Other workspace changes are preserved by reversing only scoped Git patches.
- Nine existing suites pass: session windows, selection, toggles, server filter adapter, split identity, settings-live/level wiring, data settings, composite and replay profiles.
- Five isolated actual-control Chrome checks pass with zero page errors: original three session controls, original Splitted/custom-window behaviour, original selection callbacks/flags, and original enabled POC/value-area level defaults. This checks restored UI/defaults, not the owner's live account or numeric levels.
- Full final production build exits0. Library lint passes; large-control lint uses2304MiB separately. Never standalone lint KwantifyWorkspace.

No remote preference/account/template/drawing reset, recording/provider/price changes, gateway restart or new polling. Existing saved choices are not guessed or overwritten. Historical feature notes for both reverted tasks are marked REVERTED. This rollback is the current authority: do not reapply either task unless the owner asks. Release once via existing main-only `websiterepo-yfmi` integration and verify exact live SHA.
