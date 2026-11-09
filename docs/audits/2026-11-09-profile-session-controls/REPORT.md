# Restore Volume Profile session controls

Daily Volume Profile's Filter/split time subtab showed only explanatory copy and no session controls. Reproduced in isolated Chrome with the actual ChartIndicatorsControl: zero Globex buttons while the footer was visible. The shared session block had a separate outer data-settings-section, while Volume Profile already owns its inner tab strip. Selecting the inner tab introduced a second outer section; the active General outer page retained the footer but excluded the session block.

The volume-profile session block now belongs to the same General outer section as its own profile navigation. TPO retains its existing outer section. Removed the redundant obsolete footer that was left visible by the bug. No changes to calculation engines, session boundaries, saved session flags, request payloads or filter semantics.

Actual browser regression exercised Daily, Weekly, Ask/Bid, Delta, Monthly and Composite profiles: all four Globex/Asia/London/New York buttons visible; Globex+NewYork selects exactly the existing persisted asia/newyork IDs; every session can be toggled with another session retained; switching tabs preserves the selection. Screenshots before.png and after.png retained locally. Existing rule retaining the final selected session remains unchanged; None/whole session is still explicit.

Targeted boundary/TPO tests and full isolated production build are recorded in local logs and release receipt. No owner browser, accounts, orders, live gateway or subscription restart.
