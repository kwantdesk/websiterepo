# LIQ MAP brief motion stalls — 2026-10-20

## Request and diagnosis

Owner reports brief hangs/lag during movement. Source confirms the camera's
190ms easing advanced only when renderRequested was set by an incoming book or
input event, despite having a cameraInMotion flag. It therefore paused between
packets. Full heat-raster rebuilds also repeated identical row geometry per pixel.

## Changes

- Continue camera presentation on animation frames until settled. Existing exact
  target and manual pan behaviour retained. Idle no longer paints when settled;
  inactive embedded map retains its 50ms budget.
- Heat raster computes interpolation geometry once per row; weakly cached packed
  RGBA colours use one write per pixel. Byte view creates host-endian palette,
  preserving exact RGBA output rather than relying on little-endian literals.
- Main/renderer/new helper versioned through the static module entry chain.
- No gateway change/restart, feed smoothing, discarded executions, synthetic
  history, added polling, provider session or Vercel runtime endpoint.

## Verification

- Pixel oracle compares actual existing interpolateHeatIntensity output with
  optimized output over full frames, single columns and strips; includes
  1800×1080, up/downsampling and edge rows. Source intensities unchanged.
- Actual camera method test verifies monotonic settling on the real target,
  animation termination and immediate manual pan without another packet.
- 73 focused map/paper tests; scoped ESLint.
- Controlled CPU benchmark: 10 warmups, 60 alternating baseline/new samples,
  1800×112 input to 1800×1080 RGBA. Baseline median10.18/p9512.35/max13.56ms;
  optimized median5.42/p956.93/max7.13ms. Raster stage only, not total browser FPS.
- REA runtime inspection was considered and its runtime/recovery instructions
  read; running Chrome exposed no remote-debugging endpoint. No REA Evidence
  collected and no browser timing claim made. Do not launch or reconfigure the
  owner's browser to bypass this limitation.

## Release

Pending scoped main deployment verification. Owner-perceived live smoothness
remains a follow-up check; this does not claim every possible feed stall fixed.
