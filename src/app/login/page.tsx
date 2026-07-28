import GoogleLoginButton from "@/components/GoogleLoginButton";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const messages: Record<string, string> = {
  restricted: "This Google account is not approved for Kwant Desk.",
  configuration: "The private workspace is waiting for its Supabase settings.",
  auth: "Sign-in could not be completed. Please try again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="login-page">
      <div className="login-orb login-orb-left" />
      <div className="login-orb login-orb-right" />
      <section className="login-card">
        <div className="brand-row">
          <div className="brand-mark">K</div>
          <span>KWANT DESK</span>
        </div>
        <p className="eyebrow">PRIVATE RESEARCH WORKSPACE</p>
        <h1>Decisions, quantified.</h1>
        <p className="login-copy">
          Options flow, research, and portfolio intelligence for approved members only.
        </p>
        {error ? <p className="login-error">{messages[error] ?? messages.auth}</p> : null}
        <GoogleLoginButton />
        <p className="login-note">Access is limited to authorised Google accounts.</p>
      </section>
    </main>
  );
}
