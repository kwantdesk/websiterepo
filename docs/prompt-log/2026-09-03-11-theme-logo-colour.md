# Prompt

Okay, we've got our QuantDesk logo, right? And that's on all themes. We've got it in the top left. We've got it on charts and stuff. We've got it almost on every chart, right? But right now it's gray. What I want to happen is, for say, for example, we've got a green and orange theme. Well then if the background's green, then that should be orange. If it's a black and pink theme and the background's black, well that should be the pink of the theme. This should be the contrasting color of the theme with one of the colors that's in the theme, like the bright version, like the bright one. And that should go for the QuantDesk logo on all the charts and the QuantDesk logo in the top left corner.

# Answer

Replaced the washed-out logo rule, which mixed 76% neutral foreground into 24% primary colour, with one measured brand-colour resolver shared by the entire live application.

On neutral black/white backgrounds the mark uses the theme's exact bright primary colour. On coloured backgrounds it selects the exact primary, accent or secondary colour furthest from the background hue while requiring at least 3:1 graphical contrast. This gives pink on a neutral black/pink theme, green on Chromey Mono, orange on Tangerine Terminal, and specifically orange—not green—on Forest Fire's green background. Danger/candle colours and a contrast-adjusted colour are last-resort fallbacks for unusually difficult or custom palettes.

The top-left application wordmark, every standard chart watermark, the Liquidity Map watermark and the large home-workspace wordmark now use this shared system. Shell and chart marks are measured separately against their real backgrounds. Both tokens are installed in the first-paint bootstrap and normal live theme application, so they do not flash grey or change only after hydration.

Verified brand-mark behaviour 9/9 across every current preset, brand geometry 4/4, theme suite 12/12, immediate theme switching 5/5, scoped ESLint, TypeScript and the complete 80-page production build. Production deployment details are recorded below after the push completes.

# Outcome

Shipped to `main` in commit `ae1a8c399f464f024b62035a888a34af5dd5f957`. The single active Vercel project, `websiterepo-yfmi`, completed production deployment `G9bxxX5z3a6jBzG2FgvYpszZSmqb` successfully at `https://websiterepo-yfmi-87kuc4yfj-kwant-desk.vercel.app`.
