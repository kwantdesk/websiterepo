# Social profile avatars and 500px cropping

Owner requested thirty selectable original profile avatars plus custom image
upload/cropping at 500x500 with an accurate circular preview. Owner rejected
human portraits and clarified simple PlayStation/console-style avatars, not
real humans. Do not use the abandoned portrait batches.

Owner explicitly approved the robot/fox/ghost samples and requested all thirty.
Completed thirty original built-in image_gen icons/mascots, saved as optimized
500x500 WebP assets under public/images/avatars/console-v1. Full set is 310,558
bytes. Reviewed every avatar together in its circular presentation; no real
people or discarded portraits are included. Exact prompts/source/output receipt:
docs/avatar-art/console-avatars-prompts.json. Visual review sheet:
docs/avatar-art/console-avatars-review.webp. Source preparation/review script:
scripts/prepare-social-avatar-assets.mjs.

SocialsWorkspace: preset picker with existing explicit Save Profile
publish flow, upload, 500px square output, square crop area with circular mask
and separate circular preview, drag/zoom/reset/keyboard repositioning. Pure crop
math extracted to avatarCrop.ts. Source MIME/12MiB/40-megapixel guards, bounded
350KB WebP encode, stale decode/encode guards and object URL cleanup. Focus stays
inside the crop dialog and returns to its opener. Existing profile HTTPS/data
URL contracts remain unchanged; presets use self-hosted static assets under the
existing middleware-excluded images path, avoiding thirty auth/API calls. Plain
img delivery avoids per-view image generation/optimization. UserAvatar resets
its image node on URL change so an old failed photo cannot hide a new selection.

Eight focused regressions pass: crop geometry, extreme portrait/landscape drag
bounds, exact 500px canvas drawing, real handler staging, invalid/oversize uploads,
out-of-order decode/cancelled encode recovery, all thirty unique 500px WebP files,
size bounds and profile normalization/display/friends-path compatibility. Scoped
lint has zero errors and two existing unrelated img warnings. Isolated production
build passes. Authenticated browser crop/save and cross-device roundtrip remain
unverified; do not claim those were interactively tested. Production deployment
must be checked Ready and public runtime SHA matched after the scoped main push.

Existing missing-history/provider/indicator soak and multi-user launch checks
remain open; this avatar task does not repair those platform dependencies.
