import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getClaudeApiKey } from "@/lib/claude.server";
import { NextRequest, NextResponse } from "next/server";
function settings() { const token = process.env.KWANTDESK_MARKET_DATA_GATEWAY_TOKEN || process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "", url = process.env.KWANTDESK_MARKET_DATA_GATEWAY_URL || process.env.KWANTIFY_MARKET_DATA_GATEWAY_URL || ""; if (!token || !url)
    throw Error("Support not configured"); return { origin: new URL(url).origin, secret: createHmac("sha256", token).update("kwantdesk-support-service-v1").digest("hex") }; }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
async function body(request: NextRequest) { if (!request.body)
    return {}; const reader = request.body.getReader(), parts: Uint8Array[] = []; let size = 0; while (true) {
    const { done, value } = await reader.read();
    if (done)
        break;
    size += value.byteLength;
    if (size > 1550000) {
        await reader.cancel();
        throw Error("REQUEST_TOO_LARGE");
    }
    parts.push(value);
} try {
    return JSON.parse(Buffer.concat(parts).toString()) as Record<string, unknown>;
}
catch {
    throw Error("INVALID_JSON");
} }
export async function supportProxy(request: NextRequest, path: string[]) {
    try {
        const { origin, secret } = settings();
        if (request.method !== "GET") {
            const source = request.headers.get("origin");
            if (!source || new URL(source).host !== request.headers.get("host"))
                return json({ error: "Open support from this website and try again." }, 403);
        }
        const diagnostic = path.length === 1 && path[0] === "_diagnostics";
        let actor: {
            id: string;
            email: string;
            label: string;
            verified: boolean;
        };
        if (diagnostic) {
            const received = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
            if (!/^[a-f0-9]{64}$/.test(received) || !timingSafeEqual(Buffer.from(received), Buffer.from(secret)))
                return json({ error: "Authentication required." }, 401);
            actor = { id: "00000000-0000-4000-8000-000000000001", email: "", label: "Support health check", verified: false };
        }
        else {
            const supabase = await createClient(), { data: { user } } = await supabase.auth.getUser();
            if (!user)
                return json({ error: "Sign in to use support.", code: "SIGN_IN_REQUIRED" }, 401);
            actor = { id: user.id, email: user.email || "", label: String(user.user_metadata?.display_name || user.user_metadata?.full_name || "Customer").slice(0, 80), verified: Boolean(user.email_confirmed_at) };
        }
        if (!diagnostic && !/^(session|claim|staff|ai|tickets|tickets\/[a-f0-9-]{36}(\/(messages|status|read|attachment))?)$/.test(path.join("/")))
            return json({ error: "Support action not found." }, 404);
        const input = request.method === "GET" ? null : await body(request);
        if (request.method !== "GET" && (!input || typeof input !== "object" || Array.isArray(input)))
            return json({ error: "Invalid request." }, 400);
        const apiKey = getClaudeApiKey();
        if (input) {
            delete input.providerKey;
            if (path[0] === "ai" || diagnostic)
                input.providerKey = apiKey;
            if (diagnostic)
                input.messages = [{ role: "user", content: "Reply only: KwantDesk support is ready." }];
        }
        const query = new URLSearchParams();
        for (const key of ["staff", "status", "search", "before"]) {
            const value = request.nextUrl.searchParams.get(key);
            if (value)
                query.set(key, value.slice(0, 200));
        }
        const target = `/support/v1/${diagnostic ? (request.method === "GET" ? "health" : "ai") : path.map(encodeURIComponent).join("/")}${query.size ? "?" + query : ""}`, bytes = input ? JSON.stringify(input) : "", encoded = Buffer.from(JSON.stringify(actor)).toString("base64url"), expires = String(Date.now() + 45000);
        const signature = createHmac("sha256", secret).update(JSON.stringify([request.method, target, encoded, expires, createHash("sha256").update(bytes).digest("hex")])).digest("hex");
        const response = await fetch(origin + target, { method: request.method, body: input ? bytes : undefined, cache: "no-store", signal: AbortSignal.timeout(26000), redirect: "error", headers: { "content-type": "application/json", "x-support-actor": encoded, "x-support-expires": expires, "x-support-signature": signature } });
        if (diagnostic) {
            const data = await response.json();
            return json({ ...data, aiConfigured: Boolean(apiKey) }, response.status);
        }
        if (path[0] === "session" && response.ok)
            return json({ ...await response.json(), aiAvailable: Boolean(apiKey) });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("application/json") && !/^image\/(png|jpeg|webp)/.test(contentType))
            return json({ error: "Support is temporarily unavailable." }, 502);
        return new NextResponse(await response.arrayBuffer(), { status: response.status, headers: { "Content-Type": contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "";
        return json({ error: message === "REQUEST_TOO_LARGE" ? "The report is too large. Use a screenshot under 1 MB." : message === "INVALID_JSON" ? "Invalid support request." : "Support is temporarily unavailable. Your existing reports are preserved." }, message === "REQUEST_TOO_LARGE" ? 413 : message === "INVALID_JSON" ? 400 : 503);
    }
}
