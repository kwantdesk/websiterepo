# OAuth return loop

Owner reports Supabase ERR_TOO_MANY_REDIRECTS after earlier login changes.
The automatic /login redirect added in9a23389a was unsafe: any OAuth round trip
that returned without an established website session immediately started again.
It is removed. Normal and error login pages now stop and wait for an explicit
Google sign-in action.

Production request records show repeated /auth/signin303 -> apex /308 -> www
/307 -> /login307 cycles, with no /auth/callback request in the inspected window.
This supports a provider Site URL fallback/return-routing fault rather than a
dead initial button. Request logs omit query strings, so they do not prove the
exact provider redirect allowlist configuration. No auth codes/tokens logged.

Changes:
- Google initiation uses a fixed /auth/callback URI with no changing query.
  Safe intended workspace destination is retained in a ten-minute HttpOnly,
  Secure-on-HTTPS, SameSite=Lax host cookie, then cleared at callback completion.
- If Supabase returns a one-time code to / or /login, middleware forwards it to
  /auth/callback before homepage/session/site-gate routing discards it. It still
  requires the original PKCE verifier and server code exchange; no access grant
  or session authentication is bypassed. Oversized codes fail to the error UI.
- Callback session/cleanup cookies are attached explicitly to its final redirect
  response. Errors/exceptions return to a stable retry screen. Server warnings
  carry only stage/error code/status, never credentials, auth codes or emails.
- Initial server navigation and existing site-access/account checks retained.

19 auth/cookie/middleware tests pass, including real SSR PKCE generation,
stable callback URI, fallback code preservation, explicit final session cookies,
pending destination restoration and non-looping failures. Production build,
scoped lint and whitespace checks pass. One scoped main-only release; no data
feed changes or provider/security setting changes.

Acceptance limitation: Google chooser was reached in an actual browser during
earlier tests, but that was not end-to-end sign-in. Owner's other laptop/session
is not controlled here. Verify public redirect/recovery/no-loop behaviour after
release; owner must complete their own Google account sign-in. Do not claim the
provider allowlist was directly inspected or a full real login was completed.
