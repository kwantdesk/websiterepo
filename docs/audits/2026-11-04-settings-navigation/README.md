# Settings navigation response

Owner reported five Settings presses without a screen change.

## Findings and repair

Settings was excluded from persistent workspace navigation. Pointer-down cleared chart chrome before the later click and could swallow that activation. An isolated old-path control remained on /charts after 10 seconds. Settings now commits the destination on primary mouse pointer-down, with keyboard activation and genuine touch clicks supported; scrolling the phone drawer does not navigate.

Native App Router pushState applies its canonical URL through React.startTransition (installed next/dist/client/components/app-router.js). The persistent host now listens for a local urgent navigation intent and selects its destination immediately, acknowledging the canonical pathname when it catches up. Back restores the location. Settings loads its own component without another trading-engine import or route/profile response gate. Direct /settings server authentication and API authentication are unchanged.

A queued native chart price-rail measurement could outlive chart disposal during navigation. It now checks that its local chart is still the current chart before accessing the native API.

## Evidence

Isolated Chrome test uses actual workspace/layout/Settings components, fixture authentication and market data, and blocked external networking. Canonical pathname delivery is deliberately delayed 2 seconds and a full Settings document response 4 seconds. Settings rendered in 580 ms with zero Settings document requests and zero page errors. Desktop click, Chart defaults tab, return to Charts, keyboard activation, browser Back and phone touch all passed. Screenshot and JSON evidence are adjacent. This is a controlled local measurement, not a production-network latency guarantee.

Focused navigation/auth/lifecycle tests: 18 passing. Scoped ESLint: zero errors, two existing image warnings. Full production build passed (compile, TypeScript, page generation). No gateway, provider, terminal, subscriptions, or owner browser sessions were restarted or refreshed.

Scope: Settings from persistent workspaces and urgent switching inside that host; standalone Home/Accounts retain their native route behavior. Unrelated pending GEX Data work was excluded.
