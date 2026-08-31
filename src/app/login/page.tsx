import GoogleLoginButton from "@/components/GoogleLoginButton";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
};

const messages: Record<string, string> = {
  restricted: "This Google account could not be authenticated.",
  configuration: "The private workspace is waiting for its Supabase settings.",
  auth: "Sign-in could not be completed. Please try again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, returnTo } = await searchParams;
  const safeReturnTo = safeRelativeReturn(returnTo);

  return (
    <main className="login-page">
      <div className="login-orb login-orb-left" />
      <div className="login-orb login-orb-right" />
      <section className="login-card">
        <div className="brand-row">
          <div className="brand-mark">⌁</div>
          <span>Kwant Desk</span>
        </div>
        <div className="login-heading">
          <h1>Welcome back</h1>
          <p>Access your private quantitative research workspace.</p>
        </div>
        {error ? <p className="login-error">{messages[error] ?? messages.auth}</p> : null}
        <GoogleLoginButton returnTo={safeReturnTo} />
        <p className="login-note">Continue with any Google account.</p>
      </section>
    </main>
  );
}

function safeRelativeReturn(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.length > 2_000) return "/";
  return value;
}
