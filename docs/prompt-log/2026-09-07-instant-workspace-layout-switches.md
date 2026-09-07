# Instant workspace layout switches

## Prompt

Changing the chart workspace arrangement from one panel to two took roughly
ten seconds and appeared to reload the page. Layout controls must be immediate
and must not reload or recalculate the existing chart.

## Diagnosis

The arrangement was represented as a recursive React tree. A single layout
rendered the live chart at the root, while a two-panel layout placed that same
chart beneath a new split node. React identity is tied to ancestry as well as
the component key, so the chart was unmounted and mounted again. That restarted
the canvas, history restoration and every enabled indicator even though only
the pane geometry had changed.

## Fix

- Every visible pane now owns a stable DOM portal host.
- Recursive layout nodes provide lightweight geometry slots only. On a layout
  change the existing host is moved into the new slot, preserving the live
  chart component and all of its expensive state.
- A newly visible pane continues to use staggered hydration and cannot block or
  blank the existing chart.
- Portal-level pointer activation preserves normal active-pane behaviour, and
  removed panes release their retained hosts.

## Outcome

Changing panel arrangements is now a local geometry update. The already-open
chart remains alive rather than refetching history or recalculating its entire
indicator stack.

## Verification

The workspace layout suite asserts the stable-host contract and prevents chart
rendering from returning to the recursive tree. Scoped lint, TypeScript and the
production build were run before release; commit and deployment are recorded in
the final response.
