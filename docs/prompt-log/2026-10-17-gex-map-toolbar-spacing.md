# GEX Map toolbar cramped above scrollbar

Owner screenshot shows the timeframe/horizon/model buttons cramped vertically,
with the horizontal scrollbar covering their lower edge. Requested a few pixels
above/below without changing the controls.

Removed fixed 36px height from the internal control header; it now sizes to its
contents with a 48px minimum and 6px vertical padding. Intrinsic sizing includes
the browser scrollbar instead of subtracting it from the button content area.
Buttons retain their existing sizes; horizontal scrolling and all handlers,
font sizes, settings and provider requests are unchanged.

New spacing guard and updated intentional toolbar-height expectation cover this
layout change (3 tests pass). Isolated production build passes. Scoped lint has
zero errors and one pre-existing slider aria-valuenow warning at line1658.
Existing GEX free-scroll and responsive-column source assertions
fail independently of this one-line class change (old pointer handler / old
three-column hiding expectations); not altered as part of this spacing task.
No authenticated visual screenshot or interaction test is claimed.
