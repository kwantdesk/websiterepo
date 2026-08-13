# KwantDesk Midnight Cockpit

The authenticated KwantDesk product uses the **Midnight Cockpit** design
system. The public landing page is deliberately excluded.

## Visual contract

- Matte-black continuous workspace with hairline panel seams.
- Rajdhani for interface labels and JetBrains Mono for market values.
- Near-square controls and rack-aligned panels; no floating SaaS cards.
- Magenta (`#FF1F78`) represents sell-side state, urgency and active focus.
- Cyan (`#16C7CE`) represents buy-side state, analysis and connectivity.
- Green is reserved for profit, live health and successful outcomes.
- Compact 40 px product command rail and 72 px chart command deck.
- Existing product structure, tools and workflows remain intact.

## Classic UI rollback checkpoint

The exact production state immediately before this redesign is preserved at:

- Branch: `checkpoint/kwantdesk-classic-before-cockpit-redesign`
- Tag: `kwantdesk-classic-ui-2026-08-13`
- Commit: `0fcea3e2`

Use the tag for an immutable reference and the branch when a deployable classic
UI branch is required.

## Scope switch

`AppSidebar` adds `kwant-cockpit-ui` to the document body while an authenticated
workspace is mounted. All global cockpit rules are scoped below that class in
`src/app/globals.css`, which prevents the landing experience from inheriting the
product skin.
