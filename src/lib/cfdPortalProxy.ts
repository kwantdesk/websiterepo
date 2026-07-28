import type { NextRequest } from "next/server";

import { CFD_DEFAULT_PORTAL_BASE_URL } from "@/lib/connectors";

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export function shouldProxyCfdPortalRequest(requestOrigin: string | null | undefined) {
  if (!requestOrigin) return false;
  return normalizeUrl(requestOrigin) !== normalizeUrl(CFD_DEFAULT_PORTAL_BASE_URL);
}

export async function forwardCfdPortalRequest(req: NextRequest, path: string) {
  const targetUrl = `${normalizeUrl(CFD_DEFAULT_PORTAL_BASE_URL)}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers();
  const authorization = req.headers.get("authorization");
  const contentType = req.headers.get("content-type");

  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const response = await fetch(targetUrl, init);
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
