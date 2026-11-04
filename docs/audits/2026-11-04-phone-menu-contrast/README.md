# Phone workspace menu contrast

## Cause

The cockpit's desktop dialog selector (body.kwant-cockpit-ui [role="dialog"], [aria-modal="true"]) forced the phone menu portal to #060708. Its specificity beat the phone drawer's theme background. Inverted Mono supplied #080808 text; measured text/background contrast was 1.0066:1 and navigation disappeared.

## Repair

A phone-only selector overrides that desktop dialog background with the menu's active panel colour. Launcher, close button, heading, routes, icons, actions and section caption now share locally derived menu colour tokens. Text and accents are checked against the actual theme panel (4.5:1 minimum), and borders against 3:1. Selected routes/actions use solid accent fills with their own contrasting ink. Icons/labels inherit that selected ink. Custom mismatched foreground/accent values cannot hide the controls. Tokens are recalculated before paint and on theme changes; stored theme preferences are unchanged. Desktop layout and chart behaviour are unchanged.

## Validation

Isolated Chrome, 390px touch viewport, actual component and compiled application CSS: all 43 shipped presets plus custom black-on-black and white-on-white cases passed. Lowest measured text/icon contrast 4.573:1 across 20 checked elements per theme. Switching themes with the drawer open, closing, reopening, activating Workspace, Escape and hiding the launcher at desktop width passed. Both mono screenshots were visually inspected.

Existing full phone-workspace browser regression passed: controls, Watchlist, drawing tools, 320/430/740/768/1440 widths, landscape, multi-pane selection and byte-identical desktop layout restoration, News/Journal/Backtesting navigation. No page errors. 18 navigation/auth/chart-disposal tests passed. Component ESLint passed. Full production build passed (compile, TypeScript and page generation). No owner browser refresh or data-gateway restart.
