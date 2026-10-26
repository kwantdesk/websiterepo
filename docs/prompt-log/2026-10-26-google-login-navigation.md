# Google login navigation

Owner reports Continue with Google does nothing on another laptop. Existing
login rendered a client-only button with no href/form fallback; it awaited
browser Supabase initialization and had no navigation until that completed.
The other laptop's browser/console has not been inspected, so a specific browser
error or failed hydration is not claimed as reproduced.

Replaced it with a server-rendered, styled ordinary anchor to /auth/signin.
That route starts Google OAuth through the server Supabase client, saves the
PKCE verifier via response cookies, then redirects the same tab to the provider.
No popup or browser auth-client initialization is required to begin navigation.
Failures redirect to the existing visible retry screen. Return destinations
share internal-path validation across link/initiation/callback; backslash and
control-character variants cannot become external redirects. Site-access gate,
Google authentication and email/session validation remain enforced.

8 auth/navigation/cookie regression tests pass, including real Supabase SSR PKCE
URL generation and cookie persistence adapter, server-rendered anchor markup,
error responses and return-path cases. Production build/scoped lint pass.
No provider settings, credentials, account permissions, live feeds or data jobs
changed. Release through the single main-only production Git integration. Owner
must complete account selection/sign-in on their laptop; no account action was
performed on their behalf. Public redirect/cookie verification follows release.

Follow-up: owner still reports a spinner on their other laptop. Live fresh
requests consistently return303 to Supabase in459–671ms; Supabase returns302
to accounts.google.com, with a PKCE verifier cookie on the initial response.
Apex correctly redirects308 to www. This does not reproduce the owner's hang.
Asked which hostname remains in their address bar; answer pending.

Removed another startup dependency: new OAuth initiation now uses freshOAuth
cookie reads, so an existing expired account session cannot cause Supabase
initialization to wait for token recovery before issuing the Google redirect.
Normal server clients/callback still read and validate existing cookies; verifier
writes remain enabled.9 auth/navigation/cookie tests, build and scoped lint pass.
Treat this as a verified isolation improvement, not proof the other laptop's
remaining issue has been reproduced or resolved.
