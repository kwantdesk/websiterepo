# Sitewide slider shells — 2026-11-02

Request: settings sliders should show only their theme-coloured track and handle, without the surrounding grey rectangle/background/border.

## Cause and change

The cockpit's general input treatment applied a recessed background, 1px border and inset shadow to range inputs too. Embedded Kwanty and GEX Data also have general input rules using important backgrounds/borders. A shared `public/range-input.css` now clears only the range input shell (border/background colour/shadow and enclosing focus outline). It uses sufficient specificity for the embedded general-input rules. Keyboard focus stays on the thumb; existing thumb/track rendering, hue gradient background images and custom chart navigator geometry remain owned by their existing styles.

The main globals stylesheet imports the shared CSS into its build; GEX Data, Liquidity Map and Kwanty each link it in their document head. The selector also covers dynamically created sliders and the ranges in the 20 React component files found by the literal range-input inventory, including the reusable numeric indicator control. No value/range/step/event/provider/archive/account/layout change.

## Validation

- Eight isolated headless Chrome checks, using the actual numeric slider component and compiled globals: reproduced the old grey box, checked mono/light, dark and purple shells; verified keyboard and mouse values, disabled controls, retained text-field styling and hue gradients. Screenshot review passed for all three themes.
- The actual three embedded documents/stylesheets were loaded locally with app/network scripts disabled. All static range inputs plus representative dynamically generated settings, tool-control and navigator ranges checked in each of the same three themes. Explicit theme variables catch the important embedded background/border cascade rather than accepting invalid unset variables. Zero browser exceptions or external requests.
- Existing numeric slider checks: 9/9 pass with the repository alias loader.
- Final production build and exact live commit verification recorded after completion below. No standalone giant-component lint necessary for a CSS/HTML-only change.

Evidence: tmp/range-shell-browser.cjs, tmp/range-shell-browser.log, tmp/range-shell-{before,mono,dark,purple}.png, tmp/range-shell-numeric-tests.log, tmp/range-shell-build.log. Temporary evidence is local, not included in the release.

Release limited to the shared stylesheet, one globals import, three HTML stylesheet links and this task's own notes. Preserve all unrelated dirty work and ALGO/.
