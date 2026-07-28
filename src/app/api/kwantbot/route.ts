import { NextResponse, type NextRequest } from "next/server";
import {
  ANTHROPIC_VERSION,
  extractClaudeText,
  getClaudeApiKey,
} from "@/lib/claude.server";
import { getRouteActor } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MESSAGES = 24;
const MAX_TEXT_LENGTH = 4_000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_ATTACHMENT_LENGTH = 120_000;

type IncomingAttachment = {
  name?: unknown;
  type?: unknown;
  size?: unknown;
  dataUrl?: unknown;
};

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
  attachments?: unknown;
};

type ClaudeTextBlock = {
  type: "text";
  text: string;
};

type ClaudeImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    data: string;
  };
};

type ClaudeDocumentBlock = {
  type: "document";
  source: {
    type: "base64";
    media_type: "application/pdf";
    data: string;
  };
  title?: string;
};

type ClaudeBlock = ClaudeTextBlock | ClaudeImageBlock | ClaudeDocumentBlock;
type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ClaudeBlock[];
};

const SUPPORTED_IMAGE_TYPES = new Set<ClaudeImageBlock["source"]["media_type"]>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function cleanFileName(value: unknown) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180)
    : "attachment";
}

function parseDataUrl(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_ATTACHMENT_BYTES * 1.45) {
    return null;
  }
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value);
  if (!match) return null;
  const mediaType = (match[1] || "application/octet-stream").toLowerCase();
  try {
    const buffer = match[2]
      ? Buffer.from(match[3], "base64")
      : Buffer.from(decodeURIComponent(match[3]), "utf8");
    if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) return null;
    return { mediaType, buffer, base64: buffer.toString("base64") };
  } catch {
    return null;
  }
}

function isTextAttachment(mediaType: string, name: string) {
  return mediaType.startsWith("text/")
    || mediaType === "application/json"
    || /\.(?:txt|md|csv|json|log)$/i.test(name);
}

function makeUserContent(
  text: string,
  attachments: IncomingAttachment[],
  attachmentBudget: { used: number },
): ClaudeBlock[] {
  const blocks: ClaudeBlock[] = [];
  if (text) blocks.push({ type: "text", text });

  for (const attachment of attachments.slice(0, 4)) {
    const name = cleanFileName(attachment.name);
    const parsed = parseDataUrl(attachment.dataUrl);
    if (!parsed) {
      blocks.push({ type: "text", text: `[${name} could not be read.]` });
      continue;
    }
    attachmentBudget.used += parsed.buffer.length;
    if (attachmentBudget.used > MAX_TOTAL_ATTACHMENT_BYTES) {
      blocks.push({ type: "text", text: `[${name} was omitted because the attachment limit was reached.]` });
      continue;
    }

    if (SUPPORTED_IMAGE_TYPES.has(parsed.mediaType as ClaudeImageBlock["source"]["media_type"])) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: parsed.mediaType as ClaudeImageBlock["source"]["media_type"],
          data: parsed.base64,
        },
      });
      blocks.push({ type: "text", text: `Image filename: ${name}` });
      continue;
    }

    if (parsed.mediaType === "application/pdf" || /\.pdf$/i.test(name)) {
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: parsed.base64,
        },
        title: name,
      });
      continue;
    }

    if (isTextAttachment(parsed.mediaType, name)) {
      blocks.push({
        type: "text",
        text: `Contents of ${name}:\n\n${parsed.buffer.toString("utf8").slice(0, MAX_TEXT_ATTACHMENT_LENGTH)}`,
      });
      continue;
    }

    blocks.push({
      type: "text",
      text: `[Attached file: ${name}. This file type cannot be inspected directly, so do not claim to have read its contents.]`,
    });
  }

  if (!blocks.length) {
    blocks.push({ type: "text", text: "Please analyse the attached material." });
  }
  return blocks;
}

function normalizeMessages(value: unknown): ClaudeMessage[] {
  if (!Array.isArray(value)) return [];
  const attachmentBudget = { used: 0 };
  const normalized = value.slice(-MAX_MESSAGES).flatMap((entry): ClaudeMessage[] => {
    if (!entry || typeof entry !== "object") return [];
    const message = entry as IncomingMessage;
    const role = message.role === "assistant" ? "assistant" : "user";
    const content = typeof message.content === "string"
      ? message.content.trim().slice(0, MAX_TEXT_LENGTH)
      : "";
    const attachments = Array.isArray(message.attachments)
      ? message.attachments.filter(
          (attachment): attachment is IncomingAttachment =>
            Boolean(attachment && typeof attachment === "object"),
        )
      : [];
    if (!content && !attachments.length) return [];
    if (role === "assistant") return [{ role, content }];
    return [{ role, content: makeUserContent(content, attachments, attachmentBudget) }];
  });

  const merged: ClaudeMessage[] = [];
  for (const message of normalized) {
    const previous = merged.at(-1);
    if (previous?.role === message.role) {
      const previousText = typeof previous.content === "string"
        ? [{ type: "text" as const, text: previous.content }]
        : previous.content;
      const nextText = typeof message.content === "string"
        ? [{ type: "text" as const, text: message.content }]
        : message.content;
      previous.content = [...previousText, ...nextText];
    } else {
      merged.push(message);
    }
  }
  return merged;
}

export async function POST(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Sign in to message Kwant Bot." }, { status: 401 });
  }

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Kwant Bot intelligence is not configured yet." },
      { status: 503 },
    );
  }

  let payload: { messages?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "That message could not be read." }, { status: 400 });
  }

  const messages = normalizeMessages(payload.messages);
  if (!messages.length || messages.at(-1)?.role !== "user") {
    return NextResponse.json({ error: "Write a message for Kwant Bot." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6",
        max_tokens: 1_500,
        system: [
          "You are Kwant Bot, the private research assistant inside Kwant Desk.",
          "Be concise, direct, calm, and useful to a professional futures and options trader.",
          "You can inspect supplied chart screenshots, images, PDFs, and text research.",
          "Never invent prices, positions, news, order flow, live market data, or facts that were not supplied.",
          "If current market data is required but absent, say exactly what data is missing.",
          "Separate observation from inference and flag uncertainty clearly.",
          "Do not claim to place trades. Treat trading discussion as research and decision support, not personal financial advice.",
        ].join(" "),
        metadata: { user_id: actor.userId },
        messages,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.error("Kwant Bot provider error", response.status, errorPayload.slice(0, 800));
      return NextResponse.json(
        { error: response.status === 429 ? "Kwant Bot is busy. Try again in a moment." : "Kwant Bot could not reply." },
        { status: response.status === 429 ? 429 : 502 },
      );
    }

    const text = extractClaudeText(await response.json());
    if (!text) {
      return NextResponse.json({ error: "Kwant Bot returned an empty reply." }, { status: 502 });
    }
    return NextResponse.json(
      { text: text.slice(0, 8_000) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Kwant Bot request failed", error);
    return NextResponse.json({ error: "Kwant Bot could not reply." }, { status: 502 });
  }
}
