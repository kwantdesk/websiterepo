"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleLoginButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start Google sign-in.");
      setLoading(false);
    }
  }

  return (
    <div className="login-action">
      <button className="google-button" type="button" onClick={signIn} disabled={loading}>
        <span className="google-g">G</span>
        {loading ? "Opening Google…" : "Continue with Google"}
      </button>
      {message ? <p className="login-error">{message}</p> : null}
    </div>
  );
}
