export const ANTHROPIC_VERSION = "2023-06-01";

export function getClaudeApiKey() {
  return process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY_STRATEGY_BUILDER ?? "";
}

export function extractClaudeText(data: { content?: Array<{ type?: string; text?: string }> }) {
  if (!Array.isArray(data.content)) return "";
  return data.content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

export function toClaudeMessages(messages: Array<{ role?: string; content?: string }>) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: typeof message.content === "string" ? message.content : "",
  }));
}

export async function runClaudeMessage(options: {
  apiKey: string;
  model: string;
  system: string;
  maxTokens: number;
  messages: Array<{ role?: string; content?: string }>;
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: options.model,
      system: options.system,
      max_tokens: options.maxTokens,
      messages: toClaudeMessages(options.messages),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || `Anthropic request failed with status ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return extractClaudeText(await response.json());
}
