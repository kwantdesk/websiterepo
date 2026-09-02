# 2026-09-02 — 02 — Globex volume profile looks wrong

## Prompt (verbatim)

> the fucvk is this globex volume profile whats going on with them mate market is about to open??

(Sent with a screenshot: the profile histogram sitting far below its own
VAH 29485.0 / POC 29301.0 / VAL 29289.0 labels.)

## Answer

**Not diagnosed.** While measuring it I found the gateway itself was failing —
`/health` timing out at 30s and a single profile request taking 58.7s — which
became the outage in [03](2026-09-02-03-options-page-not-working.md) and took
priority.

The profile is now served from the live in-memory ring again, because the tape
read I had put behind it is what was overloading the gateway.

What the screenshot shows is still unexplained and still open. The histogram
sits at roughly 29100 while the profile's own POC label reads 29301, so either
the levels and the summary are computed over different windows, or the
histogram is being drawn from a window that includes the crash while the labels
come from another. **This is the next thing to look at**, outside market hours.

Related and known: a profile whose window the archive cannot cover now reports
`complete: false` rather than presenting a partial value area as whole
(`e8ad2192`), and the prior-session profile is knowingly wrong again after the
revert — the in-memory ring cannot reach back, so a prior day returns almost
nothing.
