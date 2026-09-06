# Volume profile minimum width

Prompt: “1 width for all volume profiles is still too big, need another 4 x smaller than that to be 1.”

Fix: shared low-end pixel scaling after width-mode resolution and minimum-pixel
floors. Setting 1 renders at 25% of its former width; 2 at 50%, 3 at 75%,
4 and above unchanged. Zero remains hidden. Applies to the shared daily,
weekly, composite and swing volume-profile renderer, including independent
current/previous widths, and both draw-on volume-profile rendering paths.
Draw-on slider now allows 1 with single-unit steps. Level anchoring uses the
same final profile width. No volume/VA/POC math, data feeds or requests changed.

Verification:
- Fine-width regression tests: 3 passed (pixel scaling, defaults/zero, renderer wiring).
- Existing zoom/width-mode script: passed (10 checks).
- Fixed-range profile levels: passed.
- Back-overhang rendering script: passed with the repository alias hook.
- Edge-anchoring suite: 4 passed, 1 pre-existing stale source assertion failed:
  it expects `widthBasis: "chart"` in Chart.tsx, absent in HEAD before this change.
- ESLint on the new helper/test passed. Production build passed (TypeScript
  and all 80 static pages). Release through the single main-only Git integration.

Limit: no signed-in chart was available for visual verification. No claim of
on-screen validation. Existing regular/default width and zoom rules preserved.
