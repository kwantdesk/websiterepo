import { safeAuthReturn } from "@/lib/authRedirect";

export default function GoogleLoginButton({ returnTo = "/" }: { returnTo?: string }) {
  const search = new URLSearchParams({ returnTo: safeAuthReturn(returnTo) });

  return (
    <div className="login-action">
      <a className="google-button" href={`/auth/signin?${search}`}>
        <span className="google-g" aria-hidden="true">G</span>
        Continue with Google
      </a>
    </div>
  );
}
