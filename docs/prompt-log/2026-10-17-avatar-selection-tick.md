# Avatar selection tick clipping

Owner screenshot showed the selected avatar's check badge cut off at its circular
edge. The avatar button clipped all descendants with overflow-hidden. The shared
Settings/Socials picker now clips only the image using rounded-full; the button
allows overflow and the 20px tick badge has an explicit z-10 layer and panel ring.
No avatar artwork, dimensions, selection or save logic changes.

Regression checks inspect the actual picker JSX for the unclipped button,
independent round image and foreground badge. Existing avatar/settings/profile
tests, scoped lint and production build are the release checks. Authenticated
browser pixel verification remains unperformed. Standing history/VPS/live-load
items remain open in IMPORTANT-NOTES.md.
