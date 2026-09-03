# 2026-09-03 — 05 — Volume Profile left-dock handoff

## Prompt (verbatim)

> the volume profile that sticks to the left of the screen should change when you move forwards and a new volume profile goes behinid, right now its bugged and sticking to a random one and not changing

## Answer

The left dock did not have one deterministic owner. Daily and weekly profiles
were selected in separate groups but painted at the same two left-edge pixels,
then a special collision rule hid one daily profile. Within each group the
winner was chosen by `endMs`, which can grow with live coverage or be inflated
in an older cached profile. The visible result could therefore remain an older
profile and depend on model order instead of handing forward as the chart moved.

The left edge now has one owner per instrument. Among profiles whose session
anchor has crossed behind the left viewport edge, the profile with the newest
stable session start owns the dock. As the next profile crosses, ownership
changes immediately and the old owner leaves. Daily, weekly and split-session
profiles cannot overlap as competing owners at the same dock.

`endMs` is retained only as a deterministic tie-breaker, followed by stable id,
so live coverage cannot make an old profile sticky and model iteration order
cannot change the result.

### Verified

- Left-dock ownership and handoff: 10/10 checks.
- Explicit regression for an older profile with an inflated end time passes in
  both model orders.
- Cross-period daily/weekly handoff is covered.
- Volume Profile level occlusion, chain fallback and split sessions pass.
- Scoped ESLint and `tsc --noEmit` pass.
- Full production build passes.

### Deployment

Committed and pushed to `main`; Vercel production deployment to the active
`websiterepo-yfmi` project was verified from the exact commit status.

### Unfinished

None for this prompt.
