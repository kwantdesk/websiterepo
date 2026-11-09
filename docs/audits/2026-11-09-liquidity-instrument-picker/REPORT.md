# Liquidity Map instrument picker

Owner requested normal site styling, no white search focus box, and no movement while typing. The modal previously sized to its filtered results and vertically recentered. A generic embedded input focus-visible rule also overrode its outline reset.

Scoped #instrumentPicker rules now use the shared 16px dialog/8px control radii, normal themed type, compact instrument rows and undecorated plus actions. The dialog has a viewport-bounded fixed height and independently scrolling results. Search height, padding, border and outline stay constant on focus. Empty and populated results occupy the same explicit grid cell, preventing implicit columns from relocating the search field. No global dropdown, data or selection handlers were changed; unrelated main.js edits are preserved.

Actual-document headless Chrome uses the current original render/open methods extracted from main.js with local catalogue metadata; no market engine or data calls. Six checks across dark/light themes and 580x900, 390x680, 900x340 viewports verify five search/filter states, empty results, clearing, unchanged modal/search bounds, absent focus outline/shadow, internal list scrolling and selecting ES. Baseline HEAD reproduces movement and solid focus outline in all six cases; repaired version passes all. No page errors. Full isolated production build passed. Final CSS changes were checked again in the browser. Screenshots and machine-readable measurements are attached.

Existing main-only Git integration deploys the scoped change; exact live SHA and public stylesheet verification are recorded separately after deployment. No feed restart, owner-tab refresh, account/order/workspace modification or infrastructure spending change.
