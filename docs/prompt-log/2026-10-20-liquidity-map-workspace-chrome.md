# LIQ MAP visual consistency with GEX DATA and KWANTY — 2026-10-20

## Request

Match LIQ MAP's top menu, buttons, format, settings and other page chrome to the
existing GEX DATA and KWANTY visual style.

## Implemented

- Used those pages' actual control contract: 38px toolbar rows, 28px outlined
  controls, Aleph 10px/600/.075em, 3px corners, 14px/1.5-stroke line icons.
- Replaced the old gradient toolbar and grouped pill presentation with flat
  website-background bars and separate buttons, muted defaults and themed active,
  hover and keyboard focus states. Ticker tabs and add/fullscreen actions match.
- Settings retains the centred dialog/visible chart. Match heading, labels, inputs,
  dropdown triggers and 16px popup/12px option corners to the options workspaces.
  Corrected checkbox alignment to sit beside its label rather than opposite it.
- Styled Depth/Signals cards, CVD controls, instrument picker, chart tooltips and
  the React-injected Trade button consistently. Data palettes and heat gradients
  remain unchanged; no renderer, feed, account or indicator calculation modified.
- Header shortcuts use accessible line icons and preserve labels on narrow panes.
  Existing horizontal rail scrolling remains available for small workspace panels.
- Added `site.css` as the final layer and included it in the existing asset
  readiness/retry system and parent's stylesheet check; versioned iframe and CSS.

## Verification

- 70 focused map/paper tests pass, including six new chrome contract tests that
  check the GEX DATA/KWANTY reference styles and startup readiness.
- TypeScript `--noEmit`, scoped ESLint and diff whitespace checks pass.
- Isolated browser fixture uses actual map HTML/CSS, custom-select builder and
  theme mapper. Synthetic canvas only; no provider/API/account or storage writes.
- Measured header shortcuts, chart buttons, settings icon and ticker tab: all
  height 28px, font 10px/600, corners 3px and letter spacing .75px.
- Light-theme settings had white panel, dark text, 3px/32px triggers, 16px popup,
  36px options at 12px font, with no trigger background image. Dark theme verified
  too. At 360px the accessible shortcut icons fit and centred settings stays in
  its pane with independently scrolling content.
- Local reproduction: `node scripts/serve-liquidity-chrome-fixture.cjs`,
  `http://127.0.0.1:4923/` and `/narrow`. Theme buttons affect memory only.

## Release

Pending scoped main push and production verification. No new market stream,
polling, API, provider session or paid service. Final receipt will remain local
to avoid a documentation-only redeployment.
