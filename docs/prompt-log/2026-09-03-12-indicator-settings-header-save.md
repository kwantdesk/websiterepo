# Prompt

example look where the same button is like thats broken, it needs to be in the top bar next to the x this should be where the heading of the indicator is, fix this up for all indicators please

# Answer

The misplaced Save/Cancel bar was not part of the indicator window. It was a sibling of the dialog inside the full-screen centring overlay, so the overlay's flex layout placed that bar beside the modal and over the chart.

Removed that floating footer and put the shared Save action into the indicator title bar immediately before the close button. The title bar also carries the saved/unsaved state, remains fixed while long settings pages scroll, and truncates long indicator names safely on narrow windows. This is the single dialog used by the full indicator catalogue, including Daily Volume Profile and Footprint, so the repair applies automatically to all current and future indicators. Closing or clicking away with unsaved changes retains the existing Save/Discard safety prompt; clicking Save establishes a clean baseline and keeps the settings window open.

Verified the universal Save/Discard regression 11/11, scoped ESLint, TypeScript and the complete 80-page production build.

# Outcome

Shipped to `main` in commit `054b6654`. The single active Vercel project, `websiterepo-yfmi`, completed production deployment `J8t7sypcNsg72WPCZnmvGjkR5p5K` successfully at `https://websiterepo-yfmi-4hzmobeks-kwant-desk.vercel.app`.
