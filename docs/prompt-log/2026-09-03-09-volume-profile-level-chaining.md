# Prompt

value are levels are still bugged as fuck look ath this some cut off, some dont stretch out, some blow past...... like whats this, its meant to start at the volume profile, the recent one is meant to end at the right of the screen then prvious ones finish flush with the profile in front????

# Answer

Re-engineered VAH, POC and VAL extension geometry around one deterministic rule: every level starts at its own profile; a historical profile stops flush against the nearest newer profile; and the newest profile reaches the chart's right edge.

Removed candle-interaction shortening and its misleading setting, prevented older or same-session profiles from clipping newer lines, and retained off-price-screen profile boundaries so panning cannot make lines overshoot through another session. Removed the now-unused full candle mapping from the chart render path.

Added regression coverage for newest-profile extension, nearest-newer-profile chaining, same-session isolation, older docked profiles, vertically hidden boundaries and removal of interaction truncation. Verified the related profile setting, session, split, count, developing-value-area and label suites, TypeScript and the production build before deployment.
