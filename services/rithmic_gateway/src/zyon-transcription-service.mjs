const ROUTE = "/v1/zyon/transcriptions";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const MAX_WAVE_BYTES = 3_840_044;
const MIN_PCM_BYTES = 8_000;
const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;
const MAX_TRANSCRIPT_CHARACTERS = 6_000;
const DEFAULT_MODEL = "gpt-4o-mini-transcribe-2025-12-15";
const ALLOWED_MODELS = new Set([
  DEFAULT_MODEL,
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-transcribe",
  "whisper-1",
]);

/**
 * VPS-local ZYON speech-to-text boundary. The desktop supplies only bounded
 * PCM audio through its verified ticket. The provider key never leaves this
 * process and the recording is neither logged nor written to disk.
 */
export class ZyonTranscriptionService {
  constructor({ apiKey = "", model = DEFAULT_MODEL, timeoutMs = 45_000, fetchImpl = fetch } = {}) {
    this.apiKey = String(apiKey || "").trim();
    this.model = String(model || DEFAULT_MODEL).trim();
    this.timeoutMs = Math.max(10_000, Math.min(60_000, Number(timeoutMs) || 45_000));
    this.fetch = fetchImpl;
    if (this.apiKey && (this.apiKey.length < 20 || this.apiKey.length > 4_096)) {
      throw new Error("The ZYON transcription API key must contain 20 to 4096 characters.");
    }
    if (!ALLOWED_MODELS.has(this.model)) {
      throw new Error("The ZYON transcription model is not allow-listed.");
    }
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  health() {
    return Object.freeze({ configured: this.configured, model: this.model });
  }

  canHandle(method, pathname) {
    return String(method || "").toUpperCase() === "POST" && pathname === ROUTE;
  }

  async handle(request, response, principal) {
    const subject = String(principal?.subject || "").trim();
    if (!UUID.test(subject)) {
      throw problem(401, "zyon_transcription_identity_required", "A verified desktop identity is required for dictation.");
    }
    if (!this.configured) {
      throw problem(503, "zyon_transcription_unconfigured", "ZYON speech recognition is not configured on this VPS.");
    }
    const input = await readBoundedWave(request);
    try {
      const receipt = await this.#transcribe(input);
      writeJson(response, 200, receipt);
    } finally {
      input.wave.fill(0);
    }
  }

  async #transcribe(input) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(input.wave)], { type: "audio/wav" }), "dictation.wav");
    form.append("model", this.model);
    form.append("language", input.language.slice(0, 2).toLowerCase());
    form.append("response_format", "json");
    form.append(
      "prompt",
      "KwantDesk trading dictation. Expected terms include NQ, MNQ, ES, MES, VWAP, GEX, gamma, delta, stop loss, take profit, long, and short.",
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let upstream;
    try {
      upstream = await this.fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      throw problem(
        error?.name === "AbortError" ? 504 : 502,
        error?.name === "AbortError" ? "zyon_transcription_timeout" : "zyon_transcription_unavailable",
        error?.name === "AbortError"
          ? "ZYON speech recognition timed out."
          : "ZYON speech recognition is unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = await readBoundedProviderResponse(upstream);
    if (!upstream.ok) {
      throw problem(
        upstream.status === 429 ? 429 : [401, 403].includes(upstream.status) ? 503 : 502,
        upstream.status === 429 ? "zyon_transcription_rate_limited" : "zyon_transcription_unavailable",
        upstream.status === 429
          ? "ZYON speech recognition is busy. Try again shortly."
          : "ZYON speech recognition is unavailable.",
      );
    }
    const contentType = String(upstream.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      throw problem(502, "zyon_transcription_malformed", "ZYON speech recognition returned an unsupported receipt.");
    }
    let parsed;
    try { parsed = JSON.parse(payload.toString("utf8")); }
    catch {
      throw problem(502, "zyon_transcription_malformed", "ZYON speech recognition returned a malformed receipt.");
    }
    const transcript = typeof parsed?.text === "string"
      ? cleanText(parsed.text, MAX_TRANSCRIPT_CHARACTERS).trim()
      : "";
    if (!transcript) {
      throw problem(422, "zyon_transcription_no_speech", "No speech was detected in the recording.");
    }
    return Object.freeze({
      transcript,
      model: this.model,
      durationSeconds: Math.round(input.durationSeconds * 1_000) / 1_000,
    });
  }
}

async function readBoundedWave(request) {
  const contentType = String(request?.headers?.["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "audio/wav") {
    throw problem(415, "zyon_transcription_content_type", "ZYON dictation requires an audio/wav request.");
  }
  const language = String(request?.headers?.["x-kwantdesk-speech-language"] || "").trim();
  if (!LANGUAGE.test(language)) {
    throw problem(400, "zyon_transcription_invalid_language", "The ZYON dictation language is invalid.");
  }
  const declared = Number(request?.headers?.["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_WAVE_BYTES) {
    throw problem(413, "zyon_transcription_too_large", "The ZYON dictation recording exceeded its bounded payload contract.");
  }
  const chunks = [];
  let total = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += chunk.length;
    if (total > MAX_WAVE_BYTES) {
      for (const retained of chunks) retained.fill(0);
      chunk.fill(0);
      throw problem(413, "zyon_transcription_too_large", "The ZYON dictation recording exceeded its bounded payload contract.");
    }
    chunks.push(chunk);
  }
  if (!total) throw problem(400, "zyon_transcription_invalid_audio", "A dictation recording is required.");
  const wave = Buffer.concat(chunks, total);
  for (const chunk of chunks) chunk.fill(0);
  if (!validWave(wave)) {
    wave.fill(0);
    throw problem(
      400,
      "zyon_transcription_invalid_audio",
      "The ZYON dictation recording must be bounded 16 kHz mono PCM16 WAV audio.",
    );
  }
  return {
    language,
    wave,
    durationSeconds: (wave.length - 44) / 32_000,
  };
}

function validWave(wave) {
  if (!Buffer.isBuffer(wave) || wave.length < 44 + MIN_PCM_BYTES || wave.length > MAX_WAVE_BYTES) return false;
  return wave.subarray(0, 4).toString("ascii") === "RIFF" &&
    wave.readUInt32LE(4) === wave.length - 8 &&
    wave.subarray(8, 12).toString("ascii") === "WAVE" &&
    wave.subarray(12, 16).toString("ascii") === "fmt " &&
    wave.readUInt32LE(16) === 16 && wave.readUInt16LE(20) === 1 &&
    wave.readUInt16LE(22) === 1 && wave.readUInt32LE(24) === 16_000 &&
    wave.readUInt32LE(28) === 32_000 && wave.readUInt16LE(32) === 2 &&
    wave.readUInt16LE(34) === 16 && wave.subarray(36, 40).toString("ascii") === "data" &&
    wave.readUInt32LE(40) === wave.length - 44;
}

async function readBoundedProviderResponse(response) {
  const declared = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PROVIDER_RESPONSE_BYTES) {
    throw problem(502, "zyon_transcription_malformed", "ZYON speech recognition exceeded its bounded receipt contract.");
  }
  const chunks = [];
  let total = 0;
  if (response?.body) {
    for await (const value of response.body) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      total += chunk.length;
      if (total > MAX_PROVIDER_RESPONSE_BYTES) {
        throw problem(502, "zyon_transcription_malformed", "ZYON speech recognition exceeded its bounded receipt contract.");
      }
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks, total);
}

function cleanText(value, maximum) {
  return Array.from(String(value || "")).filter((character) => character !== "\0").slice(0, maximum).join("");
}

function writeJson(response, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-KwantDesk-Data-Edge": "ZYON-VPS",
  });
  response.end(body);
}

function problem(status, code, message) {
  return Object.assign(new Error(message), { zyonTranscriptionProblem: true, status, code });
}

export function zyonTranscriptionProblem(error) {
  return error?.zyonTranscriptionProblem === true
    ? error
    : problem(502, "zyon_transcription_unavailable", "ZYON speech recognition is unavailable.");
}

export const zyonTranscriptionContract = Object.freeze({
  route: ROUTE,
  maximumWaveBytes: MAX_WAVE_BYTES,
  minimumPcmBytes: MIN_PCM_BYTES,
  maximumProviderResponseBytes: MAX_PROVIDER_RESPONSE_BYTES,
  maximumTranscriptCharacters: MAX_TRANSCRIPT_CHARACTERS,
  defaultModel: DEFAULT_MODEL,
});
