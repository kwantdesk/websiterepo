# Order prices on the price scale — 9 November 2026

The shared Chart renderer now highlights every open entry, working limit/stop order, stop loss and take profit on the right-hand price scale. Armed-order and new-protection previews receive the same highlight. The handle text keeps quantity, order type/status and P&L; its duplicate numeric price is removed.

Price tags use the same priceToCoordinate transform and active-drag price as the actual line, and are registered in the existing imperative viewport repositioner. Both position and text update during a drag without waiting for a React commit. Pan/zoom repaint the tags with their lines. Instrument precision is retained and readableTextOn supplies legible axis text on light/dark themes. Tags are pointer-transparent so price-axis interactions remain available.

Controls, text, padding, close buttons and hit targets scale together by 1.1 (height18 to19.8px; font9 to9.9px). The minimum handle width is reduced now that it no longer needs the numeric price, with natural text measurement and narrow-pane clamping retained. Existing P&L calculation, protective execution, order placement/repricing/cancellation and gesture cleanup remain unchanged.

Validation:
-35 focused tests passed: actual imperative positioning callback, pan/hide, whole/fractional precision, drag release/cancellation/interaction restoration and exact paper protective fills.
-Full isolated Next.js webpack production build passed, including TypeScript and route generation.
-Isolated headless Chrome with the real Chart and paper ledger verified entry/SL/TP tags, SL drag27999.00 to27999.50 with immediate coordinate/text/P&L changes, working limit order plus its protections (six tags), and armed placement preview (seventh tag). No browser errors. Both monochrome light and dark renderings checked; screenshots/observations attached. Control height measured19.796875px due browser subpixel rounding, font9.9px; typical handle widths136-138px.

Scope: the shared Chart component. The standalone liquidity-map iframe's separate trading overlay and closed-fill arrows are not changed by this scoped release. No owner browser interaction, gateway/terminal/subscription restart, real account/order/workspace mutation or provider requests were performed. Release status is verified separately against production's commit SHA.
