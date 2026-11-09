# Centered Liquidity Map settings

Centered both settings entry points: the compact controls surface opened by the Charts pane's top gear, and the native detailed settings inspector. Width limited to680px with16px viewport margins, auto height capped to available viewport, internal scrolling, sticky header, rounded theme-matched border and a translucent backdrop. Underlying chart/engine stays mounted. Compact popup now identifies itself as Liquidity Map settings with dialog semantics. No provider, recording, execution or chart-geometry changes.

Five actual-app headless Chrome cases pass: standalone1200×820, embedded1200×820,600×600,390×820 and600×300. Both horizontal/vertical popup centers within1px of the map viewport center, every edge at least15px inside the viewport, and close buttons work; zero browser errors. Screenshots include deterministic offline market frames, not production trading data. JS syntax/diff checks pass. This centers inside the liquidity-map viewport, including a docked panel; it does not expand or relocate a docked iframe across sibling charts.

Versioned helper and panel stylesheet URLs updated. Release through existing main Git integration; no live service restart or owner-tab refresh.
