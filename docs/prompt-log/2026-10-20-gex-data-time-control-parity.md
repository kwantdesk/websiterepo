# GEX DATA / GEX VUE time control parity — 2026-10-20

Owner wants the time adjustment button and dropdown to match GEX VUE.

Live computed-style baseline: GEX VUE 164px width, 28px height, Aleph,
10px font, 600 weight, .75px spacing; GEX DATA 172px width, 28px height,
13px font, 500 weight, .156px spacing. Generic button CSS overrode compact
utilities outside the command deck; GEX DATA also forced a wider wrapper.

Shared sizing constant and compact style contract fix that drift. Same component,
same menu label and searchable dropdown. Internal menu scrolling no longer fires
the captured viewport-close handler. Genuine viewport changes still dismiss it.

Saved timezone/account state, live formatting, request cadence and theme tokens
unchanged. No extra data requests. All 11 parity, timezone formatting/persistence
and toolbar tests passed. Scoped ESLint passed on both edited small components;
production build/typecheck passed with all 84 pages. Release receipt pending.
