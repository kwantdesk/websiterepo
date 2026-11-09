# Emoji rotation and resizing

Selected chart emojis now use their corner grab handle for a polar transform: orbit around the unchanged time/price anchor to turn through any angle; move radially to resize. Rotation is clockwise and saved in Drawing.style.emojiRotation, defaulting to zero for legacy drawings. The handle rotates with the glyph and preserves the initial finger/pointer offset, so grabbing it does not snap the emoji. Existing 16–160px sizing limits remain. The Style tab also exposes a functioning angle slider. Native-colour and tinted emoji rendering use the same rotation.

The existing inverse viewport scale continues to protect glyph size during native pan/zoom. Rotation is inside that correction, so anisotropic zoom does not distort its saved angle. The SVG's interactive drawing targets suppress native touch scrolling; pointer-events:none still lets blank chart space reach the underlying chart. This prevented Chrome from cancelling a finger rotation after its first movement.

Validation:

- 19 focused unit/regression tests passed: every quadrant, complete revolution, relative off-center grab, size limits, anchor geometry, save/normalize, fixed emoji pixel size, clipboard and locks.
- Real ChartDrawLayer and ChartDrawSettings in isolated headless Chrome: a complete mouse revolution, combined 90-degree rotation/resize, reload persistence, pre-settle anisotropic native zoom, real CDP touch gesture through 90 degrees, drawing lock, and settings angle control all passed with no page errors.
- Earlier native viewport stability browser regression rerun separately.
- Scoped ESLint and full isolated production build checked before release. Exact public deployment verification is recorded locally after the Git deployment completes.

No active owner tabs, live trades, provider subscriptions or gateway processes were changed or restarted.
