# Help opening, report areas and contact permission — 2026-11-02

Owner asks for near-instant Help, every website area in Report a problem, receipt by support and both email/in-platform follow-up.

## Delivered

- The launcher imports the small panel eagerly; no click-time dynamic chunk/Opening support placeholder. No panel is mounted and no support/provider request is made while closed.
- Panel navigation, greeting and editable report draft render immediately while account identity is verified asynchronously. Sending remains disabled until authenticated. No cached identity or private reports are shown before validation; sign-out still gives the sign-in route. Drafts survive completion of that identity check.
- One areas.json catalog shared by frontend and VPS: 60 active main areas/sub-tabs, including Home, Charts, GEX Vue/Data/Map, Kwanty Classic/State/Order Flow, Options, Liquidity Map, Algo, News and all six News sections, Socials, Journal, accounts/settings, connectors/trade syncer and automation. Archived Zyon/Gameplan and legacy redirect-only page names are excluded. Current page and whitelisted sub-view choose the initial area; users can change it. All IDs are accepted and retained by the service.
- Optional email permission defaults OFF for each report. Customer sees their sign-in address when opting in. Server only uses the verified signed-in email, ignores supplied alternate addresses/dates and records its own timestamp. Additive SQLite migration leaves all existing reports in-app only. The customer can grant/withdraw permission later; changes are recorded in the thread. Failed UI changes roll back. Staff cannot opt customers in.
- Support staff retain private inbox, reports, screenshots and in-app replies. A consented report also offers Email customer, opening the operator's email application with the verified address and encoded reference/subject; header line breaks are stripped. No automatic email delivery, SMTP account or new mail subscription is configured or claimed.

## Validation and deployment

16 backend tests pass, including every catalog ID, opt-in/default/verification/forgery/idempotency, owner-only consent changes, continued in-app replies, restart-safe legacy migration and bounded opt-in changes without ever blocking withdrawal. Actual isolated launcher/panel + signed service Chrome checks cover a deliberately4s identity response: panel navigation appears in about53–64ms and a report draft is usable beforehand. All60 labels appear; opt-in/email link/withdrawal and human replies persist, mobile/light theme fit, sign-out privacy and zero idle provider requests pass. No production fixture tickets or customer emails are sent.

Scoped component/helper/proxy lint and final production build are required before the single scoped main release. Evidence: tmp/support-improvements-{core,browser,lint,build}.log; browser screenshots under tmp/support-improvements-*.png.

VPS: back up existing SQLite, preserve old runtime source, copy only isolated support runtime files/catalog/knowledge, verify SHA256 and restart only support. Schema migration and preserved record counts verified; market gateway start time unchanged. tmp/support-improvements-vps.json records checks. Existing customer records/accounts/market history are untouched.

## Remaining operator steps

Production owner setup was still pending. The private, expiring one-time activation remains outside source; a local owner-inbox-setup.html file gives the owner a button to open it while signed into the intended verified account, then claim the inbox. Do not guess a customer identity or create public/first-signup admin access. Once claimed, Support inbox receives every existing/new report and Team can invite verified staff. Automatic email alerts require a separately configured sending provider; current email action is manual.
