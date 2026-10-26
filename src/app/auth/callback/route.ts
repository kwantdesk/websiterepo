import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { safeAuthReturn } from "@/lib/authRedirect";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const returnTo = safeAuthReturn(requestUrl.searchParams.get("returnTo"));

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(`${origin}/login?error=auth`);

  const { data } = await supabase.auth.getUser();

  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=restricted`);
  }

  return NextResponse.redirect(new URL(returnTo, origin));
}
