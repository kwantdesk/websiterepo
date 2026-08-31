import { NextResponse, type NextRequest } from "next/server";
import {
  DesktopAuthorizationRequestError,
  loadDesktopTicketSigningConfig,
} from "@/lib/desktopAuthProtocol.server.ts";
import { createDesktopAuthService, DesktopAuthServiceError } from "@/lib/desktopAuthService.server.ts";
import { createDesktopAuthStoreFromEnv, DesktopAuthStoreError } from "@/lib/desktopAuthStore.server.ts";

const MAXIMUM_AUTH_BODY_BYTES = 8 * 1024;

export function loadDesktopAuthService() {
  const store = createDesktopAuthStoreFromEnv();
  const signingConfig = loadDesktopTicketSigningConfig();
  if (!store || !signingConfig) return null;
  return createDesktopAuthService({ store, signingConfig });
}

export async function readDesktopAuthJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" || !request.body) {
    throw new DesktopAuthorizationRequestError("invalid_content_type");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let joined: Uint8Array | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAXIMUM_AUTH_BODY_BYTES) {
        value.fill(0);
        await reader.cancel();
        throw new DesktopAuthorizationRequestError("request_too_large");
      }
      chunks.push(value);
    }

    joined = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
      return parsed as Record<string, unknown>;
    } catch {
      throw new DesktopAuthorizationRequestError("invalid_json");
    }
  } finally {
    reader.releaseLock();
    joined?.fill(0);
    chunks.forEach((chunk) => chunk.fill(0));
  }
}

export function desktopAuthJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function desktopAuthError(error: unknown) {
  if (error instanceof DesktopAuthServiceError) {
    return desktopAuthJson({ error: error.code }, error.status);
  }
  if (error instanceof DesktopAuthorizationRequestError) {
    return desktopAuthJson({ error: "invalid_request" }, 400);
  }
  if (error instanceof DesktopAuthStoreError) {
    return desktopAuthJson({ error: "authentication_store_unavailable" }, 503);
  }
  return desktopAuthJson({ error: "authentication_service_unavailable" }, 503);
}

export function isSameOriginConsent(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === request.nextUrl.origin && (!fetchSite || fetchSite === "same-origin");
}

export function requiredStringField(body: Record<string, unknown>, name: string, maximumLength: number) {
  const value = body[name];
  if (typeof value !== "string" || !value || value.length > maximumLength || value !== value.trim()) {
    throw new DesktopAuthorizationRequestError(`invalid_${name}`);
  }
  return value;
}
