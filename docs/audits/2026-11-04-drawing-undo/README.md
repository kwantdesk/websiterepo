# Chart drawing movement undo — 4 November 2026

## Faults verified

The previous SVG-only shortcut path worked for a simple trend-line move, but the page had independent SVG/professional/legacy/precision histories. The old dispatcher could choose professional history ahead of a newer SVG edit. Precision tools returned to dormant mode on mouse release, then their keyboard handler refused undo because it required the layer to remain engaged. Canvas grabs also prevented default focus changes, leaving a previously focused text/order field as the keyboard target.

The isolated browser harness renders the actual Chart component, its real drawing layers and two panes. Against committed Chart revision 36e11522225d5dd6da0afac10e32ab9938b9088f, the dormant precision movement restoration assertion fails. Against the updated source, the identical flow passes. No owner tabs, market providers, account storage or trades are used.

## Repair

One bounded chronological history per pane/instrument stores immutable before/after snapshots across SVG, professional, legacy position and precision moves. Pointer gestures group samples into one undo step regardless of how slowly a drag happens. Undo/redo uses capture routing in the drawing's owner document and activates only the pane actually clicked. Grabbing a drawing releases an old text-field focus; actual typing keeps native text undo. Existing independent professional/SVG stacks and timing-based grouping are removed. Precision movement restoration persists through its existing store without adding another checkpoint. Precision and legacy position restores update only the moved object, preserving drawings added afterward and never resurrecting a separately deleted object. Clear All drops undo and redo paths, preserving the owner's requirement that cleared drawings cannot reappear.

Ctrl+Z and Command+Z undo. Ctrl+Shift+Z, Command+Shift+Z and Ctrl+Y redo. History is intentionally in-memory for the mounted chart; a reload does not preserve the undo stack. Saved drawing positions continue to use the existing persistence path.

## Validation

- Actual Chart browser test: line moves, repeated undo/redo, undo after deselection, Ctrl and Meta shortcuts, another pane unaffected, typing unaffected, move a dormant precision line after typing, correct latest-engine selection, Clear All followed by undo cannot resurrect drawings. Zero page errors; external network blocked.
- Five new unit tests cover slow multi-sample gestures, chronological cross-engine operations, immutable snapshots, redo invalidation, independent histories, clear barriers and preservation of unrelated drawings.
- Drawing/clipboard/persistence/clear/replay regression suite: 60/60 pass. Including the existing precision-system suite: 74/75 pass. The remaining pre-existing assertion expects the literal precision namespace in userPreferences.ts, although committed code delegates those keys to accountPreferenceKeys.ts. Neither namespace source nor persistence API is changed here.
- Scoped ESLint passes for both new modules. Full production build checked before deployment. Release verification uses the exact live commit through diagnostics.

Reproduce with scripts/audits/drawing-undo-browser.cjs. UNDO_BASELINE=1 bundles the committed Chart source for the failure comparison; leave it unset for the fix. Both runs use local synthetic fixtures only.
