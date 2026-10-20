# GEX DATA connection-banner flash

Request: stop showing Connecting when opening GEX DATA.

Cause: static HTML rendered a legacy status strip before the awaited status
request and dock initialization. The dock later hid it, causing a visible flash.

Remove that markup and its obsolete DOM writers/refresh listeners. Preserve the
existing status request, session dates, connection checks, polling and genuine
per-tool errors. No gateway restart or new requests/services. Bump app/workspace
module URLs so the removed DOM hooks cannot be loaded from an older module.

Verification: 182 focused GEX DATA/reference, options-flow and live-theme tests
pass, including a startup regression checking successful and failed status
requests without any banner DOM. Both changed JavaScript modules pass syntax
checks. Production verification pending the existing main-only Git deployment.
