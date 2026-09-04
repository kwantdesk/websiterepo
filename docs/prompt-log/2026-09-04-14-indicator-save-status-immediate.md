# Immediate indicator save status

## User request

When Save is pressed in an indicator settings window, remove the roughly five-second delay before “Unsaved changes” changes to “All changes saved.”

## Diagnosis

Save correctly replaced the comparison snapshot, but that snapshot is held in a React ref. Updating a ref does not repaint the component, so the status label stayed stale until the debounced workspace persistence later caused another render.

There was also a narrow race when Save was pressed immediately after editing a control: the latest value was already in the component's authoritative indicator ref, while the parent-provided indicator prop could still be one render behind.

## Fix and outcome

- Added a synchronous pending-edit state for the shared indicator settings window.
- Every live settings edit immediately marks the window dirty and repaints the label.
- Save immediately clears the pending state, establishes the new baseline and repaints “All changes saved.”
- Save reads the latest in-memory indicator instance, preventing an immediately clicked Save from recording stale props.
- Account/workspace persistence remains asynchronous in the background and no longer controls visible save feedback.
- The same shared path covers every current and future indicator.

## Verification

- `test-indicator-settings-save.mjs` — 12/12 checks passed.
- `npx tsc --noEmit` — passed.
- Scoped ESLint — passed with no warnings.
- `npm run build` — production build passed; 80/80 static pages generated.
