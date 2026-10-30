# Consistent economic-calendar impact toggles

Owner request: High, Medium and Low should share the same visual selection behavior: lit when selected and dim when unselected.

Replaced severity-dependent filter classes with one static, theme-aware selected style (`primary` text/dot, tinted background and border) and one dim unselected style. Identical sizing/borders prevent movement between states. Added `aria-pressed`; filtering handlers and event severity badges remain intact. Static classes also avoid relying on interpolated Tailwind classes for High/Medium.

Verification: executed the actual JSX map callback for all eight selection combinations (24 buttons), confirming identical selected/dim styles, pressed state and unchanged toggle targets. Eleven existing News/navigation regressions and scoped lint pass. Verify full production build and main-only deployment before reporting live. No API, feed or recorder changes.
