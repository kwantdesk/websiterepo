# Remove dashed Bounce Levels projections

Owner rejects the coloured dashed horizontal lines shown after the exposure ribbons. Remove the primitive's entire right-edge projection path and its `extendRight` input; remove Chart's forced mirror-mode extension flag. Historical/observed exposure ribbons, signed colours, latest weak-node falloff, labels, mapping and snapshot data are unchanged. Saved legacy extendRight values cannot re-enable the removed renderer path. Ordinary chart price/crosshair lines and optional roll annotations are not part of this projection change.

Verification: actual primitive before/after in isolated Chrome for mirrored/legacy modes and DPR1/2. The strong projection exists before and has zero pixel alpha afterward; weak/faded continuations also have zero alpha. Five measured observed-body regions (strong/weak/negative weak/past strong/faded) are exactly identical before/after. Snapshot data is unchanged; zero page errors. Controlled screenshot: `tmp/bounce-no-projections.png`. Bounce core tests and primitive lint pass. Full production build is a release gate; never standalone lint the large Chart file.

No provider/request/polling change, gateway restart, settings/account/trade/recording reset or unrelated changes. One scoped main-only release via existing `websiterepo-yfmi` and exact live SHA verification.
