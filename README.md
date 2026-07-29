# Kwant Desk website

The private first-release Kwant Desk workspace. It is styled as a sibling to
Kwantify while keeping its own name, content, and identity.

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

## Required Vercel environment variables

Set these for Production, Preview, and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or rename the provided variable to
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` if that is the key your Supabase project uses)
- `ALLOWED_EMAILS` — comma-separated Google accounts permitted to enter
- `DATABENTO_API_KEY` — server-only key for CME futures and options market data
- `ANTHROPIC_API_KEY` — server-only key for intelligent KwantBot and ZYON replies
- `ANTHROPIC_MODEL=claude-sonnet-4-6` — optional KwantBot-side-panel override; ZYON has an in-app model selector
- `NEXT_PUBLIC_SITE_URL=https://www.kwantdesk.com`

## Supabase Google login checklist

1. In Supabase **Authentication → Providers**, enable Google and add the Google
   OAuth client ID and secret.
2. In Google Cloud, add the Supabase callback URL supplied by the Google
   provider screen as an authorized redirect URI.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to
   `https://www.kwantdesk.com` and add:
   - `https://www.kwantdesk.com/auth/callback`
   - `https://kwantdesk.com/auth/callback`
   - `http://localhost:3000/auth/callback`
   - the Vercel preview URL pattern recommended by Supabase, if previews will
     use Google sign-in.

The same Gmail used for Kwantify can sign in here. Supabase will create a new,
separate account in this project; it is allowed only when its address is listed
in `ALLOWED_EMAILS`.
