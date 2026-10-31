# GEX Map history follows the website timezone

Owner requests history time alignment with the top-right website timezone. Previously the standalone map replay clock and first-frame coverage message were hard-coded to New York, its date subtitle used the computer's timezone, its window tooltips said ET, and node snapshot hover text showed raw UTC ISO.

Both real Workspace hosts (standalone GEX Map and Charts/GEX Vue grid pane) now pass the active `chartSettings.timezone` to the map. A memoized display formatter uses that zone for the replay clock, actual local date, coverage time, node snapshot date/time and session-window tooltip bounds. Offsets are calculated for the historical timestamp, including DST. Changing zone updates presentation without reloading the map, changing the selected frame, columns, playback state or provider requests.

Session identities remain US trading dates. The custom date picker's hover description identifies the New York session; the adjacent local date can correctly be the following day in Brisbane/Auckland. NY OPEN/POWER/PRE remain the same actual exchange windows and FULL remains all actual recorded frames. Neither the provider query's sessionDate nor the frame timestamps/filtering are converted or fabricated. The underlying source and recording system are unchanged.

Verification:

- Six formatter tests pass: Brisbane midnight, UTC/New York views of the same instant, historical DST, converted RTH/POWER bounds, unchanged RTH filtering and safe fallback display.
- Eleven isolated real-component Chrome scenarios pass with zero page errors. Seven retain four custom columns/settings through replay/date/host/live transitions. Four change the host timezone while replay is displayed, verify Brisbane clock and window bounds, Auckland's following local date with the same US session picker, unchanged selected frame/settings, and zero added data requests. Real component and controls are bundled; authentication/preferences/market data are local controlled fixtures, not an assertion of observing the owner's live tab.
- Existing seven replay-settings, eight replay-window, node-detail and Bounce mirror regressions pass. Scoped Map/helper/test lint and final production build pass. Never standalone lint the huge KwantifyWorkspace component; build checks its types.

Release via one scoped main push to existing `websiterepo-yfmi`; verify exact production SHA. No VPS restart, stream/provider/subscription/account/settings reset or deployment outside the existing main Git integration.
