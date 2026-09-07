# Volume profile stock width

## Prompt

Set every fresh volume profile to width 2 because larger stock widths cover too much of the chart.

## Fix

- Added one shared stock-width constant with value `2`.
- Applied it to Daily, Weekly, Composite, Monthly, Session, Visible Range, Draw-on, Ask/Bid and Delta volume profiles.
- Aligned the numeric-setting definitions, current and completed-profile defaults, settings-dialog fallbacks and renderer fallbacks.
- Preserved explicit current and previous widths in saved profiles, including profiles passing through an older settings migration.

## Outcome

Every newly added or reset volume profile opens at width 2. Existing user-customised widths remain unchanged.
