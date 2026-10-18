# Financial Info connection and operating boundary

News now includes Financial Info, a theme-aware chronological headline wire.
It consumes the specified `akash9078/financialjuice-scraper` Actor's already
completed datasets. It does not impersonate FinancialJuice's premium service.

## Before enabling

1. Create an Apify account. Confirm the Actor's current actual checkout pricing,
   source update delay and intended redistribution rights. Its store headline
   advertises a different pricing basis from its README; neither is a verified
   recurring bill. No paid run or subscription was created during development.
2. Set an account spending limit and agree the collection interval/item count.
   At one run/minute there are 43,200 runs in a 30-day month; duplicates returned
   by each RSS scrape may still be billable. This integration makes no cost
   promise based on deduplication in our UI. Apify storage/API/platform charges
   and Vercel authenticated snapshot requests may also apply.
3. Configure the specified Actor's scheduled runs on Apify using `maxItems`
   bounded to the agreed count (no more than 500). Start with a single manual
   test AFTER cost approval. Validate real output against the documented schema.
   Do not replace the actor's source with an arbitrary URL or bypass a login.
4. Install `APIFY_API_TOKEN` privately on the gateway/VPS only, with read access
   to the Actor's runs/datasets. Set `FINANCIAL_INFO_ENABLED=1` only when ready.
   Do not put secrets in browser settings, NEXT_PUBLIC variables, Git or chat.
5. Deploy the service module and server wiring to the single gateway, following
   the planned-restart/one-Rithmic-owner procedure. Current laptop collector was
   intentionally NOT restarted just to enable an unconfigured news connector.
6. Verify authenticated `/v1/financial-info`, a real successful run, correct
   publication timestamps, safe original links, increasing collection time,
   scheduled unattended updates, stale signalling and the signed-in News tab.
   Laptop uptime is temporary; permanent 24/7 operation needs the VPS restored.

## Shared, bounded collection

- One gateway loop reads the fixed Actor's latest successful run every minute,
  independent of browser tabs. It only issues GETs; visiting/refreshing the site
  cannot start, restart, schedule or purchase a scraper run. Source scheduling
  continues in Apify; this code does NOT create a schedule automatically.
- Validates a bounded dataset (500 rows / 1MB), source URLs and original story
  dates. The scraper's extraction `timestamp` is not publication time.
- Deduplicates source GUIDs, retains at most 500 headlines, persists an atomic
  last-good snapshot and backs off failures to ten minutes. Provider errors do
  not expose credentials or destroy already verified headlines.
- A successful run older than five minutes is marked stale, even after a fresh
  API read. Collection recency is not a guarantee of fresh headlines, accuracy,
  complete market coverage or premium-speed delivery. RSS publication delay,
  scrape scheduling, gateway polling and browser polling all add latency.
- Next exposes an authenticated, fixed snapshot read with 60-second process
  coalescing/cache and private browser caching. Visible unpaused tabs refresh
  every minute; hidden/unmounted tabs stop polling; unconfigured tabs back off
  to fifteen minutes. No streaming, Actor execution or vendor keys on Vercel.
- UI pause freezes the display, not the shared collection. When scrolled into
  older stories updates wait behind a return-to-newest button to avoid jumping.
- Existing calendar/macro/developments sections are unchanged. Source categories
  are preserved; importance, sentiment, audio and premium tags are not invented.

## Evidence and unresolved items

- Actor docs: https://apify.com/akash9078/financialjuice-scraper
- API docs: https://docs.apify.com/api/v2/actor-runs-get and
  https://docs.apify.com/api/v2/dataset-items-get
- REA `ev_77c039fa7cd9cc92500c62078d6170b554461c5360b95adbf1a7dbec0ec92f1a`
  opened the public FinancialJuice home page and waited two seconds. It observed
  a Cloudflare blocked page, NOT the news UI. No bypass was attempted; no claim
  of exact FinancialJuice layout parity or paid stream inspection is made.
- Owner confirmed no Apify account exists yet. Credentials, approved recurring
  spend/schedule, source usage rights and true live end-to-end collection remain
  OPEN. Local fixtures are explicitly synthetic, never production news.

## Verification

- 420 gateway tests and five web contract tests passed; scoped ESLint passed.
- Root TypeScript and the normal optimized Turbopack production build passed
  (84 static pages), including the new authenticated financial-info route.
- REA local synthetic UI capture `ev_f8566347235894e7aa497e4370b0ff886cfc91211190e63ccc982efbf2c9b579`
  rendered the actual component at1440x900 without page errors. Search scenario
  `ev_27a70c4215cc2aa6308952cd80d84dbcca553ff937abdb77a6a39bc9a2e0a7dd`
  filtered to the equities fixture. Details/pause scenario
  `ev_7eff96f3aaefba47aa15b0d253bc7c9714f379ef40f3f62fb1ee79c841403231`
  verified the selected original link and Paused/Resume state with no page errors.
- Optional `next build --webpack` compiled but its stricter generated route-export
  checker rejected an existing unrelated `buildTpoLevelsPayload` export. No TPO
  calculations or exports were changed. Its generated checkers were archived
  outside the repo before checking the normal production Turbopack build.
