import { redirect } from "next/navigation";
import DesktopAuthorizeConsent from "./DesktopAuthorizeConsent";
import {
  DesktopAuthorizationRequestError,
  parseDesktopAuthorizationRequest,
} from "@/lib/desktopAuthProtocol.server.ts";
import { getRouteActor } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DesktopAuthorizePage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const currentPath = `/desktop/authorize?${new URLSearchParams(singleValues(raw)).toString()}`;
  const actor = await getRouteActor();
  if (!actor || actor.mode !== "supabase") {
    redirect(`/login?returnTo=${encodeURIComponent(currentPath)}`);
  }

  let authorizationRequest;
  try {
    authorizationRequest = parseDesktopAuthorizationRequest(singleValues(raw));
  } catch (error) {
    if (!(error instanceof DesktopAuthorizationRequestError)) throw error;
  }

  if (!authorizationRequest) {
    return (
      <main className="login-page">
        <section className="login-card text-center">
          <div className="brand-row"><div className="brand-mark">⌁</div><span>Kwant Desk</span></div>
          <div className="login-heading">
            <h1>Authorization request rejected</h1>
            <p>The workstation callback, security challenge or requested access was invalid. Return to the app and start again.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-orb login-orb-left" />
      <div className="login-orb login-orb-right" />
      <DesktopAuthorizeConsent request={authorizationRequest} accountLabel={actor.label} />
    </main>
  );
}

function singleValues(values: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(values).flatMap(([key, value]) =>
    typeof value === "string" ? [[key, value]] : []));
}
