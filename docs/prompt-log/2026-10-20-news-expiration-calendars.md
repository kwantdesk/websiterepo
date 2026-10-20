# News expiration calendars — 2026-10-20

Move options calendar out of KWANTY into News after Live Macro, followed by a
new futures calendar. Keep quiet entry and site-themed controls.

Options retains the same component logic, preferences and Cboe source checks.
News receives real account identity in both full page and chart-grid mounts.
Legacy KWANTY calendar URLs redirect; no duplicate KWANTY calendar navigation.
Existing saved options-flow calendar chart panels still render the moved module.

Futures scope: CME's published equity-index roll/expiration table, 2026–2028,
U.S. E-mini/micro index families plus Nikkei/TOPIX. Exact dates, no generic
holiday math; year/month/agenda, event/product filters, selected-day details,
today marker and past dimming. Roll is not a mandatory expiration deadline.

Sources checked 2026-10-20:
https://www.cmegroup.com/trading/equity-index/rolldates.html
https://www.cmegroup.com/tools-information/calendars/expiration-calendar.html

CME rejects automated page fetching from this machine, explicitly prohibiting
scraping. Do not bypass that. Ship a clearly dated reference snapshot and link
the official broader calendar; do NOT claim full energy/metals/rates/notice
coverage or automatic source updates. No additional Vercel API usage.

Validation: all 34 focused tests passed, including SSR-rendered date semantics,
official Cboe parsing/refresh/auth, News ordering and scoped legacy redirect.
ESLint passed on six edited/new components and model files (excluding the
large shared shell). Full production build/typecheck passed, 84 pages.
Release receipt pending.
