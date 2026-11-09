# Embedded liquidity-map single settings launcher

Hidden the duplicate generated Controls launcher only when workspacePane=1 (liquidity map embedded on Charts). Existing top gear button and its authenticated same-origin parent command still open the same controls drawer. Original controls, handlers, standalone phone launcher, and all market rendering stay intact. Versioned the iframe's phone-workspace helper reference.

Four actual app browser checks pass: embedded600px, embedded390px and embedded1200px have no visible Controls launcher and the existing settings command still opens usable controls, including Volume, then closes. Standalone390px retains its mobile launcher. No browser errors. JS syntax passes. Updated the older instrument-dropdown fixture to open the embedded drawer through its retained settings command rather than the removed launcher. Static assets only, no gateway/feed restart.
