# Prompt

When you use a tool on the left on the chart, any chart. So for example, I come over the left and I use an extended line, boom, click it, boom. Now the tool that shows up first on the thing should be an extended line. And then I can just click it quickly to make an extended line. Right now, you can click it quickly, but it's not adjusting to what your most recent one was, which is annoying. It should.

# Answer

Replaced the live left toolbar's fixed first-tool fallback with a validated, persistent last-used tool for every drawing group. Selecting Extended Line from the Lines flyout now immediately makes Extended Line the visible one-click Lines action. The choice synchronizes across every mounted chart, survives reloads, and keeps each other group's own recent tool independently.

# Outcome

The live toolbar now shows and one-click reuses the most recently selected tool in every group across every chart. The new recent-tool contract passed 5/5; the single-toolbar audit passed 9/9; drawing anchoring passed 7/7; grab handles passed 10/10; position-tool behavior, scoped ESLint, TypeScript and the complete 80-page production build passed. The unrelated legacy `test:drawing-selection` source-shape assertion was confirmed already stale against the unchanged committed `ChartDrawLayer.tsx`; this task does not conceal or alter that separate issue. Production commit and deployment are recorded below after the active `websiterepo-yfmi` deployment completes.
