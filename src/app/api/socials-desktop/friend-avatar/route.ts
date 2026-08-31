import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";

import { getSocialsRouteActor } from "@/lib/serverAuth";
import { createSocialsStorageClient } from "@/lib/socialsStorage.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAXIMUM_AVATAR_BYTES = 2 * 1024 * 1024;

/** Fixed account-profile image edge for native Friends. Arbitrary client URLs
 * are never accepted: the target UUID resolves to the existing community
 * profile row and all outbound hosts must resolve exclusively to public IPs. */
export async function GET(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.mode !== "desktop-gateway") {
    return NextResponse.json({ error: "The desktop avatar edge is gateway-only." }, { status: 403 });
  }
  const userId = request.nextUrl.searchParams.get("userId")?.trim().toLowerCase() ?? "";
  if (!UUID.test(userId) || [...request.nextUrl.searchParams.keys()].some((key) => key !== "userId")) {
    return NextResponse.json({ error: "Choose a valid Friends account." }, { status: 400 });
  }

  const supabase = await createSocialsStorageClient(actor);
  const { data, error } = await supabase
    .from("social_objects")
    .select("payload")
    .eq("user_id", userId)
    .eq("id", "profile")
    .eq("object_type", "profile")
    .eq("scope", "community")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "The Friends avatar could not be resolved." }, { status: 502 });
  const payload = data?.payload && typeof data.payload === "object"
    ? data.payload as Record<string, unknown>
    : {};
  const avatarUrl = typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim() : "";
  if (!avatarUrl) return NextResponse.json({ error: "That account has no avatar." }, { status: 404 });

  try {
    const image = DATA_IMAGE.test(avatarUrl)
      ? decodeDataImage(avatarUrl)
      : await fetchPublicImage(avatarUrl);
    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.bytes.length),
        "Cache-Control": "private, max-age=300, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "That account avatar is unavailable." }, { status: 422 });
  }
}

function decodeDataImage(value: string) {
  const prefix = DATA_IMAGE.exec(value);
  if (!prefix) throw new Error("invalid avatar");
  const bytes = Buffer.from(value.slice(prefix[0].length), "base64");
  if (!bytes.length || bytes.length > MAXIMUM_AVATAR_BYTES) throw new Error("avatar too large");
  return { bytes, contentType: `image/${prefix[1].toLowerCase().replace("jpg", "jpeg")}` };
}

async function fetchPublicImage(source: string) {
  let target = new URL(source);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    await assertPublicHttps(target);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(target, {
        redirect: "manual",
        headers: { Accept: "image/png,image/jpeg,image/webp,image/gif" },
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === 3) throw new Error("avatar redirect invalid");
        target = new URL(location, target);
        continue;
      }
      if (!response.ok || !response.body) throw new Error("avatar unavailable");
      const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
      if (!IMAGE_TYPES.has(contentType)) throw new Error("avatar type invalid");
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAXIMUM_AVATAR_BYTES) throw new Error("avatar too large");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        total += item.value.byteLength;
        if (total > MAXIMUM_AVATAR_BYTES) {
          await reader.cancel();
          throw new Error("avatar too large");
        }
        chunks.push(item.value);
      }
      const bytes = Buffer.allocUnsafe(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      if (!bytes.length) throw new Error("avatar empty");
      return { bytes, contentType };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("avatar redirect invalid");
}

async function assertPublicHttps(target: URL) {
  if (target.protocol !== "https:" || target.username || target.password
      || (target.port && target.port !== "443") || !target.hostname.includes(".")) {
    throw new Error("avatar host invalid");
  }
  const addresses = await lookup(target.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new Error("avatar host is not public");
  }
}

function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168))
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51) || (a === 203 && b === 0));
  }
  if (family !== 6) return false;
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isPublicAddress(normalized.slice(7));
  return normalized !== "::" && normalized !== "::1"
    && !normalized.startsWith("fc") && !normalized.startsWith("fd")
    && !/^fe[89ab]/.test(normalized) && !normalized.startsWith("ff")
    && !normalized.startsWith("2001:db8:");
}
