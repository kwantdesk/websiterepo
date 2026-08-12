"use client";

function activeSupabaseCookieBase(supabaseUrl: string) {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0]?.trim();
    return projectRef ? `sb-${projectRef}-auth-token` : "";
  } catch {
    return "";
  }
}

function expireCookie(name: string, domain?: string) {
  const encodedName = encodeURIComponent(name);
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${encodedName}=; Path=/; Max-Age=0; SameSite=Lax${domainPart}`;
}

export function clearObsoleteSupabaseCookies(supabaseUrl: string) {
  if (typeof document === "undefined") return;
  const activeBase = activeSupabaseCookieBase(supabaseUrl);
  if (!activeBase) return;
  const names = document.cookie
    .split(";")
    .map((part) => decodeURIComponent(part.split("=", 1)[0]?.trim() ?? ""))
    .filter(Boolean);
  const parentDomain = location.hostname.endsWith(".kwantdesk.com")
    ? ".kwantdesk.com"
    : undefined;

  for (const name of names) {
    if (!name.startsWith("sb-") || name === activeBase || name.startsWith(`${activeBase}.`)) continue;
    expireCookie(name);
    if (parentDomain) expireCookie(name, parentDomain);
  }
}
